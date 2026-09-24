//@ts-check

const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Next auto-detects the workspace root by walking up for a lockfile,
    // and picks up an unrelated lockfile above this repo on some machines
    // (e.g. a stray package-lock.json in the user's home directory) instead
    // of this repo's pnpm-lock.yaml. Pin it explicitly to avoid resolving
    // modules (React in particular) from the wrong place.
    root: path.join(__dirname, '../..'),
  },
};

module.exports = nextConfig;
