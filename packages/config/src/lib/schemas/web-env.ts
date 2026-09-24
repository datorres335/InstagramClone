import { z } from 'zod';

/**
 * Environment schema for apps/web. Only variables prefixed `NEXT_PUBLIC_`
 * are available in the browser bundle — see
 * https://nextjs.org/docs/app/guides/environment-variables.
 */
export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url('NEXT_PUBLIC_API_URL must be a valid URL'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
