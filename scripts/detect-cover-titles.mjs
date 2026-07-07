#!/usr/bin/env node
/**
 * detect-cover-titles — free, local, no-credits cover-title detector.
 *
 * Game box art (IGDB covers) usually has the title baked into the artwork, so a
 * card that *also* prints the title shows the name twice. This script figures out
 * WHICH covers already contain the title, once, offline — and writes a small
 * static list the frontend reads. No paid AI, no runtime cost, no DB changes.
 *
 * Providers (pluggable — the future-market path is a local vision model):
 *   --provider tesseract  (default) OCR via tesseract.js — pure JS/WASM, zero install
 *   --provider ollama      local vision LLM (moondream/llava) via Ollama — best accuracy
 *
 * Usage:
 *   node scripts/detect-cover-titles.mjs --limit 40            # sample run
 *   node scripts/detect-cover-titles.mjs --all                 # whole catalog (slow, one-time)
 *   node scripts/detect-cover-titles.mjs --provider ollama --all
 *
 * Output:
 *   src/data/coverTitleSlugs.json                 slugs whose cover has the title baked in
 *   <scratch>/cover-title-report.json (--report)  full per-game detail for auditing
 *   .cache/cover-title-progress.json              resumable progress (safe to delete)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'coverTitleSlugs.json')
const PROGRESS_FILE = path.join(ROOT, '.cache', 'cover-title-progress.json')

// ---- args ------------------------------------------------------------------
const args = process.argv.slice(2)
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return def
  const next = args[i + 1]
  return next && !next.startsWith('--') ? next : true
}
const API_BASE = String(flag('api', 'http://localhost:4000/api'))
const PROVIDER = String(flag('provider', 'tesseract'))
const LIMIT = flag('all', false) ? Infinity : Number(flag('limit', 40))
const REPORT = Boolean(flag('report', false))
const MIN_TOKEN = Number(flag('min-token', 4)) // shortest title word we trust from OCR

// ---- title / OCR normalisation ---------------------------------------------
const STOP = new Set([
  'the', 'of', 'a', 'an', 'and', 'to', 'in', 'on', 'for', 'edition', 'remastered',
  'remaster', 'complete', 'definitive', 'goty', 'game', 'year', 'deluxe', 'ultimate',
  'remake', 'hd', 'collection', 'enhanced', 'directors', 'cut', 'anniversary',
])

const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// significant, trustworthy tokens from the game's real title
function titleTokens(title) {
  return norm(title)
    .split(' ')
    .filter((t) => t.length >= MIN_TOKEN && !STOP.has(t))
}

// Decide if the OCR text contains enough of the title to call it "baked in".
function matchTitle(title, ocrText) {
  const tokens = titleTokens(title)
  if (!tokens.length) return { hasTitle: false, matched: [] }
  const ocrNorm = norm(ocrText)
  const ocrTight = ocrNorm.replace(/\s+/g, '') // stylised fonts split words oddly
  const matched = tokens.filter((t) => ocrNorm.includes(t) || ocrTight.includes(t))
  // one distinctive word (>=5) or two decent words is a confident hit
  const strong = matched.some((t) => t.length >= 5) || matched.length >= 2
  return { hasTitle: strong, matched }
}

// ---- image fetch -----------------------------------------------------------
function upsize(url) {
  // OCR needs legible text — make sure we pull a reasonable cover size, not a thumb.
  return url.replace(/\/t_[^/]+\//, '/t_cover_big/')
}
async function fetchImage(url) {
  const res = await fetch(upsize(url))
  if (!res.ok) throw new Error(`image ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ---- providers -------------------------------------------------------------
async function makeTesseract() {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  return {
    async read(buf) {
      const { data } = await worker.recognize(buf)
      return data.text || ''
    },
    async close() { await worker.terminate() },
  }
}

// Local vision LLM via Ollama (http://localhost:11434). The "future" path: a small
// on-device VLM reads stylised logos far better than OCR, still $0 and offline.
function makeOllama() {
  const model = String(flag('model', process.env.OLLAMA_MODEL || 'moondream'))
  const host = String(process.env.OLLAMA_HOST || 'http://localhost:11434')
  return {
    // returns a synthetic "ocr text" of just the title when the model says yes,
    // so the same matchTitle() path decides — keeps providers interchangeable.
    async read(buf, title) {
      const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `This is a video game cover. Does the artwork contain the game's title text "${title}" (any of those words rendered as part of the image)? Answer only "yes" or "no".`,
          images: [buf.toString('base64')],
          stream: false,
        }),
      })
      if (!res.ok) throw new Error(`ollama ${res.status} (is it running? model "${model}" pulled?)`)
      const json = await res.json()
      return /\byes\b/i.test(json.response || '') ? title : ''
    },
    async close() {},
  }
}

// ---- catalog ---------------------------------------------------------------
async function loadCatalog(limit) {
  const games = []
  const seen = new Set()
  for (let page = 1; games.length < limit; page++) {
    const res = await fetch(`${API_BASE}/games/library?sort=popular&limit=60&page=${page}`)
    if (!res.ok) throw new Error(`catalog page ${page}: ${res.status}`)
    const json = await res.json()
    const batch = json.games || []
    if (!batch.length) break
    for (const g of batch) {
      if (g.image && !seen.has(g.slug)) { seen.add(g.slug); games.push({ slug: g.slug, title: g.title, image: g.image }) }
    }
    if (page >= (json.pagination?.totalPages || page)) break
  }
  return games.slice(0, limit === Infinity ? games.length : limit)
}

// ---- io --------------------------------------------------------------------
const readJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return def } }
const writeJson = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2)) }

// ---- main ------------------------------------------------------------------
async function main() {
  console.log(`\ndetect-cover-titles · provider=${PROVIDER} · limit=${LIMIT === Infinity ? 'all' : LIMIT}\n`)
  const games = await loadCatalog(LIMIT)
  console.log(`catalog: ${games.length} games with covers\n`)

  const progress = readJson(PROGRESS_FILE, {}) // slug -> { hasTitle, matched }
  const provider = PROVIDER === 'ollama' ? makeOllama() : await makeTesseract()
  const report = []
  let done = 0

  for (const g of games) {
    done++
    if (progress[g.slug]) {
      report.push({ ...g, ...progress[g.slug], cached: true })
      continue
    }
    try {
      const buf = await fetchImage(g.image)
      const text = await provider.read(buf, g.title)
      const { hasTitle, matched } = matchTitle(g.title, text)
      progress[g.slug] = { hasTitle, matched }
      report.push({ slug: g.slug, title: g.title, hasTitle, matched, ocr: text.replace(/\s+/g, ' ').trim().slice(0, 80) })
      console.log(`${String(done).padStart(4)}/${games.length}  ${hasTitle ? '🏷️  TITLE' : '·  clean '}  ${g.title}${matched.length ? `   [${matched.join(', ')}]` : ''}`)
    } catch (err) {
      progress[g.slug] = { hasTitle: false, matched: [], error: String(err.message || err) }
      report.push({ slug: g.slug, title: g.title, hasTitle: false, error: String(err.message || err) })
      console.log(`${String(done).padStart(4)}/${games.length}  ✕  ${g.title}  (${err.message || err})`)
    }
    if (done % 20 === 0) writeJson(PROGRESS_FILE, progress)
  }

  await provider.close()
  writeJson(PROGRESS_FILE, progress)

  // merge into the shipped list (preserve slugs from prior full runs)
  const existing = new Set(readJson(OUT_FILE, []))
  for (const g of games) {
    if (progress[g.slug]?.hasTitle) existing.add(g.slug)
    else if (progress[g.slug] && progress[g.slug].hasTitle === false) existing.delete(g.slug)
  }
  const flagged = [...existing].sort()
  writeJson(OUT_FILE, flagged)

  const hits = report.filter((r) => r.hasTitle).length
  console.log(`\n✔ ${hits}/${games.length} covers have the title baked in`)
  console.log(`✔ wrote ${flagged.length} slugs → ${path.relative(ROOT, OUT_FILE)}`)
  if (REPORT) {
    const rf = path.join(process.env.TEMP || '/tmp', 'cover-title-report.json')
    writeJson(rf, report)
    console.log(`✔ full report → ${rf}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
