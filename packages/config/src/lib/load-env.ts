import type { z } from 'zod';

/**
 * Thrown by {@link loadEnv} when the provided environment does not satisfy
 * the given schema. The message lists every failing variable at once (not
 * just the first) so a misconfigured `.env` can be fixed in one pass.
 */
export class EnvValidationError extends Error {
  constructor(zodError: z.ZodError) {
    const issues = zodError.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    super(`Invalid environment configuration:\n${issues}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses and validates a source of environment variables (defaults to
 * `process.env`) against a Zod schema, returning a fully-typed config
 * object. Throws {@link EnvValidationError} — with every violation listed,
 * not just the first — if validation fails, so misconfiguration is caught
 * at process startup rather than surfacing as a confusing failure later.
 *
 * See docs/ARCHITECTURE.md §6 (`packages/config`) — each app calls this once
 * at startup with its own schema (e.g. `apiEnvSchema`).
 */
export function loadEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error);
  }
  return result.data;
}
