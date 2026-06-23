import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict Content-Security-Policy for the SHIPPED app. Injected as a <meta> tag
// only at build time so it does not interfere with the Vite dev server (which
// needs inline scripts + a ws: HMR connection). connect-src lists the only
// remote origins the renderer talks to: Supabase (auth, saved words, and the
// idioms Edge Function) and the free dictionary API. media-src stays permissive
// so pronunciation audio (served from assorted CDNs) can play.
const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "media-src 'self' https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.dictionaryapi.dev",
].join('; ');

function injectCspMeta(): Plugin {
  return {
    name: 'popdict-inject-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // ctx.server is only set when serving (dev). Skip injection there.
        if (ctx.server) return html;
        return html.replace(
          '</head>',
          `  <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}">\n  </head>`
        );
      },
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
    plugins: [react(), injectCspMeta()],
    base: './',
    // Ensure Vite processes environment variables prefixed with VITE_
    envPrefix: 'VITE_',
});
