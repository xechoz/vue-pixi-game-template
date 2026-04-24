<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as PIXI from 'pixi.js'

import {
  type GameMode,
  type GameState,
  PLAYER_DEFS,
  TRACK_LENGTH,
  buildMoveTrajectory,
  clampPiecesPerPlayer,
  createGame,
  getCurrentPlayer,
  getLegalPieceIds,
  getPieceLabel,
  getPieceLocation,
  getPlayerFinishedCount,
  getPlayerTrackCount,
  getTrackCellIndex,
  movePiece,
  rollDice,
} from './game'

const mode = ref<GameMode>(4)
const piecesPerPlayer = ref(4)
const game = ref<GameState>(
  createGame({
    mode: mode.value,
    piecesPerPlayer: piecesPerPlayer.value,
  }),
)
const canvasEl = ref<HTMLDivElement | null>(null)

let app: PIXI.Application | null = null
let scene: PIXI.Container | null = null
let boardTexture: PIXI.Texture | null = null
let pieceTexture: PIXI.Texture | null = null

type BoardLayout = {
  trackPoints: Array<{ x: number; y: number }>
  baseSlots: Array<Array<{ x: number; y: number }>>
  finishSlots: Array<Array<{ x: number; y: number }>>
}

let currentLayout: BoardLayout | null = null

const modeOptions: Array<{ value: GameMode; label: string; hint: string }> = [
  { value: 2, label: '2 人模式', hint: '2 位玩家手动，2 位电脑' },
  { value: 3, label: '3 人模式', hint: '3 位玩家手动，1 位电脑' },
  { value: 4, label: '4 人模式', hint: '4 位玩家手动，对战电脑关闭' },
]

const pieceOptions = [1, 2, 3, 4]

const currentPlayer = computed(() => getCurrentPlayer(game.value))
const legalPieces = computed(() => getLegalPieceIds(game.value))
const winner = computed(() =>
  game.value.winnerIndex === null ? null : game.value.players[game.value.winnerIndex],
)
const autoPlayMode = ref(true)
const replayingPieceId = ref<string | null>(null)
const movePath = ref<number[]>([])
const movingPoint = ref<{ x: number; y: number } | null>(null)
const rollingFace = ref<number>(1)
const isRolling = ref(false)
const showTips = ref(false)

let rollTimer: number | null = null
let autoTimer: number | null = null
let moveFrameId: number | null = null
let audioCtx: AudioContext | null = null

function refreshGameView() {
  game.value = { ...game.value }
  renderScene()
}

function clearMovePreview() {
  replayingPieceId.value = null
  movePath.value = []
  movingPoint.value = null
}

function clearTimers() {
  if (rollTimer !== null) {
    window.clearTimeout(rollTimer)
    rollTimer = null
  }
  if (autoTimer !== null) {
    window.clearTimeout(autoTimer)
    autoTimer = null
  }
  if (moveFrameId !== null) {
    window.cancelAnimationFrame(moveFrameId)
    moveFrameId = null
  }
}

function scheduleAutoTurn(delay = 180) {
  if (game.value.winnerIndex !== null) return
  if (!autoPlayMode.value || isHumanTurn()) return
  if (autoTimer !== null) {
    window.clearTimeout(autoTimer)
  }
  autoTimer = window.setTimeout(() => {
    autoTimer = null
    playAutoTurn()
  }, delay)
}

function getDiceDisplayValue() {
  if (isRolling.value) return rollingFace.value
  return game.value.dice
}

function isHumanTurn() {
  return currentPlayer.value.humanControlled
}

