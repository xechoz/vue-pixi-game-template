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

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t
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

    const hopLift = Math.max(8, animPathPoints.length * 2)
    const totalDuration = Math.max(420, (animPathPoints.length - 1) * 120)
    const startTime = performance.now()
    const stepDelay = 100
    const pathPoints = animPathPoints

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
        options.scheduleTurnAdvance(2000)
      }
    }

    const frame = (now: number) => {
      const elapsed = now - startTime
      const totalSteps = pathPoints.length - 1

      if (totalSteps <= 0) {
        finishMove()
        return
      }

      const rawStep = Math.min(totalSteps, Math.floor(elapsed / stepDelay))
      const segmentProgress = Math.min(1, (elapsed % stepDelay) / stepDelay)
      const currentStep = Math.max(0, Math.min(totalSteps - 1, rawStep))
      const start = pathPoints[currentStep]
      const end = pathPoints[currentStep + 1] ?? start

      if (!start || !end) {
        finishMove()
        return
      }

      const lift = Math.sin(segmentProgress * Math.PI) * hopLift

      movingPoint.value = {
        x: lerp(start.x, end.x, segmentProgress),
        y: lerp(start.y, end.y, segmentProgress) - lift,
      }
      options.renderScene()

      if (elapsed < totalDuration && rawStep < totalSteps) {
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
