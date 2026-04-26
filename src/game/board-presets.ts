export type BoardPresetId = 'tiny-4' | 'normal-6'

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

const tiny4Preset: BoardPreset = {
  id: 'tiny-4',
  label: '极简 4 步',
  stepsPerSide: 4,
  trackLength: 16,
  homeSteps: 2,
  startIndices: [0, 4, 8, 12],
  safeCells: [0, 4, 8, 12],
  flightJumps: [],
}

const normal6Preset: BoardPreset = {
  id: 'normal-6',
  label: '标准 6 步',
  stepsPerSide: 6,
  trackLength: 24,
  homeSteps: 4,
  startIndices: [0, 6, 12, 18],
  safeCells: [0, 6, 12, 18],
  flightJumps: [
    [2, 4],
    [8, 10],
    [14, 16],
    [20, 22],
  ],
}

const boardRenderLayouts: Record<BoardPresetId, BoardRenderLayout> = {
  'tiny-4': {
    trackInsetRatio: 0.18,
    trackSizeRatio: 0.082,
    baseZoneSizeRatio: 0.125,
    baseZonePaddingRatio: 0.018,
    baseSlotSpreadRatio: 0.24,
    finishOffsetRatio: 0.16,
    finishGapRatio: 0.08,
    finishBoxSizeRatio: 0.036,
  },
  'normal-6': {
    trackInsetRatio: 0.14,
    trackSizeRatio: 0.068,
    baseZoneSizeRatio: 0.11,
    baseZonePaddingRatio: 0.014,
    baseSlotSpreadRatio: 0.22,
    finishOffsetRatio: 0.12,
    finishGapRatio: 0.055,
    finishBoxSizeRatio: 0.03,
  },
}

export const DEFAULT_BOARD_PRESET_ID: BoardPresetId = 'tiny-4'

export const BOARD_PRESETS: Record<BoardPresetId, BoardPreset> = {
  'tiny-4': tiny4Preset,
  'normal-6': normal6Preset,
}

export function getBoardPreset(boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): BoardPreset {
  return BOARD_PRESETS[boardPresetId]
}

export function getBoardRenderLayout(boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): BoardRenderLayout {
  return boardRenderLayouts[boardPresetId]
}
