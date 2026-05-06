import type { Point } from './types'

export type CapturedFlightState = {
  pieceId: string
  origin: Point
  destination: Point
  color: string
  createdAt: number
  duration: number
}

export function createCapturedFlight(
  pieceId: string,
  origin: Point,
  destination: Point,
  color: string,
  duration = 380,
): CapturedFlightState {
  return {
    pieceId,
    origin,
    destination,
    color,
    createdAt: performance.now(),
    duration,
  }
}

export function getCapturedFlightProgress(
  flight: CapturedFlightState,
  now: number,
) {
  return Math.min(1, Math.max(0, (now - flight.createdAt) / flight.duration))
}

export function getCapturedFlightRenderState(
  flight: CapturedFlightState,
  now: number,
) {
  const progress = getCapturedFlightProgress(flight, now)
  const easedProgress = 0.5 - Math.cos(Math.PI * progress) / 2
  const x = flight.origin.x + (flight.destination.x - flight.origin.x) * easedProgress
  const y =
    flight.origin.y +
    (flight.destination.y - flight.origin.y) * easedProgress -
    Math.sin(progress * Math.PI) * 12
  const rotation = (1 - easedProgress) * Math.PI * 0.28
  const alpha = 1 - progress * 0.18

  return {
    position: { x, y },
    rotation,
    alpha,
    progress,
  }
}

export function isCapturedFlightComplete(
  flight: CapturedFlightState,
  now: number,
) {
  return now - flight.createdAt >= flight.duration
}
