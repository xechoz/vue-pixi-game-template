import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue'
import * as PIXI from 'pixi.js'

import {
  type BoardPresetId,
  type BoardRenderLayout,
  type GameMode,
  type GameState,
  advanceTurn,
  buildMoveTrajectory,
  chooseAutoMovePieceId,
  clampPiecesPerPlayer,
  createGame,
  getBoardPreset,
  getBoardRenderLayout,
  getCurrentPlayer,
  getLegalPieceIds,
  getPieceLocation,
  getPlayerTrackCount,
  getTrackCellIndex,
  isSafeCell,
  movePiece,
  rollDice,
} from '../game'
import { buildBoardLayout } from './flight-ludo-play-scene/boardLayout'
import {
  loadDiceFaceAssets,
  loadDiceIdleAsset,
  loadDiceRollAssets,
} from './flight-ludo-play-scene/diceAssets'
import { createSceneAudio } from './flight-ludo-play-scene/sceneAudio'
import type { BoardLayout } from './flight-ludo-play-scene/types'

export type AppPage = 'prepare' | 'play' | 'result'

interface PlayScreenHost {
  canvasEl: HTMLDivElement | null
}

interface UseFlightLudoPlaySceneOptions {
  page: Ref<AppPage>
  mode: Ref<GameMode>
  piecesPerPlayer: Ref<number>
  boardPresetId: Ref<BoardPresetId>
  autoPlayMode: Ref<boolean>
  playScreenRef: Ref<PlayScreenHost | null>
}

