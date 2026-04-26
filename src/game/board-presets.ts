export type BoardPresetId = 'tiny-4'

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
}

export const DEFAULT_BOARD_PRESET_ID: BoardPresetId = 'tiny-4'

export const BOARD_PRESETS: Record<BoardPresetId, BoardPreset> = {
  'tiny-4': tiny4Preset,
}

export function getBoardPreset(boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): BoardPreset {
  return BOARD_PRESETS[boardPresetId]
}

export function getBoardRenderLayout(boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): BoardRenderLayout {
  return boardRenderLayouts[boardPresetId]
}
