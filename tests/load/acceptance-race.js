import http from 'k6/http';
import { check, fail } from 'k6';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
const orderId = __ENV.TEST_ORDER_ID;
const racers = Number(__ENV.RACE_VUS || 25);
if (!baseUrl || !orderId) fail('Set BASE_URL and a dedicated TEST_ORDER_ID.');
if (baseUrl === 'https://swiftdu.org') fail('Acceptance races must never run against production.');

export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'], tasker_accept_duration: ['p(95)<1000'] } };

export default function () {
  const params = { headers: { 'Content-Type': 'application/json', ...(__ENV.COOKIE ? { Cookie: __ENV.COOKIE } : {}) }, tags: { name: 'tasker_accept' } };
  const requests = Array.from({ length: racers }, () => ['POST', `${baseUrl}/api/errands`, JSON.stringify({ orderId }), params]);
  const responses = http.batch(requests);
  const winners = responses.filter((response) => response.status === 200).length;
  check(responses, {
    'every racer is success or conflict': (items) => items.every((response) => response.status === 200 || response.status === 409),
    'exactly one acceptance succeeds': () => winners === 1,
  });
}