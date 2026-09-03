import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { SkipApiKey } from '../api-keys/api-key.decorators';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersRepository } from '../auth/users.repository';
import { BillingService } from './billing.service';

class CheckoutBody {
  @IsOptional()
  @IsIn(['developer', 'business'])
  tier?: 'developer' | 'business';
}

@Controller('billing')
@SkipApiKey()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly users: UsersRepository,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@Req() req: { user: AuthUser }) {
    const user = await this.users.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    return this.billing.getStatus(user);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Req() req: { user: AuthUser },
    @Body() body: CheckoutBody,
  ) {
    const user = await this.users.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    return this.billing.createCheckoutSession(user, body.tier ?? 'developer');
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async portal(@Req() req: { user: AuthUser }) {
    const user = await this.users.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    return this.billing.createPortalSession(user);
  }

  /**
   * Stripe webhook — requires raw body (see main.ts rawBody: true).
   * Forward with: stripe listen --forward-to localhost:3000/api/v1/billing/webhook
   */
  @Post('webhook')
  webhook(
    @Req() req: { rawBody?: Buffer; body?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const raw = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : null);
    if (!raw || !signature) {
      throw new BadRequestException('Missing raw body or stripe-signature');
    }
    return this.billing.handleWebhook(raw, signature);
  }
}
