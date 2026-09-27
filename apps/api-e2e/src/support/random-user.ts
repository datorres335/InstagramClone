import { randomBytes } from 'node:crypto';

/** A unique, schema-valid registration payload so repeat local test runs never collide. */
export function randomRegisterInput() {
  const suffix = randomBytes(4).toString('hex');
  return {
    email: `e2e_${suffix}@example.com`,
    username: `e2e_${suffix}`,
    password: 'Password123!',
  };
}
