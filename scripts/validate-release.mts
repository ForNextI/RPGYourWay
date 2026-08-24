import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as {
  name?: string
  version?: string
  rpgywVersion?: string
  dependencies?: Record<string, string>
}
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.5.1')
assert.equal(pkg.rpgywVersion, '1.5.0.1')
assert.equal(pkg.dependencies?.next, '16.2.6')
assert.equal(pkg.dependencies?.['@supabase/ssr'], '^0.12.4')
assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.112.3')

for (const file of [
  'app/page.tsx',
  'app/play/page.tsx',
  'app/shape/page.tsx',
  'app/read/page.tsx',
  'app/pricing/page.tsx',
  'app/account/page.tsx',
  'app/account/actions.ts',
  'app/auth/confirm/route.ts',
  'app/support/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'components/SiteHeader.tsx',
  'components/SiteFooter.tsx',
  'lib/version.ts',
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/proxy.ts',
  'proxy.ts',
  'public/rpgyw-logo-bordered.png',
  'public/rpgyw-compass.png',
  'public/rpgyw-map-tan.png',
]) assert.ok(exists(file), `Missing ${file}`)

const env = read('.env.example')
assert.match(env, /NEXT_PUBLIC_SUPABASE_URL=/)
assert.match(env, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/)
assert.doesNotMatch(env, /SERVICE_ROLE_KEY=.*[^\s]/)

const serverClient = read('lib/supabase/server.ts')
assert.match(serverClient, /createServerClient/)
assert.match(serverClient, /getAll\(\)/)
assert.match(serverClient, /setAll\(cookiesToSet/)
assert.doesNotMatch(serverClient, /auth-helpers-nextjs/)

const proxyHelper = read('lib/supabase/proxy.ts')
assert.match(proxyHelper, /createServerClient/)
assert.match(proxyHelper, /getAll\(\)/)
assert.match(proxyHelper, /setAll\(cookiesToSet, headers\)/)
assert.match(proxyHelper, /auth\.getClaims\(\)/)

const rootProxy = read('proxy.ts')
assert.match(rootProxy, /updateSession/)
assert.match(rootProxy, /export async function proxy/)

const account = read('app/account/page.tsx')
assert.match(account, /signIn/)
assert.match(account, /signUp/)
assert.match(account, /signOut/)
assert.match(account, /auth\.getClaims\(\)/)
assert.match(account, /Create an account/)

const actions = read('app/account/actions.ts')
assert.match(actions, /signInWithPassword/)
assert.match(actions, /auth\.signUp/)
assert.match(actions, /auth\.signOut/)

const confirm = read('app/auth/confirm/route.ts')
assert.match(confirm, /verifyOtp/)
assert.match(confirm, /token_hash/)

const header = read('components/SiteHeader.tsx')
assert.match(header, /nav-jeweled-divider/)
assert.match(header, /FullscreenToggle/)

const footer = read('components/SiteFooter.tsx')
assert.match(footer, /href="\/account"/)
assert.match(footer, /APP_VERSION/)

const css = read('app/globals.css')
assert.match(css, /border-top: 1px solid color-mix\(in srgb, var\(--forest\)/)
assert.match(css, /\.auth-grid/)
assert.match(css, /\.auth-card/)
assert.match(css, /\.auth-message-success/)
assert.match(css, /url\('\/rpgyw-map-tan\.png'\)/)

console.log('RPG Your Way 1.5.0.1 Supabase account foundation passed validation.')