function getPlayerControlLabel(player: GameState['players'][number]) {
  return player.humanControlled ? '人类' : '电脑'
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

function playAutoTurn() {
  if (!autoPlayMode.value || game.value.winnerIndex !== null) return
  if (isHumanTurn()) return
  if (game.value.dice !== null || isRolling.value) return

  handleRoll()
}

function restartGame() {
  game.value = createGame({
    mode: mode.value,
    piecesPerPlayer: clampPiecesPerPlayer(piecesPerPlayer.value),
  })
  clearMovePreview()
  renderScene()
}

function handleRoll() {
  if (game.value.winnerIndex !== null || game.value.dice !== null || isRolling.value) return
  if (!isHumanTurn() && !autoPlayMode.value) return

  clearTimers()
  isRolling.value = true
  rollingFace.value = Math.floor(Math.random() * 6) + 1

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
      if (!isHumanTurn() && autoPlayMode.value) {
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
      refreshGameView()
      clearMovePreview()
      if (!isHumanTurn() && autoPlayMode.value) scheduleAutoTurn(220)
    }
    return
  }

  const totalDuration = Math.max(420, (pathPoints.length - 1) * 130)
  const startTime = performance.now()

  const frame = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(1, elapsed / totalDuration)
    const segment = Math.min(pathPoints.length - 2, Math.floor(progress * (pathPoints.length - 1)))
    const localT = progress * (pathPoints.length - 1) - segment
    const start = pathPoints[segment]
    const end = pathPoints[segment + 1] ?? start

    movingPoint.value = {
      x: lerp(start.x, end.x, localT),
      y: lerp(start.y, end.y, localT),
    }
    renderScene()

    if (progress < 1) {
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
      if (!isHumanTurn() && autoPlayMode.value) scheduleAutoTurn(220)
    }
  }

  if (moveFrameId !== null) {
    window.cancelAnimationFrame(moveFrameId)
  }
  moveFrameId = window.requestAnimationFrame(frame)
}

function setMode(nextMode: GameMode) {
  mode.value = nextMode
}

function setPiecesPerPlayer(nextCount: number) {
  piecesPerPlayer.value = nextCount
}

watch([mode, piecesPerPlayer], restartGame)

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t
}

function hexToNumber(color: string) {
  return Number.parseInt(color.replace('#', ''), 16)
}

