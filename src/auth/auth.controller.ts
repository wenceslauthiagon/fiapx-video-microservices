import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterUserDto,
  ResetPasswordDto,
} from '../shared/dtos/auth.dto';
import { RESET_PASSWORD_PAGE_TEMPLATE } from './reset-password-page.template';
import { AUTH_CONTROLLER_MESSAGES, AUTH_TEMPLATE_KEYS } from './auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar novo usuario' })
  register(@Body() dto: RegisterUserDto) {
    return this.authService.register(
      dto.email,
      dto.password,
      dto.confirmPassword,
      dto.name,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuario e obter token JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Enviar link de redefinicao de senha por email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Redefinir senha usando token enviado por email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(
      dto.token,
      dto.password,
      dto.confirmPassword,
    );
  }

  @Get('reset-password')
  @ApiOperation({
    summary:
      'Pagina backend temporaria para redefinir senha por link (enquanto frontend nao existe)',
  })
  async resetPasswordPage(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      return res.status(400).send(AUTH_CONTROLLER_MESSAGES.tokenMissingHtml);
    }

    const page = RESET_PASSWORD_PAGE_TEMPLATE.replace(
      AUTH_TEMPLATE_KEYS.resetTokenPlaceholder,
      JSON.stringify(token),
    );

    return res.send(page);
  }
}
