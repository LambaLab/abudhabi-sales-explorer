import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read .env files into process.env early (before server starts) so that
// api/* handlers can access ANTHROPIC_API_KEY via process.env at module-init time.
// Vite's loadEnv returns a plain object but does NOT mutate process.env, which
// means the module-level `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`
// in api/analyze.js and api/explain.js would see undefined without this step.
//
// IMPORTANT: use import.meta.url (the vite.config.js location) NOT process.cwd(),
// because the preview/CLI tool may launch Vite from a different working directory
// (e.g. the Claude Code workspace root), making process.cwd() wrong.
const PROJECT_ROOT = new URL('.', import.meta.url).pathname

function loadEnvIntoProcess() {
  const files = ['.env.local', '.env']
  for (const file of files) {
    try {
      const content = readFileSync(resolve(PROJECT_ROOT, file), 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        // Strip surrounding quotes  (dotenv convention: KEY="value")
        if (val.length >= 2 &&
            ((val.startsWith('"') && val.endsWith('"')) ||
             (val.startsWith("'") && val.endsWith("'")))) {
          val = val.slice(1, -1)
        }
        // .env.local values always win — overwrite any stale shell env var
        process.env[key] = val
      }
    } catch { /* file not found – skip */ }
  }
}

loadEnvIntoProcess()

const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf8'))

/**
 * Vite plugin that handles /api/* routes in the dev server.
 * Replaces `vercel dev` — Edge Function handlers in /api/*.js are
 * dynamically imported and called directly in Node.js 24+ which has
 * native support for Request, Response, ReadableStream, TextEncoder.
 */
function apiDevPlugin() {
  return {
    name: 'api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const routeName = req.url.split('?')[0].replace('/api/', '')
        const handlerPath = new URL(`./api/${routeName}.js`, import.meta.url)

        // Collect request body from Node.js IncomingMessage stream
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const bodyBuffer = Buffer.concat(chunks)

        // Build a Web API Request from the Node.js IncomingMessage
        const protocol = req.socket?.encrypted ? 'https' : 'http'
        const host = req.headers.host ?? 'localhost'
        const webRequest = new Request(`${protocol}://${host}${req.url}`, {
          method: req.method,
          headers: Object.fromEntries(
            Object.entries(req.headers).filter(([, v]) => v != null)
          ),
          body: bodyBuffer.length > 0 ? bodyBuffer : undefined,
        })

        let handlerModule
        try {
          // Note: Node.js ESM caches by file path (query strings are ignored),
          // so the same module instance is reused across requests — that's fine
          // because process.env is already set before the first import.
          handlerModule = await import(/* @vite-ignore */ handlerPath.href)
        } catch (err) {
          console.error(`[api-dev] Failed to import handler for /api/${routeName}:`, err.message)
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `No handler found for /api/${routeName}` }))
          return
        }

        let webResponse
        try {
          webResponse = await handlerModule.default(webRequest)
        } catch (err) {
          console.error(`[api-dev] Handler /api/${routeName} threw:`, err.message)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message ?? 'Handler error' }))
          return
        }

        // Forward status + headers to Node.js response
        res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))

        if (!webResponse.body) {
          res.end()
          return
        }

        // Stream the ReadableStream body back to the HTTP client
        const reader = webResponse.body.getReader()
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) { res.end(); break }
              res.write(value)
            }
          } catch (err) {
            res.destroy(err)
          }
        }
        pump()
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss(), apiDevPlugin()],
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
})
