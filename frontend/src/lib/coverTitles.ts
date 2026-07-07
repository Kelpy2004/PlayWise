// Cover-title awareness.
//
// Many game covers (IGDB box art) already have the title baked into the artwork,
// so printing our own title on the card shows the name twice. `coverTitleSlugs`
// is generated offline by `scripts/detect-cover-titles.mjs` — a free, local OCR /
// vision pass — and lists the games whose cover already shows its title. Cards use
// this to drop the redundant caption so the art speaks for itself. Unknown/new
// games default to `false` (safe: caption stays), so nothing breaks before the
// list is regenerated.

import slugs from '../data/coverTitleSlugs.json'

const BAKED = new Set<string>(slugs as string[])

export function coverHasBakedTitle(slug?: string | null): boolean {
  return slug ? BAKED.has(slug) : false
}
