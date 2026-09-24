import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '60s', target: 50 },
    { duration: '60s', target: 100 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750']
  }
};

export default function () {
  const day = new Date().toISOString().slice(0, 10);
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health is 200': (r) => r.status === 200 });

  const schedule = http.get(`${BASE_URL}/api/v1/slots/day?day=${day}`);
  check(schedule, { 'schedule is 200': (r) => r.status === 200 });
  sleep(1);
}
