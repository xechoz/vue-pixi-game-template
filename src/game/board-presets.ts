export type BoardPresetId = 'tiny-3' | 'normal-5' | 'hell-7'

export interface BoardPreset {
  id: BoardPresetId
  label: string
  stepsPerEdge: number
  trackLength: number
  homeSteps: number
  startIndices: [number, number, number, number]
  safeCells: number[]
  flightJumps: Array<[number, number]>
}

export interface BoardRenderLayout {
  trackInsetRatio: number
  trackSizeRatio: number
  baseZoneSizeRatio: number
  baseZonePaddingRatio: number
  baseSlotSpreadRatio: number
  finishOffsetRatio: number
  finishGapRatio: number
  finishBoxSizeRatio: number
}

export function deriveOuterLength(stepsPerEdge: number): number {
  return 3 * stepsPerEdge - 3 + (stepsPerEdge + 1) / 2
}

function deriveQuarterIndices(trackLength: number): [number, number, number, number] {
  return [
    0,
    Math.floor(trackLength / 4),
    Math.floor(trackLength / 2),
    Math.floor((trackLength * 3) / 4),
  ]
}

function createPreset(id: BoardPresetId, label: string, stepsPerEdge: number, homeSteps: number): BoardPreset {
  const trackLength = deriveOuterLength(stepsPerEdge)
  const startIndices = deriveQuarterIndices(trackLength)
  return {
    id,
    label,
    stepsPerEdge,
    trackLength,
    homeSteps,
    startIndices,
    safeCells: [...startIndices],
    flightJumps: [],
  }
}

const tiny3Preset = createPreset('tiny-3', '快速 3 步', 3, 2)
const normal5Preset = createPreset('normal-5', '标准 5 步', 5, 4)
const hell7Preset = createPreset('hell-7', '地狱 7 步', 7, 5)

const boardRenderLayouts: Record<BoardPresetId, BoardRenderLayout> = {
  'tiny-3': {
    trackInsetRatio: 0.18,
    trackSizeRatio: 0.082,
    baseZoneSizeRatio: 0.125,
    baseZonePaddingRatio: 0.018,
    baseSlotSpreadRatio: 0.24,
    finishOffsetRatio: 0.16,
    finishGapRatio: 0.08,
    finishBoxSizeRatio: 0.036,
  },
  'normal-5': {
    trackInsetRatio: 0.14,
    trackSizeRatio: 0.068,
    baseZoneSizeRatio: 0.11,
    baseZonePaddingRatio: 0.014,
    baseSlotSpreadRatio: 0.22,
    finishOffsetRatio: 0.12,
    finishGapRatio: 0.055,
    finishBoxSizeRatio: 0.03,
  },
  'hell-7': {
    trackInsetRatio: 0.1,
    trackSizeRatio: 0.058,
    baseZoneSizeRatio: 0.1,
    baseZonePaddingRatio: 0.012,
    baseSlotSpreadRatio: 0.2,
    finishOffsetRatio: 0.105,
    finishGapRatio: 0.046,
    finishBoxSizeRatio: 0.026,
  },
}

export const DEFAULT_BOARD_PRESET_ID: BoardPresetId = 'tiny-3'

export const BOARD_PRESETS: Record<BoardPresetId, BoardPreset> = {
  'tiny-3': tiny3Preset,
  'normal-5': normal5Preset,
  'hell-7': hell7Preset,
}

export function getBoardPreset(boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): BoardPreset {
  return BOARD_PRESETS[boardPresetId]
}

export function getBoardRenderLayout(boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): BoardRenderLayout {
  return boardRenderLayouts[boardPresetId]
}
