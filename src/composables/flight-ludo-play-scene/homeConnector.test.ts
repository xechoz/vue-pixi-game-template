import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getHomeConnectorDotSpacing,
  getPolylineLength,
} from './homeConnector'

test('getPolylineLength sums each segment in order', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 30, y: 40 },
    { x: 30, y: 80 },
  ]

  assert.equal(getPolylineLength(points), 90)
})

test('getHomeConnectorDotSpacing follows connector length per home step', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0, y: 60 },
    { x: 0, y: 120 },
  ]

  assert.equal(getHomeConnectorDotSpacing(points, 4, 20), 30)
})

test('getHomeConnectorDotSpacing keeps a track-size minimum for short connectors', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
  ]

  assert.equal(getHomeConnectorDotSpacing(points, 5, 20), 11)
})

test('getHomeConnectorDotSpacing falls back safely when geometry is missing', () => {
  assert.equal(getHomeConnectorDotSpacing([], 4, 20), 11)
  assert.equal(getHomeConnectorDotSpacing([{ x: 0, y: 0 }], 0, 10), 8)
})