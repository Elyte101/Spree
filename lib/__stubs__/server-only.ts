// Test-only stub for the "server-only" package. Next.js's bundler
// special-cases the real "server-only" import to fail a client build; it
// doesn't need to actually resolve to a package on disk there. Vitest runs
// in plain Node without that bundler magic, so this vitest.config.ts alias
// points "server-only" at this no-op module purely so files that import it
// (a defensive marker, e.g. lib/authBackend.ts) can be unit-tested.
export {};
