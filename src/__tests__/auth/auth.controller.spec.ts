import { faker } from '@faker-js/faker/locale/pt_BR';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from '../../../src/auth/auth.controller';
import { AuthService } from '../../../src/auth/auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterUserDto,
  ResetPasswordDto,
} from '../../../src/shared/dtos/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = faker.string.uuid();
  const mockEmail = faker.internet.email();
  const mockPassword = faker.internet.password({ length: 8 });
  const mockName = faker.person.fullName();

  const mockAuthResponse = {
    access_token: faker.string.alphanumeric(100),
    user: { id: mockUserId, email: mockEmail, name: mockName },
  };

  const mockLoginDto: LoginDto = { email: mockEmail, password: mockPassword };
  const mockRegisterDto: RegisterUserDto = {
    email: mockEmail,
    password: mockPassword,
    confirmPassword: mockPassword,
    name: mockName,
  };
  const mockForgotPasswordDto: ForgotPasswordDto = { email: mockEmail };
  const mockResetPasswordDto: ResetPasswordDto = {
    token: faker.string.alphanumeric(32),
    password: mockPassword,
    confirmPassword: mockPassword,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            register: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('Should be defined', () => {
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(AuthController);
  });

  describe('register', () => {
    it('TC0001 - Should register successfully', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(mockRegisterDto);

      expect(authService.register).toHaveBeenCalledWith(
        mockRegisterDto.email,
        mockRegisterDto.password,
        mockRegisterDto.confirmPassword,
        mockRegisterDto.name,
      );
      expect(result).toEqual(mockAuthResponse);
    });

    it('TC0002 - Should propagate register error', async () => {
      const error = new Error('Email ja cadastrado');
      authService.register.mockRejectedValue(error);

      await expect(controller.register(mockRegisterDto)).rejects.toThrow(error);
    });
  });

  describe('login', () => {
    it('TC0001 - Should login successfully', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(mockLoginDto);

      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto.email,
        mockLoginDto.password,
      );
      expect(result).toEqual(mockAuthResponse);
    });

    it('TC0002 - Should handle login error', async () => {
      const error = new Error('Credenciais invalidas');
      authService.login.mockRejectedValue(error);

      await expect(controller.login(mockLoginDto)).rejects.toThrow(error);
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginDto.email,
        mockLoginDto.password,
      );
    });
  });

  describe('forgotPassword', () => {
    it('TC0001 - Should delegate forgot password request', async () => {
      authService.forgotPassword.mockResolvedValue({ message: 'ok' } as any);

      const result = await controller.forgotPassword(mockForgotPasswordDto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(mockEmail);
      expect(result).toEqual({ message: 'ok' });
    });
  });

  describe('resetPassword', () => {
    it('TC0001 - Should delegate reset password request', async () => {
      authService.resetPassword.mockResolvedValue({ message: 'ok' } as any);

      const result = await controller.resetPassword(mockResetPasswordDto);

      expect(authService.resetPassword).toHaveBeenCalledWith(
        mockResetPasswordDto.token,
        mockResetPasswordDto.password,
        mockResetPasswordDto.confirmPassword,
      );
      expect(result).toEqual({ message: 'ok' });
    });
  });

  describe('resetPasswordPage', () => {
    it('TC0001 - Should return 400 when token is missing', async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as any;

      await controller.resetPasswordPage('', res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalled();
    });

    it('TC0002 - Should render reset password page when token exists', async () => {
      const res = {
        send: jest.fn().mockReturnThis(),
      } as any;

      await controller.resetPasswordPage(mockResetPasswordDto.token, res);

      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining(mockResetPasswordDto.token),
      );
    });
  });
});
