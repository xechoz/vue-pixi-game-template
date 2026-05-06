import type { Point } from './types'

export function getPolylineLength(points: Point[]) {
  if (points.length < 2) {
    return 0
  }

  let totalLength = 0
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    totalLength += Math.hypot(to.x - from.x, to.y - from.y)
  }

  return totalLength
}

export function getHomeConnectorDotSpacing(points: Point[], homeSteps: number, trackSize: number) {
  const connectorLength = getPolylineLength(points)
  if (connectorLength === 0 || homeSteps <= 0) {
    return Math.max(8, trackSize * 0.55)
  }

  return Math.max(trackSize * 0.55, connectorLength / homeSteps)
}