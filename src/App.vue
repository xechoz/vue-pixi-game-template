<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as PIXI from 'pixi.js'

import {
  type GameMode,
  type GameState,
  PLAYER_DEFS,
  TRACK_LENGTH,
  buildMoveTrajectory,
  chooseAutoMovePieceId,
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

const modeOptions: Array<{ value: GameMode; label: string; hint: string }> = [
  { value: 2, label: '2 人模式', hint: '红方 + 蓝方' },
  { value: 3, label: '3 人模式', hint: '红方 + 黄方 + 绿方' },
  { value: 4, label: '4 人模式', hint: '四角完整对战' },
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

function refreshGameView() {
  game.value = { ...game.value }
  renderScene()
}

function clearMovePreview() {
  replayingPieceId.value = null
  movePath.value = []
}

function playAutoTurn() {
  if (!autoPlayMode.value || game.value.winnerIndex !== null) return
  if (game.value.dice !== null) return

  const rolled = rollDice(game.value)
  if (!rolled.rolled) return
  refreshGameView()

  const autoPieceId = chooseAutoMovePieceId(game.value)
  if (!autoPieceId) return

  const player = getCurrentPlayer(game.value)
  const piece = player.pieces.find((item) => item.id === autoPieceId)
  if (!piece || game.value.dice === null) return

  replayingPieceId.value = autoPieceId
  movePath.value = buildMoveTrajectory(player, piece, game.value.dice)
  renderScene()

  window.setTimeout(() => {
    handleMove(autoPieceId)
    clearMovePreview()
  }, 420)
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
  const result = rollDice(game.value)
  if (result.rolled) {
    refreshGameView()
    if (autoPlayMode.value) {
      window.setTimeout(playAutoTurn, 180)
    }
  }
}

function handleMove(pieceId: string) {
  const result = movePiece(game.value, pieceId)
  if (result.moved) {
    refreshGameView()
    if (autoPlayMode.value) {
      window.setTimeout(playAutoTurn, 180)
    }
  }
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

    const label = drawText(`${player.name} · ${player.active ? '参与' : '未上场'}`, zoneX + zoneSize / 2, zoneY + zoneSize - 18, {
      anchor: 0.5,
      fontSize: 13,
      fill: 0xcbd5e1,
    })
    board.addChild(label)

    function gapSize() {
      return safeBoardSize * 0.028
    }
  }

  const center = new PIXI.Graphics()
    .circle(centerX, centerY, safeBoardSize * 0.08)
    .fill({ color: 0x111827, alpha: 0.95 })
    .stroke({ color: 0x64748b, width: 2, alpha: 0.45 })
  board.addChild(center)

  const centerText = drawText('终点区', centerX, centerY - 10, {
    anchor: 0.5,
    fontSize: 18,
    fill: 0xf8fafc,
    fontWeight: '700',
  })
  board.addChild(centerText)

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
    const pieceGroup = new PIXI.Container()
    pieceGroup.position.set(pieceInfo.x, pieceInfo.y)
    pieceGroup.eventMode = isLegal ? 'static' : 'passive'
    pieceGroup.cursor = isLegal ? 'pointer' : 'default'

    if (isLegal) {
      pieceGroup.on('pointerdown', () => handleMove(pieceInfo.piece.id))
    }

    const shadow = new PIXI.Graphics()
      .circle(2, 3, pieceRadius + 1)
      .fill({ color: 0x020617, alpha: 0.25 })
    pieceGroup.addChild(shadow)

    const body = new PIXI.Graphics()
      .circle(0, 0, pieceRadius)
      .fill({ color: pieceInfo.player.color, alpha: pieceInfo.location === 'track' ? 1 : 0.92 })
      .stroke({ color: 0xf8fafc, width: 2, alpha: 0.85 })
    pieceGroup.addChild(body)

    const badge = drawText(String(pieceInfo.pieceIndex + 1), 0, -9, {
      anchor: 0.5,
      fontSize: 14,
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
  renderScene()

  window.addEventListener('resize', renderScene)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', renderScene)
  if (!app) return
  app.destroy(true)
  app = null
  scene = null
})
</script>

<template>
  <main class="shell">
    <section class="layout">
      <aside class="panel">
        <p class="eyebrow">简化版飞行棋</p>
        <h1>四角玩家 · 可调模式 · 1-4 枚棋子</h1>
        <p class="intro">
          这是一个可以直接玩的 PixiJS 小游戏：选择 2/3/4 人模式，再给每个玩家设置 1-4 枚棋子，点击掷骰子后移动合法棋子。
        </p>

        <div class="section">
          <h2>游戏模式</h2>
          <div class="button-row">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              :class="['choice-button', { active: mode === option.value }]"
              type="button"
              @click="setMode(option.value)"
            >
              <span>{{ option.label }}</span>
              <small>{{ option.hint }}</small>
            </button>
          </div>
        </div>

        <div class="section">
          <h2>每位玩家棋子数</h2>
          <div class="button-row compact">
            <button
              v-for="count in pieceOptions"
              :key="count"
              :class="['choice-button', 'count-button', { active: piecesPerPlayer === count }]"
              type="button"
              @click="setPiecesPerPlayer(count)"
            >
              {{ count }} 枚
            </button>
          </div>
        </div>

        <div class="section status-card">
          <h2>当前状态</h2>
          <p class="status-text">{{ game.status }}</p>
          <p class="meta-text">
            当前回合：<strong>{{ currentPlayer.name }}</strong>
            <span>·</span>
            骰子：<strong>{{ game.dice ?? '未掷' }}</strong>
            <span>·</span>
            合法棋子：<strong>{{ legalPieces.length }}</strong>
          </p>
          <p v-if="winner" class="winner-text">胜利者：{{ winner.name }}</p>
        </div>

        <div class="section stats-card">
          <h2>玩家情况</h2>
          <ul class="player-list">
            <li v-for="player in game.players" :key="player.index" :class="['player-item', { active: player.index === currentPlayer.index }]">
              <span class="swatch" :style="{ backgroundColor: player.color }" />
              <div>
                <strong>{{ player.name }}</strong>
                <small>{{ player.corner }} · {{ player.active ? '参与本局' : '未参与' }}</small>
              </div>
              <em>{{ getPlayerTrackCount(player) }}/{{ player.pieces.length }} 在路上 · {{ getPlayerFinishedCount(player) }} 完成</em>
            </li>
          </ul>
        </div>

        <div class="section actions">
          <button class="primary" type="button" :disabled="winner !== null" @click="handleRoll">
            掷骰子
          </button>
          <button class="secondary" type="button" @click="restartGame">
            重新开始
          </button>
        </div>

        <div class="section tips">
          <h2>玩法说明</h2>
          <ul>
            <li>掷出 6 时可以把棋子从基地送上赛道。</li>
            <li>落在别人棋子上可将其送回基地，四个角落是安全点。</li>
            <li>掷出 6 会获得一次额外行动。</li>
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
  padding: 24px;
}

.layout {
  width: min(1440px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.panel,
.stage-panel {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: rgba(2, 6, 23, 0.78);
  box-shadow: 0 20px 60px rgba(2, 6, 23, 0.38);
  backdrop-filter: blur(10px);
}

.panel {
  padding: 22px;
  display: grid;
  gap: 18px;
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
  font-size: 1rem;
  color: #e2e8f0;
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
.tips {
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

.meta-text,
.winner-text {
  margin: 0;
  color: #cbd5e1;
}

.meta-text span {
  margin: 0 6px;
  color: #64748b;
}

.winner-text {
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
  padding: 14px;
}

.canvas-shell {
  min-height: 72vh;
  border-radius: 18px;
  overflow: hidden;
}

.canvas-shell :deep(canvas) {
  display: block;
}

@media (min-width: 1100px) {
  .layout {
    grid-template-columns: 360px minmax(0, 1fr);
    align-items: start;
  }

  .stage-panel {
    position: sticky;
    top: 24px;
  }
}
</style>
