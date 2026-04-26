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

type DiceOrientation = {
  top: number
  bottom: number
  front: number
  back: number
  right: number
  left: number
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
  let diceFaceTextures: Partial<Record<number, PIXI.Texture>> = {}
  let diceIdleTexture: PIXI.Texture | null = null
  let diceRollTextures: PIXI.Texture[] = []
  let currentLayout: BoardLayout | null = null

  const replayingPieceId = ref<string | null>(null)
  const movePath = ref<number[]>([])
  const movingPoint = ref<{ x: number; y: number } | null>(null)
  const landingPoint = ref<{ x: number; y: number; color: string } | null>(null)
  const rollingFace = ref<number>(1)
  const previousRollingFace = ref<number>(1)
  const diceFaceTransitionAlpha = ref(0)
  const diceRollTrailAlpha = ref(0)
  const diceRollFrame = ref(0)
  const diceOrientation = ref<DiceOrientation>({ top: 1, bottom: 6, front: 2, back: 5, right: 3, left: 4 })
  const diceSpinScale = ref(1)
  const diceSpinRotation = ref(0)
  const diceSpinFlip = ref(1)
  const diceSpinPitch = ref(0)
  const diceSpinYaw = ref(0)
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
  let audioCtx: AudioContext | null = null
  let bgmAudio: HTMLAudioElement | null = null

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
    diceSpinPitch.value = 0
    diceSpinYaw.value = 0
    diceLandingLift.value = 0
    diceLandingSquash.value = 0
    diceResultPop.value = 0
    diceIdlePulse.value = 0
    diceIdleShake.value = 0
    diceIdleLift.value = 0
    diceFaceTransitionAlpha.value = 0
    diceRollTrailAlpha.value = 0
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

  function mixHexColor(base: number, target: number, amount: number) {
    const clamped = Math.max(0, Math.min(1, amount))
    const r = ((base >> 16) & 0xff) * (1 - clamped) + ((target >> 16) & 0xff) * clamped
    const g = ((base >> 8) & 0xff) * (1 - clamped) + ((target >> 8) & 0xff) * clamped
    const b = (base & 0xff) * (1 - clamped) + (target & 0xff) * clamped
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
  }

  async function loadFirstAvailableTexture(paths: string[]) {
    for (const path of paths) {
      try {
        const loaded = await PIXI.Assets.load(path)
        if (loaded instanceof PIXI.Texture) return loaded
        return PIXI.Texture.from(path)
      } catch {
        // Try next candidate path.
      }
    }
    return null
  }

  async function loadDiceIdleAsset() {
    return loadFirstAvailableTexture([
      assetUrl('dice/idle-question.png'),
      assetUrl('dice/idle-question.webp'),
      assetUrl('dice/idle-question.jpg'),
      assetUrl('dice/idle-question.jpeg'),
      assetUrl('dice/idle-question.svg'),
    ])
  }

  async function loadDiceFaceAssets() {
    const textures: Partial<Record<number, PIXI.Texture>> = {}
    const extensions = ['webp', 'png', 'jpg', 'jpeg', 'svg']

    for (let value = 1; value <= 6; value += 1) {
      const texture = await loadFirstAvailableTexture([
        ...extensions.map((extension) => assetUrl(`dice/faces/${value}.${extension}`)),
        assetUrl(`dice-${value}.svg`),
      ])
      if (texture) {
        textures[value] = texture
      }
    }

    return textures
  }

  async function loadDiceRollManifestFrames() {
    try {
      const response = await fetch(assetUrl('dice/roll/manifest.json'))
      if (!response.ok) return []
      const manifest = await response.json()
      const frames = Array.isArray(manifest)
        ? manifest
        : Array.isArray(manifest?.frames)
          ? manifest.frames
          : []
      return frames.filter((frame: unknown): frame is string => typeof frame === 'string' && frame.length > 0)
    } catch {
      return []
    }
  }

  async function loadDiceRollAssets() {
    const manifestFrames = await loadDiceRollManifestFrames()
    if (manifestFrames.length > 0) {
      const textures = await Promise.all(
        manifestFrames.map(async (frame: string) => loadFirstAvailableTexture([assetUrl(`dice/roll/${frame}`)])),
      )
      return textures.filter((texture): texture is PIXI.Texture => texture instanceof PIXI.Texture)
    }

    for (const extension of ['webp', 'png', 'jpg', 'jpeg']) {
      const firstFrame = await loadFirstAvailableTexture([assetUrl(`dice/roll/frame-001.${extension}`)])
      if (!firstFrame) continue

      const textures: PIXI.Texture[] = [firstFrame]
      for (let index = 2; index <= 48; index += 1) {
        const frameName = `frame-${String(index).padStart(3, '0')}.${extension}`
        const texture = await loadFirstAvailableTexture([assetUrl(`dice/roll/${frameName}`)])
        if (!texture) break
        textures.push(texture)
      }
      return textures
    }

    return []
  }

  function getDiceFaceAssetTexture(value: number | null) {
    if (value === null) return null
    return diceFaceTextures[value] ?? null
  }

  function getRollingDiceAssetTexture() {
    if (!isRolling.value) return null
    if (diceRollTextures.length > 0) {
      return diceRollTextures[diceRollFrame.value] ?? diceRollTextures[diceRollTextures.length - 1] ?? null
    }
    return getDiceFaceAssetTexture(rollingFace.value)
  }

  function getPreviousRollingDiceAssetTexture() {
    if (!isRolling.value || diceRollTextures.length > 0 || diceFaceTransitionAlpha.value <= 0.001) return null
    return getDiceFaceAssetTexture(previousRollingFace.value)
  }

  function getIdleDiceAssetTexture() {
    return getDiceFaceAssetTexture(game.value.dice ?? rollingFace.value ?? 1) ?? getDiceFaceAssetTexture(1)
  }

  function getDicePipLayout(value: number) {
    const layouts: Record<number, Array<[number, number]>> = {
      1: [[0.5, 0.5]],
      2: [[0.3, 0.3], [0.7, 0.7]],
      3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
      4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
      5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
      6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
    }
    return layouts[value] ?? layouts[1]
  }

  function createOrientationForFront(front: number): DiceOrientation {
    const orientations: Record<number, DiceOrientation> = {
      1: { top: 2, bottom: 5, front: 1, back: 6, right: 4, left: 3 },
      2: { top: 1, bottom: 6, front: 2, back: 5, right: 3, left: 4 },
      3: { top: 1, bottom: 6, front: 3, back: 4, right: 5, left: 2 },
      4: { top: 1, bottom: 6, front: 4, back: 3, right: 2, left: 5 },
      5: { top: 1, bottom: 6, front: 5, back: 2, right: 4, left: 3 },
      6: { top: 2, bottom: 5, front: 6, back: 1, right: 3, left: 4 },
    }
    return orientations[front] ?? orientations[2]
  }

  function rotateDiceForward(orientation: DiceOrientation): DiceOrientation {
    return {
      top: orientation.front,
      bottom: orientation.back,
      front: orientation.bottom,
      back: orientation.top,
      right: orientation.right,
      left: orientation.left,
    }
  }

  function rotateDiceRight(orientation: DiceOrientation): DiceOrientation {
    return {
      top: orientation.left,
      bottom: orientation.right,
      front: orientation.front,
      back: orientation.back,
      right: orientation.top,
      left: orientation.bottom,
    }
  }

  function spinDiceClockwise(orientation: DiceOrientation): DiceOrientation {
    return {
      top: orientation.top,
      bottom: orientation.bottom,
      front: orientation.left,
      back: orientation.right,
      right: orientation.front,
      left: orientation.back,
    }
  }

  function insetPoint(from: { x: number; y: number }, to: { x: number; y: number }, distance: number) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy) || 1
    const clamped = Math.min(distance, length * 0.4)
    return {
      x: from.x + (dx / length) * clamped,
      y: from.y + (dy / length) * clamped,
    }
  }

  function toClockwiseQuad(corners: Array<{ x: number; y: number }>) {
    if (corners.length !== 4) return corners
    return [corners[0]!, corners[1]!, corners[3]!, corners[2]!]
  }

  function createRoundedQuad(
    corners: Array<{ x: number; y: number }>,
    radius: number,
    fillColor: number,
    strokeColor: number,
    alpha = 1,
    strokeAlpha = 0.08,
  ) {
    const graphic = new PIXI.Graphics()
    if (corners.length !== 4) return graphic

    const first = corners[0]!
    const start = insetPoint(first, corners[1]!, radius)
    graphic.moveTo(start.x, start.y)

    for (let index = 0; index < corners.length; index += 1) {
      const current = corners[index]!
      const next = corners[(index + 1) % corners.length]!
      const prev = corners[(index - 1 + corners.length) % corners.length]!
      const entry = insetPoint(current, prev, radius)
      const exit = insetPoint(current, next, radius)
      graphic.lineTo(entry.x, entry.y)
      graphic.quadraticCurveTo(current.x, current.y, exit.x, exit.y)
    }

    graphic.fill({ color: fillColor, alpha })
    graphic.stroke({ color: strokeColor, width: 0.7, alpha: strokeAlpha })
    return graphic
  }

  function projectFacePoint(
    corners: Array<{ x: number; y: number }>,
    u: number,
    v: number,
  ) {
    const topLeft = corners[0]
    const topRight = corners[1]
    const bottomLeft = corners[2]
    const bottomRight = corners[3]

    const topX = topLeft.x + (topRight.x - topLeft.x) * u
    const topY = topLeft.y + (topRight.y - topLeft.y) * u
    const bottomX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * u
    const bottomY = bottomLeft.y + (bottomRight.y - bottomLeft.y) * u

    return {
      x: topX + (bottomX - topX) * v,
      y: topY + (bottomY - topY) * v,
    }
  }

  function drawProjectedPips(
    container: PIXI.Container,
    corners: Array<{ x: number; y: number }>,
    value: number,
    radius: number,
    color: number,
    alpha: number,
    highlightAlpha = 0,
    indentAlpha = 0,
  ) {
    const pipLayout = getDicePipLayout(value)
    for (const [u, v] of pipLayout) {
      const point = projectFacePoint(corners, u, v)
      if (indentAlpha > 0) {
        const pipIndentOuter = new PIXI.Graphics()
          .circle(point.x, point.y, radius * 1.36)
          .fill({ color: 0x0f172a, alpha: indentAlpha * 0.7 })
        container.addChild(pipIndentOuter)

        const pipIndentInner = new PIXI.Graphics()
          .circle(point.x - radius * 0.1, point.y + radius * 0.1, radius * 0.96)
          .fill({ color: 0x08111f, alpha: indentAlpha * 0.5 })
        container.addChild(pipIndentInner)

        const pipIndentRim = new PIXI.Graphics()
          .circle(point.x + radius * 0.12, point.y - radius * 0.12, radius * 1.05)
          .stroke({ color: 0xffffff, width: Math.max(0.5, radius * 0.18), alpha: indentAlpha * 0.28 })
        container.addChild(pipIndentRim)
      }
      if (highlightAlpha > 0) {
        const pipHighlight = new PIXI.Graphics()
          .circle(point.x + radius * 0.24, point.y - radius * 0.24, radius * 1.02)
          .fill({ color: 0xffffff, alpha: highlightAlpha })
        container.addChild(pipHighlight)
      }

      const pip = new PIXI.Graphics()
        .circle(point.x, point.y, radius * 0.92)
        .fill({ color, alpha })
      container.addChild(pip)
    }
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return null
    audioCtx = new AudioCtor()
    return audioCtx
  }

  function stopBackgroundMusic() {
    if (bgmAudio) {
      bgmAudio.pause()
      bgmAudio.currentTime = 0
      bgmAudio = null
    }
  }

  function startBackgroundMusic() {
    if (bgmAudio) return
    const audio = new Audio(assetUrl('bgm.mp3'))
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.09
    bgmAudio = audio
    audio.play().catch(() => {
      // Autoplay may be blocked until the first user gesture; keep the element ready.
    })
  }

  function playFailSound() {
    const audio = new Audio(assetUrl('fail.wav'))
    audio.preload = 'auto'
    audio.volume = 0.9
    audio.play().catch(() => {})
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
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })

      host.appendChild(app.canvas)
      scene = new PIXI.Container()
      app.stage.addChild(scene)

      const [redPiece, yellowPiece, bluePiece, greenPiece] = await Promise.all([
        PIXI.Assets.load(assetUrl('player-red.png')),
        PIXI.Assets.load(assetUrl('player-yellow.png')),
        PIXI.Assets.load(assetUrl('player-blue.png')),
        PIXI.Assets.load(assetUrl('player-green.png')),
      ])
      playerPieceTextures = {
        0: redPiece instanceof PIXI.Texture ? redPiece : PIXI.Texture.from(assetUrl('player-red.png')),
        1: yellowPiece instanceof PIXI.Texture ? yellowPiece : PIXI.Texture.from(assetUrl('player-yellow.png')),
        2: bluePiece instanceof PIXI.Texture ? bluePiece : PIXI.Texture.from(assetUrl('player-blue.png')),
        3: greenPiece instanceof PIXI.Texture ? greenPiece : PIXI.Texture.from(assetUrl('player-green.png')),
      }
      pieceTexture = playerPieceTextures[0] ?? playerPieceTextures[1] ?? playerPieceTextures[2] ?? playerPieceTextures[3] ?? null
      const [loadedDiceIdle, loadedDiceFaces, loadedDiceRoll] = await Promise.all([
        loadDiceIdleAsset(),
        loadDiceFaceAssets(),
        loadDiceRollAssets(),
      ])
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

    const canRoll = game.value.winnerIndex === null && game.value.dice === null && !isTurnTransitioning.value && (isHumanTurn() || !options.autoPlayMode.value)

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

      if (isActivePlayer && canRoll) {
        playerBase.eventMode = 'static'
        playerBase.cursor = 'pointer'
        playerBase.hitArea = new PIXI.Rectangle(zoneX, zoneY, zoneSize, zoneSize)
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
      const gapSize = () => safeBoardSize * 0.028
      const finishBox = new PIXI.Graphics()
      finishBox
        .roundRect(finish[0].x - gapSize(), finish[0].y - gapSize(), gapSize() * 2, gapSize() * 2, 12)
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
    const orientation = isRolling.value ? diceOrientation.value : createOrientationForFront(diceValue ?? rollingFace.value)
    const rollingDiceAssetTexture = getRollingDiceAssetTexture()
    const previousRollingDiceAssetTexture = getPreviousRollingDiceAssetTexture()
    const settledDiceAssetTexture = getDiceFaceAssetTexture(diceValue)
    const idleDiceAssetTexture = getIdleDiceAssetTexture()
    const useDiceAssetRender = rollingDiceAssetTexture !== null || previousRollingDiceAssetTexture !== null || settledDiceAssetTexture !== null || idleDiceAssetTexture !== null

    const diceGroup = new PIXI.Container()
    diceGroup.eventMode = canRoll ? 'static' : 'passive'
    diceGroup.cursor = canRoll ? 'pointer' : 'default'
    diceGroup.hitArea = new PIXI.Rectangle(-diceSize * 0.95, -diceSize * 0.95, diceSize * 1.9, diceSize * 1.9)
    if (canRoll) {
      diceGroup.on('pointerdown', () => handleRoll(false))
    }
    center.addChild(diceGroup)

    const faceSize = diceSize * 0.72

    if (useDiceAssetRender) {
      const assetTexture = rollingDiceAssetTexture ?? settledDiceAssetTexture ?? idleDiceAssetTexture
      if (assetTexture) {
        const textureWidth = assetTexture.width || 1
        const textureHeight = assetTexture.height || 1
        const fittedHeight = diceSize * 0.98
        const fittedWidth = Math.max(diceSize * 0.8, (fittedHeight * textureWidth) / textureHeight)

        const previousTexture = previousRollingDiceAssetTexture
        if (previousTexture) {
          const previousSprite = new PIXI.Sprite(previousTexture)
          previousSprite.anchor.set(0.5)
          previousSprite.width = fittedWidth
          previousSprite.height = fittedHeight
          previousSprite.alpha = Math.max(0, Math.min(0.45, diceFaceTransitionAlpha.value * 0.5))
          previousSprite.tint = 0xe2e8f0
          diceGroup.addChild(previousSprite)
        }

        if (isRolling.value && diceRollTextures.length === 0 && diceRollTrailAlpha.value > 0.001) {
          const trailSprite = new PIXI.Sprite(assetTexture)
          trailSprite.anchor.set(0.5)
          trailSprite.width = fittedWidth
          trailSprite.height = fittedHeight
          trailSprite.alpha = Math.max(0, Math.min(0.16, diceRollTrailAlpha.value))
          trailSprite.tint = 0xdbeafe
          trailSprite.position.set(-diceSpinRotation.value * fittedWidth * 0.55, diceSpinFlip.value < 0.72 ? fittedHeight * 0.035 : -fittedHeight * 0.012)
          trailSprite.scale.set(1 + Math.abs(diceSpinRotation.value) * 0.16, 1)
          diceGroup.addChild(trailSprite)
        }

        const diceSprite = new PIXI.Sprite(assetTexture)
        diceSprite.anchor.set(0.5)
        diceSprite.width = fittedWidth
        diceSprite.height = fittedHeight
        diceGroup.addChild(diceSprite)

        if (!isRolling.value && isIdleDiceState && diceIdleTexture) {
          const overlayWidth = fittedWidth * 0.43
          const overlayHeight = fittedHeight * 0.43
          const overlayCenterY = -overlayHeight * 0.015

          const idleOverlaySprite = new PIXI.Sprite(diceIdleTexture)
          idleOverlaySprite.anchor.set(0.5)
          idleOverlaySprite.position.set(0, overlayCenterY)
          idleOverlaySprite.width = overlayWidth
          idleOverlaySprite.height = overlayHeight
          idleOverlaySprite.alpha = 1
          diceGroup.addChild(idleOverlaySprite)
        }

        const landingShadowScale = 1 + diceLandingSquash.value * 0.45 + (isRolling.value ? 0.06 : 0)
        const landingShadowOffset = fittedHeight * (0.36 + diceLandingSquash.value * 0.08)
        const shadowAlpha = 0.16 + (isRolling.value ? 0.08 : 0.02) + diceLandingSquash.value * 0.14
        const diceShadow = new PIXI.Graphics()
          .ellipse(0, landingShadowOffset, fittedWidth * 0.24 * landingShadowScale, fittedHeight * 0.08 * (1 + diceLandingSquash.value * 0.35))
          .fill({ color: 0x020617, alpha: shadowAlpha })
        diceGroup.addChildAt(diceShadow, 0)

        if (!isRolling.value && isIdleDiceState) {
          const promptGlow = new PIXI.Graphics()
            .roundRect(-faceSize * 0.18, faceSize * 0.09, faceSize * 0.36, faceSize * 0.2, faceSize * 0.08)
            .fill({ color: 0xffffff, alpha: 0.14 + diceIdlePulse.value * 0.08 })
          diceGroup.addChild(promptGlow)
        }

        const settleFlashAlpha = !isRolling.value && !isIdleDiceState
          ? Math.max(0, Math.min(0.18, diceLandingSquash.value * 0.32 + diceLandingLift.value * 0.004))
          : 0
        if (settleFlashAlpha > 0.001) {
          const settleFlash = new PIXI.Graphics()
            .roundRect(-fittedWidth * 0.33, -fittedHeight * 0.33, fittedWidth * 0.66, fittedHeight * 0.24, fittedWidth * 0.08)
            .fill({ color: 0xffffff, alpha: settleFlashAlpha })
          diceGroup.addChild(settleFlash)
        }

        const diceScaleBoost = 1 + diceIdlePulse.value * 0.05 + (isRolling.value ? 0.05 : 0)
        const shakeX = diceIdleShake.value * (isRolling.value ? 4.5 : 3)
        const shakeY = Math.sin(diceIdleShake.value * Math.PI * 0.5) * 2.2
        const landingScaleX = 1 + diceLandingSquash.value * 0.34 + diceResultPop.value * 0.08
        const landingScaleY = 1 - diceLandingSquash.value * 0.24 + diceResultPop.value * 0.04
        const landingSettleNudge = !isRolling.value && !isIdleDiceState ? Math.max(0, diceLandingSquash.value * 0.1) : 0
        const spinScaleX = diceSpinScale.value * diceScaleBoost * (isRolling.value ? diceSpinFlip.value : 1) * landingScaleX
        const spinScaleY = diceSpinScale.value * diceScaleBoost * (isRolling.value ? 1 + (1 - diceSpinFlip.value) * 0.22 : 1) * landingScaleY
        diceGroup.position.set(shakeX, shakeY - diceIdleLift.value - diceLandingLift.value + landingSettleNudge * fittedHeight * 0.08)
        diceGroup.rotation = diceSpinRotation.value
        diceGroup.scale.set(spinScaleX, spinScaleY)
      }
    } else {
      const depth = diceSize * 0.22
      const perspectiveYaw = Math.max(0.28, Math.min(1.22, 0.76 + diceSpinYaw.value))
      const perspectivePitch = Math.max(0.24, Math.min(1.08, 0.58 + diceSpinPitch.value))
      const skew = depth * (0.52 + perspectiveYaw * 0.78)
      const liftDepth = depth * (0.52 + perspectivePitch * 0.92)
      const baseFaceColor = createDiceBackdropTint(orientation.front)
      const enamelTone = mixHexColor(baseFaceColor, 0xffffff, 0.12)
      const frontColor = mixHexColor(enamelTone, 0xffffff, 0.1 + perspectivePitch * 0.05)
      const topColor = mixHexColor(createDiceBackdropTint(orientation.top), 0xffffff, 0.3 + perspectivePitch * 0.1)
      const sideColor = mixHexColor(createDiceBackdropTint(orientation.right), 0x0f172a, 0.1 + perspectiveYaw * 0.035)
      const strokeColor = mixHexColor(frontColor, 0x0f172a, 0.22)
      const pipColor = 0x102033
      const seamOverlap = faceSize * 0.028

    const shadowWidth = faceSize * (0.44 + perspectiveYaw * 0.1 + diceLandingSquash.value * 0.12)
    const shadowHeight = faceSize * (0.14 + (1.12 - perspectivePitch) * 0.04 + (isRolling.value ? 0.05 : 0.02))
    const shadow = new PIXI.Graphics()
      .ellipse(skew * 0.18, faceSize * 0.66, shadowWidth, shadowHeight)
      .fill({ color: 0x020617, alpha: 0.14 + (isRolling.value ? 0.12 : 0) + diceLandingSquash.value * 0.08 })
    diceGroup.addChild(shadow)

    const topCorners = [
      { x: -faceSize / 2, y: -faceSize / 2 },
      { x: faceSize / 2, y: -faceSize / 2 },
      { x: -faceSize / 2 + skew, y: -faceSize / 2 - liftDepth },
      { x: faceSize / 2 + skew, y: -faceSize / 2 - liftDepth },
    ]
    const rightCorners = [
      { x: faceSize / 2, y: -faceSize / 2 },
      { x: faceSize / 2 + skew, y: -faceSize / 2 - liftDepth },
      { x: faceSize / 2, y: faceSize / 2 },
      { x: faceSize / 2 + skew, y: faceSize / 2 - liftDepth },
    ]
    const frontFaceInset = faceSize * Math.max(0, Math.min(0.14, (1 - perspectivePitch) * 0.08))
    const frontCorners = [
      { x: -faceSize / 2, y: -faceSize / 2 + frontFaceInset },
      { x: faceSize / 2, y: -faceSize / 2 + frontFaceInset },
      { x: -faceSize / 2, y: faceSize / 2 },
      { x: faceSize / 2, y: faceSize / 2 },
    ]
    const topDrawCorners = [
      { x: topCorners[0]!.x + seamOverlap * 0.02, y: topCorners[0]!.y + seamOverlap * 0.18 },
      { x: topCorners[1]!.x + seamOverlap * 0.12, y: topCorners[1]!.y + seamOverlap * 0.24 },
      { x: topCorners[2]!.x + seamOverlap * 0.02, y: topCorners[2]!.y - seamOverlap * 0.02 },
      { x: topCorners[3]!.x + seamOverlap * 0.16, y: topCorners[3]!.y - seamOverlap * 0.04 },
    ]
    const rightDrawCorners = [
      { x: rightCorners[0]!.x - seamOverlap * 0.46, y: rightCorners[0]!.y - seamOverlap * 0.03 },
      { x: rightCorners[1]!.x + seamOverlap * 0.04, y: rightCorners[1]!.y - seamOverlap * 0.06 },
      { x: rightCorners[2]!.x - seamOverlap * 0.46, y: rightCorners[2]!.y + seamOverlap * 0.03 },
      { x: rightCorners[3]!.x + seamOverlap * 0.04, y: rightCorners[3]!.y + seamOverlap * 0.015 },
    ]

    const topFace = createRoundedQuad(toClockwiseQuad(topDrawCorners), faceSize * 0.08, topColor, strokeColor, 0.995, 0.04)
    diceGroup.addChild(topFace)

    const topGlaze = createRoundedQuad(
      toClockwiseQuad([
        { x: topDrawCorners[0]!.x + faceSize * 0.1, y: topDrawCorners[0]!.y + faceSize * 0.015 },
        { x: topDrawCorners[1]!.x - faceSize * 0.26, y: topDrawCorners[1]!.y + faceSize * 0.015 },
        { x: topDrawCorners[2]!.x + faceSize * 0.2, y: topDrawCorners[2]!.y + liftDepth * 0.34 },
        { x: topDrawCorners[3]!.x - faceSize * 0.34, y: topDrawCorners[3]!.y + liftDepth * 0.28 },
      ]),
      faceSize * 0.045,
      0xffffff,
      0xffffff,
      0.06,
      0,
    )
    diceGroup.addChild(topGlaze)

    const topGlazeTail = createRoundedQuad(
      toClockwiseQuad([
        { x: topDrawCorners[0]!.x + faceSize * 0.2, y: topDrawCorners[0]!.y + faceSize * 0.08 },
        { x: topDrawCorners[1]!.x - faceSize * 0.42, y: topDrawCorners[1]!.y + faceSize * 0.08 },
        { x: topDrawCorners[2]!.x + faceSize * 0.24, y: topDrawCorners[2]!.y + liftDepth * 0.5 },
        { x: topDrawCorners[3]!.x - faceSize * 0.46, y: topDrawCorners[3]!.y + liftDepth * 0.42 },
      ]),
      faceSize * 0.04,
      0xffffff,
      0xffffff,
      0.028,
      0,
    )
    diceGroup.addChild(topGlazeTail)

    const topBevel = createRoundedQuad(
      toClockwiseQuad([
        { x: topDrawCorners[0]!.x + faceSize * 0.03, y: topDrawCorners[0]!.y + faceSize * 0.005 },
        { x: topDrawCorners[1]!.x - faceSize * 0.03, y: topDrawCorners[1]!.y + faceSize * 0.005 },
        { x: topDrawCorners[2]!.x + faceSize * 0.04, y: topDrawCorners[2]!.y + liftDepth * 0.04 },
        { x: topDrawCorners[3]!.x - faceSize * 0.04, y: topDrawCorners[3]!.y + liftDepth * 0.04 },
      ]),
      faceSize * 0.045,
      0xffffff,
      0xffffff,
      0.035,
      0,
    )
    diceGroup.addChild(topBevel)

    const sideFace = createRoundedQuad(toClockwiseQuad(rightDrawCorners), faceSize * 0.07, sideColor, strokeColor, 0.995, 0.04)
    diceGroup.addChild(sideFace)

    const sideGloss = createRoundedQuad(
      toClockwiseQuad([
        { x: rightDrawCorners[0]!.x + seamOverlap * 0.26, y: rightDrawCorners[0]!.y + faceSize * 0.04 },
        { x: rightDrawCorners[1]!.x - faceSize * 0.26, y: rightDrawCorners[1]!.y + liftDepth * 0.08 },
        { x: rightDrawCorners[2]!.x + seamOverlap * 0.22, y: rightDrawCorners[2]!.y - faceSize * 0.22 },
        { x: rightDrawCorners[3]!.x - faceSize * 0.28, y: rightDrawCorners[3]!.y - faceSize * 0.18 },
      ]),
      faceSize * 0.03,
      0xffffff,
      0xffffff,
      0.024,
      0,
    )
    diceGroup.addChild(sideGloss)

    const sideGlossTail = createRoundedQuad(
      toClockwiseQuad([
        { x: rightDrawCorners[0]!.x + seamOverlap * 0.32, y: rightDrawCorners[0]!.y + faceSize * 0.16 },
        { x: rightDrawCorners[1]!.x - faceSize * 0.34, y: rightDrawCorners[1]!.y + liftDepth * 0.18 },
        { x: rightDrawCorners[2]!.x + seamOverlap * 0.24, y: rightDrawCorners[2]!.y - faceSize * 0.04 },
        { x: rightDrawCorners[3]!.x - faceSize * 0.36, y: rightDrawCorners[3]!.y + faceSize * 0.02 },
      ]),
      faceSize * 0.026,
      0xffffff,
      0xffffff,
      0.016,
      0,
    )
    diceGroup.addChild(sideGlossTail)

    const sideBevel = createRoundedQuad(
      toClockwiseQuad([
        { x: rightDrawCorners[0]!.x + seamOverlap * 0.16, y: rightDrawCorners[0]!.y + faceSize * 0.01 },
        { x: rightDrawCorners[1]!.x - faceSize * 0.03, y: rightDrawCorners[1]!.y + liftDepth * 0.05 },
        { x: rightDrawCorners[2]!.x + seamOverlap * 0.16, y: rightDrawCorners[2]!.y - faceSize * 0.02 },
        { x: rightDrawCorners[3]!.x - faceSize * 0.04, y: rightDrawCorners[3]!.y + liftDepth * 0.02 },
      ]),
      faceSize * 0.04,
      0x0f172a,
      0x0f172a,
      0.05,
      0,
    )
    diceGroup.addChild(sideBevel)

    const frontFace = new PIXI.Graphics()
      .roundRect(
        -faceSize / 2,
        -faceSize / 2 + frontFaceInset - seamOverlap * 0.9,
        faceSize + seamOverlap * 0.92,
        faceSize - frontFaceInset + seamOverlap * 0.94,
        faceSize * 0.152,
      )
      .fill({ color: frontColor, alpha: 0.995 })
      .stroke({ color: strokeColor, width: 0.8, alpha: 0.09 })
    diceGroup.addChild(frontFace)

    const frontBevel = new PIXI.Graphics()
      .roundRect(
        -faceSize / 2 + faceSize * 0.026,
        -faceSize / 2 + frontFaceInset + faceSize * 0.02 - seamOverlap * 0.5,
        faceSize * 0.95,
        faceSize - frontFaceInset - faceSize * 0.042 + seamOverlap * 0.42,
        faceSize * 0.132,
      )
      .stroke({ color: 0xffffff, width: faceSize * 0.03, alpha: 0.06 })
    diceGroup.addChild(frontBevel)

    const frontGlaze = new PIXI.Graphics()
      .roundRect(
        -faceSize / 2 + faceSize * 0.1,
        -faceSize / 2 + frontFaceInset + faceSize * 0.075,
        faceSize * 0.36,
        faceSize * 0.14,
        faceSize * 0.08,
      )
      .fill({ color: 0xffffff, alpha: 0.075 })
    diceGroup.addChild(frontGlaze)

    const frontGlazeTail = createRoundedQuad(
      toClockwiseQuad([
        { x: -faceSize / 2 + faceSize * 0.18, y: -faceSize / 2 + frontFaceInset + faceSize * 0.22 },
        { x: faceSize * 0.02, y: -faceSize / 2 + frontFaceInset + faceSize * 0.22 },
        { x: -faceSize / 2 + faceSize * 0.12, y: -faceSize / 2 + frontFaceInset + faceSize * 0.38 },
        { x: faceSize * 0.08, y: -faceSize / 2 + frontFaceInset + faceSize * 0.36 },
      ]),
      faceSize * 0.035,
      0xffffff,
      0xffffff,
      0.045,
      0,
    )
    diceGroup.addChild(frontGlazeTail)


    const frontRightSeam = new PIXI.Graphics()
      .roundRect(
        faceSize / 2 - seamOverlap,
        -faceSize / 2 + frontFaceInset + faceSize * 0.03,
        faceSize * 0.058,
        faceSize * 0.92,
        faceSize * 0.032,
      )
      .fill({ color: 0xffffff, alpha: 0.029 })
    diceGroup.addChild(frontRightSeam)

    const topRightSeam = createRoundedQuad(
      toClockwiseQuad([
        { x: faceSize / 2 - seamOverlap * 0.14, y: -faceSize / 2 + seamOverlap * 0.06 },
        { x: faceSize / 2 + skew * 0.14, y: -faceSize / 2 - liftDepth * 0.05 },
        { x: faceSize / 2 + skew * 0.2, y: -faceSize / 2 - liftDepth * 0.2 },
        { x: faceSize / 2 + seamOverlap * 0.02, y: -faceSize / 2 - seamOverlap * 0.05 },
      ]),
      faceSize * 0.018,
      0xffffff,
      0xffffff,
      0.022,
      0,
    )
    diceGroup.addChild(topRightSeam)

    const topFaceHighlight = createRoundedQuad(
      toClockwiseQuad([
        { x: -faceSize / 2 + faceSize * 0.1, y: -faceSize / 2 - liftDepth * 0.06 },
        { x: faceSize / 2 - faceSize * 0.2, y: -faceSize / 2 - liftDepth * 0.06 },
        { x: -faceSize / 2 + skew * 0.38, y: -faceSize / 2 - liftDepth * 0.62 },
        { x: faceSize / 2 + skew * 0.45, y: -faceSize / 2 - liftDepth * 0.62 },
      ]),
      faceSize * 0.05,
      0xffffff,
      0xffffff,
      0.05,
      0,
    )
    diceGroup.addChild(topFaceHighlight)

    const sideShade = createRoundedQuad(
      toClockwiseQuad([
        { x: faceSize / 2 + skew * 0.24, y: -faceSize / 2 - liftDepth * 0.02 },
        { x: faceSize / 2 + skew * 0.84, y: -faceSize / 2 - liftDepth * 0.14 },
        { x: faceSize / 2 + skew * 0.2, y: faceSize / 2 - liftDepth * 0.06 },
        { x: faceSize / 2 + skew * 0.82, y: faceSize / 2 - liftDepth * 0.18 },
      ]),
      faceSize * 0.04,
      0x0f172a,
      0x0f172a,
      0.06,
      0,
    )
    diceGroup.addChild(sideShade)

    const faceHighlight = createRoundedQuad(
      toClockwiseQuad([
        { x: -faceSize / 2 + faceSize * 0.06, y: -faceSize / 2 + frontFaceInset + faceSize * 0.06 },
        { x: faceSize * 0.18, y: -faceSize / 2 + frontFaceInset + faceSize * 0.06 },
        { x: -faceSize / 2 + faceSize * 0.02, y: -faceSize / 2 + frontFaceInset + faceSize * 0.22 },
        { x: faceSize * 0.28, y: -faceSize / 2 + frontFaceInset + faceSize * 0.22 },
      ]),
      faceSize * 0.05,
      0xffffff,
      0xffffff,
      0.08,
      0,
    )
    diceGroup.addChild(faceHighlight)

    drawProjectedPips(
      diceGroup,
      topCorners,
      orientation.top,
      faceSize * 0.044,
      mixHexColor(pipColor, 0xffffff, 0.16),
      0.34,
      0.06,
      0.14,
    )

    drawProjectedPips(
      diceGroup,
      rightCorners,
      orientation.right,
      faceSize * 0.038,
      mixHexColor(pipColor, 0xffffff, 0.08),
      0.3,
      0.03,
      0.12,
    )

    drawProjectedPips(
      diceGroup,
      frontCorners,
      orientation.front,
      faceSize * 0.074,
      pipColor,
      0.98,
      0.05,
      0.2,
    )

    if (diceValue === null) {
      const promptGlow = new PIXI.Graphics()
        .roundRect(-faceSize * 0.16, faceSize * 0.08, faceSize * 0.32, faceSize * 0.22, faceSize * 0.08)
        .fill({ color: 0xffffff, alpha: 0.18 + diceIdlePulse.value * 0.1 })
      diceGroup.addChild(promptGlow)
    }

    const diceScaleBoost = 1 + diceIdlePulse.value * 0.05 + (isRolling.value ? 0.05 : 0)
    const shakeX = diceIdleShake.value * (isRolling.value ? 4.5 : 3)
    const shakeY = Math.sin(diceIdleShake.value * Math.PI * 0.5) * 2.2
    const landingScaleX = 1 + diceLandingSquash.value * 0.22
    const landingScaleY = 1 - diceLandingSquash.value * 0.16
    const spinScaleX = diceSpinScale.value * diceScaleBoost * (isRolling.value ? diceSpinFlip.value : 1) * landingScaleX
    const spinScaleY = diceSpinScale.value * diceScaleBoost * (isRolling.value ? 1 + (1 - diceSpinFlip.value) * 0.22 : 1) * landingScaleY
    diceGroup.position.set(shakeX, shakeY - diceIdleLift.value - diceLandingLift.value)
    diceGroup.rotation = diceSpinRotation.value
    diceGroup.scale.set(spinScaleX, spinScaleY)
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

      const legalRing = new PIXI.Graphics()
        .circle(0, 0, pieceRadius + 11)
        .stroke({ color: 0xffffff, width: 2, alpha: isLegal ? 0.22 + legalPulse.value * 0.3 : 0.04 })
      pieceGroup.addChildAt(legalRing, 0)

      if (isLegal && !isMoving) {
        const legalGlow = new PIXI.Graphics()
          .circle(0, 0, pieceRadius + 15)
          .stroke({ color: hexToNumber(pieceInfo.player.color), width: 4, alpha: 0.15 + legalPulse.value * 0.35 })
        pieceGroup.addChildAt(legalGlow, 0)
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
    syncTurnAccentAnimation()
    if (game.value.winnerIndex !== null) {
      options.page.value = 'result'
    }
    playAutoTurn()
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
      diceLandingSquash.value = Math.max(0, Math.sin(progress * Math.PI * 1.2) * (1 - progress * 0.58))
      diceResultPop.value = Math.max(0, Math.sin(progress * Math.PI * 1.35) * (1 - progress * 0.42))
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
    let lastFaceChangeTime = startTime
    let orientation = createOrientationForFront(rollingFace.value)
    diceOrientation.value = orientation

    const tumbleOps = [rotateDiceForward, rotateDiceRight, spinDiceClockwise, rotateDiceForward, rotateDiceRight]
    const tumbleSequence = Array.from({ length: 18 }, (_, index) => tumbleOps[(index + Math.floor(Math.random() * tumbleOps.length)) % tumbleOps.length])

    const spin = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / 1100)
      const interval = Math.max(55, 165 - progress * 88)
      const tick = Math.floor(elapsed / interval)
      while (lastTick < tick) {
        const tumble = tumbleSequence[lastTick % tumbleSequence.length] ?? rotateDiceForward
        orientation = tumble(orientation)
        diceOrientation.value = orientation
        previousRollingFace.value = rollingFace.value
        rollingFace.value = orientation.front
        diceFaceTransitionAlpha.value = previousRollingFace.value === rollingFace.value ? 0 : 0.32
        lastFaceChangeTime = now
        lastTick += 1
      }
      const wobbleDecay = 1 - progress * 0.22
      const turnProgress = 1 - (1 - progress) * (1 - progress)
      const pitchWave = Math.sin(progress * Math.PI * 3.6 + Math.PI * 0.15)
      const yawWave = Math.cos(progress * Math.PI * 3.1 - Math.PI * 0.2)
      if (diceRollTextures.length === 0) {
        const elapsedSinceFaceChange = now - lastFaceChangeTime
        const fadeProgress = Math.min(1, elapsedSinceFaceChange / 90)
        diceFaceTransitionAlpha.value = Math.max(0, (1 - fadeProgress) * 0.32)
        diceRollTrailAlpha.value = (0.06 + Math.abs(diceSpinRotation.value) * 0.34 + (1 - diceSpinFlip.value) * 0.08) * (1 - progress * 0.3)
      }
      diceSpinScale.value = 1 + Math.sin(progress * Math.PI) * 0.06
      diceSpinRotation.value = Math.sin(progress * Math.PI * 4.8) * 0.26 * wobbleDecay + turnProgress * Math.PI * 0.1
      diceSpinFlip.value = 0.46 + Math.abs(Math.cos(progress * Math.PI * 6.8)) * 0.54
      diceSpinPitch.value = pitchWave * 0.28 * wobbleDecay + 0.08
      diceSpinYaw.value = yawWave * 0.24 * wobbleDecay + 0.04
      if (diceRollTextures.length > 0) {
        diceRollFrame.value = Math.min(diceRollTextures.length - 1, Math.floor(progress * diceRollTextures.length))
      }
      renderScene()
      if (progress < 1) {
        rollFrameId = window.requestAnimationFrame(spin)
      } else {
        rollFrameId = null
        diceSpinScale.value = 1
        diceSpinRotation.value = 0
        diceSpinFlip.value = 1
        diceSpinPitch.value = 0
        diceSpinYaw.value = 0
        diceFaceTransitionAlpha.value = 0
        diceRollTrailAlpha.value = 0
        if (diceRollTextures.length > 0) {
          diceRollFrame.value = Math.max(0, diceRollTextures.length - 1)
        }
        diceOrientation.value = createOrientationForFront(rollingFace.value)
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
    if (getPlayerTrackCount(currentPlayer.value) === 0 && game.value.dice === 6) return legalIds[0] ?? null
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
    previousRollingFace.value = rollingFace.value
    diceFaceTransitionAlpha.value = 0
    diceRollTrailAlpha.value = 0
    diceRollFrame.value = 0
    diceSpinScale.value = 1
    diceSpinPitch.value = 0
    diceSpinYaw.value = 0
    diceLandingLift.value = 0
    diceLandingSquash.value = 0
    startDiceSpin()

    let ticks = 0
    const spin = () => {
      if (!isRolling.value) return
      previousRollingFace.value = rollingFace.value
      rollingFace.value = Math.floor(Math.random() * 6) + 1
      if (previousRollingFace.value !== rollingFace.value) {
        diceFaceTransitionAlpha.value = diceRollTextures.length === 0 ? 0.32 : 0
      }
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
        autoMoveTimer = window.setTimeout(() => {
          autoMoveTimer = null
          handleMove(humanAutoPieceId)
        }, 220)
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
    if (!currentLayout || game.value.dice === null || game.value.winnerIndex !== null || movingPoint.value !== null) return
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

  function cleanupPixi() {
    clearTimers()
    stopBackgroundMusic()
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
