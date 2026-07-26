import { faker } from '@faker-js/faker/locale/pt_BR';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';

import { AuthService } from '../../../src/auth/auth.service';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: any;
  let sendMail: any;

  const mockUserId = faker.string.uuid();
  const mockEmail = faker.internet.email();
  const mockName = faker.person.fullName();
  const mockPassword = faker.internet.password({ length: 8 });
  const mockConfirmPassword = mockPassword;
  const mockToken = faker.string.alphanumeric(100);

  beforeEach(async () => {
    sendMail = jest.fn(() => Promise.resolve()) as any;
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    (bcrypt.hash as any).mockImplementation((value: any) =>
      Promise.resolve(`hashed:${value}`),
    );
    (bcrypt.compare as any).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue(mockToken) },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            passwordResetToken: {
              deleteMany: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    prisma = module.get(PrismaService);
  });

  it('Should be defined', () => {
    expect(service).toBeDefined();
  });

  it('TC0001 - Should configure SMTP auth when credentials are present', async () => {
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue(mockToken) },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    module.get<AuthService>(AuthService);

    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        auth: { user: 'user', pass: 'pass' },
      }),
    );

    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  describe('register', () => {
    it('TC0001 - Should return access_token and user on success', async () => {
      const mockUser = { id: mockUserId, email: mockEmail, name: mockName };

      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockResolvedValue(null);
      jest
        .spyOn((service as any).userRepository, 'create')
        .mockResolvedValue(mockUser);

      const result = await service.register(
        mockEmail,
        mockPassword,
        mockConfirmPassword,
        mockName,
      );

      expect(result.access_token).toBe(mockToken);
      expect(result.user.email).toBe(mockEmail);
    });

    it('TC0002 - Should throw when email already exists', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        name: mockName,
        password: 'hashed',
      };
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValueOnce(true);

      await expect(
        service.register(
          mockEmail,
          mockPassword,
          mockConfirmPassword,
          mockName,
        ),
      ).rejects.toThrow('Email already registered');
    });

    it('TC0003 - Should throw when password confirmation does not match', async () => {
      await expect(
        service.register(mockEmail, mockPassword, 'different', mockName),
      ).rejects.toThrow('Password and confirmPassword must match');
    });

    it('TC0004 - Should throw when email format is invalid', async () => {
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockResolvedValue(null);

      await expect(
        service.register('invalid-email', mockPassword, mockPassword, mockName),
      ).rejects.toThrow('Invalid email format');
    });

    it('TC0005 - Should throw service unavailable when schema is missing', async () => {
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockRejectedValue({ code: 'P2021' });

      await expect(
        service.register(mockEmail, mockPassword, mockPassword, mockName),
      ).rejects.toThrow(
        'Database schema not initialized. Please run migrations.',
      );
    });

    it('TC0006 - Should throw internal server error on unexpected register failure', async () => {
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockRejectedValue(new Error('boom'));

      await expect(
        service.register(mockEmail, mockPassword, mockPassword, mockName),
      ).rejects.toThrow('Registration failed');
    });
  });

  describe('login', () => {
    it('TC0001 - Should return access_token and user on valid credentials', async () => {
      const hashed = await bcrypt.hash(mockPassword, 10);
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        name: mockName,
        password: hashed,
      };

      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockResolvedValue(mockUser);

      const result = await service.login(mockEmail, mockPassword);

      expect(result.access_token).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUserId,
        email: mockEmail,
      });
    });

    it('TC0002 - Should throw on invalid credentials', async () => {
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockResolvedValue(null);

      await expect(service.login(mockEmail, mockPassword)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('TC0003 - Should throw service unavailable when schema is missing', async () => {
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockRejectedValue({ code: 'P2021' });

      await expect(service.login(mockEmail, mockPassword)).rejects.toThrow(
        'Database schema not initialized. Please run migrations.',
      );
    });

    it('TC0004 - Should throw internal server error on unexpected auth failure', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        name: mockName,
        password: 'hashed',
      };
      jest
        .spyOn((service as any).userRepository, 'findByEmail')
        .mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockRejectedValueOnce(new Error('boom'));

      await expect(service.login(mockEmail, mockPassword)).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('forgotPassword', () => {
    it('TC0001 - Should return generic message when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword(mockEmail);

      expect(result).toEqual({
        message: 'If the email exists, a password reset link was sent.',
      });
    });

    it('TC0002 - Should create token and send reset email for existing user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: mockEmail,
      });
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'token-id' });

      const result = await service.forgotPassword(mockEmail);

      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'If the email exists, a password reset link was sent.',
      });
    });

    it('TC0003 - Should throw service unavailable when schema is missing', async () => {
      prisma.user.findUnique.mockRejectedValue({ code: 'P2021' });

      await expect(service.forgotPassword(mockEmail)).rejects.toThrow(
        'Database schema not initialized. Please run migrations.',
      );
    });

    it('TC0004 - Should throw internal server error on unexpected lookup failure', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('boom'));

      await expect(service.forgotPassword(mockEmail)).rejects.toThrow(
        'Forgot password failed',
      );
    });

    it('TC0005 - Should throw when email sending fails', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: mockEmail,
      });
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'token-id' });
      sendMail.mockRejectedValueOnce(new Error('smtp'));

      await expect(service.forgotPassword(mockEmail)).rejects.toThrow(
        'Failed to send reset email',
      );
    });

    it('TC0006 - Should use SMTP_FROM and PASSWORD_RESET_URL_BASE when provided', async () => {
      process.env.SMTP_FROM = 'sender@test.dev';
      process.env.PASSWORD_RESET_URL_BASE = 'http://frontend/reset-password';
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: mockEmail,
      });
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'token-id' });

      await service.forgotPassword(mockEmail);

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'sender@test.dev',
          text: expect.stringContaining(
            'http://frontend/reset-password?token=',
          ),
        }),
      );

      delete process.env.SMTP_FROM;
      delete process.env.PASSWORD_RESET_URL_BASE;
    });
  });

  describe('resetPassword', () => {
    it('TC0001 - Should reset password successfully', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-id',
        userId: mockUserId,
        tokenHash: 'hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.resetPassword(
        'raw-token',
        mockPassword,
        mockPassword,
      );

      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('TC0002 - Should throw when confirmation does not match', async () => {
      await expect(
        service.resetPassword('raw-token', mockPassword, 'different'),
      ).rejects.toThrow('Password and confirmPassword must match');
    });

    it('TC0003 - Should throw when token is invalid', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('raw-token', mockPassword, mockPassword),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('TC0004 - Should throw when token is already used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-id',
        userId: mockUserId,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.resetPassword('raw-token', mockPassword, mockPassword),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('TC0005 - Should throw when token is expired', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-id',
        userId: mockUserId,
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        service.resetPassword('raw-token', mockPassword, mockPassword),
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });
});
