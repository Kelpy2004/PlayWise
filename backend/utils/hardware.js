const Cpu = require('../models/Cpu')
const Gpu = require('../models/Gpu')
const Laptop = require('../models/Laptop')
const { CPUs, GPUs, Laptops } = require('../data/seedHardware')

const CPU_SCORES = Object.fromEntries(CPUs.map(item => [item.name, item.score]))
const GPU_SCORES = Object.fromEntries(GPUs.map(item => [item.name, item.score]))
const LAPTOP_LIBRARY = Laptops.map(({ model, cpu, gpu, ram, brand, platform, tags }) => ({ model, cpu, gpu, ram, brand, platform, tags }))
const RAM_OPTIONS = [8, 12, 16, 18, 24, 32, 36, 64]

const MAC_COMPATIBLE_SLUGS = new Set([
  '0-a-d',
  'super-tux-kart',
  'battle-for-wesnoth',
  'openttd',
  'xonotic'
])

function scoreToGrade(ratio) {
  if (ratio >= 1.25) return { grade: 'Excellent', tone: 'good' }
  if (ratio >= 1.0) return { grade: 'Good', tone: 'good' }
  if (ratio >= 0.82) return { grade: 'Playable', tone: 'warn' }
  return { grade: 'Poor', tone: 'bad' }
}

async function ensureHardwareSeeded() {
  try {
    const [cpuCount, gpuCount, laptopCount] = await Promise.all([
      Cpu.countDocuments(),
      Gpu.countDocuments(),
      Laptop.countDocuments()
    ])

    if (!cpuCount) await Cpu.insertMany(CPUs)
    if (!gpuCount) await Gpu.insertMany(GPUs)
    if (!laptopCount) await Laptop.insertMany(Laptops)
  } catch (err) {
    console.error('Hardware seed skipped or failed:', err.message)
  }
}

async function getHardwareCatalog() {
  try {
    const [cpus, gpus, laptops] = await Promise.all([
      Cpu.find().sort({ name: 1 }).lean(),
      Gpu.find().sort({ name: 1 }).lean(),
      Laptop.find().sort({ model: 1 }).lean()
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
  } catch (err) {
    return {
      cpus: CPUs,
      gpus: GPUs,
      laptops: Laptops,
      ramOptions: RAM_OPTIONS
    }
  }
}

function escapeRegex(value) {
return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}

async function findLaptopByModel(model) {
  if (!model) return null

  try {
    const found = await Laptop.findOne({ model: new RegExp(`^${escapeRegex(model.trim())}$`, 'i') }).lean()
    if (found) return found
  } catch (err) {
  }

  return LAPTOP_LIBRARY.find(item => item.model.toLowerCase() === model.trim().toLowerCase()) || null
}

async function lookupCpuScore(name) {
  if (!name) return null

  try {
    const cpu = await Cpu.findOne({ name }).lean()
    if (cpu && cpu.score) return cpu.score
  } catch (err) {
  }

  return CPU_SCORES[name] ?? null
}

async function lookupGpuScore(name) {
  if (!name) return null

  try {
    const gpu = await Gpu.findOne({ name }).lean()
    if (gpu && gpu.score) return gpu.score
  } catch (err) {
  }

  return GPU_SCORES[name] ?? null
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

function normalizeSupportedPlatforms(game = {}) {
  const supportedPlatforms = game.supportedPlatforms || game.platform || game.platforms || []
  const normalized = supportedPlatforms.map(item => String(item).toLowerCase())
  if (!normalized.length) return ['windows']
  return normalized
}

async function normalizeHardwareInput(input = {}) {
  if (input.laptop) {
    const laptop = await findLaptopByModel(input.laptop)
    if (laptop) {
      return {
        cpu: laptop.cpu,
        gpu: laptop.gpu,
        ram: Number(laptop.ram) || 8,
        source: laptop.model,
        brand: laptop.brand,
        platform: laptop.platform || inferPlatformFromHardware(laptop),
        tags: laptop.tags || []
      }
    }
  }

  return {
    cpu: input.cpu,
    gpu: input.gpu,
    ram: Number(input.ram) || 8,
    source: input.source || 'Manual entry',
    platform: inferPlatformFromHardware(input)
  }
}

async function estimatePerformance(game, rawHardware) {
  const hardware = await normalizeHardwareInput(rawHardware)
  const cpuScore = (await lookupCpuScore(hardware.cpu)) || Number(rawHardware.cpuScore) || 30
  const gpuScore = (await lookupGpuScore(hardware.gpu)) || Number(rawHardware.gpuScore) || 25
  const ram = Number(hardware.ram) || 8
  const platform = inferPlatformFromHardware(hardware)
  const supportedPlatforms = normalizeSupportedPlatforms(game)

  const isMacUnsupported = platform === 'macos' && !supportedPlatforms.includes('macos') && !MAC_COMPATIBLE_SLUGS.has(game.slug)

  if (isMacUnsupported) {
    return {
      canRun: 'Not supported',
      performance: 'Unsupported on macOS',
      tone: 'bad',
      recommendedPreset: 'Unavailable',
      fps: { low: '—', medium: '—', high: '—' },
      expectedFps: 'No native support expected',
      warning: 'This MacBook/macOS setup is not supported for this game in the current PlayWise catalog.',
      source: hardware.source || 'Laptop preset',
      platform,
      details: ['Use a Windows PC or another supported platform for this title.']
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
  const overall = (cpuRatio * 0.35) + (gpuRatio * 0.45) + (ramRatio * 0.2)
  const status = scoreToGrade(overall)

  const lowBase = Math.max(18, Math.round(28 + overall * 38))
  const mediumBase = Math.max(16, Math.round(lowBase * 0.82))
  const highBase = Math.max(14, Math.round(lowBase * 0.68))

  let expectedFps = 'Under 35 FPS without major compromises'
  if (overall >= 1.2) expectedFps = '90+ FPS in optimized scenes'
  else if (overall >= 1.0) expectedFps = '60+ FPS with recommended settings'
  else if (overall >= 0.82) expectedFps = '35–55 FPS with tuned settings'

  return {
    canRun: cpuScore < minimumCpu || gpuScore < minimumGpu || ram < minimumRam
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
    warning: ram < recommendedRam
      ? `${ram} GB RAM may cause stutter in heavier areas or while multitasking.`
      : 'No major bottleneck detected for the selected build.',
    source: hardware.source || 'Manual entry',
    platform,
    details: [
      `CPU score used: ${cpuScore}`,
      `GPU score used: ${gpuScore}`,
      `Compared against recommended target ${recommendedCpu}/${recommendedGpu}/${recommendedRam} GB RAM`
    ]
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
  estimatePerformance
}
