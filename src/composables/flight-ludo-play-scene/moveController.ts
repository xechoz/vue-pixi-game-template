import { ref, type ComputedRef, type Ref } from 'vue'

import {
  buildMoveTrajectory,
  getCurrentPlayer,
  movePiece,
  type GameState,
  type PieceState,
  type PlayerState,
} from '../../game'
import type { BoardLayout, LandingPoint, Point, RefreshGameView } from './types'
import { createCapturedFlight, isCapturedFlightComplete } from './boardRenderer.FailAnim'
import type { CapturedFlightState } from './boardRenderer.FailAnim'

function easeInOutSine(progress: number) {
  return 0.5 - Math.cos(Math.PI * progress) / 2
}

function interpolatePoint(start: Point, end: Point, progress: number): Point {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  }
}

type MoveControllerOptions = {
  game: Ref<GameState>
  legalPieces: ComputedRef<string[]>
  diceHandoffHiding: Ref<boolean>
  getCurrentLayout: () => BoardLayout | null
  resolvePiecePoint: (
    layout: BoardLayout,
    player: Pick<PlayerState, 'index' | 'startIndex' | 'boardPresetId'>,
    piece: Pick<PieceState, 'progress'>,
  ) => Point
  clearTimers: () => void
  renderScene: () => void
  refreshGameView: RefreshGameView
  scheduleTurnAdvance: (delay?: number) => void
  playFailSound: () => void
  playMoveSound: () => void
  playWinSound: () => void
}

