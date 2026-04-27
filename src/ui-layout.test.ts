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

  assert.match(playScreen, /top:\s*calc\(50% - \(var\(--play-canvas-width\) \* 0\.75\) - 86px\);/)
  assert.match(playScreen, /top:\s*calc\(50% - \(var\(--play-canvas-width\) \* 0\.75\) - 70px\);/)

  assert.ok(playScreen.includes('ui/back-button.png'))
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

test('player plane sprites use board-step-aware sizing with softer clickable glow and no shadow', () => {
  const playScene = read('composables/flight-ludo-play-scene/boardRenderer.ts')

  assert.ok(playScene.includes('const trackPieceBodyScale ='))
  assert.ok(playScene.includes('options.boardPreset.stepsPerSide <= 4'))
  assert.ok(playScene.includes('? 5.6'))
  assert.ok(playScene.includes(': 4.85'))
  assert.ok(playScene.includes('const basePieceBodyScale = trackPieceBodyScale + 1.15'))
  assert.ok(playScene.includes('body.position.set(0, pieceInfo.location === \'base\' ? -3 : -1.5)'))
  assert.ok(playScene.includes('body.width = pieceRadius * pieceBodyScale'))
  assert.ok(playScene.includes('body.height = pieceRadius * pieceBodyScale'))

  assert.ok(!playScene.includes('const shadow = new PIXI.Graphics()'))
  assert.ok(!playScene.includes('.ellipse(2, 7, pieceRadius + 10, pieceRadius + 5)'))

  assert.ok(playScene.includes('const legalGlow = new PIXI.Graphics()'))
  assert.ok(playScene.includes('.circle(0, 0, pieceRadius + 6)'))
  assert.ok(playScene.includes('alpha: 0.12 + options.turn.legalPulse * 0.16'))
})

test('idle dice prompt overlay uses 0.8x sizing and blurs the idle dice face', () => {
  const playScene = read('composables/flight-ludo-play-scene/boardRenderer.ts')

  assert.ok(playScene.includes('const idleFaceBlur = new PIXI.Graphics()'))
  assert.ok(playScene.includes('.roundRect('))
  assert.ok(playScene.includes('fittedWidth * 0.72'))
  assert.ok(playScene.includes('.fill({ color: 0xffffff, alpha: 0.3 })'))
  assert.ok(playScene.includes('const overlayWidth = fittedWidth * 0.8'))
  assert.ok(playScene.includes('const overlayHeight = fittedHeight * 0.8'))
  assert.ok(playScene.includes('const overlayCenterY = -overlayHeight * 0.02'))
  assert.ok(playScene.includes('idleOverlaySprite.position.set(0, overlayCenterY)'))
  assert.ok(playScene.includes('idleOverlaySprite.width = overlayWidth'))
  assert.ok(playScene.includes('idleOverlaySprite.height = overlayHeight'))
})
