const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { CPUs, GPUs, Laptops } = require('../data/seedHardware')

const CPU_SCORES = Object.fromEntries(CPUs.map((item) => [item.name, item.score]))
const GPU_SCORES = Object.fromEntries(GPUs.map((item) => [item.name, item.score]))
const LAPTOP_LIBRARY = Laptops.map(({ model, cpu, gpu, ram, brand, platform, tags }) => ({
  model,
  cpu,
  gpu,
  ram,
  brand,
  platform,
  tags
}))
const RAM_OPTIONS = [8, 12, 16, 18, 24, 32, 36, 64]
const MAC_COMPATIBLE_SLUGS = new Set(['0-ad', 'supertuxkart', 'battle-for-wesnoth', 'openttd', 'xonotic'])
const STOP_TOKENS = new Set([
  'graphics',
  'gpu',
  'cpu',
  'processor',
  'laptop',
  'notebook',
  'edition',
  'series',
  'gen'
])

function scoreToGrade(ratio) {
  if (ratio >= 1.25) return { grade: 'Excellent', tone: 'good' }
  if (ratio >= 1.0) return { grade: 'Good', tone: 'good' }
  if (ratio >= 0.82) return { grade: 'Playable', tone: 'warn' }
  return { grade: 'Poor', tone: 'bad' }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(value) {
  return normalizeText(value).replace(/[\s.-]+/g, '')
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function upperAlphaSuffix(value) {
  return String(value || '').replace(/[a-z]+$/i, (suffix) => suffix.toUpperCase())
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !STOP_TOKENS.has(token))
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]
}

function parseRamFromText(value, fallback = 0) {
  const matches = [...String(value || '').matchAll(/(\d{1,3})\s*gb/gi)]
  const candidate = matches
    .map((entry) => Number(entry[1]))
    .find((amount) => Number.isFinite(amount) && amount >= 4 && amount <= 128)

  if (candidate) return candidate

  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric >= 4 && numeric <= 128) return numeric

  return fallback
}

function normalizeSupportedPlatforms(game = {}) {
  const supportedPlatforms = game.supportedPlatforms || game.platform || game.platforms || []
  const normalized = supportedPlatforms.map((item) => String(item).toLowerCase())
  if (!normalized.length) return ['windows']
  return normalized
}

function inferPlatformFromHardware(hardware = {}) {
  if (hardware.platform) return String(hardware.platform).toLowerCase()

  const cpu = String(hardware.cpu || '').toLowerCase()
  const gpu = String(hardware.gpu || '').toLowerCase()
  const source = String(hardware.source || '').toLowerCase()

  if (cpu.includes('apple') || gpu.includes('apple') || source.includes('macbook')) {
    return 'macos'
  }

  return 'windows'
}

function buildCpuAliases(name) {
  const normalized = normalizeText(name)
  const aliases = [name, normalized]
  const intelMatch = normalized.match(/(?:intel\s+)?(?:core\s+)?(i[3579])[- ]?(\d{4,5}[a-z]{0,3})/)
  const ultraMatch = normalized.match(/(?:intel\s+)?(?:core\s+)?ultra\s+([579])\s+(\d{3}[a-z]{0,2})/)
  const ryzenMatch = normalized.match(/(?:amd\s+)?(ryzen\s+(?:ai\s+)?[3579]\s+(?:hx\s+)?\d{3,4}[a-z]{0,3})/)
  const appleMatch = normalized.match(/(?:apple\s+)?(m[1234](?:\s+(?:pro|max|ultra))?)/)

  if (intelMatch) {
    aliases.push(
      `${intelMatch[1]} ${intelMatch[2]}`,
      `${intelMatch[1]}-${intelMatch[2]}`,
      intelMatch[2],
      `intel ${intelMatch[1]} ${intelMatch[2]}`
    )
  }

  if (ultraMatch) {
    aliases.push(
      `ultra ${ultraMatch[1]} ${ultraMatch[2]}`,
      `core ultra ${ultraMatch[1]} ${ultraMatch[2]}`,
      ultraMatch[2]
    )
  }

  if (ryzenMatch) {
    const trimmed = ryzenMatch[1].replace(/\s+/g, ' ').trim()
    aliases.push(trimmed, `amd ${trimmed}`, trimmed.split(' ').slice(-1)[0])
  }

  if (appleMatch) {
    aliases.push(appleMatch[1], `apple ${appleMatch[1]}`)
  }

  return uniqueValues(aliases)
}

