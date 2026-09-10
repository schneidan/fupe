/**
 * Pure queue vs auto-commit policy for community edits.
 * Kept separate so CI can unit-test without booting Nest.
 */
export const TRUST_AUTO_COMMIT_THRESHOLD = 50;

export function shouldAutoCommitEdit(input: {
  trustScore: number;
  isSuggestEntity: boolean;
  isCreateEntity: boolean;
}): boolean {
  if (input.isSuggestEntity || input.isCreateEntity) return false;
  return input.trustScore > TRUST_AUTO_COMMIT_THRESHOLD;
}
