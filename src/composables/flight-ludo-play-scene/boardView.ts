import type { Point } from './types'

// This module is UI-only.
// It turns the raw geometric track points into a small set of visual anchors
// that are useful for numbering, labels, and route explanations.
// The game rules do not depend on these anchors.

function pickClosestPoint(points: Point[], target: Point) {
  let bestPoint = points[0] ?? target
  let bestDistance = Number.POSITIVE_INFINITY

  for (const point of points) {
    const dx = point.x - target.x
    const dy = point.y - target.y
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      bestPoint = point
    }
  }

  return bestPoint
}

// Derive eight visual anchors from the outer track bounds.
// The anchors are ordered clockwise so the renderer can label them in a stable way.
export function deriveOuterAnchorPoints(trackPoints: Point[]) {
  if (trackPoints.length === 0) return []

  const minX = Math.min(...trackPoints.map((point) => point.x))
  const maxX = Math.max(...trackPoints.map((point) => point.x))
  const minY = Math.min(...trackPoints.map((point) => point.y))
  const maxY = Math.max(...trackPoints.map((point) => point.y))
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  return [
    pickClosestPoint(trackPoints, { x: minX, y: minY }),
    pickClosestPoint(trackPoints, { x: midX, y: minY }),
    pickClosestPoint(trackPoints, { x: maxX, y: minY }),
    pickClosestPoint(trackPoints, { x: maxX, y: midY }),
    pickClosestPoint(trackPoints, { x: maxX, y: maxY }),
    pickClosestPoint(trackPoints, { x: midX, y: maxY }),
    pickClosestPoint(trackPoints, { x: minX, y: maxY }),
    pickClosestPoint(trackPoints, { x: minX, y: midY }),
  ]
}
