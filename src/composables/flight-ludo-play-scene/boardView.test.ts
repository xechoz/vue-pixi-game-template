import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveOuterAnchorPoints } from './boardView'

const trackPoints = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 100, y: 100 },
  { x: 50, y: 100 },
  { x: 0, y: 100 },
  { x: 0, y: 50 },
]

test('deriveOuterAnchorPoints maps raw track data to 8 visual anchors', () => {
  const anchors = deriveOuterAnchorPoints(trackPoints)

  assert.equal(anchors.length, 8)
  assert.deepEqual(anchors[0], { x: 0, y: 0 })
  assert.deepEqual(anchors[2], { x: 100, y: 0 })
  assert.deepEqual(anchors[4], { x: 100, y: 100 })
  assert.deepEqual(anchors[6], { x: 0, y: 100 })
})
