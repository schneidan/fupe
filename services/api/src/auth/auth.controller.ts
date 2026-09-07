import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthService, AuthUser } from './auth.service';
import { AuthIpThrottleGuard } from './auth-ip-throttle.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SkipApiKey } from '../api-keys/api-key.decorators';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  email_updates_opt_in?: boolean;
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

class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  display_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  organization?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;

  @IsOptional()
  @IsBoolean()
  email_updates_opt_in?: boolean;
}

class RequestEmailChangeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class ConfirmEmailChangeDto {
  @IsString()
  token!: string;
}

@Controller('auth')
@SkipApiKey()
@UseGuards(AuthIpThrottleGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() { email, password, email_updates_opt_in }: RegisterDto,
  ) {
    return this.authService.register(email, password, {
      emailUpdatesOptIn: email_updates_opt_in,
    });
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
    return this.authService.getMe(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: { user: AuthUser }, @Body() body: UpdateMeDto) {
    return this.authService.updateMe(req.user.id, body);
  }

  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  requestEmailChange(
    @Req() req: { user: AuthUser },
    @Body() { email, password }: RequestEmailChangeDto,
  ) {
    return this.authService.requestEmailChange(req.user.id, email, password);
  }

  @Post('change-email/cancel')
  @UseGuards(JwtAuthGuard)
  cancelEmailChange(@Req() req: { user: AuthUser }) {
    return this.authService.cancelEmailChange(req.user.id).then((user) => ({
      message: 'Email change cancelled',
      user,
    }));
  }

  @Post('confirm-email-change')
  confirmEmailChange(@Body() { token }: ConfirmEmailChangeDto) {
    return this.authService.confirmEmailChange(token).then((user) => ({
      message: 'Email updated',
      user,
    }));
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
