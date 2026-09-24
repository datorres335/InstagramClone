import { z } from 'zod';

/**
 * Environment schema for apps/mobile. Only variables prefixed `EXPO_PUBLIC_`
 * are inlined into the client bundle — see
 * https://docs.expo.dev/guides/environment-variables/.
 */
export const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url('EXPO_PUBLIC_API_URL must be a valid URL'),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;
