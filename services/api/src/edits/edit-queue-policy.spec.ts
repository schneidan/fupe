import {
  shouldAutoCommitEdit,
  TRUST_AUTO_COMMIT_THRESHOLD,
} from './edit-queue-policy';

describe('shouldAutoCommitEdit', () => {
  it('auto-commits ownership edits above the trust threshold', () => {
    expect(
      shouldAutoCommitEdit({
        trustScore: TRUST_AUTO_COMMIT_THRESHOLD + 1,
        isSuggestEntity: false,
        isCreateEntity: false,
      }),
    ).toBe(true);
  });

  it('queues ownership edits at or below the threshold', () => {
    expect(
      shouldAutoCommitEdit({
        trustScore: TRUST_AUTO_COMMIT_THRESHOLD,
        isSuggestEntity: false,
        isCreateEntity: false,
      }),
    ).toBe(false);
  });

  it('never auto-commits create_entity even at high trust', () => {
    expect(
      shouldAutoCommitEdit({
        trustScore: 100,
        isSuggestEntity: false,
        isCreateEntity: true,
      }),
    ).toBe(false);
  });

  it('never auto-commits suggest_entity tips', () => {
    expect(
      shouldAutoCommitEdit({
        trustScore: 100,
        isSuggestEntity: true,
        isCreateEntity: false,
      }),
    ).toBe(false);
  });
});
