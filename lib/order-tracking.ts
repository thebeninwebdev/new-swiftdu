import { randomBytes } from 'crypto';

import { getSiteUrl } from '@/lib/site';

export function createOrderTrackingToken() {
  return randomBytes(24).toString('base64url');
}

export function getOrderTrackingUrl(token?: string | null) {
  if (!token) {
    return null;
  }

  return `${getSiteUrl()}/track/${token}`;
}
