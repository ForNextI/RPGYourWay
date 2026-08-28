import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

function walk(directory: string, extension: string, found: string[] = []) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(relative, extension, found)
    else if (entry.isFile() && entry.name.endsWith(extension)) found.push(relative)
  }
  return found
}

function jsxOpeningTags(source: string, tagName: string) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`<${escaped}\\b[\\s\\S]*?>`, 'g')) ?? []
}

function srgbChannel(value: number) {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string) {
  const normalized = hex.replace('#', '')
  assert.equal(normalized.length, 6, `Expected six-digit hex color, received ${hex}`)
  const r = srgbChannel(Number.parseInt(normalized.slice(0, 2), 16))
  const g = srgbChannel(Number.parseInt(normalized.slice(2, 4), 16))
  const b = srgbChannel(Number.parseInt(normalized.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

const layout = read('app/layout.tsx')
assert.match(layout, /<html lang="en">/)
assert.match(layout, /className="skip-link" href="#main-content"/)

assert.ok(exists('app/accessibility/page.tsx'), 'Missing public accessibility page')
assert.ok(exists('ACCESSIBILITY.md'), 'Missing accessibility engineering standard')
const accessibilityPage = read('app/accessibility/page.tsx')
assert.match(accessibilityPage, /Web Content Accessibility Guidelines/)
assert.match(accessibilityPage, /WCAG<\/abbr> 2\.2 Level AA/)
assert.match(accessibilityPage, /does not claim independent certification/)

const footer = read('components/SiteFooter.tsx')
assert.match(footer, /href="\/accessibility"/)

// Every non-redirect public page keeps a main landmark and a page heading. Play
// and signed-in Start render those semantics inside their client shells.
for (const relative of [
  'app/page.tsx',
  'app/account/page.tsx',
  'app/accessibility/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'app/read/page.tsx',
  'app/script/page.tsx',
  'app/support/page.tsx',
]) {
  const page = read(relative)
  assert.match(page, /<main\b[^>]*id="main-content"/, `${relative}: missing main landmark target`)
  assert.match(page, /<h1\b/, `${relative}: missing page h1`)
}
const startPage = read('app/start/page.tsx')
const startEntry = read('components/aigm/rpgyw-start-entry.tsx')
assert.match(startPage, /<main\b[^>]*id="main-content"/)
assert.match(startPage, /<h1\b/)
assert.match(startEntry, /<main\b[^>]*id="main-content"/)
assert.match(startEntry, /<h1\b/)
const playShell = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(playShell, /<main\b[^>]*id="main-content"/)
assert.match(playShell, /<h1\b/)

const css = read('app/globals.css')
assert.match(css, /RPG Your Way 1\.10\.0 accessibility foundation/)
assert.match(css, /outline: 3px solid var\(--cream-bright\) !important/)
assert.match(css, /0 0 0 5px var\(--forest-deep\) !important/)
assert.match(css, /min-width: 24px/)
assert.match(css, /min-height: 24px/)
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
assert.match(css, /@media \(forced-colors: active\)/)
assert.match(css, /scroll-margin-top: 5\.5rem/)

// Core palette regression checks. Normal text must meet 4.5:1, and the border
// color used to distinguish controls must meet the 3:1 non-text threshold.
assert.ok(contrast('#5f665c', '#fbf2e6') >= 4.5, 'Muted body text lost AA contrast on the main cream surface')
assert.ok(contrast('#07563f', '#fbf2e6') >= 4.5, 'Forest text lost AA contrast on the main cream surface')
assert.ok(contrast('#043a2d', '#fbf2e6') >= 4.5, 'Deep-forest text lost AA contrast on the main cream surface')
assert.ok(contrast('#c1dc4d', '#043a2d') >= 4.5, 'Lime text lost AA contrast on deep forest')
assert.ok(contrast('#9b8a68', '#fbf2e6') >= 3, 'Standard control border lost 3:1 non-text contrast')

const tsxFiles = [...walk('app', '.tsx'), ...walk('components', '.tsx')]
for (const relative of tsxFiles) {
  const source = read(relative)

  // Informative or decorative images both need an alt attribute. Decorative
  // images use alt="" rather than omitting the attribute.
  for (const tagName of ['img', 'Image']) {
    for (const tag of jsxOpeningTags(source, tagName)) {
      assert.match(tag, /\balt\s*=/, `${relative}: <${tagName}> is missing alt`)
    }
  }

  // Custom dialogs must expose a programmatic name.
  for (const tag of source.match(/<[^>]+\brole="dialog"[^>]*>/g) ?? []) {
    assert.match(tag, /\baria-(?:label|labelledby)\s*=/, `${relative}: dialog is missing an accessible name`)
  }

  // Positive tabindex creates a competing keyboard order. tabindex 0 and -1
  // are allowed where a component genuinely needs programmatic focus.
  assert.doesNotMatch(source, /\btabIndex\s*=\s*(?:"[1-9]\d*"|\{\s*[1-9]\d*\s*\})/, `${relative}: positive tabIndex is not allowed`)

  // Ordinary containers must not become pointer-only controls. If an element
  // needs activation semantics, use a real button/link or a purpose-built
  // keyboard-operable widget instead.
  for (const tag of source.match(/<(?:div|span|p|section|article|li)\b[^>]*\bonClick\s*=\s*[^>]*>/g) ?? []) {
    assert.fail(`${relative}: non-interactive element has onClick: ${tag.slice(0, 140)}`)
  }
}

const start = read('components/start/StartOnboarding.tsx')
assert.match(start, /useAccessibleDialog<HTMLElement>/)
assert.match(start, /role="log" aria-live="polite"/)
assert.match(start, /className="start-rating-control" role="group"/)
assert.match(start, /aria-pressed=\{value === number\}/)
assert.match(start, /tabIndex=\{-1\} aria-hidden="true" accept=/)

const deleteAccount = read('components/account/DeleteAccountControl.tsx')
assert.match(deleteAccount, /useAccessibleDialog<HTMLElement>/)
assert.match(deleteAccount, /aria-describedby="delete-account-confirm-help"/)
assert.match(deleteAccount, /aria-invalid=/)

const play = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(play, /aria-label="Your gameplay action or message"/)
assert.match(play, /role="group" aria-label="Dice mode"/)
assert.match(play, /aigm-character-reorder-accessible[\s\S]*?role="group" aria-label=\{`Reorder \${name} in the party`\}/)
assert.match(play, /mobilePanelFocusReadyRef/)
assert.match(play, /role="status" aria-live="polite"/)
assert.doesNotMatch(play, /Drag to reorder this character/)

const tableChat = read('components/multiplayer/TableChatPanel.tsx')
const multiplayerSwitcher = read('components/multiplayer/MultiplayerPanelSwitcher.tsx')
assert.match(tableChat, /role="log"/)
assert.match(tableChat, /aria-live="off"/)
assert.match(tableChat, /role="status" aria-live="polite"/)
assert.match(tableChat, /htmlFor="table-chat-message"/)
assert.match(tableChat, /htmlFor="multiplayer-display-name"/)
assert.match(tableChat, /<fieldset className="aigm-multiplayer-character-choice"/)
assert.match(tableChat, /<legend>Your characters<\/legend>/)
assert.match(tableChat, /Back to Play/)
assert.match(multiplayerSwitcher, /aria-pressed=/)
assert.match(multiplayerSwitcher, /aria-label="Multiplayer side panels"/)

const header = read('components/SiteHeader.tsx')
assert.match(header, /usePathname/)
assert.match(header, /aria-current=/)

const motion = read('components/accessibility/motion-preference.tsx')
assert.match(motion, /prefers-reduced-motion/)
assert.doesNotMatch(motion, /Wardens PC has disabled/)

console.log('RPG Your Way 1.10.0 accessibility regression checks passed.')
