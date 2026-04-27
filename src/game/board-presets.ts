export type BoardPresetId = 'tiny-3' | 'normal-5' | 'hell-7'

export interface BoardPreset {
  id: BoardPresetId
  label: string
  stepsPerSide: number
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

const tiny3Preset: BoardPreset = {
  id: 'tiny-3',
  label: '快速 3 步',
  stepsPerSide: 3,
  trackLength: 12,
  homeSteps: 2,
  startIndices: [0, 3, 6, 9],
  safeCells: [0, 3, 6, 9],
  flightJumps: [],
}

const normal5Preset: BoardPreset = {
  id: 'normal-5',
  label: '标准 5 步',
  stepsPerSide: 5,
  trackLength: 20,
  homeSteps: 4,
  startIndices: [0, 5, 10, 15],
  safeCells: [0, 5, 10, 15],
  flightJumps: [
    [2, 4],
    [7, 9],
    [12, 14],
    [17, 19],
  ],
}

const hell7Preset: BoardPreset = {
  id: 'hell-7',
  label: '地狱 7 步',
  stepsPerSide: 7,
  trackLength: 28,
  homeSteps: 5,
  startIndices: [0, 7, 14, 21],
  safeCells: [0, 7, 14, 21],
  flightJumps: [
    [3, 6],
    [10, 13],
    [17, 20],
    [24, 27],
  ],
}

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
