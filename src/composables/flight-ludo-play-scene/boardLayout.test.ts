import test from 'node:test'
import assert from 'node:assert/strict'

import { getBoardPreset, getBoardRenderLayout } from '../../game'
import { buildBoardLayout } from './boardLayout'

test('boardLayout returns raw track data with the expected length', () => {
  const preset = getBoardPreset('hell-7')
  const renderLayout = getBoardRenderLayout('hell-7')
  const size = 700
  const layout = buildBoardLayout(0, 0, size, preset, renderLayout)

  assert.equal(layout.trackPoints.length, preset.trackLength)
})
