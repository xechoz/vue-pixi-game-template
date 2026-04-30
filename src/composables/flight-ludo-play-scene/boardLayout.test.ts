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

test('boardLayout keeps finish slots 50px away from center', () => {
  const preset = getBoardPreset('hell-7')
  const renderLayout = getBoardRenderLayout('hell-7')
  const size = 700
  const layout = buildBoardLayout(0, 0, size, preset, renderLayout)

  const center = { x: size / 2, y: size / 2 }
  const lastSlot = layout.finishSlots[0]?.[preset.homeSteps - 1]

  assert.ok(lastSlot)
  assert.notEqual(lastSlot!.x, center.x)
  assert.notEqual(lastSlot!.y, center.y)

  const distance = Math.hypot(lastSlot!.x - center.x, lastSlot!.y - center.y)
  assert.ok(Math.abs(distance - 50) < 0.001)
})
