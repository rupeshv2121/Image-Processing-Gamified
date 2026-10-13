// Gamified "quest" structure: each syllabus unit is a level made of missions.
// Completion is read from the progress that MATLAB stores (progressManager.m).
import { asArray } from '../api'

const has = (p, area, item) => asArray(p?.activities?.[area]).includes(item)
const count = (p, area) => asArray(p?.activities?.[area]).length
const topicDone = (p, titles) => asArray(p?.topicsCompleted).some((t) => titles.includes(t))

export const UNITS = [
  {
    id: 'u1', num: 'I', title: 'Fundamentals', subtitle: 'Pixels, sampling & quantisation', icon: 'pixels', lab: 'fundamentals',
    labs: ['fundamentals', 'workspace'],
    missions: [
      { text: 'Load an image into MATLAB', link: 'workspace', done: (p, s) => s.imageLoaded },
      { text: 'Explore pixel neighbourhoods', link: 'fundamentals', done: (p) => has(p, 'tools', 'neighborhood') },
      { text: 'Sample and quantise an image', link: 'fundamentals', done: (p) => has(p, 'tools', 'sampling') || has(p, 'tools', 'quantization') },
      { text: 'Read a Unit I topic', link: 'learn', done: (p) => topicDone(p, ['Digital Image Fundamentals', 'Basic Relationships Between Pixels', 'Image Sensing, Sampling and Quantisation']) },
    ],
  },
  {
    id: 'u2', num: 'II', title: 'Enhancement', subtitle: 'Histograms, filters, convolution', icon: 'sliders', lab: 'filters',
    labs: ['histogram', 'filters', 'correlation', 'kernel', 'sharpening', 'compare'],
    missions: [
      { text: 'Equalise a histogram', link: 'histogram', done: (p) => has(p, 'histogram', 'histeq') || has(p, 'histogram', 'histeqManual') },
      { text: 'Try 3 spatial filters', link: 'filters', done: (p) => count(p, 'filters') >= 3 },
      { text: 'Step through a correlation', link: 'correlation', done: (p) => has(p, 'tools', 'correlation') },
      { text: 'Flip a kernel (convolution)', link: 'correlation', done: (p) => has(p, 'tools', 'convolution') },
      { text: 'Design your own kernel', link: 'kernel', done: (p) => has(p, 'tools', 'kernelPlayground') },
      { text: 'Sharpen an image', link: 'sharpening', done: (p) => count(p, 'sharpening') >= 1 },
    ],
  },
  {
    id: 'u3', num: 'III', title: 'Restoration & Colour', subtitle: 'Noise models, adaptive filters, colour', icon: 'palette', lab: 'noise',
    labs: ['noise', 'compare', 'color'],
    missions: [
      { text: 'Add 2 different noise types', link: 'noise', done: (p) => count(p, 'noise') >= 2 },
      { text: 'Restore noise with the adaptive median', link: 'noise', done: (p) => has(p, 'filters', 'adaptivemedian') },
      { text: 'Rank filters in a comparison', link: 'compare', done: (p) => has(p, 'tools', 'compare') },
      { text: 'Split an image into colour channels', link: 'color', done: (p) => asArray(p?.activities?.color).some((c) => c !== 'enhance') },
      { text: 'Enhance a colour channel', link: 'color', done: (p) => has(p, 'color', 'enhance') },
    ],
  },
  {
    id: 'u4', num: 'IV', title: 'Segmentation', subtitle: 'Edges, thresholds, morphology, regions', icon: 'edges', lab: 'edges',
    labs: ['edges', 'segmentation', 'morphology', 'regions'],
    missions: [
      { text: 'Detect edges with Canny', link: 'edges', done: (p) => has(p, 'edges', 'canny') },
      { text: 'Compare 3 edge detectors', link: 'edges', done: (p) => count(p, 'edges') >= 3 },
      { text: "Threshold with Otsu's method", link: 'segmentation', done: (p) => has(p, 'segmentation', 'otsu') },
      { text: 'Grow a region from a seed', link: 'segmentation', done: (p) => has(p, 'segmentation', 'regiongrow') },
      { text: 'Open or close a binary image', link: 'morphology', done: (p) => has(p, 'morphology', 'open') || has(p, 'morphology', 'close') },
      { text: 'Fill the holes in an object', link: 'morphology', done: (p) => has(p, 'morphology', 'fill') },
      { text: 'Read the chain code of a region', link: 'regions', done: (p) => count(p, 'regions') >= 1 },
    ],
  },
]

export function unitProgress(unit, progress, state = {}) {
  const done = unit.missions.filter((m) => m.done(progress, state)).length
  return { done, total: unit.missions.length, ratio: done / unit.missions.length }
}

export function nextMission(progress, state = {}) {
  for (const u of UNITS) {
    const m = u.missions.find((x) => !x.done(progress, state))
    if (m) return { unit: u, mission: m }
  }
  return null
}

export const MEDALS = {
  filter_master: '🧪', noise_fighter: '🛡️', histogram_hero: '📊', convolution_expert: '🔄',
  edge_detective: '🔍', segmentation_pro: '🧩', colour_artist: '🎨', perfect_quiz: '💯',
  streak_master: '🔥', experimenter: '⚗️', scholar: '🎓', quiz_regular: '⚡',
  morphologist: '🫧', shape_analyst: '📐', restorer: '🩹', daily_devotee: '📅',
}

// All labs with their navigation metadata
export const LABS = {
  workspace: { label: 'Image Workspace', icon: 'image', text: 'Load, inspect, undo / redo and save images.' },
  fundamentals: { label: 'Pixels & Sampling', icon: 'pixels', text: 'Neighbourhoods, distances, sampling and quantisation.' },
  histogram: { label: 'Histogram Lab', icon: 'histogram', text: 'Equalisation, CLAHE, stretching, gamma and log.' },
  filters: { label: 'Spatial Filters', icon: 'layers', text: 'Linear and non-linear filters — toolbox vs manual.' },
  correlation: { label: 'Correlation & Convolution', icon: 'conv', text: 'Watch the kernel slide and flip, step by step.' },
  kernel: { label: 'Kernel Playground', icon: 'kernel', text: 'Design any 3×3 to 7×7 kernel and see it live.' },
  sharpening: { label: 'Sharpening Lab', icon: 'sharpen', text: 'Laplacian, gradients, unsharp masking, high-boost.' },
  compare: { label: 'Filter Comparison', icon: 'compare', text: 'Rank filters by MSE, PSNR, SSIM and time.' },
  noise: { label: 'Noise Lab', icon: 'noise', text: 'Gaussian, salt & pepper, speckle and Poisson noise.' },
  color: { label: 'Color Processing', icon: 'palette', text: 'RGB, HSV, YCbCr and Lab channels and enhancement.' },
  edges: { label: 'Edge Detection', icon: 'edges', text: 'Roberts, Prewitt, Sobel, LoG and Canny.' },
  segmentation: { label: 'Segmentation', icon: 'scissors', text: 'Thresholds, Otsu, region growing, split & merge.' },
  morphology: { label: 'Morphology Lab', icon: 'morph', text: 'Erosion, dilation, opening, closing, boundaries and hole filling.' },
  regions: { label: 'Region Analysis', icon: 'regions', text: 'Connected components, chain codes, area, perimeter and centroid.' },
}
