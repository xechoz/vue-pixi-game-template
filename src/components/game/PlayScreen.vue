<script setup lang="ts">
import { ref } from 'vue'

import { getBoardPreset, type BoardPresetId } from '../../game'

const props = defineProps<{
  boardPresetId: BoardPresetId
}>()

const assetBase = import.meta.env.BASE_URL
const canvasEl = ref<HTMLDivElement | null>(null)

defineExpose({ canvasEl })

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'update:board-preset-id', value: BoardPresetId): void
}>()

const difficultyOptions = [
  {
    value: 'tiny-4' as const,
    title: '快速模式',
    hint: `${getBoardPreset('tiny-4').stepsPerSide}步/边`,
    accent: '#ffb347',
    image: `${assetBase}difficulty/quick-mode.png`,
  },
  {
    value: 'normal-6' as const,
    title: '正常模式',
    hint: `${getBoardPreset('normal-6').stepsPerSide}步/边`,
    accent: '#5f9cff',
    image: `${assetBase}difficulty/normal-mode.png`,
  },
  {
    value: 'hell-8' as const,
    title: '地狱模式',
    hint: `${getBoardPreset('hell-8').stepsPerSide}步/边`,
    accent: '#ef4444',
    image: `${assetBase}difficulty/hell-mode.png`,
  },
]
</script>

<template>
  <section
    class="page page-play"
    :style="{
      backgroundImage: `url(${assetBase}prepare-bg.jpg)`,
      backgroundPosition: 'center center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
    }"
  >
    <div class="bg-decor" aria-hidden="true">
      <span class="bg-orbit bg-orbit-a"></span>
      <span class="bg-orbit bg-orbit-b"></span>
      <span class="bg-orbit bg-orbit-c"></span>
      <span class="bg-cloud bg-cloud-a"></span>
      <span class="bg-cloud bg-cloud-b"></span>
      <span class="bg-star bg-star-a"></span>
      <span class="bg-star bg-star-b"></span>
      <span class="bg-star bg-star-c"></span>
      <span class="bg-dot bg-dot-a"></span>
      <span class="bg-dot bg-dot-b"></span>
    </div>
    <div class="grid play-grid">
      <div class="play-topbar">
        <div class="play-controls-row">
          <button class="circle-action secondary" type="button" aria-label="返回准备" @click="emit('back')">↩</button>
          <div class="board-preset-row" aria-label="难度模式">
            <button
              v-for="option in difficultyOptions"
              :key="option.value"
              type="button"
              class="preset-pill"
              :class="{ active: props.boardPresetId === option.value }"
              :style="{
                '--accent': option.accent,
                '--preset-image': `url(${option.image})`,
              }"
              :aria-label="option.title"
              @click="emit('update:board-preset-id', option.value)"
            >
              <span class="sr-only">{{ option.title }}</span>
            </button>
          </div>
          <div class="play-controls-spacer" aria-hidden="true"></div>
        </div>
      </div>
      <div class="play-stage">
        <section ref="canvasEl" class="canvas-shell play-canvas-shell" aria-label="飞行棋游戏画布" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  width: min(1280px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.page.page-play {
  width: 100%;
  min-height: 100dvh;
  align-content: center;
  position: relative;
  isolation: isolate;
  overflow: visible;
  background: none;
}

.play-grid {
  --play-canvas-width: min(100%, 92vw, 88vh);
  display: grid;
  place-items: center;
  position: relative;
  width: 100%;
  min-height: 100dvh;
  z-index: 1;
}

.play-topbar {
  position: absolute;
  left: 50%;
  top: calc(50% - (var(--play-canvas-width) * 0.75) - 118px);
  width: var(--play-canvas-width);
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
}

.play-controls-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  width: 100%;
  pointer-events: auto;
}

.play-stage {
  position: relative;
  width: var(--play-canvas-width);
  height: calc(var(--play-canvas-width) * 1.5);
}

