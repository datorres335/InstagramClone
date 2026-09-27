import { createZodDto } from 'nestjs-zod';

import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema,
} from '@instagram-clone/validation';

/**
 * Thin `createZodDto` wrappers (docs/ARCHITECTURE.md §5.2) — the schemas
 * themselves live in `packages/validation` (Milestone 3), the single source
 * of truth shared with web/mobile. These classes exist only so Nest's
 * `@Body()` has a metatype the global `ZodValidationPipe` recognizes.
 */

export class RegisterDto extends createZodDto(registerInputSchema) {}
export class LoginDto extends createZodDto(loginInputSchema) {}
export class RefreshDto extends createZodDto(refreshInputSchema) {}
export class LogoutDto extends createZodDto(logoutInputSchema) {}
