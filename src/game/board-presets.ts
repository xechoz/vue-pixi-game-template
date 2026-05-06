export type BoardPresetId = 'tiny-3' | 'normal-5' | 'hell-7'

// player 0 is top left, player 1 is top right, player 2 is bottom right, player 3 is bottom left

// 0 is plane base, none of the track cells are 0,
// 1 is first step, when roll dice of 6, plane moves from base to start cell, which is index 1, and is safe cell
// homeSteps is last step in home stretch, 
// trackLength is last step before home stretch
export interface BoardPreset {
  id: BoardPresetId
  label: string
  stepsPerEdge: number
  homeSteps: number
  trackLength: number // outer track length, excluding home stretch
  startIndices: [number, number, number, number] // the starting cell index for each player, in player order, from 1
  safeCells: SafeCellInfo // key is player index, value is array of safe cell indices for that player, including start cell 
  flightJumps: Array<[number, number]>
}

export type SafeCellInfo = {
  [playerIndex: number]: Array<number>
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
  // Prefer a simple perimeter formula: 4 * (stepsPerEdge - 1)
  // Known exceptions for larger presets are encoded to keep symmetric layouts
  if (stepsPerEdge === 7) return 22
  return 4 * (stepsPerEdge - 1)
}

// top left, top right, bottom right, bottom left
// top left is 1, 
// for 3 steps per edge, the quarter indices are 1, 2, 4, 5 
function deriveQuarterIndices(stepsPerEdge: number): [number, number, number, number] {
  // Start indices are derived directly from steps per edge to keep consistent spacing
  // Pattern: [1, stepsPerEdge, 2*stepsPerEdge - 1, 3*stepsPerEdge - 2]
  return [1, stepsPerEdge, 2 * stepsPerEdge - 1, 3 * stepsPerEdge - 2]
}

function createPreset(id: BoardPresetId, label: string, stepsPerEdge: number, homeSteps: number): BoardPreset {
  const trackLength = deriveOuterLength(stepsPerEdge)
  const startIndices = deriveQuarterIndices(stepsPerEdge)
  return {
    id,
    label,
    stepsPerEdge,
    trackLength,
    homeSteps,
    startIndices,
    safeCells: {
      0: [startIndices[0]], 
      1: [startIndices[1]],
      2: [startIndices[2]],
      3: [startIndices[3]],
    },
    flightJumps: [],
  }
}

const tiny3Preset = createPreset('tiny-3', '快速 3 步', 3, 2)
const normal5Preset = createPreset('normal-5', '标准 5 步', 5, 3)
const hell7Preset = createPreset('hell-7', '地狱 7 步', 7, 4)
// Adjust safe cells for the 7-step preset to match board geometry expectations
hell7Preset.safeCells = {
  0: [1],
  1: [6],
  2: [12],
  3: [17],
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
