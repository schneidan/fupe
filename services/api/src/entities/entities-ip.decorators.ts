import { SetMetadata } from '@nestjs/common';

export type EntitiesIpBucket = 'entities_list' | 'entities_detail';

export const ENTITIES_IP_BUCKET_KEY = 'entities_ip_bucket';

/** Mark a public entities route for anonymous IP list/detail daily + burst caps. */
export const EntitiesIpQuota = (bucket: EntitiesIpBucket) =>
  SetMetadata(ENTITIES_IP_BUCKET_KEY, bucket);
