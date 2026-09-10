import assert from 'node:assert/strict';
import { safeNextPath } from './safe-next';

/** Run: pnpm --filter @fupe/web exec ts-node --transpile-only src/lib/safe-next.smoke.ts */
const cases: Array<{ raw: string | null; expected: string }> = [
  { raw: null, expected: '/' },
  { raw: '', expected: '/' },
  { raw: '/account', expected: '/account' },
  { raw: '/contribute/suggest?x=1', expected: '/contribute/suggest?x=1' },
  { raw: 'https://evil.example/', expected: '/' },
  { raw: '//evil.example', expected: '/' },
  { raw: '/\\evil', expected: '/' },
  { raw: 'javascript:alert(1)', expected: '/' },
  { raw: 'account', expected: '/' },
];

for (const { raw, expected } of cases) {
  assert.equal(
    safeNextPath(raw),
    expected,
    `safeNextPath(${JSON.stringify(raw)})`,
  );
}

console.log(`safe-next smoke: ${cases.length} cases ok`);
