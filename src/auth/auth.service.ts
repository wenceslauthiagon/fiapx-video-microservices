import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import * as nodemailer from 'nodemailer';
import { APP_DEFAULTS } from '../shared/app.constants';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import {
  AuthenticateUserUseCase,
  RegisterUserUseCase,
} from '../application/use-cases';
import { AUTH_DEFAULTS, AUTH_MESSAGES } from './auth.constants';

@Injectable()
export class AuthService {
  private readonly userRepository: PrismaUserRepository;
  private readonly prisma: PrismaService;
  private readonly smtpTransporter: nodemailer.Transporter;

  constructor(
    private readonly jwtService: JwtService,
    prisma: PrismaService,
  ) {
    this.prisma = prisma;
    this.userRepository = new PrismaUserRepository(prisma);
    const smtpSecure =
      (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const transportOptions: Record<string, unknown> = {
      host: process.env.SMTP_HOST || APP_DEFAULTS.smtpHost,
      port: Number(process.env.SMTP_PORT || APP_DEFAULTS.smtpPort),
      secure: smtpSecure,
    };

    if (smtpUser && smtpPass) {
      transportOptions.auth = { user: smtpUser, pass: smtpPass };
    }

    this.smtpTransporter = nodemailer.createTransport(transportOptions);
  }

  async register(
    email: string,
    password: string,
    confirmPassword: string,
    name: string,
  ) {
    if (password !== confirmPassword) {
      throw new BadRequestException(AUTH_MESSAGES.passwordConfirmMismatch);
    }

    const useCase = new RegisterUserUseCase(this.userRepository);
    let user;
    try {
      user = await useCase.execute(email, password, name, (pwd) =>
        bcrypt.hash(pwd, 10),
      );
    } catch (error) {
      const prismaCode = (error as { code?: string })?.code;
      const message =
        error instanceof Error
          ? error.message
          : AUTH_MESSAGES.registrationFailed;

      if (prismaCode === 'P2021') {
        throw new ServiceUnavailableException(
          AUTH_MESSAGES.schemaNotInitialized,
        );
      }

      if (message === AUTH_MESSAGES.emailAlreadyRegistered) {
        throw new ConflictException(message);
      }

      if (message === AUTH_MESSAGES.invalidEmailFormat) {
        throw new BadRequestException(message);
      }

      throw new InternalServerErrorException(AUTH_MESSAGES.registrationFailed);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(email: string, password: string) {
    const useCase = new AuthenticateUserUseCase(this.userRepository);
    let user;
    try {
      user = await useCase.execute(email, password, (plain, hashed) =>
        bcrypt.compare(plain, hashed),
      );
    } catch (error) {
      const prismaCode = (error as { code?: string })?.code;
      const message =
        error instanceof Error
          ? error.message
          : AUTH_MESSAGES.invalidCredentials;

      if (prismaCode === 'P2021') {
        throw new ServiceUnavailableException(
          AUTH_MESSAGES.schemaNotInitialized,
        );
      }

      if (message !== AUTH_MESSAGES.invalidCredentials) {
        throw new InternalServerErrorException(
          AUTH_MESSAGES.authenticationFailed,
        );
      }

      throw new UnauthorizedException(message);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async forgotPassword(email: string) {
    const genericMessage = AUTH_MESSAGES.genericForgotPassword;

    let user;
    try {
      user = await this.prisma.user.findUnique({ where: { email } });
    } catch (error) {
      const prismaCode = (error as { code?: string })?.code;
      if (prismaCode === 'P2021') {
        throw new ServiceUnavailableException(
          AUTH_MESSAGES.schemaNotInitialized,
        );
      }
      throw new InternalServerErrorException(
        AUTH_MESSAGES.forgotPasswordFailed,
      );
    }

    if (!user) {
      return { message: genericMessage };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }],
      },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetBaseUrl =
      process.env.PASSWORD_RESET_URL_BASE || APP_DEFAULTS.passwordResetUrl;
    const resetLink = `${resetBaseUrl}?token=${rawToken}`;

    try {
      await this.smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || AUTH_DEFAULTS.smtpFrom,
        to: user.email,
        subject: AUTH_MESSAGES.resetPasswordSubject,
        text: `${AUTH_MESSAGES.resetPasswordEmailTextPrefix} ${resetLink}`,
      });
    } catch {
      throw new ServiceUnavailableException(
        AUTH_MESSAGES.failedToSendResetEmail,
      );
    }

    return { message: genericMessage };
  }

  async resetPassword(
    token: string,
    password: string,
    confirmPassword: string,
  ) {
    if (password !== confirmPassword) {
      throw new BadRequestException(AUTH_MESSAGES.passwordConfirmMismatch);
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new NotFoundException(AUTH_MESSAGES.invalidOrExpiredResetToken);
    }

    const newPasswordHash = await bcrypt.hash(password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ]);

    return { message: AUTH_MESSAGES.resetPasswordSuccess };
  }
}
