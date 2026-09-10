import {
  signEmailUpdatesUnsubscribeToken,
  verifyEmailUpdatesUnsubscribeToken,
} from './email-unsubscribe';

describe('email unsubscribe tokens', () => {
  const secret = 'test-secret-for-unsubscribe-specs';

  it('round-trips a valid token', () => {
    const token = signEmailUpdatesUnsubscribeToken('user-123', secret, 1_700_000_000);
    const parsed = verifyEmailUpdatesUnsubscribeToken(
      token,
      secret,
      1_700_000_000,
    );
    expect(parsed).toEqual({ userId: 'user-123' });
  });

  it('rejects expired tokens', () => {
    const token = signEmailUpdatesUnsubscribeToken('user-123', secret, 1_700_000_000);
    const parsed = verifyEmailUpdatesUnsubscribeToken(
      token,
      secret,
      1_700_000_000 + 91 * 24 * 60 * 60,
    );
    expect(parsed).toBeNull();
  });

  it('rejects tampered tokens', () => {
    const token = signEmailUpdatesUnsubscribeToken('user-123', secret);
    const broken = `${token.slice(0, -4)}xxxx`;
    expect(verifyEmailUpdatesUnsubscribeToken(broken, secret)).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = signEmailUpdatesUnsubscribeToken('user-123', secret);
    expect(verifyEmailUpdatesUnsubscribeToken(token, 'other-secret')).toBeNull();
  });
});