function buildGpuAliases(name) {
  const normalized = normalizeText(name)
  const aliases = [name, normalized]
  const nvidiaMatch = normalized.match(/(?:nvidia\s+)?(?:geforce\s+)?(rtx|gtx)\s*(\d{3,4})(\s*ti|\s*super)?/)
  const amdMatch = normalized.match(/(?:amd\s+)?(?:radeon\s+)?(rx)\s*(\d{4}[a-z]?)/)
  const radeonMatch = normalized.match(/radeon\s+(\d{3,4}[a-z]?)/)
  const appleMatch = normalized.match(/(?:apple\s+)?(m[1234](?:\s+(?:pro|max))?)\s+gpu/)

  if (nvidiaMatch) {
    const tier = `${nvidiaMatch[1]} ${nvidiaMatch[2]}${nvidiaMatch[3] || ''}`.replace(/\s+/g, ' ').trim()
    aliases.push(tier, `nvidia ${tier}`, `geforce ${tier}`, `${nvidiaMatch[2]}${(nvidiaMatch[3] || '').replace(/\s+/g, '').toLowerCase()}`)
  }

  if (amdMatch) {
    aliases.push(`rx ${amdMatch[2]}`, `amd rx ${amdMatch[2]}`, amdMatch[2])
  }

  if (radeonMatch) {
    aliases.push(`radeon ${radeonMatch[1]}`, radeonMatch[1])
  }

  if (normalized.includes('iris xe')) aliases.push('iris xe', 'intel iris xe')
  if (normalized.includes('uhd')) aliases.push('uhd', 'intel uhd')
  if (normalized.includes('arc')) aliases.push('arc', 'intel arc')

  if (appleMatch) {
    aliases.push(appleMatch[1], `apple ${appleMatch[1]}`, `${appleMatch[1]} gpu`)
  }

  return uniqueValues(aliases)
}

function stripModelSpecs(value) {
  return normalizeText(value)
    .replace(/(?:rtx|gtx|rx)\s*\d{3,4}[a-z]?(?:\s*ti|\s*super)?/g, ' ')
    .replace(/(?:iris xe|intel arc|intel uhd|radeon\s+\d{3,4}[a-z]?)/g, ' ')
    .replace(/(?:i[3579][- ]?\d{4,5}[a-z]{0,3}|ultra\s+[579]\s+\d{3}[a-z]{0,2}|ryzen\s+(?:ai\s+)?[3579]\s+(?:hx\s+)?\d{3,4}[a-z]{0,3}|m[1234](?:\s+(?:pro|max|ultra))?)/g, ' ')
    .replace(/\d{1,3}\s*gb/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildLaptopAliases(entry) {
  const base = stripModelSpecs(`${entry.brand || ''} ${entry.model}`)

  return uniqueValues([
    entry.model,
    `${entry.brand || ''} ${entry.model}`,
    base,
    `${base} ${entry.gpu}`,
    `${base} ${entry.cpu}`,
    `${base} ${entry.ram}GB`,
    `${entry.brand || ''} ${base}`.trim()
  ])
}

function buildAliasRows(entityKind, entries, getName, aliasBuilder) {
  const rows = []

  for (const entry of entries) {
    const canonicalName = getName(entry)
    for (const alias of aliasBuilder(entry)) {
      rows.push({
        entityKind,
        alias,
        canonicalName
      })
    }
  }

  return rows
}

async function ensureHardwareSeeded() {
  if (!isDatabaseReady()) return

  const prisma = getPrisma()
  const [cpuCount, gpuCount, laptopCount, aliasCount] = await Promise.all([
    prisma.cpu.count(),
    prisma.gpu.count(),
    prisma.laptop.count(),
    prisma.hardwareAlias.count()
  ])

  if (!cpuCount) {
    await prisma.cpu.createMany({ data: CPUs, skipDuplicates: true })
  }

  if (!gpuCount) {
    await prisma.gpu.createMany({ data: GPUs, skipDuplicates: true })
  }

  if (!laptopCount) {
    await prisma.laptop.createMany({
      data: Laptops.map((entry) => ({
        ...entry,
        tags: entry.tags || []
      })),
      skipDuplicates: true
    })
  }

  if (!aliasCount) {
    const aliasRows = [
      ...buildAliasRows('CPU', CPUs, (entry) => entry.name, (entry) => buildCpuAliases(entry.name)),
      ...buildAliasRows('GPU', GPUs, (entry) => entry.name, (entry) => buildGpuAliases(entry.name)),
      ...buildAliasRows('LAPTOP', Laptops, (entry) => entry.model, buildLaptopAliases)
    ]

    if (aliasRows.length) {
      await prisma.hardwareAlias.createMany({
        data: aliasRows,
        skipDuplicates: true
      })
    }
  }
}

async function getHardwareCatalog() {
  if (!isDatabaseReady()) {
    return {
      cpus: CPUs,
      gpus: GPUs,
      laptops: Laptops,
      ramOptions: RAM_OPTIONS
    }
  }

  const prisma = getPrisma()
  const [cpus, gpus, laptops] = await Promise.all([
    prisma.cpu.findMany({ orderBy: { name: 'asc' } }),
    prisma.gpu.findMany({ orderBy: { name: 'asc' } }),
    prisma.laptop.findMany({ orderBy: { model: 'asc' } })
  ])

  if (!cpus.length || !gpus.length || !laptops.length) {
    return {
      cpus: CPUs,
      gpus: GPUs,
      laptops: Laptops,
      ramOptions: RAM_OPTIONS
    }
  }

  return { cpus, gpus, laptops, ramOptions: RAM_OPTIONS }
}

async function getAliasLookup(kind) {
  if (!isDatabaseReady()) {
    return new Map()
  }

  const entityKind = kind.toUpperCase()
  const aliases = await getPrisma().hardwareAlias.findMany({
    where: { entityKind },
    orderBy: { alias: 'asc' }
  })

  const lookup = new Map()
  for (const alias of aliases) {
    const bucket = lookup.get(alias.canonicalName) || []
    bucket.push(alias.alias)
    lookup.set(alias.canonicalName, bucket)
  }

  return lookup
}

function scoreCandidate(query, candidateStrings) {
  const trimmedQuery = String(query || '').trim()
  if (!trimmedQuery) return 0

  const normalizedQuery = normalizeText(trimmedQuery)
  const compactQuery = compactText(trimmedQuery)
  const queryTokens = tokenize(trimmedQuery)
  let best = 0

  for (const candidate of candidateStrings) {
    const normalizedCandidate = normalizeText(candidate)
    const compactCandidate = compactText(candidate)
    const candidateTokens = new Set(tokenize(candidate))
    let score = 0

    if (!normalizedCandidate) continue

    if (normalizedCandidate === normalizedQuery || compactCandidate === compactQuery) {
      score = 100
    } else {
      if (normalizedCandidate.includes(normalizedQuery) || compactCandidate.includes(compactQuery)) {
        score += 62
      }

      if (normalizedQuery.includes(normalizedCandidate) && normalizedCandidate.length >= 5) {
        score += 40
      }

      let matchedTokens = 0
      for (const token of queryTokens) {
        if (candidateTokens.has(token) || compactCandidate.includes(token.replace(/\s+/g, ''))) {
          matchedTokens += 1
        }
      }

      if (matchedTokens) {
        score += matchedTokens * 12
        if (matchedTokens === queryTokens.length) score += 10
      }

      if (compactCandidate.startsWith(compactQuery) || compactQuery.startsWith(compactCandidate)) {
        score += 8
      }
    }

    if (score > best) best = Math.min(score, 100)
  }

  return best
}

function sortMatches(matches) {
  return matches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.label.localeCompare(right.label)
  })
}

