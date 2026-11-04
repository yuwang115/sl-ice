import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

/**
 * Public URL the build is deployed under (no trailing slash). Social-card crawlers
 * need absolute URLs, so `%SITE_URL%` in the HTML entry points is replaced with this.
 * Override at build time, e.g. `SITE_URL=https://example.org/sl-ice npm run build`
 * (or set SITE_URL in a .env file). `base` stays relative, so the build itself is
 * still path-independent.
 */
const DEFAULT_SITE_URL = 'https://yuwang.blog/tools/sl-ice'

function resolveSiteUrl(raw: string | undefined): string {
  const url = (raw?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    throw new Error(`SITE_URL must be an absolute URL, got "${url}"`)
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`SITE_URL must use http(s), got "${url}"`)
  }
  return url
}

/** Substitutes `%SITE_URL%` in index.html / landing.html before Vite processes them. */
function siteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: 'sl-ice:site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    },
  }
}

/**
 * Long-cache vendor chunks: they only change when dependencies are upgraded, so app
 * releases do not invalidate them. three/R3F/drei are reachable only from the lazily
 * loaded AntarcticaExplorer chunk, so neither HTML entry imports or preloads them.
 * zustand sits with React because both the app store and R3F import it; leaving it
 * to the R3F group would make the main entry statically import the 3D vendor chunks.
 */
const VENDOR_CHUNKS = [
  {
    name: 'vendor-react',
    test: /[\\/]node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/,
    priority: 30,
  },
  { name: 'vendor-three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 20 },
  {
    name: 'vendor-r3f',
    test: /[\\/]node_modules[\\/](@react-three[\\/](fiber|drei)|three-stdlib)[\\/]/,
    priority: 10,
  },
]

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const siteUrl = resolveSiteUrl(loadEnv(mode, __dirname, 'SITE_URL').SITE_URL)

  return {
    base: './',
    plugins: [react(), tailwindcss(), siteUrlPlugin(siteUrl)],
    worker: {
      format: 'es',
    },
    build: {
      // Sized for vendor-three (three.js core, ~716 kB minified, not splittable in a
      // useful way); every other chunk is < 200 kB, so real regressions still warn.
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          landing: resolve(__dirname, 'landing.html'),
        },
        output: {
          codeSplitting: { groups: VENDOR_CHUNKS },
        },
      },
    },
  }
})