export function createMoveController(options: MoveControllerOptions) {
  const replayingPieceId = ref<string>('')
  const movePath = ref<number[]>([])
  const replayingStartProgress = ref<number>(-1)
  const movingPoint = ref<Point | null>(null)
  const landingPoint = ref<LandingPoint | null>(null)
  const capturedFlights = ref<CapturedFlightState[]>([])

  let landingTimer: number = -1
  let moveFrameId: number = -1
  let captureFrameId: number = -1

  function clearCapturedFlights() {
    if (captureFrameId !== -1) {
      window.cancelAnimationFrame(captureFrameId)
      captureFrameId = -1
    }
    capturedFlights.value = []
  }

  function clearMovePreview() {
    replayingPieceId.value = ''
    movePath.value = []
    replayingStartProgress.value = -1
    movingPoint.value = null
    landingPoint.value = null
  }

  function clearMoveTimers() {
    if (landingTimer !== -1) {
      window.clearTimeout(landingTimer)
      landingTimer = -1
    }
    if (moveFrameId !== -1) {
      window.cancelAnimationFrame(moveFrameId)
      moveFrameId = -1
    }
    clearCapturedFlights()
  }

  function scheduleCapturedFlightAnimation() {
    if (captureFrameId !== -1 || capturedFlights.value.length === 0) return

    const frame = (now: number) => {
      const activeFlights = capturedFlights.value.filter(
        (flight) => !isCapturedFlightComplete(flight, now),
      )
      if (activeFlights.length === 0) {
        clearCapturedFlights()
        options.refreshGameView()
        return
      }
      options.renderScene()
      captureFrameId = window.requestAnimationFrame(frame)
    }

    captureFrameId = window.requestAnimationFrame(frame)
  }

  function resetMoveState() {
    clearMoveTimers()
    clearMovePreview()
  }

  function handleMove(pieceId: string) {
    const currentLayout = options.getCurrentLayout()
    if (
      !currentLayout ||
      options.game.value.dice === 0 ||
      options.game.value.winnerIndex !== -1 ||
      movingPoint.value !== null
    )
      return
    if (!options.legalPieces.value.includes(pieceId)) return

    const player = getCurrentPlayer(options.game.value)
    const piece = player.pieces.find((item) => item.id === pieceId)
    if (!piece) return

    const diceValue = options.game.value.dice
    const startProgress = piece.progress
    const trajectory = buildMoveTrajectory(player, piece, diceValue)
    if (trajectory.length === 0) return

    const resolveProgress = (progress: number) =>
      options.resolvePiecePoint(currentLayout, player, { progress })
    const animPathPoints = [
      resolveProgress(startProgress),
      ...trajectory.map(resolveProgress),
    ]
    const endPoint =
      animPathPoints[animPathPoints.length - 1] ?? animPathPoints[0]

    const snapshotByPieceId = new Map<
      string,
      { origin: Point; ownerIndex: number; pieceIndex: number; color: string }
    >()

    for (const candidatePlayer of options.game.value.players) {
      for (const candidatePiece of candidatePlayer.pieces) {
        const origin = options.resolvePiecePoint(
          currentLayout,
          candidatePlayer,
          candidatePiece,
        )
        const [, pieceIdIndex] = candidatePiece.id.split('-')
        snapshotByPieceId.set(candidatePiece.id, {
          origin,
          ownerIndex: candidatePlayer.index,
          pieceIndex: Number(pieceIdIndex),
          color: candidatePlayer.color,
        })
      }
    }

    options.clearTimers()
    replayingStartProgress.value = startProgress
    const result = movePiece(options.game.value, pieceId)
    if (!result.moved) {
      replayingStartProgress.value = -1
      clearMovePreview()
      options.refreshGameView()
      return
    }

    const capturedFlightsInMove = result.capturedPieceIds?.length
      ? result.capturedPieceIds
          .map((capturedId) => {
            const snapshot = snapshotByPieceId.get(capturedId)
            if (!snapshot) return null
            const destination =
              currentLayout.baseSlots[snapshot.ownerIndex]?.[snapshot.pieceIndex] ??
              currentLayout.baseSlots[snapshot.ownerIndex]?.[0] ??
              snapshot.origin
            return createCapturedFlight(
              capturedId,
              snapshot.origin,
              destination,
              snapshot.color,
            )
          })
          .filter((value): value is CapturedFlightState => Boolean(value))
      : []

    if (capturedFlightsInMove.length > 0) {
      capturedFlights.value = capturedFlightsInMove
    }

    const willWin = result.victory
    if (result.advancePending) {
      options.diceHandoffHiding.value = true
    }
    replayingPieceId.value = pieceId
    movePath.value = trajectory
    movingPoint.value = { x: animPathPoints[0]!.x, y: animPathPoints[0]!.y }
    options.refreshGameView({ deferResultPage: willWin })

    const pathPoints = animPathPoints
    const totalSteps = pathPoints.length - 1
    const hopLift = Math.max(10, Math.min(24, totalSteps * 2))
    const stepDuration = Math.max(200, Math.min(220, Math.round(420 / Math.max(1, totalSteps))))
    const flightRatio = 0.55
    const flightDuration = stepDuration * flightRatio
    const totalDuration = stepDuration * totalSteps
    const startTime = performance.now()

    const finishMove = () => {
      moveFrameId = -1
      movingPoint.value = null
      options.playMoveSound()
      if (result.capturedCount > 0) options.playFailSound()
      if (result.victory) options.playWinSound()
      clearMovePreview()
      landingPoint.value = {
        x: endPoint.x,
        y: endPoint.y,
        color: player.color,
      }
      if (landingTimer !== -1) window.clearTimeout(landingTimer)
      landingTimer = window.setTimeout(() => {
        landingTimer = -1
        landingPoint.value = null
      }, 260)
      options.refreshGameView()
      if (capturedFlights.value.length > 0) {
        scheduleCapturedFlightAnimation()
      }
      if (result.advancePending) {
        options.diceHandoffHiding.value = false
        options.scheduleTurnAdvance(1200)
      }
    }

    const frame = (now: number) => {
      const elapsed = now - startTime

      if (totalSteps <= 0) {
        finishMove()
        return
      }

      const clampedElapsed = Math.min(elapsed, totalDuration)
      const currentStep = Math.min(
        totalSteps - 1,
        Math.floor(clampedElapsed / stepDuration),
      )
      const stepElapsed = clampedElapsed - currentStep * stepDuration
      const isFlying = stepElapsed < flightDuration
      const stepProgress = isFlying ? stepElapsed / flightDuration : 1
      const easedProgress = easeInOutSine(stepProgress)
      const start = pathPoints[currentStep]
      const end = pathPoints[currentStep + 1] ?? start

      if (!start || !end) {
        finishMove()
        return
      }

      const currentPosition = interpolatePoint(start, end, easedProgress)
      const lift = isFlying ? Math.sin(stepProgress * Math.PI) * hopLift : 0

      movingPoint.value = {
        x: currentPosition.x,
        y: currentPosition.y - lift,
      }
      options.renderScene()

      if (elapsed < totalDuration) {
        moveFrameId = window.requestAnimationFrame(frame)
        return
      }

      finishMove()
    }

    moveFrameId = window.requestAnimationFrame(frame)
  }

  return {
    replayingPieceId,
    movePath,
    replayingStartProgress,
    movingPoint,
    landingPoint,
    capturedFlights,
    clearMovePreview,
    clearMoveTimers,
    resetMoveState,
    handleMove,
  }
}