function buildCpuSuggestion(entry, score, matchType, query) {
  return {
    kind: 'cpu',
    label: entry.name,
    value: query && score < 90 ? query : entry.name,
    matchValue: entry.name,
    meta: `${entry.score} performance score${entry.family ? ` • ${entry.family}` : ''}`,
    confidence: Number((score / 100).toFixed(2)),
    matchType
  }
}

function buildGpuSuggestion(entry, score, matchType, query) {
  return {
    kind: 'gpu',
    label: entry.name,
    value: query && score < 90 ? query : entry.name,
    matchValue: entry.name,
    meta: `${entry.score} performance score${entry.family ? ` • ${entry.family}` : ''}`,
    confidence: Number((score / 100).toFixed(2)),
    matchType
  }
}

function buildLaptopSuggestion(entry, score, matchType, query) {
  return {
    kind: 'laptop',
    label: entry.model,
    value: query && score < 90 ? query : entry.model,
    matchValue: entry.model,
    meta: [entry.cpu, entry.gpu, `${entry.ram} GB RAM`].filter(Boolean).join(' • '),
    confidence: Number((score / 100).toFixed(2)),
    matchType
  }
}

async function findTopMatches(kind, query, limit = 6) {
  const catalog = await getHardwareCatalog()
  const aliasLookup = await getAliasLookup(kind)
  const sourceEntries =
    kind === 'cpu' ? catalog.cpus : kind === 'gpu' ? catalog.gpus : catalog.laptops

  const matches = sourceEntries
    .map((entry) => {
      const label = kind === 'laptop' ? entry.model : entry.name
      const aliases = aliasLookup.get(label) || []
      const searchStrings =
        kind === 'laptop'
          ? uniqueValues([label, `${entry.brand || ''} ${entry.model}`, ...buildLaptopAliases(entry), ...aliases])
          : kind === 'cpu'
            ? uniqueValues([label, ...buildCpuAliases(entry.name), ...aliases])
            : uniqueValues([label, ...buildGpuAliases(entry.name), ...aliases])

      const score = scoreCandidate(query, searchStrings)
      if (!score) return null

      return {
        entry,
        label,
        score
      }
    })
    .filter(Boolean)

  return sortMatches(matches).slice(0, limit)
}

