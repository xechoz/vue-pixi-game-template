import { ref, type ComputedRef, type Ref } from 'vue'

import {
  advanceTurn,
  chooseAutoMovePieceId,
  getPlayerTrackCount,
  type GameState,
  type PlayerState,
} from '../../game'
import type { Point, RefreshGameView } from './types'

type TurnControllerOptions = {
  game: Ref<GameState>
  currentPlayer: ComputedRef<PlayerState>
  legalPieces: ComputedRef<string[]>
  autoPlayMode: Ref<boolean>
  isRolling: Ref<boolean>
  movingPoint: Ref<Point | null>
  isPlayPageActive: () => boolean
  renderScene: () => void
  refreshGameView: RefreshGameView
  clearTimers: () => void
  handleRoll: (fromAuto?: boolean) => void
  handleMove: (pieceId: string) => void
}

export function createTurnController(options: TurnControllerOptions) {
  const legalPulse = ref(0)
  const isTurnTransitioning = ref(false)
  const diceHandoffHiding = ref(false)

  let autoTimer: number | null = null
  let autoMoveTimer: number | null = null
  let turnAdvanceTimer: number | null = null
  let turnAccentFrameId: number | null = null

  function isHumanTurn() {
    return options.currentPlayer.value.humanControlled
  }

  function clearAutoTimers() {
    if (autoTimer !== null) {
      window.clearTimeout(autoTimer)
      autoTimer = null
    }
    if (autoMoveTimer !== null) {
      window.clearTimeout(autoMoveTimer)
      autoMoveTimer = null
    }
  }

  function stopTurnAccentAnimation() {
    if (turnAccentFrameId !== null) {
      window.cancelAnimationFrame(turnAccentFrameId)
      turnAccentFrameId = null
    }
    legalPulse.value = 0
  }

  function clearTurnTimers() {
    clearAutoTimers()
    if (turnAdvanceTimer !== null) {
      window.clearTimeout(turnAdvanceTimer)
      turnAdvanceTimer = null
    }
    isTurnTransitioning.value = false
    diceHandoffHiding.value = false
    stopTurnAccentAnimation()
  }

  function scheduleTurnAdvance(delay = 2000) {
    if (!options.isPlayPageActive() || options.game.value.winnerIndex !== null)
      return
    if (turnAdvanceTimer !== null) {
      window.clearTimeout(turnAdvanceTimer)
    }
    isTurnTransitioning.value = true
    const timer = window.setTimeout(() => {
      if (turnAdvanceTimer !== timer) return
      turnAdvanceTimer = null
      if (
        !options.isPlayPageActive() ||
        options.game.value.winnerIndex !== null
      ) {
        isTurnTransitioning.value = false
        return
      }
      advanceTurn(options.game.value)
      isTurnTransitioning.value = false
      diceHandoffHiding.value = false
      options.refreshGameView()
      if (!isHumanTurn() && options.autoPlayMode.value) {
        scheduleAutoTurn(220)
      }
    }, delay)
    turnAdvanceTimer = timer
  }

  function syncTurnAccentAnimation() {
    stopTurnAccentAnimation()

    const shouldAnimate =
      options.isPlayPageActive() &&
      options.game.value.winnerIndex === null &&
      options.game.value.dice !== null &&
      !options.isRolling.value &&
      options.movingPoint.value === null &&
      options.legalPieces.value.length > 0

    if (!shouldAnimate) return

    const tick = (now: number) => {
      if (
        !options.isPlayPageActive() ||
        options.game.value.winnerIndex !== null ||
        options.game.value.dice === null ||
        options.isRolling.value ||
        options.movingPoint.value !== null ||
        options.legalPieces.value.length === 0
      ) {
        stopTurnAccentAnimation()
        options.renderScene()
        return
      }

      legalPulse.value = 0.45 + 0.55 * Math.sin(now / 160)
      options.renderScene()
      turnAccentFrameId = window.requestAnimationFrame(tick)
    }

    turnAccentFrameId = window.requestAnimationFrame(tick)
  }

  function getHumanAutoMovePieceId() {
    if (
      options.game.value.dice === null ||
      options.game.value.winnerIndex !== null
    )
      return null
    const legalIds = options.legalPieces.value
    if (legalIds.length === 0) return null
    if (legalIds.length === 1) return legalIds[0] ?? null
    if (
      getPlayerTrackCount(options.currentPlayer.value) === 0 &&
      options.game.value.dice === 6
    )
      return legalIds[0] ?? null
    return null
  }

  function scheduleAutoTurn(delay = 180) {
    if (!options.isPlayPageActive() || options.game.value.winnerIndex !== null)
      return
    if (isTurnTransitioning.value || !options.autoPlayMode.value) return
    if (autoTimer !== null) {
      window.clearTimeout(autoTimer)
    }
    const timer = window.setTimeout(() => {
      if (autoTimer !== timer) return
      autoTimer = null
      if (
        !options.isPlayPageActive() ||
        !options.autoPlayMode.value ||
        options.game.value.winnerIndex !== null
      )
        return
      playAutoTurn()
    }, delay)
    autoTimer = timer
  }

  function scheduleAutoMove(action: () => void, delay: number) {
    if (
      !options.isPlayPageActive() ||
      !options.autoPlayMode.value ||
      options.game.value.winnerIndex !== null
    )
      return
    if (autoMoveTimer !== null) {
      window.clearTimeout(autoMoveTimer)
    }
    const timer = window.setTimeout(() => {
      if (autoMoveTimer !== timer) return
      autoMoveTimer = null
      if (
        !options.isPlayPageActive() ||
        !options.autoPlayMode.value ||
        options.game.value.winnerIndex !== null
      )
        return
      action()
    }, delay)
    autoMoveTimer = timer
  }

  function playAutoTurn() {
    if (
      !options.isPlayPageActive() ||
      !options.autoPlayMode.value ||
      options.game.value.winnerIndex !== null
    ) {
      clearAutoTimers()
      return
    }
    if (
      isTurnTransitioning.value ||
      options.isRolling.value ||
      options.movingPoint.value !== null
    )
      return

    if (options.game.value.dice === null) {
      if (!isHumanTurn()) {
        scheduleAutoMove(() => options.handleRoll(true), 220)
      }
      return
    }

    const pieceId = isHumanTurn()
      ? getHumanAutoMovePieceId()
      : chooseAutoMovePieceId(options.game.value)
    if (!pieceId) {
      if (!isHumanTurn()) {
        scheduleTurnAdvance(2000)
      }
      return
    }

    scheduleAutoMove(
      () => options.handleMove(pieceId),
      isHumanTurn() ? 180 : 260,
    )
  }

  return {
    legalPulse,
    isTurnTransitioning,
    diceHandoffHiding,
    isHumanTurn,
    clearAutoTimers,
    clearTurnTimers,
    stopTurnAccentAnimation,
    syncTurnAccentAnimation,
    getHumanAutoMovePieceId,
    scheduleAutoTurn,
    scheduleAutoMove,
    scheduleTurnAdvance,
    playAutoTurn,
  }
}