function buildTrackPoints(originX: number, originY: number, size: number) {
  const left = originX + size * 0.14
  const right = originX + size * 0.86
  const top = originY + size * 0.14
  const bottom = originY + size * 0.86

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

function buildBaseSlots(originX: number, originY: number, size: number) {
  const cornerInset = size * 0.08
  const gap = size * 0.075

  const corners = [
    { x: originX + cornerInset, y: originY + cornerInset },
    { x: originX + size - cornerInset, y: originY + cornerInset },
    { x: originX + size - cornerInset, y: originY + size - cornerInset },
    { x: originX + cornerInset, y: originY + size - cornerInset },
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

function buildFinishSlots(originX: number, originY: number, size: number) {
  const centerX = originX + size / 2
  const centerY = originY + size / 2
  const offset = size * 0.11
  const gap = size * 0.055

  const corners = [
    { x: centerX - offset, y: centerY - offset },
    { x: centerX + offset, y: centerY - offset },
    { x: centerX + offset, y: centerY + offset },
    { x: centerX - offset, y: centerY + offset },
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

function drawText(
  text: string,
  x: number,
  y: number,
  options: Partial<PIXI.TextStyle> & { anchor?: number } = {},
) {
  const { anchor, ...style } = options
  const label = new PIXI.Text({
    text,
    style: {
      fill: 0xe2e8f0,
      fontFamily: 'Inter, system-ui, sans-serif',
      ...style,
    },
  })
  label.position.set(x, y)
  if (anchor !== undefined) {
    label.anchor.set(anchor)
  }
  return label
}

function renderScene() {
  if (!app || !scene) return

  const removable = scene.removeChildren()
  for (const child of removable) {
    child.destroy({ children: true })
  }

  const { width, height } = app.screen
  const boardSize = Math.min(width, height) - 32
  const safeBoardSize = Math.max(260, boardSize)
  const originX = (width - safeBoardSize) / 2
  const originY = (height - safeBoardSize) / 2
  const cellSize = safeBoardSize * 0.06
  const trackSize = cellSize * 0.74
  const pieceRadius = cellSize * 0.33

  const board = new PIXI.Container()
  scene.addChild(board)

  const backdrop = new PIXI.Graphics()
    .roundRect(originX, originY, safeBoardSize, safeBoardSize, 28)
    .fill({ color: 0x0f172a, alpha: 0.94 })
    .stroke({ color: 0x334155, width: 2, alpha: 0.65 })
  board.addChild(backdrop)

  if (boardTexture) {
    const boardSprite = new PIXI.Sprite(boardTexture)
    boardSprite.position.set(originX, originY)
    boardSprite.width = safeBoardSize
    boardSprite.height = safeBoardSize
    board.addChild(boardSprite)
  }

  const boardInset = safeBoardSize * 0.14
  const innerLeft = originX + boardInset
  const innerTop = originY + boardInset
  const innerRight = originX + safeBoardSize - boardInset
  const innerBottom = originY + safeBoardSize - boardInset
  const centerX = originX + safeBoardSize / 2
  const centerY = originY + safeBoardSize / 2

  const homes = new PIXI.Graphics()
  homes
    .roundRect(originX + 16, originY + 16, safeBoardSize - 32, safeBoardSize - 32, 22)
    .stroke({ color: 0x1e293b, width: 1, alpha: 0.5 })
  homes
    .roundRect(innerLeft, innerTop, innerRight - innerLeft, innerBottom - innerTop, 18)
    .fill({ color: 0x172033, alpha: 0.95 })
    .stroke({ color: 0x263244, width: 2, alpha: 0.9 })
  board.addChild(homes)

  const trackPoints = buildTrackPoints(originX, originY, safeBoardSize)
  const baseSlots = buildBaseSlots(originX, originY, safeBoardSize)
  const finishSlots = buildFinishSlots(originX, originY, safeBoardSize)
  currentLayout = { trackPoints, baseSlots, finishSlots }

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
    const zoneSize = safeBoardSize * 0.18
    const zoneX = player.index === 0 || player.index === 3 ? originX + 14 : originX + safeBoardSize - 14 - zoneSize
    const zoneY = player.index === 0 || player.index === 1 ? originY + 14 : originY + safeBoardSize - 14 - zoneSize

    playerBase
      .roundRect(zoneX, zoneY, zoneSize, zoneSize, 24)
      .fill({ color: player.color, alpha: 0.12 })
      .stroke({ color: player.color, width: 2, alpha: 0.35 })
    board.addChild(playerBase)

    const cornerTag = drawText(player.corner, zoneX + zoneSize / 2, zoneY + 12, {
      anchor: 0.5,
      fontSize: 14,
      fill: player.color,
      fontWeight: '700',
    })
    board.addChild(cornerTag)

    const finish = finishSlots[player.index]
    const finishBox = new PIXI.Graphics()
    finishBox
      .roundRect(finish[0].x - gapSize(), finish[0].y - gapSize(), gapSize() * 2, gapSize() * 2, 12)
      .fill({ color: player.color, alpha: 0.08 })
      .stroke({ color: player.color, width: 1, alpha: 0.24 })
    board.addChild(finishBox)

    const label = drawText(`${player.name} · ${getPlayerControlLabel(player)}`, zoneX + zoneSize / 2, zoneY + zoneSize - 18, {
      anchor: 0.5,
      fontSize: 13,
      fill: 0xcbd5e1,
    })
    board.addChild(label)

    function gapSize() {
      return safeBoardSize * 0.028
    }
  }

  const canRoll = game.value.winnerIndex === null && game.value.dice === null
  const center = new PIXI.Container()
  center.position.set(centerX, centerY)
  center.eventMode = canRoll ? 'static' : 'passive'
  center.cursor = canRoll ? 'pointer' : 'default'
  if (canRoll) {
    center.on('pointerdown', handleRoll)
  }
  board.addChild(center)

  const diceSize = safeBoardSize * 0.18
  const diceBody = new PIXI.Graphics()
    .roundRect(-diceSize / 2, -diceSize / 2, diceSize, diceSize, 22)
    .fill({ color: 0x0f172a, alpha: 0.98 })
    .stroke({ color: 0x7dd3fc, width: 3, alpha: 0.72 })
  center.addChild(diceBody)

  const diceGlow = new PIXI.Graphics()
    .roundRect(-diceSize * 0.62 / 2, -diceSize * 0.62 / 2, diceSize * 0.62, diceSize * 0.62, 18)
    .stroke({ color: 0x38bdf8, width: 2, alpha: 0.16 })
  center.addChildAt(diceGlow, 0)

  const diceValue = getDiceDisplayValue()
  if (diceValue === null) {
    const diceLabel = drawText('掷骰', 0, -6, {
      anchor: 0.5,
      fontSize: 26,
      fill: 0xf8fafc,
      fontWeight: '800',
    })
    center.addChild(diceLabel)

    const diceHint = drawText('点击投掷', 0, 20, {
      anchor: 0.5,
      fontSize: 12,
      fill: 0x94a3b8,
    })
    center.addChild(diceHint)
  } else {
    const pipRadius = diceSize * 0.05
    const pipOffset = diceSize * 0.22
    const pipPoints = [
      [-pipOffset, -pipOffset],
      [0, -pipOffset],
      [pipOffset, -pipOffset],
      [-pipOffset, 0],
      [0, 0],
      [pipOffset, 0],
      [-pipOffset, pipOffset],
      [0, pipOffset],
      [pipOffset, pipOffset],
    ] as const

    const layouts: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    }

    for (const index of layouts[diceValue] ?? layouts[1]) {
      const [px, py] = pipPoints[index]
      const pip = new PIXI.Graphics()
        .circle(px, py, pipRadius)
        .fill({ color: 0xf8fafc, alpha: 0.96 })
      center.addChild(pip)
    }

    const diceLabel = drawText(String(diceValue), 0, diceSize * 0.34, {
      anchor: 0.5,
      fontSize: 18,
      fill: 0xcbd5e1,
      fontWeight: '800',
    })
    center.addChild(diceLabel)
  }

  const centerText = drawText('终点区', 0, diceSize * 0.72, {
    anchor: 0.5,
    fontSize: 14,
    fill: 0xcbd5e1,
    fontWeight: '700',
  })
  center.addChild(centerText)

  const centerBadge = drawText('点这里投骰', 0, -diceSize * 0.72, {
    anchor: 0.5,
    fontSize: 11,
    fill: 0x67e8f9,
    fontWeight: '700',
  })
  center.addChild(centerBadge)

  const statusBox = new PIXI.Graphics()
    .roundRect(originX + 16, originY + safeBoardSize - 72, safeBoardSize - 32, 56, 16)
    .fill({ color: 0x020617, alpha: 0.72 })
    .stroke({ color: 0x475569, width: 1, alpha: 0.45 })
  board.addChild(statusBox)

  const statusText = drawText(game.value.status, originX + 32, originY + safeBoardSize - 54, {
    fontSize: 15,
    fill: 0xcbd5e1,
  })
  board.addChild(statusText)

  const metaText = drawText(
    `模式 ${game.value.mode} 人 · 每人 ${game.value.piecesPerPlayer} 枚棋子 · 回合 ${game.value.turnCount}`,
    originX + 32,
    originY + 24,
    {
      fontSize: 14,
      fill: 0x94a3b8,
    },
  )
  board.addChild(metaText)

  if (winner.value) {
    const banner = new PIXI.Graphics()
      .roundRect(originX + safeBoardSize * 0.18, originY + safeBoardSize * 0.36, safeBoardSize * 0.64, safeBoardSize * 0.16, 24)
      .fill({ color: 0x020617, alpha: 0.9 })
      .stroke({ color: winner.value.color, width: 3, alpha: 0.9 })
    board.addChild(banner)

    const winnerText = drawText(`${winner.value.name} 胜利！`, originX + safeBoardSize / 2, originY + safeBoardSize / 2 - 20, {
      anchor: 0.5,
      fontSize: 26,
      fill: 0xf8fafc,
      fontWeight: '800',
    })
    board.addChild(winnerText)

    const hintText = drawText('可以点“重新开始”再开一局。', originX + safeBoardSize / 2, originY + safeBoardSize / 2 + 12, {
      anchor: 0.5,
      fontSize: 14,
      fill: 0xcbd5e1,
    })
    board.addChild(hintText)
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
      .ellipse(2, 6, pieceRadius + 8, pieceRadius + 4)
      .fill({ color: 0x020617, alpha: 0.28 })
    pieceGroup.addChild(shadow)

    const tint = hexToNumber(pieceInfo.player.color)
    if (pieceTexture) {
      const body = new PIXI.Sprite(pieceTexture)
      body.anchor.set(0.5)
      body.position.set(0, -1)
      body.width = pieceRadius * 4.4
      body.height = pieceRadius * 4.4
      body.tint = tint
      pieceGroup.addChild(body)
    } else {
      const body = new PIXI.Graphics()
        .circle(0, 0, pieceRadius + 3)
        .fill({ color: tint, alpha: 1 })
        .stroke({ color: 0xffffff, width: 2, alpha: 0.88 })
      pieceGroup.addChild(body)
    }

    const badgeRing = new PIXI.Graphics()
      .circle(0, 0, pieceRadius + 6)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.9 })
    pieceGroup.addChildAt(badgeRing, 0)

    const badge = drawText(String(pieceInfo.pieceIndex + 1), 0, -2, {
      anchor: 0.5,
      fontSize: 13,
      fill: 0xf8fafc,
      fontWeight: '800',
    })
    pieceGroup.addChild(badge)

    const label = drawText(getPieceLabel(pieceInfo.piece), 0, pieceRadius + 6, {
      anchor: 0.5,
      fontSize: 10,
      fill: 0xcbd5e1,
    })
    pieceGroup.addChild(label)

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

onMounted(async () => {
  if (!canvasEl.value) return

  app = new PIXI.Application()
  await app.init({
    resizeTo: canvasEl.value,
    background: '#050b16',
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  })

  canvasEl.value.appendChild(app.canvas)
  scene = new PIXI.Container()
  app.stage.addChild(scene)

  const [loadedBoard, loadedPiece] = await Promise.all([
    PIXI.Assets.load('/flight-ludo-board.svg'),
    PIXI.Assets.load('/flight-ludo-plane.svg'),
  ])
  boardTexture = loadedBoard instanceof PIXI.Texture ? loadedBoard : PIXI.Texture.from('/flight-ludo-board.svg')
  pieceTexture = loadedPiece instanceof PIXI.Texture ? loadedPiece : PIXI.Texture.from('/flight-ludo-plane.svg')

  renderScene()

  window.addEventListener('resize', renderScene)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', renderScene)
  clearTimers()
  if (!app) return
  app.destroy(true)
  app = null
  scene = null
  currentLayout = null
  audioCtx?.close().catch(() => {})
  audioCtx = null
})
</script>

<template>
  <main class="shell">
    <section class="layout">
      <aside class="panel">
        <p class="eyebrow">简化版飞行棋</p>
        <h1>飞行棋</h1>
        <p class="intro">选模式，掷骰子，走棋。</p>

        <div class="section">
          <h2>模式</h2>
          <div class="button-row chips">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              :class="['choice-button', 'chip-button', { active: mode === option.value }]"
              type="button"
              @click="setMode(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="section">
          <h2>棋子</h2>
          <div class="button-row compact chips">
            <button
              v-for="count in pieceOptions"
              :key="count"
              :class="['choice-button', 'count-button', 'chip-button', { active: piecesPerPlayer === count }]"
              type="button"
              @click="setPiecesPerPlayer(count)"
            >
              {{ count }}
            </button>
          </div>
        </div>

        <div class="section status-card glass-card compact-card">
          <h2>状态</h2>
          <p class="status-text">{{ game.status }}</p>
          <div class="meta-row">
            <span><strong>{{ currentPlayer.name }}</strong> 回合（{{ currentPlayer.humanControlled ? '手动' : '电脑' }}）</span>
            <span>骰子 <strong>{{ game.dice ?? '—' }}</strong></span>
            <span>可走 <strong>{{ legalPieces.length }}</strong></span>
          </div>
          <p v-if="winner" class="winner-text">胜利者：{{ winner.name }}</p>
        </div>

        <div class="section stats-card glass-card compact-card">
          <h2>玩家</h2>
          <ul class="player-list">
            <li v-for="player in game.players" :key="player.index" :class="['player-item', { active: player.index === currentPlayer.index }]">
              <span class="swatch" :style="{ backgroundColor: player.color }" />
              <div>
                <strong>{{ player.name }}</strong>
                <small>{{ player.humanControlled ? '手动' : '电脑' }}</small>
              </div>
              <em>{{ getPlayerTrackCount(player) }}/{{ player.pieces.length }} · {{ getPlayerFinishedCount(player) }}</em>
            </li>
          </ul>
        </div>

        <button class="secondary compact-action" type="button" @click="restartGame">
          重开
        </button>

        <button class="tips-toggle" type="button" @click="showTips = !showTips">
          {{ showTips ? '收起说明' : '说明' }}
        </button>

        <div v-if="showTips" class="section tips glass-card">
          <h2>说明</h2>
          <ul>
            <li>掷出 6 才能从基地出发。</li>
            <li>落在对方棋子上可把它送回基地。</li>
            <li>四个角是安全点，掷出 6 可连走一次。</li>
          </ul>
        </div>
      </aside>

      <section class="stage-panel">
        <div ref="canvasEl" class="canvas-shell" aria-label="飞行棋游戏画布" />
      </section>
    </section>
  </main>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  padding: 18px;
  display: grid;
  gap: 20px;
}

.layout {
  width: min(1500px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.panel,
.stage-panel {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.9)),
    radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 45%);
  box-shadow: 0 24px 70px rgba(2, 6, 23, 0.5);
  backdrop-filter: blur(14px);
}

.panel {
  padding: 18px;
  display: grid;
  gap: 14px;
}

.eyebrow {
  margin: 0;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.75rem;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 1.05;
}

.intro {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.7;
  max-width: 64ch;
}

.section {
  display: grid;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 0.95rem;
  color: #e2e8f0;
}

.roll-dice-button,
.compact-action,
.tips-toggle {
  width: 100%;
}

.tips-toggle {
  border: 1px solid rgba(56, 189, 248, 0.28);
  background: rgba(8, 47, 73, 0.72);
  color: #e2e8f0;
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
  justify-self: start;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.tips-toggle:hover {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.6);
  background: rgba(8, 47, 73, 0.9);
}

.tips-toggle:active {
  transform: translateY(0);
}

.button-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.button-row.compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.choice-button,
.primary,
.secondary {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.82);
  color: #e2e8f0;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.choice-button {
  padding: 14px 16px;
  display: grid;
  gap: 4px;
  text-align: left;
}