function inferCpuScore(name) {
  const normalized = normalizeText(name)
  const appleMatch = normalized.match(/m([1234])(?:\s+(pro|max|ultra))?/)
  if (appleMatch) {
    const base = { 1: 82, 2: 92, 3: 104, 4: 116 }[appleMatch[1]] || 92
    const tierBonus = { pro: 14, max: 30, ultra: 40 }[appleMatch[2]] || 0
    return base + tierBonus
  }

  const ultraMatch = normalized.match(/ultra\s+([579])\s+(\d{3})([a-z]{0,2})/)
  if (ultraMatch) {
    const tierBase = { 5: 86, 7: 102, 9: 118 }[ultraMatch[1]] || 90
    const suffixBonus = ultraMatch[3].includes('h') ? 4 : 0
    return tierBase + suffixBonus
  }

  const intelMatch = normalized.match(/i([3579])[- ]?(\d{4,5})([a-z]{0,3})/)
  if (intelMatch) {
    const tierBase = { 3: 32, 5: 46, 7: 60, 9: 76 }[intelMatch[1]] || 42
    const modelNumber = intelMatch[2]
    const generation = modelNumber.length === 5 ? Number(modelNumber.slice(0, 2)) : Number(modelNumber.charAt(0))
    const generationBonus = Math.max(0, generation - 10) * 4
    const suffix = intelMatch[3].toLowerCase()
    const suffixBonus =
      suffix.includes('hx') ? 18 : suffix.includes('hk') ? 14 : suffix.includes('h') ? 10 : suffix.includes('f') ? 14 : suffix.includes('u') ? 2 : 8
    return tierBase + generationBonus + suffixBonus
  }

  const ryzenMatch = normalized.match(/ryzen\s+(?:ai\s+)?([3579])\s+(?:hx\s+)?(\d{3,4})([a-z]{0,3})/)
  if (ryzenMatch) {
    const tierBase = { 3: 34, 5: 50, 7: 66, 9: 82 }[ryzenMatch[1]] || 46
    const seriesDigit = Number(String(ryzenMatch[2]).charAt(0))
    const seriesBonus = Math.max(0, seriesDigit - 5) * 8
    const suffix = ryzenMatch[3].toLowerCase()
    const suffixBonus =
      suffix.includes('hx') ? 16 : suffix.includes('hs') ? 12 : suffix.includes('h') ? 10 : suffix.includes('u') ? 2 : suffix.includes('x') ? 12 : 8
    const aiBonus = normalized.includes('ryzen ai') ? 10 : 0
    return tierBase + seriesBonus + suffixBonus + aiBonus
  }

  return null
}

function inferGpuScore(name) {
  const normalized = normalizeText(name)

  if (normalized.includes('iris xe')) return 20
  if (normalized.includes('uhd')) return 12
  if (normalized.includes('intel arc')) return 36

  const appleMatch = normalized.match(/m([1234])(?:\s+(pro|max))?(?:\s+gpu)?/)
  if (appleMatch) {
    const base = { 1: 40, 2: 46, 3: 54, 4: 66 }[appleMatch[1]] || 40
    const tierBonus = { pro: 20, max: 48 }[appleMatch[2]] || 0
    return base + tierBonus
  }

  const nvidiaMatch = normalized.match(/(rtx|gtx)\s*(\d{3,4})(\s*ti|\s*super)?/)
  if (nvidiaMatch) {
    const family = nvidiaMatch[1]
    const tier = Number(nvidiaMatch[2])
    const suffix = normalizeText(nvidiaMatch[3] || '')

    if (family === 'gtx') {
      if (tier <= 1050) return 24
      if (tier <= 1650) return 38
      if (tier <= 1660) return 48
      return 52
    }

    const exactMap = {
      2050: 44,
      2060: 54,
      2070: 66,
      2080: 78,
      3050: 58,
      3060: 72,
      3070: 88,
      3080: 112,
      4050: 78,
      4060: 90,
      4070: 104,
      4080: 128,
      4090: 145
    }

    let score = exactMap[tier] || 62
    if (suffix.includes('ti')) score += 4
    if (suffix.includes('super')) score += 6
    return score
  }

  const rxMatch = normalized.match(/rx\s*(\d{4})([a-z]?)/)
  if (rxMatch) {
    const tier = Number(rxMatch[1])
    const suffix = rxMatch[2].toLowerCase()
    let score = 50

    if (tier >= 7600) score = 86
    else if (tier >= 6700) score = 74
    else if (tier >= 6600) score = 64
    else if (tier >= 6500) score = 46
    else if (tier >= 5700) score = 52
    else if (tier >= 570) score = 36

    if (suffix === 'm') score += 2
    if (suffix === 's') score += 4
    return score
  }

  const radeonMatch = normalized.match(/radeon\s+(\d{3,4})([a-z]?)/)
  if (radeonMatch) {
    const tier = Number(radeonMatch[1])
    if (tier >= 780) return 46
    if (tier >= 680) return 34
  }

  return null
}

function canonicalizeCpuToken(value) {
  const normalized = normalizeText(value)
  const ultraMatch = normalized.match(/(?:core\s+)?ultra\s+([579])\s+(\d{3}[a-z]{0,2})/)
  if (ultraMatch) {
    return `Intel Core Ultra ${ultraMatch[1]} ${upperAlphaSuffix(ultraMatch[2])}`
  }

  const intelMatch = normalized.match(/(i[3579])[- ]?(\d{4,5}[a-z]{0,3})/)
  if (intelMatch) {
    return `Intel Core ${intelMatch[1]}-${upperAlphaSuffix(intelMatch[2])}`
  }

  const ryzenMatch = normalized.match(/(ryzen\s+(?:ai\s+)?[3579]\s+(?:hx\s+)?\d{3,4}[a-z]{0,3})/)
  if (ryzenMatch) {
    return `AMD ${titleCase(upperAlphaSuffix(ryzenMatch[1]))}`
  }

  const appleMatch = normalized.match(/(m[1234](?:\s+(?:pro|max|ultra))?)/)
  if (appleMatch) {
    return `Apple ${titleCase(appleMatch[1])}`
  }

  return titleCase(value)
}

