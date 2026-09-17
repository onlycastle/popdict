import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  // node:sqlite is prefix-only and absent from builtinModules on Node 22.
  // Keep the real Electron builtin instead of Vite's empty browser shim.
  build: { rollupOptions: { external: ['node:sqlite'] } },
  define: {
    // Bake the GitHub "owner/repo" into the main bundle so a release build can
    // enable auto-update without editing source:
    //   POPDICT_GITHUB_REPO=owner/repo npm run release:arm64
    'process.env.POPDICT_GITHUB_REPO': JSON.stringify(
      process.env.POPDICT_GITHUB_REPO || ''
    ),
  },
});
