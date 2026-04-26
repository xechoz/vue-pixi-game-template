import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BOARD_PRESETS,
  DEFAULT_BOARD_PRESET_ID,
  getBoardPreset,
  getBoardRenderLayout,
} from './board-presets.ts'

test('board presets expose a default tiny-4 preset for future board expansion', () => {
  assert.equal(DEFAULT_BOARD_PRESET_ID, 'tiny-4')
  assert.ok(BOARD_PRESETS['tiny-4'])

  const preset = getBoardPreset()
  assert.equal(preset.id, 'tiny-4')
  assert.equal(preset.stepsPerSide, 4)
  assert.equal(preset.trackLength, 16)
  assert.equal(preset.homeSteps, 2)
  assert.deepEqual(preset.startIndices, [0, 4, 8, 12])
  assert.deepEqual(preset.safeCells, [0, 4, 8, 12])
  assert.deepEqual(preset.flightJumps, [])
})

test('tiny-4 render layout is preset-driven and keeps compact-board-specific spacing values together', () => {
  const layout = getBoardRenderLayout('tiny-4')

  assert.equal(layout.trackInsetRatio, 0.18)
  assert.equal(layout.trackSizeRatio, 0.082)
  assert.equal(layout.baseZoneSizeRatio, 0.125)
  assert.equal(layout.baseSlotSpreadRatio, 0.24)
  assert.equal(layout.finishOffsetRatio, 0.16)
  assert.equal(layout.finishGapRatio, 0.08)
  assert.equal(layout.finishBoxSizeRatio, 0.036)
})
