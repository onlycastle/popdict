import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    // Bake the GitHub "owner/repo" into the main bundle so a release build can
    // enable auto-update without editing source:
    //   POPDICT_GITHUB_REPO=owner/repo npm run release:arm64
    'process.env.POPDICT_GITHUB_REPO': JSON.stringify(
      process.env.POPDICT_GITHUB_REPO || ''
    ),
  },
});