export function useFlightLudoPlayScene(options: UseFlightLudoPlaySceneOptions) {
  const currentPlayer = computed(() => getCurrentPlayer(game.value))
  const legalPieces = computed(() => getLegalPieceIds(game.value))
  const winner = computed(() =>
    game.value.winnerIndex === null
      ? null
      : game.value.players[game.value.winnerIndex],
  )

  const assetBase = import.meta.env.BASE_URL
  function assetUrl(name: string) {
    return `${assetBase}${name}`
  }
  const sceneAudio = createSceneAudio(assetUrl)
  const {
    disposeAudio,
    playFailSound,
    playMoveSound,
    playRollSound,
    playWinSound,
    startBackgroundMusic,
  } = sceneAudio

  const canvasEl = computed(() => options.playScreenRef.value?.canvasEl ?? null)
  const game = ref<GameState>(
    createGame({
      mode: options.mode.value,
      piecesPerPlayer: options.piecesPerPlayer.value,
      boardPresetId: options.boardPresetId.value,
    }),
  )
  const boardPreset = computed(() => getBoardPreset(game.value.boardPresetId))
  const boardRenderLayout = computed<BoardRenderLayout>(() =>
    getBoardRenderLayout(game.value.boardPresetId),
  )

  let app: PIXI.Application | null = null
  let scene: PIXI.Container | null = null
  let pieceTexture: PIXI.Texture | null = null
  let playerPieceTextures: Partial<Record<number, PIXI.Texture>> = {}
  let diceFaceTextures: Partial<Record<number, PIXI.Texture>> = {}
  let diceIdleTexture: PIXI.Texture | null = null
  let diceRollTextures: PIXI.Texture[] = []
  let currentLayout: BoardLayout | null = null

  const replayingPieceId = ref<string | null>(null)
  const movePath = ref<number[]>([])
  const movingPoint = ref<{ x: number; y: number } | null>(null)
  const landingPoint = ref<{ x: number; y: number; color: string } | null>(null)
  const rollingFace = ref<number>(1)
  const diceRollFrame = ref(0)
  const diceSpinScale = ref(1)
  const diceSpinRotation = ref(0)
  const diceSpinFlip = ref(1)
  const diceLandingLift = ref(0)
  const diceLandingSquash = ref(0)
  const diceResultPop = ref(0)
  const diceIdlePulse = ref(0)
  const diceIdleShake = ref(0)
  const diceIdleLift = ref(0)
  const legalPulse = ref(0)
  const isRolling = ref(false)
  const isTurnTransitioning = ref(false)

  let rollTimer: number | null = null
  let rollFrameId: number | null = null
  let diceLandingFrameId: number | null = null
  let diceIdleFrameId: number | null = null
  let diceIdleLastRender = 0
  let turnAccentFrameId: number | null = null
  let diceIdleStart = 0
  let autoTimer: number | null = null
  let autoMoveTimer: number | null = null
  let turnAdvanceTimer: number | null = null
  let landingTimer: number | null = null
  let moveFrameId: number | null = null
  let appInitPromise: Promise<void> | null = null
  let pixiInitToken = 0

  function isPlayPageActive() {
    return options.page.value === 'play'
  }

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
    if (diceLandingFrameId !== null) {
      window.cancelAnimationFrame(diceLandingFrameId)
      diceLandingFrameId = null
    }
    diceIdleLastRender = 0
    diceSpinRotation.value = 0
    diceSpinFlip.value = 1
    diceLandingLift.value = 0
    diceLandingSquash.value = 0
    diceResultPop.value = 0
    diceIdlePulse.value = 0
    diceIdleShake.value = 0
    diceIdleLift.value = 0
    legalPulse.value = 0
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
    if (diceLandingFrameId !== null) {
      window.cancelAnimationFrame(diceLandingFrameId)
      diceLandingFrameId = null
    }
    clearAutoTimers()
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
    stopTurnAccentAnimation()
  }

  function getDiceDisplayValue() {
    if (isRolling.value) return rollingFace.value
    return game.value.dice
  }

  function isHumanTurn() {
    return currentPlayer.value.humanControlled
  }

  function getDiceFaceAssetTexture(value: number | null) {
    if (value === null) return null
    return diceFaceTextures[value] ?? null
  }

  function getRollingDiceAssetTexture() {
    if (!isRolling.value) return null
    if (diceRollTextures.length > 0) {
      return (
        diceRollTextures[diceRollFrame.value] ??
        diceRollTextures[diceRollTextures.length - 1] ??
        null
      )
    }
    return getDiceFaceAssetTexture(rollingFace.value)
  }

  function getIdleDiceAssetTexture() {
    return (
      getDiceFaceAssetTexture(game.value.dice ?? rollingFace.value ?? 1) ??
      getDiceFaceAssetTexture(1)
    )
  }

  function resolvePiecePoint(
    layout: BoardLayout,
    player: { index: number; startIndex: number },
    piece: { progress: number },
  ) {
    const activeBoardPreset = boardPreset.value
    const finishStep =
      activeBoardPreset.trackLength + activeBoardPreset.homeSteps

    const centerX = layout.trackPoints[0]?.x ?? 0
    const centerY = layout.trackPoints[0]?.y ?? 0

    if (piece.progress < 0) {
      return layout.baseSlots[player.index]?.[0] ?? { x: centerX, y: centerY }
    }

    if (piece.progress < activeBoardPreset.trackLength) {
      const trackIndex =
        (player.startIndex + piece.progress) % activeBoardPreset.trackLength
      return layout.trackPoints[trackIndex] ?? { x: centerX, y: centerY }
    }

    if (piece.progress < finishStep) {
      const laneIndex = piece.progress - activeBoardPreset.trackLength
      return (
        layout.finishSlots[player.index]?.[laneIndex] ?? {
          x: centerX,
          y: centerY,
        }
      )
    }

    return (
      layout.finishSlots[player.index]?.[activeBoardPreset.homeSteps - 1] ?? {
        x: centerX,
        y: centerY,
      }
    )
  }

  function buildPiecePath(
    layout: BoardLayout,
    player: { index: number; startIndex: number },
    piece: { progress: number },
    dice: number,
  ) {
    const activeBoardPreset = boardPreset.value
    const finishStep =
      activeBoardPreset.trackLength + activeBoardPreset.homeSteps
    const path: Array<{ x: number; y: number }> = []
    let progress = piece.progress

    if (progress < 0) {
      if (dice !== 6) return path
      path.push(resolvePiecePoint(layout, player, { progress: 0 }))
      return path
    }

    const target = Math.min(progress + dice, finishStep)
    while (progress < target) {
      progress += 1
      path.push(resolvePiecePoint(layout, player, { progress }))
    }

    return path
  }

  function getPlayerByPieceId(state: GameState, pieceId: string) {
    return (
      state.players.find((player) =>
        player.pieces.some((piece) => piece.id === pieceId),
      ) ?? null
    )
  }

  function scheduleTurnAdvance(delay = 2000) {
    if (!isPlayPageActive() || game.value.winnerIndex !== null) return
    if (turnAdvanceTimer !== null) {
      window.clearTimeout(turnAdvanceTimer)
    }
    isTurnTransitioning.value = true
    const timer = window.setTimeout(() => {
      if (turnAdvanceTimer !== timer) return
      turnAdvanceTimer = null
      if (!isPlayPageActive() || game.value.winnerIndex !== null) {
        isTurnTransitioning.value = false
        return
      }
      advanceTurn(game.value)
      isTurnTransitioning.value = false
      refreshGameView()
      if (!isHumanTurn() && options.autoPlayMode.value) {
        scheduleAutoTurn(220)
      }
    }, delay)
    turnAdvanceTimer = timer
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
      const initToken = ++pixiInitToken
      const nextApp = new PIXI.Application()
      await nextApp.init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })

      if (
        initToken !== pixiInitToken ||
        !isPlayPageActive() ||
        canvasEl.value !== host
      ) {
        nextApp.destroy(true)
        return
      }

      app = nextApp
      host.appendChild(app.canvas)
      scene = new PIXI.Container()
      app.stage.addChild(scene)

      const [redPiece, yellowPiece, bluePiece, greenPiece] = await Promise.all([
        PIXI.Assets.load(assetUrl('player-red.png')),
        PIXI.Assets.load(assetUrl('player-yellow.png')),
        PIXI.Assets.load(assetUrl('player-blue.png')),
        PIXI.Assets.load(assetUrl('player-green.png')),
      ])
      if (initToken !== pixiInitToken || !app || !scene) return
      playerPieceTextures = {
        0:
          redPiece instanceof PIXI.Texture
            ? redPiece
            : PIXI.Texture.from(assetUrl('player-red.png')),
        1:
          yellowPiece instanceof PIXI.Texture
            ? yellowPiece
            : PIXI.Texture.from(assetUrl('player-yellow.png')),
        2:
          bluePiece instanceof PIXI.Texture
            ? bluePiece
            : PIXI.Texture.from(assetUrl('player-blue.png')),
        3:
          greenPiece instanceof PIXI.Texture
            ? greenPiece
            : PIXI.Texture.from(assetUrl('player-green.png')),
      }
      pieceTexture =
        playerPieceTextures[0] ??
        playerPieceTextures[1] ??
        playerPieceTextures[2] ??
        playerPieceTextures[3] ??
        null
      const [loadedDiceIdle, loadedDiceFaces, loadedDiceRoll] =
        await Promise.all([
          loadDiceIdleAsset(assetUrl),
          loadDiceFaceAssets(assetUrl),
          loadDiceRollAssets(assetUrl),
        ])
      if (initToken !== pixiInitToken || !app || !scene) return
      diceIdleTexture = loadedDiceIdle
      diceFaceTextures = loadedDiceFaces
      diceRollTextures = loadedDiceRoll
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

    diceIdleStart = performance.now()

    const tick = (now: number) => {
      if (
        options.page.value !== 'play' ||
        game.value.winnerIndex !== null ||
        game.value.dice !== null ||
        isRolling.value ||
        movingPoint.value !== null
      ) {
        stopDiceIdleAnimation()
        renderScene()
        return
      }

      if (diceIdleLastRender === 0 || now - diceIdleLastRender >= 80) {
        const elapsed = now - diceIdleStart
        diceIdleShake.value = Math.sin(elapsed / 140)
        diceIdleLift.value = Math.sin(elapsed / 320) * 2.6
        diceIdlePulse.value = 0.5 + 0.5 * Math.sin(elapsed / 240)
        diceIdleLastRender = now
        renderScene()
      }

      diceIdleFrameId = window.requestAnimationFrame(tick)
    }

    diceIdleFrameId = window.requestAnimationFrame(tick)
  }

  function stopTurnAccentAnimation() {
    if (turnAccentFrameId !== null) {
      window.cancelAnimationFrame(turnAccentFrameId)
      turnAccentFrameId = null
    }
    legalPulse.value = 0
  }

  function syncTurnAccentAnimation() {
    stopTurnAccentAnimation()

    const shouldAnimate =
      options.page.value === 'play' &&
      game.value.winnerIndex === null &&
      game.value.dice !== null &&
      !isRolling.value &&
      movingPoint.value === null &&
      legalPieces.value.length > 0

    if (!shouldAnimate) return

    const tick = (now: number) => {
      if (
        options.page.value !== 'play' ||
        game.value.winnerIndex !== null ||
        game.value.dice === null ||
        isRolling.value ||
        movingPoint.value !== null ||
        legalPieces.value.length === 0
      ) {
        stopTurnAccentAnimation()
        renderScene()
        return
      }

      legalPulse.value = 0.45 + 0.55 * Math.sin(now / 160)
      renderScene()
      turnAccentFrameId = window.requestAnimationFrame(tick)
    }

    turnAccentFrameId = window.requestAnimationFrame(tick)
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

    const activeBoardPreset = boardPreset.value
    const activeBoardRenderLayout = boardRenderLayout.value
    const boardInset = safeBoardSize * activeBoardRenderLayout.trackInsetRatio
    const innerLeft = originX + boardInset
    const innerTop = originY + boardInset
    const innerRight = originX + safeBoardSize - boardInset
    const innerBottom = originY + safeBoardSize - boardInset
    const centerX = originX + safeBoardSize / 2
    const centerY = originY + safeBoardSize / 2

    const currentPlayerGlow = new PIXI.Graphics()
      .roundRect(
        originX + 8,
        originY + 8,
        safeBoardSize - 16,
        safeBoardSize - 16,
        30,
      )
      .stroke({
        color: hexToNumber(currentPlayer.value.color),
        width: 5,
        alpha: isRolling.value ? 0.42 : 0.22,
      })
    board.addChild(currentPlayerGlow)

    const homes = new PIXI.Graphics()
    homes
      .roundRect(
        originX + 16,
        originY + 16,
        safeBoardSize - 32,
        safeBoardSize - 32,
        22,
      )
      .stroke({ color: 0x1e293b, width: 1, alpha: 0.5 })
    homes
      .roundRect(
        innerLeft,
        innerTop,
        innerRight - innerLeft,
        innerBottom - innerTop,
        18,
      )
      .stroke({ color: 0x263244, width: 2, alpha: 0.9 })
    board.addChild(homes)

    currentLayout = buildBoardLayout(
      originX,
      originY,
      safeBoardSize,
      activeBoardPreset,
      activeBoardRenderLayout,
    )
    const { trackPoints, baseSlots, finishSlots } = currentLayout

    let activeDiceAnchor = { x: centerX, y: centerY }

    for (let index = 0; index < trackPoints.length; index += 1) {
      const point = trackPoints[index]
      const cell = new PIXI.Graphics()
      const playerIndex =
        Math.floor(index / activeBoardPreset.stepsPerSide) %
        game.value.players.length
      const activeColor = game.value.players[playerIndex].color
      const isStartCell = index % activeBoardPreset.stepsPerSide === 0
      const isSafeTrackCell = isSafeCell(index, game.value.boardPresetId)
      cell
        .roundRect(
          point.x - trackSize / 2,
          point.y - trackSize / 2,
          trackSize,
          trackSize,
          9,
        )
        .fill({
          color: isSafeTrackCell ? 0xf8fafc : 0xe2e8f0,
          alpha: isSafeTrackCell ? 0.16 : 0.07,
        })
        .stroke({
          color: activeColor,
          width: isStartCell ? 3 : isSafeTrackCell ? 2 : 1,
          alpha: isSafeTrackCell ? 0.55 : 0.35,
        })
      board.addChild(cell)
    }

    const canRoll =
      game.value.winnerIndex === null &&
      game.value.dice === null &&
      !isTurnTransitioning.value &&
      (isHumanTurn() || !options.autoPlayMode.value)

    for (const player of game.value.players) {
      const playerBase = new PIXI.Graphics()
      const zoneSize = safeBoardSize * activeBoardRenderLayout.baseZoneSizeRatio
      const zonePadding =
        safeBoardSize * activeBoardRenderLayout.baseZonePaddingRatio
      const zoneX =
        player.index === 0 || player.index === 3
          ? originX + zonePadding
          : originX + safeBoardSize - zonePadding - zoneSize
      const zoneY =
        player.index === 0 || player.index === 1
          ? originY + zonePadding
          : originY + safeBoardSize - zonePadding - zoneSize

      const isActivePlayer = game.value.currentPlayerIndex === player.index
      playerBase
        .roundRect(zoneX, zoneY, zoneSize, zoneSize, 14)
        .fill({ color: player.color, alpha: isActivePlayer ? 0.1 : 0.07 })
        .stroke({
          color: player.color,
          width: isActivePlayer ? 3 : 2,
          alpha: isActivePlayer ? 0.3 : 0.2,
        })
      board.addChild(playerBase)

      if (isActivePlayer && canRoll) {
        playerBase.eventMode = 'static'
        playerBase.cursor = 'pointer'
        playerBase.hitArea = new PIXI.Rectangle(
          zoneX,
          zoneY,
          zoneSize,
          zoneSize,
        )
        playerBase.on('pointerdown', () => handleRoll(false))
      }

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
      const finishBoxRadius =
        safeBoardSize * activeBoardRenderLayout.finishBoxSizeRatio
      const finishBox = new PIXI.Graphics()
      finishBox
        .roundRect(
          finish[0].x - finishBoxRadius,
          finish[0].y - finishBoxRadius,
          finishBoxRadius * 2,
          finishBoxRadius * 2,
          12,
        )
        .fill({ color: player.color, alpha: 0.08 })
        .stroke({ color: player.color, width: 1, alpha: 0.24 })
      board.addChild(finishBox)
    }

    const center = new PIXI.Container()
    center.position.set(activeDiceAnchor.x, activeDiceAnchor.y)
    center.eventMode = 'passive'
    center.cursor = 'default'
    board.addChild(center)

    const diceSize = safeBoardSize * 0.18
    const diceValue = getDiceDisplayValue()
    const isIdleDiceState = !isRolling.value && game.value.dice === null
    const rollingDiceAssetTexture = getRollingDiceAssetTexture()
    const settledDiceAssetTexture = getDiceFaceAssetTexture(diceValue)
    const idleDiceAssetTexture = getIdleDiceAssetTexture()
    const useDiceAssetRender =
      rollingDiceAssetTexture !== null ||
      settledDiceAssetTexture !== null ||
      idleDiceAssetTexture !== null

    const diceGroup = new PIXI.Container()
    diceGroup.eventMode = canRoll ? 'static' : 'passive'
    diceGroup.cursor = canRoll ? 'pointer' : 'default'
    diceGroup.hitArea = new PIXI.Rectangle(
      -diceSize * 0.95,
      -diceSize * 0.95,
      diceSize * 1.9,
      diceSize * 1.9,
    )
    if (canRoll) {
      diceGroup.on('pointerdown', () => handleRoll(false))
    }
    center.addChild(diceGroup)

    const faceSize = diceSize * 0.72

    if (useDiceAssetRender) {
      const assetTexture =
        rollingDiceAssetTexture ??
        settledDiceAssetTexture ??
        idleDiceAssetTexture
      if (assetTexture) {
        const textureWidth = assetTexture.width || 1
        const textureHeight = assetTexture.height || 1
        const fittedHeight = diceSize * 0.98
        const fittedWidth = Math.max(
          diceSize * 0.8,
          (fittedHeight * textureWidth) / textureHeight,
        )

        const diceSprite = new PIXI.Sprite(assetTexture)
        diceSprite.anchor.set(0.5)
        diceSprite.width = fittedWidth
        diceSprite.height = fittedHeight
        diceGroup.addChild(diceSprite)

        if (!isRolling.value && isIdleDiceState && diceIdleTexture) {
          const idleFaceBlur = new PIXI.Graphics()
            .roundRect(
              -fittedWidth * 0.36,
              -fittedHeight * 0.36,
              fittedWidth * 0.72,
              fittedHeight * 0.72,
              fittedWidth * 0.12,
            )
            .fill({ color: 0xffffff, alpha: 0.3 })
          diceGroup.addChild(idleFaceBlur)

          const overlayWidth = fittedWidth * 0.8
          const overlayHeight = fittedHeight * 0.8
          const overlayCenterY = -overlayHeight * 0.02

          const idleOverlaySprite = new PIXI.Sprite(diceIdleTexture)
          idleOverlaySprite.anchor.set(0.5)
          idleOverlaySprite.position.set(0, overlayCenterY)
          idleOverlaySprite.width = overlayWidth
          idleOverlaySprite.height = overlayHeight
          idleOverlaySprite.alpha = 1
          diceGroup.addChild(idleOverlaySprite)
        }

        const landingShadowScale =
          1 + diceLandingSquash.value * 0.45 + (isRolling.value ? 0.06 : 0)
        const landingShadowOffset =
          fittedHeight * (0.36 + diceLandingSquash.value * 0.08)
        const shadowAlpha =
          0.16 +
          (isRolling.value ? 0.08 : 0.02) +
          diceLandingSquash.value * 0.14
        const diceShadow = new PIXI.Graphics()
          .ellipse(
            0,
            landingShadowOffset,
            fittedWidth * 0.24 * landingShadowScale,
            fittedHeight * 0.08 * (1 + diceLandingSquash.value * 0.35),
          )
          .fill({ color: 0x020617, alpha: shadowAlpha })
        diceGroup.addChildAt(diceShadow, 0)

        if (!isRolling.value && isIdleDiceState) {
          const promptGlow = new PIXI.Graphics()
            .roundRect(
              -faceSize * 0.18,
              faceSize * 0.09,
              faceSize * 0.36,
              faceSize * 0.2,
              faceSize * 0.08,
            )
            .fill({ color: 0xffffff, alpha: 0.14 + diceIdlePulse.value * 0.08 })
          diceGroup.addChild(promptGlow)
        }

        const settleFlashAlpha =
          !isRolling.value && !isIdleDiceState
            ? Math.max(
                0,
                Math.min(
                  0.18,
                  diceLandingSquash.value * 0.32 +
                    diceLandingLift.value * 0.004,
                ),
              )
            : 0
        if (settleFlashAlpha > 0.001) {
          const settleFlash = new PIXI.Graphics()
            .roundRect(
              -fittedWidth * 0.33,
              -fittedHeight * 0.33,
              fittedWidth * 0.66,
              fittedHeight * 0.24,
              fittedWidth * 0.08,
            )
            .fill({ color: 0xffffff, alpha: settleFlashAlpha })
          diceGroup.addChild(settleFlash)
        }

        const diceScaleBoost =
          1 + diceIdlePulse.value * 0.05 + (isRolling.value ? 0.05 : 0)
        const shakeX = diceIdleShake.value * (isRolling.value ? 4.5 : 3)
        const shakeY = Math.sin(diceIdleShake.value * Math.PI * 0.5) * 2.2
        const landingScaleX =
          1 + diceLandingSquash.value * 0.34 + diceResultPop.value * 0.08
        const landingScaleY =
          1 - diceLandingSquash.value * 0.24 + diceResultPop.value * 0.04
        const landingSettleNudge =
          !isRolling.value && !isIdleDiceState
            ? Math.max(0, diceLandingSquash.value * 0.1)
            : 0
        const spinScaleX =
          diceSpinScale.value *
          diceScaleBoost *
          (isRolling.value ? diceSpinFlip.value : 1) *
          landingScaleX
        const spinScaleY =
          diceSpinScale.value *
          diceScaleBoost *
          (isRolling.value ? 1 + (1 - diceSpinFlip.value) * 0.22 : 1) *
          landingScaleY
        diceGroup.position.set(
          shakeX,
          shakeY -
            diceIdleLift.value -
            diceLandingLift.value +
            landingSettleNudge * fittedHeight * 0.08,
        )
        diceGroup.rotation = diceSpinRotation.value
        diceGroup.scale.set(spinScaleX, spinScaleY)
      }
    }

    if (winner.value) {
      const banner = new PIXI.Graphics()
        .roundRect(
          originX + safeBoardSize * 0.18,
          originY + safeBoardSize * 0.36,
          safeBoardSize * 0.64,
          safeBoardSize * 0.16,
          24,
        )
        .fill({ color: 0x020617, alpha: 0.9 })
        .stroke({ color: winner.value.color, width: 3, alpha: 0.9 })
      board.addChild(banner)
    }

    if (landingPoint.value) {
      const pulse = new PIXI.Graphics()
        .circle(landingPoint.value.x, landingPoint.value.y, pieceRadius * 1.25)
        .stroke({
          color: hexToNumber(landingPoint.value.color),
          width: 3,
          alpha: 0.35,
        })
      board.addChild(pulse)
    }

    if (currentLayout && replayingPieceId.value && movePath.value.length > 0) {
      const player = getPlayerByPieceId(game.value, replayingPieceId.value)
      const piece = player?.pieces.find(
        (item) => item.id === replayingPieceId.value,
      )
      if (player && piece && currentLayout) {
        const layout = currentLayout
        const pathPoints = [
          resolvePiecePoint(layout, player, piece),
          ...movePath.value.map((progress) =>
            resolvePiecePoint(layout, player, { progress }),
          ),
        ]

        const trail = new PIXI.Graphics()
        trail.moveTo(pathPoints[0].x, pathPoints[0].y)
        for (const point of pathPoints.slice(1)) {
          trail.lineTo(point.x, point.y)
        }
        trail.stroke({ color: player.color, width: 5, alpha: 0.45 })
        board.addChild(trail)

        const arcLift = Math.max(4, pieceRadius * 0.75)
        for (let index = 1; index < pathPoints.length; index += 1) {
          const point = pathPoints[index]
          const prev = pathPoints[index - 1]
          const midX = (prev.x + point.x) / 2
          const midY = (prev.y + point.y) / 2 - arcLift
          const arcTrail = new PIXI.Graphics()
          arcTrail.moveTo(prev.x, prev.y)
          arcTrail.quadraticCurveTo(midX, midY, point.x, point.y)
          arcTrail.stroke({ color: player.color, width: 4, alpha: 0.28 })
          board.addChild(arcTrail)

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
          const slot =
            baseSlots[player.index][pieceIndex] ?? baseSlots[player.index][0]
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
          const slot =
            finishSlots[player.index][pieceIndex] ??
            finishSlots[player.index][0]
          x = slot.x
          y = slot.y
        }

        if (
          landingPoint.value &&
          landingPoint.value.color === player.color &&
          piece.progress >= 0
        ) {
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
      const isLegal =
        game.value.winnerIndex === null &&
        legalPieces.value.includes(pieceInfo.piece.id)
      const isMoving =
        replayingPieceId.value === pieceInfo.piece.id &&
        movingPoint.value !== null
      const movingPosition = movingPoint.value
      const pieceGroup = new PIXI.Container()
      pieceGroup.position.set(
        isMoving && movingPosition ? movingPosition.x : pieceInfo.x,
        isMoving && movingPosition ? movingPosition.y : pieceInfo.y,
      )
      pieceGroup.eventMode = isLegal && !isMoving ? 'static' : 'passive'
      pieceGroup.cursor = isLegal && !isMoving ? 'pointer' : 'default'

      if (isLegal && !isMoving) {
        pieceGroup.on('pointerdown', () => handleMove(pieceInfo.piece.id))
      }

      if (isLegal && !isMoving) {
        const legalGlow = new PIXI.Graphics()
          .circle(0, 0, pieceRadius + 6)
          .stroke({
            color: hexToNumber(pieceInfo.player.color),
            width: 2,
            alpha: 0.12 + legalPulse.value * 0.16,
          })
        pieceGroup.addChildAt(legalGlow, 0)
      }

      const tint = hexToNumber(pieceInfo.player.color)
      const texture = getPlayerPieceTexture(pieceInfo.player.index)
      const trackPieceBodyScale =
        activeBoardPreset.stepsPerSide <= 4
          ? 5.6
          : activeBoardPreset.stepsPerSide <= 6
            ? 5.15
            : 4.85
      const pieceBodyScale =
        pieceInfo.location === 'base'
          ? trackPieceBodyScale + 1.15
          : trackPieceBodyScale
      if (texture) {
        const body = new PIXI.Sprite(texture)
        body.anchor.set(0.5)
        body.position.set(0, pieceInfo.location === 'base' ? -3 : -1.5)
        body.width = pieceRadius * pieceBodyScale
        body.height = pieceRadius * pieceBodyScale
        pieceGroup.addChild(body)
      } else {
        const body = new PIXI.Graphics()
          .circle(0, 0, pieceRadius + 5)
          .fill({ color: tint, alpha: 1 })
          .stroke({ color: 0xffffff, width: 2, alpha: 0.88 })
        pieceGroup.addChild(body)
      }

      board.addChild(pieceGroup)
    }
  }

  function refreshGameView() {
    game.value = { ...game.value }
    renderScene()
    syncDiceIdleAnimation()
    syncTurnAccentAnimation()
    if (game.value.winnerIndex !== null) {
      options.page.value = 'result'
    }
    if (isPlayPageActive()) {
      playAutoTurn()
    } else {
      clearAutoTimers()
    }
  }

  function scheduleAutoTurn(delay = 180) {
    if (!isPlayPageActive() || game.value.winnerIndex !== null) return
    if (isTurnTransitioning.value || !options.autoPlayMode.value) return
    if (autoTimer !== null) {
      window.clearTimeout(autoTimer)
    }
    const timer = window.setTimeout(() => {
      if (autoTimer !== timer) return
      autoTimer = null
      if (
        !isPlayPageActive() ||
        !options.autoPlayMode.value ||
        game.value.winnerIndex !== null
      )
        return
      playAutoTurn()
    }, delay)
    autoTimer = timer
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

  function scheduleAutoMove(action: () => void, delay: number) {
    if (
      !isPlayPageActive() ||
      !options.autoPlayMode.value ||
      game.value.winnerIndex !== null
    )
      return
    if (autoMoveTimer !== null) {
      window.clearTimeout(autoMoveTimer)
    }
    const timer = window.setTimeout(() => {
      if (autoMoveTimer !== timer) return
      autoMoveTimer = null
      if (
        !isPlayPageActive() ||
        !options.autoPlayMode.value ||
        game.value.winnerIndex !== null
      )
        return
      action()
    }, delay)
    autoMoveTimer = timer
  }

  function startDiceLandingAnimation() {
    if (diceLandingFrameId !== null) {
      window.cancelAnimationFrame(diceLandingFrameId)
      diceLandingFrameId = null
    }

    const startTime = performance.now()
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / 420)
      const bounce = Math.sin(progress * Math.PI) * (1 - progress)
      const rebound = Math.sin(progress * Math.PI * 2.6) * (1 - progress) * 0.28
      diceLandingLift.value = Math.max(0, bounce * 20 + rebound * 8)
      diceLandingSquash.value = Math.max(
        0,
        Math.sin(progress * Math.PI * 1.2) * (1 - progress * 0.58),
      )
      diceResultPop.value = Math.max(
        0,
        Math.sin(progress * Math.PI * 1.35) * (1 - progress * 0.42),
      )
      renderScene()

      if (progress < 1) {
        diceLandingFrameId = window.requestAnimationFrame(animate)
      } else {
        diceLandingFrameId = null
        diceLandingLift.value = 0
        diceLandingSquash.value = 0
        diceResultPop.value = 0
        renderScene()
      }
    }

    diceLandingFrameId = window.requestAnimationFrame(animate)
  }

  function startDiceSpin() {
    const startTime = performance.now()
    let lastTick = 0

    const spin = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / 1100)
      const interval = Math.max(55, 165 - progress * 88)
      const tick = Math.floor(elapsed / interval)
      while (lastTick < tick) {
        rollingFace.value = Math.floor(Math.random() * 6) + 1
        lastTick += 1
      }
      const wobbleDecay = 1 - progress * 0.22
      const turnProgress = 1 - (1 - progress) * (1 - progress)
      diceSpinScale.value = 1 + Math.sin(progress * Math.PI) * 0.06
      diceSpinRotation.value =
        Math.sin(progress * Math.PI * 4.8) * 0.26 * wobbleDecay +
        turnProgress * Math.PI * 0.1
      diceSpinFlip.value =
        0.46 + Math.abs(Math.cos(progress * Math.PI * 6.8)) * 0.54
      if (diceRollTextures.length > 0) {
        diceRollFrame.value = Math.min(
          diceRollTextures.length - 1,
          Math.floor(progress * diceRollTextures.length),
        )
      }
      renderScene()
      if (progress < 1) {
        rollFrameId = window.requestAnimationFrame(spin)
      } else {
        rollFrameId = null
        diceSpinScale.value = 1
        diceSpinRotation.value = 0
        diceSpinFlip.value = 1
        if (diceRollTextures.length > 0) {
          diceRollFrame.value = Math.max(0, diceRollTextures.length - 1)
        }
        renderScene()
      }
    }

    rollFrameId = window.requestAnimationFrame(spin)
  }

  function getHumanAutoMovePieceId() {
    if (game.value.dice === null || game.value.winnerIndex !== null) return null
    const legalIds = legalPieces.value
    if (legalIds.length === 0) return null
    if (legalIds.length === 1) return legalIds[0] ?? null
    if (getPlayerTrackCount(currentPlayer.value) === 0 && game.value.dice === 6)
      return legalIds[0] ?? null
    return null
  }

  function playAutoTurn() {
    if (
      !isPlayPageActive() ||
      !options.autoPlayMode.value ||
      game.value.winnerIndex !== null
    ) {
      clearAutoTimers()
      return
    }
    if (
      isTurnTransitioning.value ||
      isRolling.value ||
      movingPoint.value !== null
    )
      return

    if (game.value.dice === null) {
      if (!isHumanTurn()) {
        scheduleAutoMove(() => handleRoll(true), 220)
      }
      return
    }

    const pieceId = isHumanTurn()
      ? getHumanAutoMovePieceId()
      : chooseAutoMovePieceId(game.value)
    if (!pieceId) {
      if (!isHumanTurn()) {
        scheduleTurnAdvance(2000)
      }
      return
    }

    scheduleAutoMove(() => handleMove(pieceId), isHumanTurn() ? 180 : 260)
  }

  function handleRoll(fromAuto = false) {
    if (
      game.value.winnerIndex !== null ||
      game.value.dice !== null ||
      isRolling.value ||
      isTurnTransitioning.value
    )
      return
    if (!isHumanTurn() && !fromAuto) return

    clearTimers()
    isRolling.value = true
    rollingFace.value = Math.floor(Math.random() * 6) + 1
    diceRollFrame.value = 0
    diceSpinScale.value = 1
    diceLandingLift.value = 0
    diceLandingSquash.value = 0
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
      if (!result.rolled) return

      startDiceLandingAnimation()
      playRollSound()
      refreshGameView()

      if (result.skipped) {
        if (!isHumanTurn() && options.autoPlayMode.value) {
          scheduleAutoTurn(220)
        }
        return
      }

      const humanAutoPieceId = isHumanTurn() ? getHumanAutoMovePieceId() : null
      if (humanAutoPieceId) {
        scheduleAutoMove(() => handleMove(humanAutoPieceId), 220)
        return
      }

      if (result.advancePending) {
        scheduleTurnAdvance(2000)
      }

      if (!isHumanTurn() && options.autoPlayMode.value) {
        scheduleAutoTurn(220)
      }
    }

    spin()
  }

  function handleMove(pieceId: string) {
    if (
      !currentLayout ||
      game.value.dice === null ||
      game.value.winnerIndex !== null ||
      movingPoint.value !== null
    )
      return
    if (!legalPieces.value.includes(pieceId)) return

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
    const hopLift = Math.max(8, pathPoints.length * 2)
    const totalDuration = Math.max(420, (pathPoints.length - 1) * 120)
    const startTime = performance.now()
    const stepDelay = 100

    if (moveFrameId !== null) {
      window.cancelAnimationFrame(moveFrameId)
      moveFrameId = null
    }

    const frame = (now: number) => {
      const elapsed = now - startTime
      const totalSteps = pathPoints.length - 1
      const rawStep = Math.min(totalSteps, Math.floor(elapsed / stepDelay))
      const segmentProgress = Math.min(1, (elapsed % stepDelay) / stepDelay)
      const currentStep = Math.min(totalSteps - 1, rawStep)
      const start = pathPoints[currentStep]
      const end = pathPoints[currentStep + 1] ?? start
      const lift = Math.sin(segmentProgress * Math.PI) * hopLift

      movingPoint.value = {
        x: lerp(start.x, end.x, segmentProgress),
        y: lerp(start.y, end.y, segmentProgress) - lift,
      }
      renderScene()

      if (elapsed < totalDuration && rawStep < totalSteps) {
        moveFrameId = window.requestAnimationFrame(frame)
        return
      }

      moveFrameId = null
      movingPoint.value = null
      const result = movePiece(game.value, pieceId)
      if (!result.moved) {
        clearMovePreview()
        refreshGameView()
        return
      }

      playMoveSound()
      if (result.message.includes('吃子')) playFailSound()
      if (result.message.includes('胜利')) playWinSound()
      clearMovePreview()
      landingPoint.value = { x: end.x, y: end.y, color: player.color }
      if (landingTimer !== null) window.clearTimeout(landingTimer)
      landingTimer = window.setTimeout(() => {
        landingTimer = null
        landingPoint.value = null
      }, 260)
      refreshGameView()
      if (result.advancePending) {
        scheduleTurnAdvance(2000)
      } else if (!isHumanTurn() && options.autoPlayMode.value) {
        scheduleAutoTurn(220)
      }
    }

    moveFrameId = window.requestAnimationFrame(frame)
  }

  function restartGame() {
    game.value = createGame({
      mode: options.mode.value,
      piecesPerPlayer: clampPiecesPerPlayer(options.piecesPerPlayer.value),
      boardPresetId: options.boardPresetId.value,
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
    startBackgroundMusic()
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

  function setBoardPresetId(nextBoardPresetId: BoardPresetId) {
    options.boardPresetId.value = nextBoardPresetId
  }

  function cleanupPixi() {
    pixiInitToken += 1
    clearTimers()
    disposeAudio()
    if (app) {
      app.destroy(true)
      app = null
      scene = null
      currentLayout = null
    }
  }

  watch(
    [options.mode, options.piecesPerPlayer, options.boardPresetId],
    restartGame,
  )

  watch(
    () =>
      [
        game.value.currentPlayerIndex,
        game.value.dice,
        game.value.winnerIndex,
        options.autoPlayMode.value,
      ] as const,
    () => {
      if (!isPlayPageActive() || game.value.winnerIndex !== null) {
        clearTimers()
        return
      }

      if (!options.autoPlayMode.value) {
        clearAutoTimers()
        return
      }

      if (isHumanTurn() || isRolling.value || movingPoint.value !== null) {
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
    setBoardPresetId,
  }
}
