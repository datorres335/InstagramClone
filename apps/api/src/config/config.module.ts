import { Global, Module } from '@nestjs/common';

import { type ApiEnv, apiEnvSchema, loadEnv } from '@instagram-clone/config';

/**
 * DI token for the validated env object. `main.ts` also calls `loadEnv()`
 * directly for bootstrap-time concerns (port, host, CORS, helmet) that run
 * before the Nest DI container exists — this module exists so everything
 * *inside* the container (services, other modules) can inject the same
 * validated config instead of each re-parsing `process.env` itself.
 */
export const API_ENV = Symbol('API_ENV');

@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: (): ApiEnv => loadEnv(apiEnvSchema),
    },
  ],
  exports: [API_ENV],
})
export class ConfigModule {}
