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

test('boardLayout scales base slots down on smaller boards', () => {
  const preset = getBoardPreset('hell-7')
  const renderLayout = getBoardRenderLayout('hell-7')
  const largeSize = 700
  const smallSize = 500
  const largeLayout = buildBoardLayout(0, 0, largeSize, preset, renderLayout)
  const smallLayout = buildBoardLayout(0, 0, smallSize, preset, renderLayout)

  const largeBaseSlots = largeLayout.baseSlots[0]
  const smallBaseSlots = smallLayout.baseSlots[0]

  assert.ok(largeBaseSlots)
  assert.ok(smallBaseSlots)
  assert.equal(largeBaseSlots.length, 4)
  assert.equal(smallBaseSlots.length, 4)

  const largeWidth = largeBaseSlots[1].x - largeBaseSlots[0].x
  const largeHeight = largeBaseSlots[2].y - largeBaseSlots[0].y
  const smallWidth = smallBaseSlots[1].x - smallBaseSlots[0].x
  const smallHeight = smallBaseSlots[2].y - smallBaseSlots[0].y

  assert.ok(smallWidth < largeWidth)
  assert.ok(smallHeight < largeHeight)
})

test('boardLayout keeps base slots inside centered corner quadrants', () => {
  const preset = getBoardPreset('hell-7')
  const renderLayout = getBoardRenderLayout('hell-7')
  const size = 700
  const layout = buildBoardLayout(0, 0, size, preset, renderLayout)
  const centerX = size / 2
  const centerY = size / 2

  for (const slots of layout.baseSlots) {
    for (const slot of slots) {
      assert.ok(slot.x > 0)
      assert.ok(slot.x < size)
      assert.ok(slot.y > 0)
      assert.ok(slot.y < size)
    }
  }

  const [topLeftSlots, topRightSlots, bottomRightSlots, bottomLeftSlots] = layout.baseSlots
  const averagePoint = (slots: { x: number; y: number }[]) => ({
    x: slots.reduce((sum, slot) => sum + slot.x, 0) / slots.length,
    y: slots.reduce((sum, slot) => sum + slot.y, 0) / slots.length,
  })

  const topLeftCenter = averagePoint(topLeftSlots)
  const topRightCenter = averagePoint(topRightSlots)
  const bottomRightCenter = averagePoint(bottomRightSlots)
  const bottomLeftCenter = averagePoint(bottomLeftSlots)

  assert.ok(topLeftCenter.x < centerX)
  assert.ok(topLeftCenter.y < centerY)
  assert.ok(topRightCenter.x > centerX)
  assert.ok(topRightCenter.y < centerY)
  assert.ok(bottomRightCenter.x > centerX)
  assert.ok(bottomRightCenter.y > centerY)
  assert.ok(bottomLeftCenter.x < centerX)
  assert.ok(bottomLeftCenter.y > centerY)
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
