import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  ApiKeyTier,
  ApiKeysService,
} from '../api-keys/api-keys.service';
import { UsersRepository, UserRow } from '../auth/users.repository';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
    private readonly apiKeys: ApiKeysService,
  ) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secret ? new Stripe(secret) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.stripe && this.config.get('STRIPE_PRICE_DEVELOPER'));
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in the API env.',
      );
    }
    return this.stripe;
  }

  async getStatus(user: UserRow) {
    return {
      subscription_tier: user.subscription_tier ?? 'free',
      subscription_status: user.subscription_status,
      stripe_configured: this.isConfigured(),
      tiers: {
        free: {
          price_usd: 0,
          rate_limit_daily: 100,
          image_lookup: false,
        },
        developer: {
          price_usd: 9,
          rate_limit_daily: 10_000,
          image_lookup: true,
        },
        business: {
          price_usd: null,
          rate_limit_daily: 100_000,
          image_lookup: true,
          note: 'Custom SLA — contact us or use STRIPE_PRICE_BUSINESS',
        },
      },
    };
  }

  async createCheckoutSession(
    user: UserRow,
    tier: 'developer' | 'business' = 'developer',
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const priceId =
      tier === 'business'
        ? this.config.get<string>('STRIPE_PRICE_BUSINESS')
        : this.config.get<string>('STRIPE_PRICE_DEVELOPER');

    if (!priceId) {
      throw new BadRequestException(
        tier === 'business'
          ? 'Business tier is not configured (STRIPE_PRICE_BUSINESS). Contact support for custom pricing.'
          : 'STRIPE_PRICE_DEVELOPER is not set',
      );
    }

    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';

    const customerId = await this.ensureCustomer(user);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site.replace(/\/$/, '')}/developers?checkout=success`,
      cancel_url: `${site.replace(/\/$/, '')}/developers?checkout=cancel`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        tier,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          tier,
        },
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }
    return { url: session.url };
  }

  async createPortalSession(user: UserRow): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    if (!user.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer on this account yet');
    }
    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${site.replace(/\/$/, '')}/developers`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const stripe = this.requireStripe();
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET is not set');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook signature failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.debug(`Ignored Stripe event ${event.type}`);
    }

    return { received: true };
  }

  private async ensureCustomer(user: UserRow): Promise<string> {
    const stripe = this.requireStripe();
    if (user.stripe_customer_id) return user.stripe_customer_id;

    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    await this.users.setStripeCustomerId(user.id, customer.id);
    return customer.id;
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId =
      session.metadata?.user_id ?? session.client_reference_id ?? null;
    if (!userId) {
      this.logger.warn('checkout.session.completed missing user_id');
      return;
    }

    const tier = this.parseTier(session.metadata?.tier) ?? 'developer';
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null;

    await this.applyTier(userId, tier, 'active', subscriptionId);

    if (session.customer && typeof session.customer === 'string') {
      await this.users.setStripeCustomerId(userId, session.customer);
    }
  }

  private async onSubscriptionUpdated(sub: Stripe.Subscription) {
    const userId = sub.metadata?.user_id;
    let user: UserRow | null = null;
    if (userId) {
      user = await this.users.findById(userId);
    } else if (typeof sub.customer === 'string') {
      user = await this.users.findByStripeCustomerId(sub.customer);
    }
    if (!user) {
      this.logger.warn(`subscription.updated: no user for ${sub.id}`);
      return;
    }

    const tier =
      this.parseTier(sub.metadata?.tier) ??
      this.tierFromPrice(sub) ??
      (user.subscription_tier as ApiKeyTier) ??
      'developer';

    const status = sub.status;
    if (status === 'active' || status === 'trialing') {
      await this.applyTier(user.id, tier, status, sub.id);
    } else if (
      status === 'canceled' ||
      status === 'unpaid' ||
      status === 'incomplete_expired'
    ) {
      await this.applyTier(user.id, 'free', status, sub.id);
    } else {
      await this.users.setSubscription({
        userId: user.id,
        tier: user.subscription_tier ?? 'free',
        status,
        subscriptionId: sub.id,
      });
    }
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription) {
    const userId = sub.metadata?.user_id;
    let user: UserRow | null = null;
    if (userId) {
      user = await this.users.findById(userId);
    } else if (typeof sub.customer === 'string') {
      user = await this.users.findByStripeCustomerId(sub.customer);
    }
    if (!user) return;
    await this.applyTier(user.id, 'free', 'canceled', null);
  }

  private async applyTier(
    userId: string,
    tier: ApiKeyTier,
    status: string | null,
    subscriptionId: string | null,
  ) {
    await this.users.setSubscription({
      userId,
      tier,
      status,
      subscriptionId,
    });
    await this.apiKeys.setTierForUser(userId, tier);
    this.logger.log(`User ${userId} → tier=${tier} status=${status}`);
  }

  private parseTier(raw?: string | null): ApiKeyTier | null {
    if (raw === 'free' || raw === 'developer' || raw === 'business') return raw;
    return null;
  }

  private tierFromPrice(sub: Stripe.Subscription): ApiKeyTier | null {
    const priceId = sub.items.data[0]?.price?.id;
    if (!priceId) return null;
    if (priceId === this.config.get('STRIPE_PRICE_BUSINESS')) return 'business';
    if (priceId === this.config.get('STRIPE_PRICE_DEVELOPER')) return 'developer';
    return null;
  }
}
