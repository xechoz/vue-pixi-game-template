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

  let landingTimer: number = -1
  let moveFrameId: number = -1

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

    options.clearTimers()
    replayingStartProgress.value = startProgress
    const result = movePiece(options.game.value, pieceId)
    if (!result.moved) {
      replayingStartProgress.value = -1
      clearMovePreview()
      options.refreshGameView()
      return
    }

    const willWin = result.message.includes('胜利')
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
      if (result.message.includes('吃子')) options.playFailSound()
      if (result.message.includes('胜利')) options.playWinSound()
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
    clearMovePreview,
    clearMoveTimers,
    resetMoveState,
    handleMove,
  }
}
