export const AUTH_ROUTES = {
  resetPassword: '/auth/reset-password',
} as const;

export const AUTH_TEMPLATE_KEYS = {
  resetTokenPlaceholder: '__RESET_TOKEN_PLACEHOLDER__',
} as const;

export const AUTH_CONTROLLER_MESSAGES = {
  tokenMissingHtml:
    '<h2>Token ausente</h2><p>Abra o link completo recebido por email.</p>',
} as const;

export const AUTH_MESSAGES = {
  passwordConfirmMismatch: 'Password and confirmPassword must match',
  registrationFailed: 'Registration failed',
  schemaNotInitialized:
    'Database schema not initialized. Please run migrations.',
  emailAlreadyRegistered: 'Email already registered',
  invalidEmailFormat: 'Invalid email format',
  invalidCredentials: 'Invalid credentials',
  authenticationFailed: 'Authentication failed',
  forgotPasswordFailed: 'Forgot password failed',
  genericForgotPassword: 'If the email exists, a password reset link was sent.',
  failedToSendResetEmail: 'Failed to send reset email',
  resetPasswordSubject: 'Redefinicao de senha',
  invalidOrExpiredResetToken: 'Invalid or expired reset token',
  resetPasswordSuccess: 'Password reset successfully',
  resetPasswordEmailTextPrefix:
    'Recebemos uma solicitacao para redefinir sua senha. Use este link:',
} as const;

export const AUTH_DEFAULTS = {
  smtpFrom: 'noreply@fiapx.local',
} as const;
