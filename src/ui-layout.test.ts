import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = '/data/data/com.termux/files/home/projects/pixi-vue-ts-template/src'

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function sliceBlock(source: string, selector: string) {
  const start = source.indexOf(selector)

  assert.notEqual(start, -1, `Missing selector block: ${selector}`)

  const end = source.indexOf('\n}\n', start)

  assert.notEqual(end, -1, `Unclosed selector block: ${selector}`)

  return source.slice(start, end + 3)
}

function sliceSceneBlock(source: string, anchor: string, endAnchor: string) {
  const start = source.indexOf(anchor)
  assert.notEqual(start, -1, `Missing anchor: ${anchor}`)

  const end = source.indexOf(endAnchor, start)
  assert.notEqual(end, -1, `Missing end anchor: ${endAnchor}`)

  return source.slice(start, end)
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

test('play topbar sits lower and uses the uploaded image-based back button asset', () => {
  const playScreen = read('components/game/PlayScreen.vue')

  assert.ok(playScreen.includes("top: calc(50% - (var(--play-canvas-width) * 0.75) - 86px);"))
  assert.ok(playScreen.includes("top: calc(50% - (var(--play-canvas-width) * 0.75) - 70px);"))

  assert.ok(playScreen.includes("const backButtonImage = `${assetBase}ui/back-button.png`"))
  assert.ok(playScreen.includes('<img class="back-icon" :src="backButtonImage" alt="" />'))
  assert.ok(!playScreen.includes('>↩</button>'))
})

test('back button is a rounded rectangle instead of a circle', () => {
  const playScreen = read('components/game/PlayScreen.vue')
  const backActionBlock = sliceBlock(playScreen, '.back-action {')

  assert.ok(backActionBlock.includes('width: 56px;'))
  assert.ok(backActionBlock.includes('height: 40px;'))
  assert.ok(backActionBlock.includes('padding: 6px 10px;'))
  assert.ok(backActionBlock.includes('border-radius: 14px;'))
  assert.ok(!backActionBlock.includes('border-radius: 999px;'))
})

test('player plane sprites use stronger base-vs-track sizing, no shadow, and only clickable glow remains', () => {
  const playScene = read('composables/useFlightLudoPlayScene.ts')
  const pieceRenderBlock = sliceSceneBlock(playScene, "if (isLegal && !isMoving) {", 'board.addChild(pieceGroup)')

  assert.ok(pieceRenderBlock.includes("const pieceBodyScale = pieceInfo.location === 'base' ? 6.5 : 4.5"))
  assert.ok(pieceRenderBlock.includes('body.width = pieceRadius * pieceBodyScale'))
  assert.ok(pieceRenderBlock.includes('body.height = pieceRadius * pieceBodyScale'))

  assert.ok(!pieceRenderBlock.includes('const shadow = new PIXI.Graphics()'))
  assert.ok(!pieceRenderBlock.includes('.ellipse(2, 7, pieceRadius + 10, pieceRadius + 5)'))

  assert.ok(pieceRenderBlock.includes('const legalGlow = new PIXI.Graphics()'))
  assert.ok(pieceRenderBlock.includes('.circle(0, 0, pieceRadius + 8)'))
  assert.ok(pieceRenderBlock.includes('.stroke({ color: hexToNumber(pieceInfo.player.color), width: 2.5, alpha: 0.18 + legalPulse.value * 0.22 })'))
  assert.ok(!pieceRenderBlock.includes('const legalRing = new PIXI.Graphics()'))
})
