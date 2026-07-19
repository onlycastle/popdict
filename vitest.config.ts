import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      '{src,electron,shared}/**/*.test.{ts,tsx}',
      'scripts/{events,harness,phrases,translations}/**/*.test.mjs',
    ],
  },
})