function canonicalizeGpuToken(value) {
  const normalized = normalizeText(value)
  const nvidiaMatch = normalized.match(/(rtx|gtx)\s*(\d{3,4})(\s*ti|\s*super)?/)
  if (nvidiaMatch) {
    const suffix = titleCase(normalizeText(nvidiaMatch[3] || ''))
    return `NVIDIA ${nvidiaMatch[1].toUpperCase()} ${nvidiaMatch[2]}${suffix ? ` ${suffix}` : ''}`
  }

  const rxMatch = normalized.match(/rx\s*(\d{4})([a-z]?)/)
  if (rxMatch) {
    return `AMD RX ${rxMatch[1]}${rxMatch[2] ? rxMatch[2].toUpperCase() : ''}`
  }

  if (normalized.includes('iris xe')) return 'Intel Iris Xe Graphics'
  if (normalized.includes('uhd')) return 'Intel UHD Graphics'
  if (normalized.includes('intel arc')) return 'Intel Arc Graphics'

  const radeonMatch = normalized.match(/radeon\s+(\d{3,4}[a-z]?)/)
  if (radeonMatch) {
    return `AMD Radeon ${radeonMatch[1].toUpperCase()}`
  }

  const appleMatch = normalized.match(/(m[1234](?:\s+(?:pro|max))?)(?:\s+gpu)?/)
  if (appleMatch) {
    return `Apple ${titleCase(appleMatch[1])} GPU`
  }

  return titleCase(value)
}

function extractCpuToken(value) {
  const source = normalizeText(value)
  const patterns = [
    /(?:intel\s+)?(?:core\s+)?ultra\s+[579]\s+\d{3}[a-z]{0,2}/i,
    /(?:intel\s+)?(?:core\s+)?i[3579][ -]?\d{4,5}[a-z]{0,3}/i,
    /(?:amd\s+)?ryzen\s+(?:ai\s+)?[3579]\s+(?:hx\s+)?\d{3,4}[a-z]{0,3}/i,
    /(?:apple\s+)?m[1234](?:\s+(?:pro|max|ultra))?/i
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match) return match[0]
  }

  return ''
}

function extractGpuToken(value) {
  const source = normalizeText(value)
  const patterns = [
    /(?:nvidia\s+)?(?:geforce\s+)?(?:rtx|gtx)\s*\d{3,4}(?:\s*ti|\s*super)?/i,
    /(?:amd\s+)?(?:radeon\s+)?rx\s*\d{4}[a-z]?/i,
    /radeon\s+\d{3,4}[a-z]?/i,
    /intel\s+arc/i,
    /iris\s+xe/i,
    /uhd\s+graphics/i,
    /(?:apple\s+)?m[1234](?:\s+(?:pro|max))?\s+gpu/i
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match) return match[0]
  }

  return ''
}

function namesLikelyMatch(left, right) {
  const leftCompact = compactText(left)
  const rightCompact = compactText(right)
  return leftCompact === rightCompact || leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact)
}

async function resolveCpuInput(value, existingCatalog) {
  const query = String(value || '').trim()
  if (!query) return null

  const topMatches = await findTopMatches('cpu', query, 3)
  const bestMatch = topMatches[0]
  if (bestMatch && bestMatch.score >= 60) {
    return {
      name: bestMatch.entry.name,
      score: bestMatch.entry.score,
      confidence: Number((bestMatch.score / 100).toFixed(2)),
      matchType: bestMatch.score >= 95 ? 'exact' : 'catalog',
      notes: [`Matched CPU input to ${bestMatch.entry.name}.`]
    }
  }

  const token = extractCpuToken(query)
  if (token) {
    const canonical = canonicalizeCpuToken(token)
    const fallbackMatch =
      bestMatch && namesLikelyMatch(bestMatch.entry.name, canonical) ? bestMatch.entry : null
    const inferredScore = fallbackMatch?.score || inferCpuScore(canonical)

    if (inferredScore) {
      return {
        name: fallbackMatch?.name || canonical,
        score: inferredScore,
        confidence: fallbackMatch ? Number((Math.max(bestMatch.score, 68) / 100).toFixed(2)) : 0.58,
        matchType: fallbackMatch ? 'catalog' : 'inferred',
        notes: [
          fallbackMatch
            ? `Mapped CPU token to ${fallbackMatch.name}.`
            : `Estimated CPU score from detected processor family ${canonical}.`
        ]
      }
    }
  }

  const catalog = existingCatalog || (await getHardwareCatalog())
  const compactQuery = compactText(query)
  const nearEntry = catalog.cpus.find((entry) => compactText(entry.name).includes(compactQuery))
  if (nearEntry) {
    return {
      name: nearEntry.name,
      score: nearEntry.score,
      confidence: 0.46,
      matchType: 'approximate',
      notes: [`Used the nearest known CPU match ${nearEntry.name}.`]
    }
  }

  return null
}

