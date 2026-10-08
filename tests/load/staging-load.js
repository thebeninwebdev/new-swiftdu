import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) fail('Set BASE_URL to a non-production staging deployment.');
if (baseUrl === 'https://swiftdu.org' && __ENV.ALLOW_PRODUCTION !== 'true') {
  fail('Refusing to run against production. Set ALLOW_PRODUCTION=true only for an explicitly approved run.');
}

export const options = {
  scenarios: {
    customer_read_burst: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '1m', target: 50 }, { duration: '2m', target: 100 },
      { duration: '3m', target: 250 }, { duration: '3m', target: 500 },
      { duration: '3m', target: 700 }, { duration: '1m', target: 0 },
    ], exec: 'customerReads' },
    tasker_reads: { executor: 'constant-vus', vus: Number(__ENV.TASKER_VUS || 100), duration: '13m', exec: 'taskerReads' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    customer_order_duration: ['p(95)<1000'],
    tasker_accept_duration: ['p(95)<1000'],
  },
};

const headers = () => __ENV.COOKIE ? { Cookie: __ENV.COOKIE } : {};

export function customerReads() {
  const res = http.get(`${baseUrl}/api/orders?current=true`, { headers: headers(), tags: { name: 'customer_orders' } });
  check(res, { 'customer read succeeds': (r) => r.status === 200 || r.status === 401 });
  sleep(5);
}

export function taskerReads() {
  const taskerId = __ENV.TASKER_ID;
  if (!taskerId) fail('Set TASKER_ID for tasker read load.');
  for (const query of [`available=true&taskerId=${encodeURIComponent(taskerId)}&fast=true&limit=80`, `accepted=true&taskerId=${encodeURIComponent(taskerId)}&fast=true&limit=40`]) {
    const res = http.get(`${baseUrl}/api/errands?${query}`, { headers: headers(), tags: { name: 'tasker_errands' } });
    check(res, { 'tasker read succeeds': (r) => r.status === 200 || r.status === 401 || r.status === 403 });
  }
  sleep(Number(__ENV.TASKER_INTERVAL_SECONDS || 60));
}