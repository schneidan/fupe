import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService, AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SkipApiKey } from '../api-keys/api-key.decorators';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class VerifyEmailDto {
  @IsString()
  token!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('auth')
@SkipApiKey()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() { email, password }: RegisterDto) {
    return this.authService.register(email, password);
  }

  @Post('login')
  login(@Body() { email, password }: LoginDto) {
    return this.authService.login(email, password);
  }

  @Post('forgot-password')
  forgotPassword(@Body() { email }: ForgotPasswordDto) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  resetPassword(@Body() { token, password }: ResetPasswordDto) {
    return this.authService.resetPassword(token, password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return req.user;
  }

  @Post('verify-email')
  verifyEmail(@Body() { token }: VerifyEmailDto) {
    return this.authService.verifyEmail(token).then((user) => ({
      message: 'Email verified',
      user,
    }));
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  resendVerification(@Req() req: { user: AuthUser }) {
    return this.authService.resendVerification(req.user);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  exportData(@Req() req: { user: AuthUser }) {
    return this.authService.exportMyData(req.user);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteAccount(@Req() req: { user: AuthUser }) {
    return this.authService.deleteMyAccount(req.user);
  }
}
