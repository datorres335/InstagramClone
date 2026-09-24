/**
 * Prisma seed script (run via `prisma db seed`, configured in
 * prisma.config.ts). Empty for now because the schema has no models yet —
 * see docs/DATABASE.md §9 for the seed dataset this will create once the
 * User/Post/etc. models exist.
 */
async function main() {
  console.warn(
    'No models to seed yet — schema is still empty (see prisma/schema.prisma).',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
