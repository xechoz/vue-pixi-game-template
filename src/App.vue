<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as PIXI from 'pixi.js'

import { defaultGameConfig } from './game'

const canvasEl = ref<HTMLDivElement | null>(null)
const isHelloActive = ref(false)
let app: PIXI.Application | null = null
let title: PIXI.Text | null = null

const toggleHello = () => {
  isHelloActive.value = !isHelloActive.value
  if (!title) return

  title.style.fill = isHelloActive.value ? '#38bdf8' : '#e2e8f0'
}

onMounted(async () => {
  if (!canvasEl.value) return

  app = new PIXI.Application()
  await app.init({
    resizeTo: canvasEl.value,
    background: '#0f172a',
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  })

  canvasEl.value.appendChild(app.canvas)

  title = new PIXI.Text({
    text: 'Hello',
    style: {
      fill: '#e2e8f0',
      fontSize: 40,
      fontWeight: '700',
    },
  })
  title.anchor.set(0.5)
  title.position.set(app.screen.width / 2, app.screen.height / 2 - 10)
  app.stage.addChild(title)

  const hint = new PIXI.Text({
    text: `点击下方按钮切换 Hello 颜色 · ${defaultGameConfig.title}`,
    style: {
      fill: '#94a3b8',
      fontSize: 16,
    },
  })
  hint.anchor.set(0.5)
  hint.position.set(app.screen.width / 2, app.screen.height / 2 + 28)
  app.stage.addChild(hint)
})

onBeforeUnmount(async () => {
  await app?.destroy(true)
  app = null
  title = null
})
</script>

<template>
  <main class="app-shell">
    <section class="hero-panel">
      <div class="copy">
        <p class="eyebrow">Template starter</p>
        <h1>Vue + Pixi + TypeScript</h1>
        <p class="description">
          这是一个空白小游戏模板，后续创建的 JS 小游戏都可以直接基于它开发。
        </p>
        <ul class="notes">
          <li>Pixi bootstrapping lives in <code>src/App.vue</code>.</li>
          <li>Game-specific code goes in <code>src/game/</code>.</li>
          <li>Shared assets go in <code>src/assets/</code>.</li>
        </ul>
      </div>
      <div class="stage-wrap">
        <button class="start-button" type="button" @click="toggleHello">
          {{ isHelloActive ? '点击切回' : '点击开始' }}
        </button>
        <div ref="canvasEl" class="game-canvas" aria-label="Pixi canvas area" />
      </div>
    </section>
  </main>
</template>