async function resolveGpuInput(value, existingCatalog) {
  const query = String(value || '').trim()
  if (!query) return null

  const topMatches = await findTopMatches('gpu', query, 3)
  const bestMatch = topMatches[0]
  if (bestMatch && bestMatch.score >= 60) {
    return {
      name: bestMatch.entry.name,
      score: bestMatch.entry.score,
      confidence: Number((bestMatch.score / 100).toFixed(2)),
      matchType: bestMatch.score >= 95 ? 'exact' : 'catalog',
      notes: [`Matched GPU input to ${bestMatch.entry.name}.`]
    }
  }

  const token = extractGpuToken(query)
  if (token) {
    const canonical = canonicalizeGpuToken(token)
    const fallbackMatch =
      bestMatch && namesLikelyMatch(bestMatch.entry.name, canonical) ? bestMatch.entry : null
    const inferredScore = fallbackMatch?.score || inferGpuScore(canonical)

    if (inferredScore) {
      return {
        name: fallbackMatch?.name || canonical,
        score: inferredScore,
        confidence: fallbackMatch ? Number((Math.max(bestMatch.score, 68) / 100).toFixed(2)) : 0.56,
        matchType: fallbackMatch ? 'catalog' : 'inferred',
        notes: [
          fallbackMatch
            ? `Mapped GPU token to ${fallbackMatch.name}.`
            : `Estimated GPU score from detected graphics family ${canonical}.`
        ]
      }
    }
  }

  const catalog = existingCatalog || (await getHardwareCatalog())
  const compactQuery = compactText(query)
  const nearEntry = catalog.gpus.find((entry) => compactText(entry.name).includes(compactQuery))
  if (nearEntry) {
    return {
      name: nearEntry.name,
      score: nearEntry.score,
      confidence: 0.44,
      matchType: 'approximate',
      notes: [`Used the nearest known GPU match ${nearEntry.name}.`]
    }
  }

  return null
}

function detectBrand(value) {
  const normalized = normalizeText(value)
  const brands = [
    'acer',
    'asus',
    'alienware',
    'apple',
    'dell',
    'framework',
    'gigabyte',
    'hp',
    'lenovo',
    'microsoft',
    'msi',
    'razer',
    'samsung'
  ]

  const found = brands.find((brand) => normalized.includes(brand))
  return found ? titleCase(found) : undefined
}

async function resolveLaptopInput(value, catalog) {
  const query = String(value || '').trim()
  if (!query) return null

  const topMatches = await findTopMatches('laptop', query, 4)
  const bestMatch = topMatches[0]
  const parsedRam = parseRamFromText(query, 0)
  const parsedCpu = await resolveCpuInput(extractCpuToken(query) || query, catalog)
  const parsedGpu = await resolveGpuInput(extractGpuToken(query) || query, catalog)

  if (bestMatch && bestMatch.score >= 52) {
    const matchedLaptop = bestMatch.entry
    const cpuResolution =
      parsedCpu && !namesLikelyMatch(parsedCpu.name, matchedLaptop.cpu)
        ? parsedCpu
        : { name: matchedLaptop.cpu, score: (await resolveCpuInput(matchedLaptop.cpu, catalog))?.score || 30, confidence: 0.92, notes: [] }
    const gpuResolution =
      parsedGpu && !namesLikelyMatch(parsedGpu.name, matchedLaptop.gpu)
        ? parsedGpu
        : { name: matchedLaptop.gpu, score: (await resolveGpuInput(matchedLaptop.gpu, catalog))?.score || 25, confidence: 0.92, notes: [] }

    const notes = [`Matched laptop input to ${matchedLaptop.model}.`]
    if (parsedCpu && !namesLikelyMatch(parsedCpu.name, matchedLaptop.cpu)) {
      notes.push(`Adjusted CPU to parsed value ${parsedCpu.name}.`)
    }
    if (parsedGpu && !namesLikelyMatch(parsedGpu.name, matchedLaptop.gpu)) {
      notes.push(`Adjusted GPU to parsed value ${parsedGpu.name}.`)
    }
    if (parsedRam && parsedRam !== matchedLaptop.ram) {
      notes.push(`Adjusted RAM to parsed value ${parsedRam} GB.`)
    }

    return {
      cpu: cpuResolution.name,
      cpuScore: cpuResolution.score,
      gpu: gpuResolution.name,
      gpuScore: gpuResolution.score,
      ram: parsedRam || matchedLaptop.ram || 8,
      source: matchedLaptop.model,
      platform: matchedLaptop.platform || inferPlatformFromHardware(matchedLaptop),
      brand: matchedLaptop.brand,
      tags: matchedLaptop.tags || [],
      confidence: Number((bestMatch.score / 100).toFixed(2)),
      matchType: bestMatch.score >= 95 ? 'exact' : 'catalog',
      notes
    }
  }

  if (parsedCpu || parsedGpu) {
    const notes = ['Used parsed hardware details from the typed laptop/model string.']
    if (!parsedCpu) notes.push('CPU could not be matched exactly, so a conservative default may be used.')
    if (!parsedGpu) notes.push('GPU could not be matched exactly, so a conservative default may be used.')

    return {
      cpu: parsedCpu?.name || 'Unknown CPU',
      cpuScore: parsedCpu?.score || null,
      gpu: parsedGpu?.name || 'Unknown GPU',
      gpuScore: parsedGpu?.score || null,
      ram: parsedRam || 16,
      source: query,
      platform: inferPlatformFromHardware({ cpu: parsedCpu?.name, gpu: parsedGpu?.name, source: query }),
      brand: detectBrand(query),
      tags: ['parsed'],
      confidence: Math.max(parsedCpu?.confidence || 0, parsedGpu?.confidence || 0, parsedRam ? 0.42 : 0.3),
      matchType: 'parsed',
      notes
    }
  }

  return null
}

