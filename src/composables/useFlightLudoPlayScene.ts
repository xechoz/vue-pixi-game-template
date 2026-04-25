import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as PIXI from 'pixi.js'

import {
  type GameMode,
  type GameState,
  PLAYER_DEFS,
  TRACK_LENGTH,
  advanceTurn,
  buildMoveTrajectory,
  chooseAutoMovePieceId,
  clampPiecesPerPlayer,
  createGame,
  getCurrentPlayer,
  getLegalPieceIds,
  getPieceLocation,
  getPlayerTrackCount,
  getTrackCellIndex,
  movePiece,
  rollDice,
} from '../game'

export type AppPage = 'prepare' | 'play' | 'result'

interface PlayScreenHost {
  canvasEl: HTMLDivElement | null
}

interface UseFlightLudoPlaySceneOptions {
  page: Ref<AppPage>
  mode: Ref<GameMode>
  piecesPerPlayer: Ref<number>
  autoPlayMode: Ref<boolean>
  playScreenRef: Ref<PlayScreenHost | null>
}

type BoardLayout = {
  trackPoints: Array<{ x: number; y: number }>
  baseSlots: Array<Array<{ x: number; y: number }>>
  finishSlots: Array<Array<{ x: number; y: number }>>
}

export function useFlightLudoPlayScene(options: UseFlightLudoPlaySceneOptions) {
  const currentPlayer = computed(() => getCurrentPlayer(game.value))
  const legalPieces = computed(() => getLegalPieceIds(game.value))
  const winner = computed(() =>
    game.value.winnerIndex === null ? null : game.value.players[game.value.winnerIndex],
  )

  const assetBase = import.meta.env.BASE_URL
  function assetUrl(name: string) {
    return `${assetBase}${name}`
  }

  const canvasEl = computed(() => options.playScreenRef.value?.canvasEl ?? null)
  const game = ref<GameState>(
    createGame({
      mode: options.mode.value,
      piecesPerPlayer: options.piecesPerPlayer.value,
    }),
  )

  let app: PIXI.Application | null = null
  let scene: PIXI.Container | null = null
  let pieceTexture: PIXI.Texture | null = null
  let playerPieceTextures: Partial<Record<number, PIXI.Texture>> = {}
  const diceTextures: Partial<Record<number, PIXI.Texture>> = {}
  let currentLayout: BoardLayout | null = null

  const replayingPieceId = ref<string | null>(null)
  const movePath = ref<number[]>([])
  const movingPoint = ref<{ x: number; y: number } | null>(null)
  const landingPoint = ref<{ x: number; y: number; color: string } | null>(null)
  const rollingFace = ref<number>(1)
  const diceSpinScale = ref(1)
  const diceIdlePulse = ref(0)
  const diceIdleShake = ref(0)
  const diceIdleLift = ref(0)
  const isRolling = ref(false)
  const isTurnTransitioning = ref(false)

  let rollTimer: number | null = null
  let rollFrameId: number | null = null
  let diceIdleFrameId: number | null = null
  let diceIdleStart = 0
  let autoTimer: number | null = null
  let autoMoveTimer: number | null = null
  let turnAdvanceTimer: number | null = null
  let landingTimer: number | null = null
  let moveFrameId: number | null = null
  let appInitPromise: Promise<void> | null = null
  let audioCtx: AudioContext | null = null

  function lerp(start: number, end: number, t: number) {
    return start + (end - start) * t
  }

  function hexToNumber(color: string) {
    return Number.parseInt(color.replace('#', ''), 16)
  }

  function clearMovePreview() {
    replayingPieceId.value = null
    movePath.value = []
    movingPoint.value = null
    landingPoint.value = null
  }

  function stopDiceIdleAnimation() {
    if (diceIdleFrameId !== null) {
      window.cancelAnimationFrame(diceIdleFrameId)
      diceIdleFrameId = null
    }
    diceIdlePulse.value = 0
    diceIdleShake.value = 0
    diceIdleLift.value = 0
  }

  function clearTimers() {
    if (rollTimer !== null) {
      window.clearTimeout(rollTimer)
      rollTimer = null
    }
    if (rollFrameId !== null) {
      window.cancelAnimationFrame(rollFrameId)
      rollFrameId = null
    }
    if (diceIdleFrameId !== null) {
      window.cancelAnimationFrame(diceIdleFrameId)
      diceIdleFrameId = null
    }
    if (autoTimer !== null) {
      window.clearTimeout(autoTimer)
      autoTimer = null
    }
    if (autoMoveTimer !== null) {
      window.clearTimeout(autoMoveTimer)
      autoMoveTimer = null
    }
    if (turnAdvanceTimer !== null) {
      window.clearTimeout(turnAdvanceTimer)
      turnAdvanceTimer = null
    }
    if (landingTimer !== null) {
      window.clearTimeout(landingTimer)
      landingTimer = null
    }
    if (moveFrameId !== null) {
      window.cancelAnimationFrame(moveFrameId)
      moveFrameId = null
    }
    isTurnTransitioning.value = false
    stopDiceIdleAnimation()
  }

  function getDiceDisplayValue() {
    if (isRolling.value) return rollingFace.value
    return game.value.dice
  }

  function isHumanTurn() {
    return currentPlayer.value.humanControlled
  }

  function createDiceBackdropTint(value: number) {
    const palette: Record<number, number> = {
      1: 0xf8fafc,
      2: 0xfde68a,
      3: 0xfca5a5,
      4: 0x93c5fd,
      5: 0xa7f3d0,
      6: 0xd8b4fe,
    }
    return palette[value] ?? 0xf8fafc
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return null
    audioCtx = new AudioCtor()
    return audioCtx
  }

  function playTone(frequency: number, duration = 0.09, type: OscillatorType = 'sine', gainValue = 0.04) {
    const ctx = ensureAudioContext()
    if (!ctx) return
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gainNode.gain.value = gainValue
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(gainValue, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  function playRollSound() {
    playTone(660, 0.06, 'square', 0.03)
    window.setTimeout(() => playTone(880, 0.09, 'square', 0.035), 60)
  }

  function playMoveSound() {
    playTone(392, 0.08, 'triangle', 0.03)
    window.setTimeout(() => playTone(523.25, 0.08, 'triangle', 0.028), 70)
  }

  function playCaptureSound() {
    playTone(220, 0.12, 'sawtooth', 0.03)
    window.setTimeout(() => playTone(165, 0.14, 'sawtooth', 0.028), 90)
  }

  function playWinSound() {
    playTone(523.25, 0.12, 'triangle', 0.03)
    window.setTimeout(() => playTone(659.25, 0.12, 'triangle', 0.028), 110)
    window.setTimeout(() => playTone(783.99, 0.16, 'triangle', 0.03), 220)
  }

  function resolvePiecePoint(
    layout: BoardLayout,
    player: { index: number; startIndex: number },
    piece: { progress: number },
  ) {
    const centerX = layout.trackPoints[0]?.x ?? 0
    const centerY = layout.trackPoints[0]?.y ?? 0

    if (piece.progress < 0) {
      return layout.baseSlots[player.index]?.[0] ?? { x: centerX, y: centerY }
    }

    if (piece.progress < TRACK_LENGTH) {
      const trackIndex = (player.startIndex + piece.progress) % TRACK_LENGTH
      return layout.trackPoints[trackIndex] ?? { x: centerX, y: centerY }
    }

    if (piece.progress < TRACK_LENGTH + 4) {
      const laneIndex = piece.progress - TRACK_LENGTH
      return layout.finishSlots[player.index]?.[laneIndex] ?? { x: centerX, y: centerY }
    }

    return layout.finishSlots[player.index]?.[3] ?? { x: centerX, y: centerY }
  }

  function buildPiecePath(
    layout: BoardLayout,
    player: { index: number; startIndex: number },
    piece: { progress: number },
    dice: number,
  ) {
    const path: Array<{ x: number; y: number }> = []
    let progress = piece.progress

    if (progress < 0) {
      if (dice !== 6) return path
      path.push(resolvePiecePoint(layout, player, { progress: 0 }))
      return path
    }

    const target = Math.min(progress + dice, TRACK_LENGTH + 4)
    while (progress < target) {
      progress += 1
      path.push(resolvePiecePoint(layout, player, { progress }))
    }

    return path
  }

  function getPlayerByPieceId(state: GameState, pieceId: string) {
    return state.players.find((player) => player.pieces.some((piece) => piece.id === pieceId)) ?? null
  }

  function scheduleTurnAdvance(delay = 2000) {
    if (game.value.winnerIndex !== null) return
    if (turnAdvanceTimer !== null) {
      window.clearTimeout(turnAdvanceTimer)
    }
    isTurnTransitioning.value = true
    turnAdvanceTimer = window.setTimeout(() => {
      turnAdvanceTimer = null
      advanceTurn(game.value)
      isTurnTransitioning.value = false
      refreshGameView()
      if (!isHumanTurn() && options.autoPlayMode.value) {
        scheduleAutoTurn(220)
      }
    }, delay)
  }

  async function ensurePixiReady() {
    if (!canvasEl.value) return

    if (app && scene) {
      if (app.canvas.parentElement !== canvasEl.value) {
        canvasEl.value.appendChild(app.canvas)
        renderScene()
      }
      return
    }

    if (appInitPromise) {
      await appInitPromise
      return
    }

    const host = canvasEl.value
    if (!host) return

    appInitPromise = (async () => {
      app = new PIXI.Application()
      await app.init({
        resizeTo: host,
        background: '#050b16',
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })

      host.appendChild(app.canvas)
      scene = new PIXI.Container()
      app.stage.addChild(scene)

      const [loadedPiece, redPiece, yellowPiece, bluePiece, greenPiece, ...diceFaces] = await Promise.all([
        PIXI.Assets.load(assetUrl('flight-ludo-plane.svg')),
        PIXI.Assets.load(assetUrl('player-red.png')),
        PIXI.Assets.load(assetUrl('player-yellow.png')),
        PIXI.Assets.load(assetUrl('player-blue.png')),
        PIXI.Assets.load(assetUrl('player-green.png')),
        PIXI.Assets.load(assetUrl('dice-1.svg')),
        PIXI.Assets.load(assetUrl('dice-2.svg')),
        PIXI.Assets.load(assetUrl('dice-3.svg')),
        PIXI.Assets.load(assetUrl('dice-4.svg')),
        PIXI.Assets.load(assetUrl('dice-5.svg')),
        PIXI.Assets.load(assetUrl('dice-6.svg')),
      ])
      pieceTexture = loadedPiece instanceof PIXI.Texture ? loadedPiece : PIXI.Texture.from(assetUrl('flight-ludo-plane.svg'))
      playerPieceTextures = {
        0: redPiece instanceof PIXI.Texture ? redPiece : PIXI.Texture.from(assetUrl('player-red.png')),
        1: yellowPiece instanceof PIXI.Texture ? yellowPiece : PIXI.Texture.from(assetUrl('player-yellow.png')),
        2: bluePiece instanceof PIXI.Texture ? bluePiece : PIXI.Texture.from(assetUrl('player-blue.png')),
        3: greenPiece instanceof PIXI.Texture ? greenPiece : PIXI.Texture.from(assetUrl('player-green.png')),
      }
      diceTextures[1] = diceFaces[0] instanceof PIXI.Texture ? diceFaces[0] : PIXI.Texture.from(assetUrl('dice-1.svg'))
      diceTextures[2] = diceFaces[1] instanceof PIXI.Texture ? diceFaces[1] : PIXI.Texture.from(assetUrl('dice-2.svg'))
      diceTextures[3] = diceFaces[2] instanceof PIXI.Texture ? diceFaces[2] : PIXI.Texture.from(assetUrl('dice-3.svg'))
      diceTextures[4] = diceFaces[3] instanceof PIXI.Texture ? diceFaces[3] : PIXI.Texture.from(assetUrl('dice-4.svg'))
      diceTextures[5] = diceFaces[4] instanceof PIXI.Texture ? diceFaces[4] : PIXI.Texture.from(assetUrl('dice-5.svg'))
      diceTextures[6] = diceFaces[5] instanceof PIXI.Texture ? diceFaces[5] : PIXI.Texture.from(assetUrl('dice-6.svg'))
    })()

    try {
      await appInitPromise
    } finally {
      appInitPromise = null
    }

    renderScene()
  }

  function syncDiceIdleAnimation() {
    stopDiceIdleAnimation()

    const shouldAnimate =
      options.page.value === 'play' &&
      game.value.winnerIndex === null &&
      game.value.dice === null &&
      !isRolling.value &&
      movingPoint.value === null

    if (!shouldAnimate) return

    // 之前这里用 RAF 持续整页重绘来做骰子呼吸动画，
    // 但会反复创建/销毁整张棋盘与所有棋子，容易在多回合后造成卡死或崩溃。
    // 现在只做一次轻量刷新，避免无限重绘循环。
    diceIdleStart = performance.now()
    diceIdleShake.value = Math.sin(diceIdleStart / 120)
    diceIdleLift.value = Math.sin(diceIdleStart / 420) * 2
    diceIdlePulse.value = 0.5 + 0.5 * Math.sin(diceIdleStart / 260)
    renderScene()
  }

  function getDiceTexture(value: number) {
    return diceTextures[value] ?? null
  }

  function getPlayerPieceTexture(playerIndex: number) {
    return playerPieceTextures[playerIndex] ?? pieceTexture
  }

  function renderScene() {
    if (!app || !scene) return

    const removable = scene.removeChildren()
    for (const child of removable) {
      child.destroy({ children: true })
    }

    const { width, height } = app.screen
    const boardSize = Math.min(width, height) - 72
    const safeBoardSize = Math.max(240, boardSize)
    const originX = (width - safeBoardSize) / 2
    const originY = (height - safeBoardSize) / 2
    const cellSize = safeBoardSize * 0.06
    const trackSize = cellSize * 0.68
    const pieceRadius = cellSize * 0.28

    const board = new PIXI.Container()
    scene.addChild(board)

    const boardInset = safeBoardSize * 0.12
    const innerLeft = originX + boardInset
    const innerTop = originY + boardInset
    const innerRight = originX + safeBoardSize - boardInset
    const innerBottom = originY + safeBoardSize - boardInset
    const centerX = originX + safeBoardSize / 2
    const centerY = originY + safeBoardSize / 2

    const currentPlayerGlow = new PIXI.Graphics()
      .roundRect(originX + 8, originY + 8, safeBoardSize - 16, safeBoardSize - 16, 30)
      .stroke({ color: hexToNumber(currentPlayer.value.color), width: 5, alpha: isRolling.value ? 0.42 : 0.22 })
    board.addChild(currentPlayerGlow)

    if (isRolling.value) {
      const pulse = new PIXI.Graphics()
        .circle(centerX, centerY, safeBoardSize * 0.26)
        .stroke({ color: hexToNumber(currentPlayer.value.color), width: 4, alpha: 0.22 })
      board.addChild(pulse)
    }


    const homes = new PIXI.Graphics()
    homes
      .roundRect(originX + 16, originY + 16, safeBoardSize - 32, safeBoardSize - 32, 22)
      .stroke({ color: 0x1e293b, width: 1, alpha: 0.5 })
    homes
      .roundRect(innerLeft, innerTop, innerRight - innerLeft, innerBottom - innerTop, 18)
      .fill({ color: 0x172033, alpha: 0.95 })
      .stroke({ color: 0x263244, width: 2, alpha: 0.9 })
    board.addChild(homes)

    const buildTrackPoints = (originXValue: number, originYValue: number, size: number) => {
      const left = originXValue + size * 0.14
      const right = originXValue + size * 0.86
      const top = originYValue + size * 0.14
      const bottom = originYValue + size * 0.86

      return Array.from({ length: TRACK_LENGTH }, (_, index) => {
        const progress = index / 10
        const side = Math.floor(progress)
        const local = progress - side

        if (side === 0) return { x: lerp(left, right, local), y: top }
        if (side === 1) return { x: right, y: lerp(top, bottom, local) }
        if (side === 2) return { x: lerp(right, left, local), y: bottom }
        return { x: left, y: lerp(bottom, top, local) }
      })
    }

    const buildBaseSlots = (originXValue: number, originYValue: number, size: number) => {
      const zoneSize = size * 0.085
      const spread = zoneSize * 0.22

      const zones = [
        { x: originXValue - zoneSize * 0.66, y: originYValue - zoneSize * 0.66 },
        { x: originXValue + size - zoneSize * 0.34, y: originYValue - zoneSize * 0.66 },
        { x: originXValue + size - zoneSize * 0.34, y: originYValue + size - zoneSize * 0.34 },
        { x: originXValue - zoneSize * 0.66, y: originYValue + size - zoneSize * 0.34 },
      ]

      return zones.map((zone) => {
        const centerX = zone.x + zoneSize / 2
        const centerY = zone.y + zoneSize / 2
        return [
          { x: centerX - spread, y: centerY - spread },
          { x: centerX + spread, y: centerY - spread },
          { x: centerX - spread, y: centerY + spread },
          { x: centerX + spread, y: centerY + spread },
        ]
      })
    }

    const buildFinishSlots = (originXValue: number, originYValue: number, size: number) => {
      const centerXValue = originXValue + size / 2
      const centerYValue = originYValue + size / 2
      const offset = size * 0.11
      const gap = size * 0.055

      const corners = [
        { x: centerXValue - offset, y: centerYValue - offset },
        { x: centerXValue + offset, y: centerYValue - offset },
        { x: centerXValue + offset, y: centerYValue + offset },
        { x: centerXValue - offset, y: centerYValue + offset },
      ]

      return corners.map((corner, index) => {
        const xDir = index === 0 || index === 3 ? -1 : 1
        const yDir = index === 0 || index === 1 ? -1 : 1
        return [
          { x: corner.x - gap, y: corner.y - gap },
          { x: corner.x + xDir * gap, y: corner.y - gap },
          { x: corner.x - gap, y: corner.y + yDir * gap },
          { x: corner.x + xDir * gap, y: corner.y + yDir * gap },
        ]
      })
    }

    const trackPoints = buildTrackPoints(originX, originY, safeBoardSize)
    const baseSlots = buildBaseSlots(originX, originY, safeBoardSize)
    const finishSlots = buildFinishSlots(originX, originY, safeBoardSize)
    currentLayout = { trackPoints, baseSlots, finishSlots }

    let activeDiceAnchor = { x: centerX, y: centerY }

    for (let index = 0; index < trackPoints.length; index += 1) {
      const point = trackPoints[index]
      const cell = new PIXI.Graphics()
      const playerIndex = Math.floor(index / 10) % PLAYER_DEFS.length
      const activeColor = game.value.players[playerIndex].color
      cell
        .roundRect(point.x - trackSize / 2, point.y - trackSize / 2, trackSize, trackSize, 9)
        .fill({ color: 0xe2e8f0, alpha: 0.07 })
        .stroke({ color: activeColor, width: index % 10 === 0 ? 3 : 1, alpha: 0.35 })
      board.addChild(cell)
    }

    for (const player of game.value.players) {
      const playerBase = new PIXI.Graphics()
      const zoneSize = safeBoardSize * 0.105
      const zonePadding = safeBoardSize * 0.008
      const zoneX = player.index === 0 || player.index === 3 ? originX + zonePadding : originX + safeBoardSize - zonePadding - zoneSize
      const zoneY = player.index === 0 || player.index === 1 ? originY + zonePadding : originY + safeBoardSize - zonePadding - zoneSize

      const isActivePlayer = game.value.currentPlayerIndex === player.index
      playerBase
        .roundRect(zoneX, zoneY, zoneSize, zoneSize, 14)
        .fill({ color: player.color, alpha: isActivePlayer ? 0.1 : 0.07 })
        .stroke({ color: player.color, width: isActivePlayer ? 3 : 2, alpha: isActivePlayer ? 0.3 : 0.2 })
      board.addChild(playerBase)

      if (isActivePlayer) {
        const diceHalf = safeBoardSize * 0.09
        const diceGap = safeBoardSize * 0.012
        const diceYOffset = safeBoardSize * 0.09
        activeDiceAnchor = {
          x:
            player.index === 0 || player.index === 3
              ? zoneX + zoneSize + diceHalf + diceGap
              : zoneX - diceHalf - diceGap,
          y:
            player.index === 0 || player.index === 1
              ? zoneY + zoneSize / 2 - diceYOffset
              : zoneY + zoneSize / 2 + diceYOffset,
        }
      }

      const finish = finishSlots[player.index]
      const gapSize = () => safeBoardSize * 0.028
      const finishBox = new PIXI.Graphics()
      finishBox
        .roundRect(finish[0].x - gapSize(), finish[0].y - gapSize(), gapSize() * 2, gapSize() * 2, 12)
        .fill({ color: player.color, alpha: 0.08 })
        .stroke({ color: player.color, width: 1, alpha: 0.24 })
      board.addChild(finishBox)
    }

    const canRoll = game.value.winnerIndex === null && game.value.dice === null && !isTurnTransitioning.value && (isHumanTurn() || !options.autoPlayMode.value)

    const center = new PIXI.Container()
    center.position.set(activeDiceAnchor.x, activeDiceAnchor.y)
    center.eventMode = 'passive'
    center.cursor = 'default'
    board.addChild(center)

    const diceSize = safeBoardSize * 0.18
    const currentDiceColor = game.value.winnerIndex === null ? currentPlayer.value.color : '#64748b'
    const currentDiceTint = hexToNumber(currentDiceColor)
    const diceValue = getDiceDisplayValue()
    const diceFaceTexture = diceValue === null ? null : getDiceTexture(diceValue)

    const diceGroup = new PIXI.Container()
    diceGroup.eventMode = canRoll ? 'static' : 'passive'
    diceGroup.cursor = canRoll ? 'pointer' : 'default'
    diceGroup.hitArea = new PIXI.Rectangle(-diceSize * 0.68, -diceSize * 0.68, diceSize * 1.36, diceSize * 1.36)
    if (canRoll) {
      diceGroup.on('pointerdown', () => handleRoll(false))
    }
    diceGroup.scale.set(diceSpinScale.value)
    center.addChild(diceGroup)

    const diceBackPlate = new PIXI.Graphics()
      .roundRect(-diceSize / 2 + 6, -diceSize / 2 + 8, diceSize, diceSize, 24)
      .fill({ color: 0x020617, alpha: 0.28 })
      .stroke({ color: 0x000000, width: 1, alpha: 0.16 })
    diceGroup.addChildAt(diceBackPlate, 0)

    const diceBody = new PIXI.Graphics()
      .roundRect(-diceSize / 2, -diceSize / 2, diceSize, diceSize, 22)
      .fill({ color: createDiceBackdropTint(diceValue ?? rollingFace.value), alpha: 0.88 })
      .stroke({ color: 0xffffff, width: 3, alpha: 0.58 })
    diceGroup.addChild(diceBody)

    const diceGlow = new PIXI.Graphics()
      .roundRect(-diceSize * 0.62 / 2, -diceSize * 0.62 / 2, diceSize * 0.62, diceSize * 0.62, 18)
      .stroke({ color: currentDiceTint, width: 3, alpha: 0.18 })
    diceGroup.addChildAt(diceGlow, 0)

    const edgeShadow = new PIXI.Graphics()
      .roundRect(-diceSize / 2 + 2, -diceSize / 2 + 3, diceSize - 4, diceSize - 4, 20)
      .stroke({ color: 0x0f172a, width: 6, alpha: 0.16 })
    diceGroup.addChild(edgeShadow)

    if (diceFaceTexture) {
      const face = new PIXI.Sprite(diceFaceTexture)
      face.anchor.set(0.5)
      face.width = diceSize * 0.94
      face.height = diceSize * 0.94
      diceGroup.addChild(face)
    }

    if (diceValue === null) {
      const idleMark = new PIXI.Graphics()
        .circle(0, 0, diceSize * 0.26)
        .stroke({ color: currentDiceTint, width: 4, alpha: 0.16 + diceIdlePulse.value * 0.18 })
      diceGroup.addChild(idleMark)

      const idleDot = new PIXI.Graphics()
        .circle(0, 0, diceSize * 0.08)
        .fill({ color: 0xffffff, alpha: 0.9 })
      diceGroup.addChild(idleDot)

      const idleSquares = 1 + Math.floor(((rollingFace.value || 1) - 1) / 2)
      const offset = diceSize * 0.18
      for (let i = 0; i < idleSquares; i += 1) {
        const dot = new PIXI.Graphics()
          .circle(-offset + i * offset, 0, diceSize * 0.045)
          .fill({ color: currentDiceTint, alpha: 0.14 + diceIdlePulse.value * 0.12 })
        diceGroup.addChild(dot)
      }
    }

    const diceScaleBoost = 1 + diceIdlePulse.value * 0.05 + (isRolling.value ? 0.06 : 0)
    const shakeX = diceIdleShake.value * (isRolling.value ? 4 : 3)
    const shakeY = Math.sin(diceIdleShake.value * Math.PI * 0.5) * 2
    diceGroup.position.set(shakeX, shakeY - diceIdleLift.value)
    diceGroup.scale.set(diceSpinScale.value * diceScaleBoost)

    if (isRolling.value) {
      const spinRing = new PIXI.Graphics()
        .circle(0, 0, diceSize * 0.74)
        .stroke({ color: currentDiceTint, width: 4, alpha: 0.25 })
      diceGroup.addChildAt(spinRing, 0)
    }

    if (winner.value) {
      const banner = new PIXI.Graphics()
        .roundRect(originX + safeBoardSize * 0.18, originY + safeBoardSize * 0.36, safeBoardSize * 0.64, safeBoardSize * 0.16, 24)
        .fill({ color: 0x020617, alpha: 0.9 })
        .stroke({ color: winner.value.color, width: 3, alpha: 0.9 })
      board.addChild(banner)
    }

    if (landingPoint.value) {
      const pulse = new PIXI.Graphics()
        .circle(landingPoint.value.x, landingPoint.value.y, pieceRadius * 1.25)
        .stroke({ color: hexToNumber(landingPoint.value.color), width: 3, alpha: 0.35 })
      board.addChild(pulse)
    }

    if (currentLayout && replayingPieceId.value && movePath.value.length > 0) {
      const player = getPlayerByPieceId(game.value, replayingPieceId.value)
      const piece = player?.pieces.find((item) => item.id === replayingPieceId.value)
      if (player && piece && currentLayout) {
        const layout = currentLayout
        const pathPoints = [
          resolvePiecePoint(layout, player, piece),
          ...movePath.value.map((progress) => resolvePiecePoint(layout, player, { progress })),
        ]

        const trail = new PIXI.Graphics()
        trail.moveTo(pathPoints[0].x, pathPoints[0].y)
        for (const point of pathPoints.slice(1)) {
          trail.lineTo(point.x, point.y)
        }
        trail.stroke({ color: player.color, width: 5, alpha: 0.45 })
        board.addChild(trail)

        for (const point of pathPoints.slice(1)) {
          const marker = new PIXI.Graphics()
            .circle(point.x, point.y, 8)
            .fill({ color: 0xffffff, alpha: 0.14 })
            .stroke({ color: player.color, width: 2, alpha: 0.6 })
          board.addChild(marker)
        }
      }
    }

    const pieces = game.value.players.flatMap((player) =>
      player.pieces.map((piece, pieceIndex) => {
        const location = getPieceLocation(player, piece)
        let x = originX + safeBoardSize / 2
        let y = originY + safeBoardSize / 2

        if (location === 'base') {
          const slot = baseSlots[player.index][pieceIndex] ?? baseSlots[player.index][0]
          x = slot.x
          y = slot.y
        } else if (location === 'track') {
          const trackIndex = getTrackCellIndex(player, piece)
          if (trackIndex !== null) {
            const point = trackPoints[trackIndex]
            x = point.x
            y = point.y
          }
        } else {
          const slot = finishSlots[player.index][pieceIndex] ?? finishSlots[player.index][0]
          x = slot.x
          y = slot.y
        }

        if (landingPoint.value && landingPoint.value.color === player.color && piece.progress >= 0) {
          const dx = x - landingPoint.value.x
          const dy = y - landingPoint.value.y
          if (Math.hypot(dx, dy) < pieceRadius * 4) {
            x += dx * 0.08
            y += dy * 0.08
          }
        }

        return { player, piece, pieceIndex, x, y, location }
      }),
    )

    for (const pieceInfo of pieces) {
      const isLegal = game.value.winnerIndex === null && legalPieces.value.includes(pieceInfo.piece.id)
      const isMoving = replayingPieceId.value === pieceInfo.piece.id && movingPoint.value !== null
      const movingPosition = movingPoint.value
      const pieceGroup = new PIXI.Container()
      pieceGroup.position.set(isMoving && movingPosition ? movingPosition.x : pieceInfo.x, isMoving && movingPosition ? movingPosition.y : pieceInfo.y)
      pieceGroup.eventMode = isLegal && !isMoving ? 'static' : 'passive'
      pieceGroup.cursor = isLegal && !isMoving ? 'pointer' : 'default'

      if (isLegal && !isMoving) {
        pieceGroup.on('pointerdown', () => handleMove(pieceInfo.piece.id))
      }

      const shadow = new PIXI.Graphics()
        .ellipse(2, 7, pieceRadius + 10, pieceRadius + 5)
        .fill({ color: 0x020617, alpha: 0.26 })
      pieceGroup.addChild(shadow)

      const tint = hexToNumber(pieceInfo.player.color)
      const texture = getPlayerPieceTexture(pieceInfo.player.index)
      if (texture) {
        const body = new PIXI.Sprite(texture)
        body.anchor.set(0.5)
        body.position.set(0, -2)
        body.width = pieceRadius * 5.2
        body.height = pieceRadius * 5.2
        pieceGroup.addChild(body)
      } else {
        const body = new PIXI.Graphics()
          .circle(0, 0, pieceRadius + 5)
          .fill({ color: tint, alpha: 1 })
          .stroke({ color: 0xffffff, width: 2, alpha: 0.88 })
        pieceGroup.addChild(body)
      }

      const badgeRing = new PIXI.Graphics()
        .circle(0, 0, pieceRadius + 8)
        .stroke({ color: tint, width: 3, alpha: 0.95 })
      pieceGroup.addChildAt(badgeRing, 0)

      const badgeGlow = new PIXI.Graphics()
        .circle(0, 0, pieceRadius + 2)
        .stroke({ color: 0xffffff, width: 2, alpha: isLegal ? 0.45 : 0.18 })
      pieceGroup.addChild(badgeGlow)

      if (game.value.currentPlayerIndex === pieceInfo.player.index && pieceInfo.location === 'base') {
        const halo = new PIXI.Graphics()
          .circle(0, 0, pieceRadius + 8)
          .stroke({ color: 0xf8fafc, width: 2, alpha: 0.18 })
        pieceGroup.addChildAt(halo, 0)
      }

      if (isLegal) {
        const ring = new PIXI.Graphics()
          .circle(0, 0, pieceRadius + 5)
          .stroke({ color: 0xf8fafc, width: 2, alpha: 0.3 })
        pieceGroup.addChildAt(ring, 0)
      }

      board.addChild(pieceGroup)
    }
  }

  function refreshGameView() {
    game.value = { ...game.value }
    renderScene()
    syncDiceIdleAnimation()
    if (game.value.winnerIndex !== null) {
      options.page.value = 'result'
    }
  }

  function scheduleAutoTurn(delay = 180) {
    if (game.value.winnerIndex !== null) return
    if (isTurnTransitioning.value || !options.autoPlayMode.value) return
    if (autoTimer !== null) {
      window.clearTimeout(autoTimer)
    }
    autoTimer = window.setTimeout(() => {
      autoTimer = null
      playAutoTurn()
    }, delay)
  }

  function startDiceSpin() {
    const startTime = performance.now()
    let lastTick = 0

    const spin = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / 760)
      const interval = Math.max(38, 120 - progress * 72)
      const tick = Math.floor(elapsed / interval)
      if (tick > lastTick) {
        rollingFace.value = Math.floor(Math.random() * 6) + 1
        lastTick = tick
      }
      diceSpinScale.value = 1 + Math.sin(progress * Math.PI) * 0.1
      renderScene()
      if (progress < 1) {
        rollFrameId = window.requestAnimationFrame(spin)
      } else {
        rollFrameId = null
        diceSpinScale.value = 1
        renderScene()
      }
    }

    rollFrameId = window.requestAnimationFrame(spin)
  }

  function getHumanAutoMovePieceId() {
    if (game.value.dice === null || game.value.winnerIndex !== null) return null
    const legalIds = legalPieces.value
    if (legalIds.length === 0) return null
    if (getPlayerTrackCount(currentPlayer.value) === 0 && game.value.dice === 6) return legalIds[0] ?? null
    if (legalIds.length === 1) return legalIds[0] ?? null
    return null
  }

  function playAutoTurn() {
    if (!options.autoPlayMode.value || game.value.winnerIndex !== null) return
    if (isTurnTransitioning.value || isRolling.value || movingPoint.value !== null) return

    if (game.value.dice === null) {
      if (!isHumanTurn()) {
        autoMoveTimer = window.setTimeout(() => {
          autoMoveTimer = null
          handleRoll(true)
        }, 220)
      }
      return
    }

    const pieceId = isHumanTurn() ? getHumanAutoMovePieceId() : chooseAutoMovePieceId(game.value)
    if (!pieceId) {
      if (!isHumanTurn()) {
        scheduleTurnAdvance(2000)
      }
      return
    }

    autoMoveTimer = window.setTimeout(() => {
      autoMoveTimer = null
      handleMove(pieceId)
    }, isHumanTurn() ? 180 : 260)
  }

  function handleRoll(fromAuto = false) {
    if (game.value.winnerIndex !== null || game.value.dice !== null || isRolling.value || isTurnTransitioning.value) return
    if (!isHumanTurn() && !fromAuto) return

    clearTimers()
    isRolling.value = true
    rollingFace.value = Math.floor(Math.random() * 6) + 1
    diceSpinScale.value = 1
    startDiceSpin()

    let ticks = 0
    const spin = () => {
      if (!isRolling.value) return
      rollingFace.value = Math.floor(Math.random() * 6) + 1
      ticks += 1
      if (ticks < 6) {
        rollTimer = window.setTimeout(spin, 55)
        return
      }

      isRolling.value = false
      rollTimer = null
      const result = rollDice(game.value)
      if (result.rolled) {
        playRollSound()
        refreshGameView()
        if (result.advancePending) {
          scheduleTurnAdvance(2000)
        }

        if (result.skipped) {
          if (!isHumanTurn() && options.autoPlayMode.value) {
            scheduleAutoTurn(220)
          }
          return
        }

        if (!isHumanTurn() && options.autoPlayMode.value) {
          scheduleAutoTurn(220)
        }
      }
    }

    spin()
  }

  function handleMove(pieceId: string) {
    if (!currentLayout || game.value.dice === null || game.value.winnerIndex !== null || movingPoint.value !== null) return

    const player = getCurrentPlayer(game.value)
    const piece = player.pieces.find((item) => item.id === pieceId)
    if (!piece) return

    const trajectory = buildMoveTrajectory(player, piece, game.value.dice)
    if (trajectory.length === 0) return

    clearTimers()
    replayingPieceId.value = pieceId
    movePath.value = trajectory

    const pathPoints = [
      resolvePiecePoint(currentLayout, player, piece),
      ...buildPiecePath(currentLayout, player, piece, game.value.dice),
    ]

    if (pathPoints.length <= 1) {
      const result = movePiece(game.value, pieceId)
      if (result.moved) {
        playMoveSound()
        if (result.message.includes('吃子')) playCaptureSound()
        if (result.message.includes('胜利')) playWinSound()
        clearMovePreview()
        refreshGameView()
        if (result.advancePending) {
          scheduleTurnAdvance(2000)
        } else if (!isHumanTurn() && options.autoPlayMode.value) scheduleAutoTurn(220)
      }
      return
    }

    const totalDuration = Math.max(420, (pathPoints.length - 1) * 130)
    const startTime = performance.now()
    const stepDelay = 110

    const frame = (now: number) => {
      const elapsed = now - startTime
      const totalSteps = pathPoints.length - 1
      const rawStep = Math.min(totalSteps, Math.floor(elapsed / stepDelay))
      const segmentProgress = Math.min(1, (elapsed % stepDelay) / stepDelay)
      const currentStep = Math.min(totalSteps - 1, rawStep)
      const start = pathPoints[currentStep]
      const end = pathPoints[currentStep + 1] ?? start

      movingPoint.value = {
        x: lerp(start.x, end.x, segmentProgress),
        y: lerp(start.y, end.y, segmentProgress),
      }
      renderScene()

      if (elapsed < totalDuration && rawStep < totalSteps) {
        moveFrameId = window.requestAnimationFrame(frame)
        return
      }

      moveFrameId = null
      movingPoint.value = null
      const result = movePiece(game.value, pieceId)
      if (result.moved) {
        playMoveSound()
        if (result.message.includes('吃子')) playCaptureSound()
        if (result.message.includes('胜利')) playWinSound()
        refreshGameView()
        clearMovePreview()
        landingPoint.value = { x: end.x, y: end.y, color: player.color }
        if (landingTimer !== null) window.clearTimeout(landingTimer)
        landingTimer = window.setTimeout(() => {
          landingTimer = null
          landingPoint.value = null
        }, 260)
        if (result.advancePending) {
          scheduleTurnAdvance(2000)
        } else if (!isHumanTurn() && options.autoPlayMode.value) scheduleAutoTurn(220)
      }
    }

    if (moveFrameId !== null) {
      window.cancelAnimationFrame(moveFrameId)
    }
    moveFrameId = window.requestAnimationFrame(frame)
  }

  function restartGame() {
    game.value = createGame({
      mode: options.mode.value,
      piecesPerPlayer: clampPiecesPerPlayer(options.piecesPerPlayer.value),
    })
    clearMovePreview()
    clearTimers()
    isRolling.value = false
    diceSpinScale.value = 1
    rollingFace.value = 1
    renderScene()
  }

  async function startGame() {
    options.page.value = 'play'
    restartGame()
    await nextTick()
    await ensurePixiReady()
    renderScene()
    if (!isHumanTurn() && options.autoPlayMode.value) {
      scheduleAutoTurn(260)
    }
  }

  async function replayGame() {
    options.page.value = 'play'
    restartGame()
    await nextTick()
    await ensurePixiReady()
    renderScene()
    if (!isHumanTurn() && options.autoPlayMode.value) {
      scheduleAutoTurn(260)
    }
  }

  function goToPrepare() {
    options.page.value = 'prepare'
    restartGame()
  }

  function setMode(nextMode: GameMode) {
    options.mode.value = nextMode
  }

  function setPiecesPerPlayer(nextCount: number) {
    options.piecesPerPlayer.value = nextCount
  }

  function cleanupPixi() {
    clearTimers()
    if (!app) return
    app.destroy(true)
    app = null
    scene = null
    currentLayout = null
    audioCtx?.close().catch(() => {})
    audioCtx = null
  }

  watch([options.mode, options.piecesPerPlayer], restartGame)

  watch(
    () => [game.value.currentPlayerIndex, game.value.dice, game.value.winnerIndex, options.autoPlayMode.value] as const,
    () => {
      if (game.value.winnerIndex !== null) {
        clearTimers()
        return
      }

      if (!options.autoPlayMode.value || isHumanTurn() || isRolling.value || movingPoint.value !== null) {
        return
      }

      scheduleAutoTurn(220)
    },
    { immediate: true },
  )

  onMounted(() => {
    if (options.page.value === 'play') {
      void nextTick().then(() => ensurePixiReady())
    }
  })

  watch(canvasEl, async () => {
    if (options.page.value !== 'play') return
    await nextTick()
    await ensurePixiReady()
    renderScene()
  })

  watch(options.page, async (nextPage) => {
    if (nextPage === 'play') {
      await nextTick()
      await ensurePixiReady()
      renderScene()
    } else {
      clearTimers()
    }
  })

  onBeforeUnmount(() => {
    cleanupPixi()
  })

  return {
    currentPlayer,
    legalPieces,
    winner,
    restartGame,
    startGame,
    replayGame,
    goToPrepare,
    setMode,
    setPiecesPerPlayer,
  }
}
