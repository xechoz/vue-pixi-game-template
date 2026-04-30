import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = '/data/data/com.termux/files/home/projects/pixi-vue-ts-template/src'

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

test('difficulty mode selector lives on PlayScreen instead of PrepareScreen', () => {
  const prepareScreen = read('components/game/PrepareScreen.vue')
  const playScreen = read('components/game/PlayScreen.vue')

  assert.ok(!prepareScreen.includes('class="board-preset-row"'))
  assert.ok(!prepareScreen.includes("update:board-preset-id"))

  assert.ok(playScreen.includes('class="board-preset-row"'))
  assert.ok(playScreen.includes("update:board-preset-id"))
})

test('play controls keep only the back button and use 50x50 difficulty buttons', () => {
  const appVue = read('App.vue')
  const playScreen = read('components/game/PlayScreen.vue')

  assert.ok(!playScreen.includes("(event: 'restart')"))
  assert.ok(!playScreen.includes("emit('restart')"))
  assert.ok(!playScreen.includes('aria-label="重开本局"'))
  assert.ok(!appVue.includes('@restart="restartGame"'))

  assert.ok(playScreen.includes('.board-preset-row {'))
  assert.ok(playScreen.includes('grid-template-columns: repeat(3, 50px);'))
  assert.ok(playScreen.includes('grid-auto-rows: 50px;'))

  assert.ok(playScreen.includes('.preset-pill {'))
  assert.ok(playScreen.includes('width: 50px;'))
  assert.ok(playScreen.includes('height: 50px;'))
})

test('back button shares the same row with horizontally centered difficulty buttons', () => {
  const playScreen = read('components/game/PlayScreen.vue')

  assert.ok(playScreen.includes('<div class="play-controls-row">'))
  assert.ok(playScreen.includes('.play-controls-row {'))
  assert.ok(playScreen.includes('grid-template-columns: auto 1fr auto;'))
  assert.ok(playScreen.includes('align-items: center;'))

  assert.ok(playScreen.includes('<div class="play-controls-spacer" aria-hidden="true"></div>'))

  assert.ok(playScreen.includes('.board-preset-row {'))
  assert.ok(playScreen.includes('justify-content: center;'))
  assert.ok(playScreen.includes('justify-self: center;'))

  assert.ok(!playScreen.includes('<div class="play-actions-stack">'))
})

test('play page uses a centered non-fullscreen desktop shell with a capped board width', () => {
  const playScreen = read('components/game/PlayScreen.vue')

  assert.ok(playScreen.includes('.page.page-play {'))
  assert.ok(playScreen.includes('width: min(920px, calc(100% - 20px));'))
  assert.ok(playScreen.includes('min-height: 100dvh;'))
  assert.ok(playScreen.includes('background: transparent;'))
  assert.ok(playScreen.includes('.play-grid {'))
  assert.ok(playScreen.includes('max-width: 760px;'))
  assert.ok(playScreen.includes('--play-canvas-width: min(100%, 760px, calc(100dvw - 20px), calc((100dvh - 212px) / 1.5));'))
  assert.ok(playScreen.includes('.play-stage {'))
  assert.ok(playScreen.includes('aspect-ratio: 2 / 3;'))
  assert.ok(playScreen.includes('.play-topbar {'))
  assert.ok(playScreen.includes('position: static;'))
  assert.ok(playScreen.includes('ui/back-button.png'))
  assert.ok(!playScreen.includes('>↩</button>'))
})

test('prepare and result screens stay centered and capped on desktop', () => {
  const prepareScreen = read('components/game/PrepareScreen.vue')
  const resultScreen = read('components/game/ResultScreen.vue')

  assert.ok(prepareScreen.includes('.page {'))
  assert.ok(prepareScreen.includes('width: min(920px, calc(100% - 20px));'))
  assert.ok(prepareScreen.includes('margin: 0 auto;'))
  assert.ok(prepareScreen.includes('box-sizing: border-box;'))
  assert.ok(prepareScreen.includes('@media (max-width: 540px) {'))
  assert.ok(prepareScreen.includes('width: min(100%, calc(100% - 12px));'))

  assert.ok(resultScreen.includes('.page {'))
  assert.ok(resultScreen.includes('width: min(920px, calc(100% - 20px));'))
  assert.ok(resultScreen.includes('box-sizing: border-box;'))
  assert.ok(resultScreen.includes('@media (max-width: 859px) {'))
  assert.ok(resultScreen.includes('width: min(100%, calc(100% - 12px));'))
})

test('player plane sprites use board-step-aware sizing with softer clickable glow and no shadow', () => {
  const playScene = read('composables/flight-ludo-play-scene/boardRenderer.ts')

  assert.ok(playScene.includes('const trackPieceBodyScale = 7.2'))
  assert.ok(playScene.includes('const basePieceBodyScale = 8.15'))
  assert.ok(playScene.includes('body.position.set(0, pieceInfo.location === \'base\' ? -3 : -1.5)'))
  assert.ok(playScene.includes('body.width = pieceRadius * pieceBodyScale'))
  assert.ok(playScene.includes('body.height = pieceRadius * pieceBodyScale'))

  assert.ok(!playScene.includes('const shadow = new PIXI.Graphics()'))
  assert.ok(!playScene.includes('.ellipse(2, 7, pieceRadius + 10, pieceRadius + 5)'))

  assert.ok(playScene.includes('const legalGlow = new PIXI.Graphics()'))
  assert.ok(playScene.includes('.circle(0, 0, pieceRadius + 6)'))
  assert.ok(playScene.includes('alpha: 0.12 + options.turn.legalPulse * 0.16'))
})

test('red player route is drawn as a yellow dotted path from start through finish', () => {
  const playScene = read('composables/flight-ludo-play-scene/boardRenderer.ts')

  assert.ok(playScene.includes("if (player.index === 0) {"))
  assert.ok(playScene.includes('const redRoutePoints = ['))
  assert.ok(playScene.includes('color: 0xffd400'))
  assert.ok(playScene.includes('drawDottedPolyline(redRoute, redRoutePoints, {'))
  assert.ok(playScene.includes('alpha: 0.42'))
})

test('stacked pieces get a deterministic visual offset layer', () => {
  const playScene = read('composables/flight-ludo-play-scene/boardRenderer.ts')

  assert.ok(playScene.includes('export function getStackOffsets(count: number, step: number)'))
  assert.ok(playScene.includes('const stackGroups = new Map<string, number[]>()'))
  assert.ok(playScene.includes('const stackIndexByPiece = new Map<number, number>()'))
  assert.ok(playScene.includes('const stackSizeByPiece = new Map<number, number>()'))
  assert.ok(playScene.includes('const stackOffset = stackOffsets[stackIndex] ?? { x: 0, y: 0 }'))
  assert.ok(playScene.includes('pieceGroup.position.set('))
})