.bg-decor {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.bg-orbit,
.bg-cloud,
.bg-star,
.bg-dot {
  position: absolute;
}

.bg-orbit {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  opacity: 0.7;
}

.bg-orbit-a {
  width: min(72vw, 860px);
  height: min(72vw, 860px);
  left: 50%;
  top: 48%;
  transform: translate(-50%, -50%);
}

.bg-orbit-b {
  width: min(48vw, 540px);
  height: min(48vw, 540px);
  left: 8%;
  top: 10%;
  border-style: dashed;
  opacity: 0.45;
}

.bg-orbit-c {
  width: min(34vw, 380px);
  height: min(34vw, 380px);
  right: 6%;
  bottom: 10%;
  border-style: dashed;
  opacity: 0.38;
}

.bg-cloud {
  width: 120px;
  height: 44px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 22% 60%, rgba(255, 255, 255, 0.72) 0 18px, transparent 19px),
    radial-gradient(circle at 52% 36%, rgba(255, 255, 255, 0.82) 0 22px, transparent 23px),
    radial-gradient(circle at 78% 60%, rgba(255, 255, 255, 0.68) 0 16px, transparent 17px),
    rgba(255, 255, 255, 0.24);
  filter: blur(0.3px);
  opacity: 0.55;
}

.bg-cloud-a {
  top: 8%;
  left: 8%;
  transform: scale(1.15);
}

.bg-cloud-b {
  right: 10%;
  top: 15%;
  transform: scale(0.92);
}

.bg-star {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.45);
}

.bg-star::before,
.bg-star::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: 28px;
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
  transform: translate(-50%, -50%);
}

.bg-star::after {
  width: 2px;
  height: 28px;
}

.bg-star-a {
  left: 16%;
  top: 22%;
}

.bg-star-b {
  right: 20%;
  top: 30%;
}

.bg-star-c {
  left: 28%;
  bottom: 18%;
}

.bg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 70%, white);
  opacity: 0.6;
  box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.04);
}

.bg-dot-a {
  left: 10%;
  bottom: 28%;
}

.bg-dot-b {
  right: 14%;
  bottom: 24%;
}

.play-controls-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  width: 100%;
  pointer-events: auto;
}

.play-controls-spacer {
  width: 44px;
  height: 44px;
}

.board-preset-row {
  display: grid;
  grid-template-columns: repeat(3, 50px);
  grid-auto-rows: 50px;
  justify-content: center;
  justify-self: center;
  gap: 8px;
}

.preset-pill {
  position: relative;
  width: 50px;
  height: 50px;
  min-height: 50px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 14px;
  padding: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04)),
    rgba(255, 255, 255, 0.08);
  box-shadow:
    0 8px 18px rgba(0, 31, 61, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.preset-pill::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(6, 18, 36, 0.08), rgba(6, 18, 36, 0.16)),
    var(--preset-image) center center / cover no-repeat;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.preset-pill::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.24), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 55%);
  pointer-events: none;
}

.preset-pill.active {
  border-color: color-mix(in srgb, var(--accent) 62%, white);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.15) inset,
    0 10px 18px color-mix(in srgb, var(--accent) 16%, rgba(0, 117, 222, 0.1));
  transform: translateY(-1px);
}

.preset-pill.active::before {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    0 0 0 1px color-mix(in srgb, var(--accent) 32%, transparent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.play-canvas-shell {
  min-height: 0;
}

.circle-action {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  line-height: 1;
}

.canvas-shell {
  border: none;
  border-radius: 22px;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  width: 100%;
  height: 100%;
  max-height: none;
  overflow: visible;
}

.canvas-shell :deep(canvas) {
  display: block;
}

@media (max-width: 859px) {
  .page.page-play {
    width: 100%;
    min-height: 100dvh;
  }

  .play-grid {
    --play-canvas-width: min(calc(100dvw - 16px), calc((100dvh - 172px) / 1.5));
  }

  .play-topbar {
    top: calc(50% - (var(--play-canvas-width) * 0.75) - 94px);
  }

  .canvas-shell {
    min-height: unset;
    max-height: none;
    aspect-ratio: auto;
  }

  .board-preset-row {
    gap: 6px;
  }

  .preset-pill {
    width: 50px;
    height: 50px;
    min-height: 50px;
    border-radius: 14px;
  }

  .preset-pill::before,
  .preset-pill::after {
    inset: 4px;
    border-radius: 10px;
  }

  .play-floating-actions {
    right: 8px;
    top: 8px;
    gap: 8px;
  }

  .circle-action {
    width: 40px;
    height: 40px;
  }
}
</style>