async function searchHardware(kind, query, limit = 6) {
  const trimmedQuery = String(query || '').trim()
  if (!trimmedQuery) return []

  const matches = await findTopMatches(kind, trimmedQuery, limit)
  const suggestions =
    kind === 'cpu'
      ? matches.map((match) =>
          buildCpuSuggestion(match.entry, match.score, match.score >= 95 ? 'exact' : 'catalog', trimmedQuery)
        )
      : kind === 'gpu'
        ? matches.map((match) =>
            buildGpuSuggestion(match.entry, match.score, match.score >= 95 ? 'exact' : 'catalog', trimmedQuery)
          )
        : matches.map((match) =>
            buildLaptopSuggestion(match.entry, match.score, match.score >= 95 ? 'exact' : 'catalog', trimmedQuery)
          )

  if (kind === 'laptop') {
    const catalog = await getHardwareCatalog()
    const parsed = await resolveLaptopInput(trimmedQuery, catalog)
    if (
      parsed &&
      !suggestions.some((item) => compactText(item.matchValue || item.label) === compactText(parsed.source))
    ) {
      suggestions.unshift({
        kind: 'laptop',
        label: parsed.source,
        value: trimmedQuery,
        matchValue: parsed.source,
        meta: [parsed.cpu, parsed.gpu, `${parsed.ram} GB RAM`].filter(Boolean).join(' • '),
        confidence: Number((parsed.confidence || 0.5).toFixed(2)),
        matchType: parsed.matchType || 'parsed'
      })
    }
  }

  if (kind === 'cpu') {
    const catalog = await getHardwareCatalog()
    const parsed = await resolveCpuInput(trimmedQuery, catalog)
    if (
      parsed &&
      !suggestions.some((item) => compactText(item.matchValue || item.label) === compactText(parsed.name))
    ) {
      suggestions.unshift({
        kind: 'cpu',
        label: parsed.name,
        value: trimmedQuery,
        matchValue: parsed.name,
        meta: `${parsed.score} performance score • ${parsed.matchType}`,
        confidence: Number((parsed.confidence || 0.5).toFixed(2)),
        matchType: parsed.matchType || 'parsed'
      })
    }
  }

  if (kind === 'gpu') {
    const catalog = await getHardwareCatalog()
    const parsed = await resolveGpuInput(trimmedQuery, catalog)
    if (
      parsed &&
      !suggestions.some((item) => compactText(item.matchValue || item.label) === compactText(parsed.name))
    ) {
      suggestions.unshift({
        kind: 'gpu',
        label: parsed.name,
        value: trimmedQuery,
        matchValue: parsed.name,
        meta: `${parsed.score} performance score • ${parsed.matchType}`,
        confidence: Number((parsed.confidence || 0.5).toFixed(2)),
        matchType: parsed.matchType || 'parsed'
      })
    }
  }

  const deduped = []
  const seen = new Set()
  for (const suggestion of suggestions) {
    const key = `${suggestion.kind}:${compactText(suggestion.matchValue || suggestion.label)}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(suggestion)
  }

  return deduped.slice(0, limit)
}

async function normalizeHardwareInput(input = {}) {
  const catalog = await getHardwareCatalog()
  const notes = []

  if (input.laptop) {
    const laptop = await resolveLaptopInput(input.laptop, catalog)
    if (laptop) {
      return {
        cpu: laptop.cpu,
        cpuScore: laptop.cpuScore,
        gpu: laptop.gpu,
        gpuScore: laptop.gpuScore,
        ram: Number(laptop.ram) || 8,
        source: laptop.source,
        brand: laptop.brand,
        platform: laptop.platform || inferPlatformFromHardware(laptop),
        tags: laptop.tags || [],
        confidence: laptop.confidence,
        matchType: laptop.matchType,
        notes: laptop.notes || []
      }
    }

    notes.push('No exact laptop preset was found, so PlayWise fell back to manual parsing.')
  }

  const cpuResolution = await resolveCpuInput(input.cpu, catalog)
  const gpuResolution = await resolveGpuInput(input.gpu, catalog)
  const ram =
    parseRamFromText(input.ram, 0) ||
    parseRamFromText(input.laptop, 0) ||
    parseRamFromText(input.cpu, 0) ||
    parseRamFromText(input.gpu, 0) ||
    8

  if (cpuResolution?.notes?.length) notes.push(...cpuResolution.notes)
  if (gpuResolution?.notes?.length) notes.push(...gpuResolution.notes)

  return {
    cpu: cpuResolution?.name || String(input.cpu || '').trim() || 'Unknown CPU',
    cpuScore: cpuResolution?.score || Number(input.cpuScore) || null,
    gpu: gpuResolution?.name || String(input.gpu || '').trim() || 'Unknown GPU',
    gpuScore: gpuResolution?.score || Number(input.gpuScore) || null,
    ram,
    source: input.source || 'Manual entry',
    platform: inferPlatformFromHardware({
      cpu: cpuResolution?.name || input.cpu,
      gpu: gpuResolution?.name || input.gpu,
      source: input.source
    }),
    confidence: Math.max(cpuResolution?.confidence || 0, gpuResolution?.confidence || 0),
    matchType: cpuResolution?.matchType || gpuResolution?.matchType || 'manual',
    notes
  }
}

async function estimatePerformance(game, rawHardware) {
  const hardware = await normalizeHardwareInput(rawHardware)
  const cpuScore = Number(hardware.cpuScore) || Number(rawHardware.cpuScore) || 30
  const gpuScore = Number(hardware.gpuScore) || Number(rawHardware.gpuScore) || 25
  const ram = Number(hardware.ram) || 8
  const platform = inferPlatformFromHardware(hardware)
  const supportedPlatforms = normalizeSupportedPlatforms(game)

  const isMacUnsupported =
    platform === 'macos' && !supportedPlatforms.includes('macos') && !MAC_COMPATIBLE_SLUGS.has(game.slug)

  if (isMacUnsupported) {
    return {
      canRun: 'Not supported',
      performance: 'Unsupported on macOS',
      tone: 'bad',
      recommendedPreset: 'Unavailable',
      fps: { low: '—', medium: '—', high: '—' },
      expectedFps: 'No native support expected',
      warning: 'This macOS setup is not supported for this game in the current PlayWise catalog.',
      source: hardware.source || 'Typed hardware',
      platform,
      details: ['Use a Windows PC or another supported platform for this title.', ...(hardware.notes || [])]
    }
  }

  const minimumCpu = game.requirements?.minimum?.cpuScore || 25
  const minimumGpu = game.requirements?.minimum?.gpuScore || 20
  const minimumRam = game.requirements?.minimum?.ram || 8

  const recommendedCpu = game.requirements?.recommended?.cpuScore || minimumCpu
  const recommendedGpu = game.requirements?.recommended?.gpuScore || minimumGpu
  const recommendedRam = game.requirements?.recommended?.ram || minimumRam

  const cpuRatio = cpuScore / recommendedCpu
  const gpuRatio = gpuScore / recommendedGpu
  const ramRatio = ram / recommendedRam
  const overall = cpuRatio * 0.35 + gpuRatio * 0.45 + ramRatio * 0.2
  const status = scoreToGrade(overall)

  const lowBase = Math.max(18, Math.round(28 + overall * 38))
  const mediumBase = Math.max(16, Math.round(lowBase * 0.82))
  const highBase = Math.max(14, Math.round(lowBase * 0.68))

  let expectedFps = 'Under 35 FPS without major compromises'
  if (overall >= 1.2) expectedFps = '90+ FPS in optimized scenes'
  else if (overall >= 1.0) expectedFps = '60+ FPS with recommended settings'
  else if (overall >= 0.82) expectedFps = '35-55 FPS with tuned settings'

  const comparisonDetails = [
    `CPU used: ${hardware.cpu} (${cpuScore})`,
    `GPU used: ${hardware.gpu} (${gpuScore})`,
    `RAM used: ${ram} GB`,
    `Compared against recommended target ${recommendedCpu}/${recommendedGpu}/${recommendedRam} GB RAM`
  ]

  if (hardware.matchType) {
    comparisonDetails.push(`Hardware match mode: ${hardware.matchType}`)
  }

  if (typeof hardware.confidence === 'number' && hardware.confidence > 0) {
    comparisonDetails.push(`Matching confidence: ${Math.round(hardware.confidence * 100)}%`)
  }

  if (Array.isArray(hardware.notes)) {
    comparisonDetails.push(...hardware.notes)
  }

  return {
    canRun:
      cpuScore < minimumCpu || gpuScore < minimumGpu || ram < minimumRam
        ? 'Possibly, but one or more components are below minimum'
        : 'Yes',
    performance: status.grade,
    tone: status.tone,
    recommendedPreset: overall >= 1.08 ? 'High' : overall >= 0.88 ? 'Medium' : 'Low',
    fps: {
      low: `${lowBase}-${lowBase + 10} FPS`,
      medium: `${mediumBase}-${mediumBase + 8} FPS`,
      high: `${highBase}-${highBase + 7} FPS`
    },
    expectedFps,
    warning:
      ram < recommendedRam
        ? `${ram} GB RAM may cause stutter in heavier areas or while multitasking.`
        : 'No major bottleneck detected for the selected build.',
    source: hardware.source || 'Typed hardware',
    platform,
    details: comparisonDetails
  }
}

module.exports = {
  CPUs,
  GPUs,
  Laptops,
  CPU_SCORES,
  GPU_SCORES,
  LAPTOP_LIBRARY,
  RAM_OPTIONS,
  ensureHardwareSeeded,
  getHardwareCatalog,
  normalizeHardwareInput,
  estimatePerformance,
  searchHardware
}
