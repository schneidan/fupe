import { SetMetadata } from '@nestjs/common';

/** Skip API-key check (auth/edits/health and similar first-party routes). */
export const SKIP_API_KEY_KEY = 'skipApiKey';
export const SkipApiKey = () => SetMetadata(SKIP_API_KEY_KEY, true);

/** When set, a valid API key is required (no anonymous first-party pass). */
export const REQUIRE_API_KEY_KEY = 'requireApiKey';
export const RequireApiKey = () => SetMetadata(REQUIRE_API_KEY_KEY, true);
