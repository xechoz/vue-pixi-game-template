import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BOARD_PRESETS,
  DEFAULT_BOARD_PRESET_ID,
  getBoardPreset,
  getBoardRenderLayout,
} from './board-presets.ts'

test('board presets expose a default tiny-3 preset for future board expansion', () => {
  assert.equal(DEFAULT_BOARD_PRESET_ID, 'tiny-3')
  assert.ok(BOARD_PRESETS['tiny-3'])

  const preset = getBoardPreset()
  assert.equal(preset.id, 'tiny-3')
  assert.equal(preset.stepsPerSide, 3)
  assert.equal(preset.trackLength, 12)
  assert.equal(preset.homeSteps, 2)
  assert.deepEqual(preset.startIndices, [0, 3, 6, 9])
  assert.deepEqual(preset.safeCells, [0, 3, 6, 9])
  assert.deepEqual(preset.flightJumps, [])
})

test('tiny-3 render layout is preset-driven and keeps compact-board-specific spacing values together', () => {
  const layout = getBoardRenderLayout('tiny-3')

  assert.equal(layout.trackInsetRatio, 0.18)
  assert.equal(layout.trackSizeRatio, 0.082)
  assert.equal(layout.baseZoneSizeRatio, 0.125)
  assert.equal(layout.baseSlotSpreadRatio, 0.24)
  assert.equal(layout.finishOffsetRatio, 0.16)
  assert.equal(layout.finishGapRatio, 0.08)
  assert.equal(layout.finishBoxSizeRatio, 0.036)
})

test('board presets also expose a normal-5 preset without changing the default board', () => {
  assert.equal(DEFAULT_BOARD_PRESET_ID, 'tiny-3')
  assert.ok(BOARD_PRESETS['normal-5'])

  const preset = getBoardPreset('normal-5')
  assert.equal(preset.id, 'normal-5')
  assert.equal(preset.stepsPerSide, 5)
  assert.equal(preset.trackLength, 20)
  assert.equal(preset.homeSteps, 4)
  assert.deepEqual(preset.startIndices, [0, 5, 10, 15])
  assert.deepEqual(preset.safeCells, [0, 5, 10, 15])
  assert.deepEqual(preset.flightJumps, [
    [2, 4],
    [7, 9],
    [12, 14],
    [17, 19],
  ])
})

test('board presets also expose a hell-7 preset for the third difficulty mode', () => {
  assert.ok(BOARD_PRESETS['hell-7'])

  const preset = getBoardPreset('hell-7')
  assert.equal(preset.id, 'hell-7')
  assert.equal(preset.stepsPerSide, 7)
  assert.equal(preset.trackLength, 28)
  assert.equal(preset.homeSteps, 5)
  assert.deepEqual(preset.startIndices, [0, 7, 14, 21])
  assert.deepEqual(preset.safeCells, [0, 7, 14, 21])
  assert.deepEqual(preset.flightJumps, [
    [3, 6],
    [10, 13],
    [17, 20],
    [24, 27],
  ])
})

test('hell-7 render layout tightens the board for the longest route', () => {
  const layout = getBoardRenderLayout('hell-7')

  assert.equal(layout.trackInsetRatio, 0.1)
  assert.equal(layout.trackSizeRatio, 0.058)
  assert.equal(layout.baseZoneSizeRatio, 0.1)
  assert.equal(layout.baseSlotSpreadRatio, 0.2)
  assert.equal(layout.finishOffsetRatio, 0.105)
  assert.equal(layout.finishGapRatio, 0.046)
  assert.equal(layout.finishBoxSizeRatio, 0.026)
})