.choice-button small {
  color: #94a3b8;
}

.choice-button.active {
  border-color: rgba(56, 189, 248, 0.6);
  background: rgba(8, 47, 73, 0.9);
}

.count-button {
  text-align: center;
  justify-items: center;
}

.choice-button:hover,
.primary:hover,
.secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.45);
}

.choice-button:active,
.primary:active,
.secondary:active {
  transform: translateY(0);
}

.status-card,
.stats-card,
.tips,
.compact-card {
  padding: 16px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.status-text {
  margin: 0;
  color: #f8fafc;
  line-height: 1.6;
}

.meta-row {
  display: grid;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.92rem;
}

.meta-row strong {
  color: #67e8f9;
  font-weight: 700;
}

.winner-text {
  margin: 0;
  color: #67e8f9;
  font-weight: 700;
}

.player-list,
.tips ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.player-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 12px;
  align-items: center;
  padding: 12px;
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.player-item.active {
  border-color: rgba(56, 189, 248, 0.4);
}

.player-item .swatch {
  grid-row: span 2;
  width: 14px;
  height: 14px;
  border-radius: 999px;
}

.player-item strong,
.player-item small,
.player-item em {
  display: block;
  font-style: normal;
}

.player-item small,
.player-item em {
  color: #94a3b8;
  font-size: 0.82rem;
}

.player-item em {
  grid-column: 2;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.primary,
.secondary {
  padding: 14px 16px;
  font-weight: 700;
}

.primary {
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.95), rgba(8, 145, 178, 0.9));
}

.primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.secondary {
  background: rgba(15, 23, 42, 0.92);
}

.tips ul {
  gap: 8px;
  color: #cbd5e1;
  line-height: 1.6;
}

.stage-panel {
  padding: 8px;
  min-height: 82vh;
  display: grid;
  place-items: center;
}

.canvas-shell {
  min-height: 82vh;
  width: 100%;
  border-radius: 20px;
  overflow: hidden;
}

.canvas-shell :deep(canvas) {
  display: block;
}

@media (min-width: 1100px) {
  .layout {
    grid-template-columns: 280px minmax(0, 1fr);
    align-items: start;
  }

  .stage-panel {
    position: sticky;
    top: 24px;
  }
}
</style>
