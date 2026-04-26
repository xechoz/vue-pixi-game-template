<script setup lang="ts">
import { ref } from 'vue'

import { getBoardPreset, type BoardPresetId } from '../../game'

const props = defineProps<{
  boardPresetId: BoardPresetId
}>()

const assetBase = import.meta.env.BASE_URL
const backButtonImage = `${assetBase}ui/back-button.png`
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
      '--page-bg-image': `url(${assetBase}prepare-bg.jpg)`,
    }"
  >
    <div class="grid play-grid">
      <div class="play-topbar">
        <div class="play-controls-row">
          <button class="circle-action secondary back-action" type="button" aria-label="返回准备" @click="emit('back')">
            <img class="back-icon" :src="backButtonImage" alt="" />
          </button>
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
  height: 100dvh;
  align-content: center;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: none;
}

.page.page-play::before {
  content: '';
  position: absolute;
  inset: -20px;
  background: var(--page-bg-image) center center / cover no-repeat;
  filter: blur(14px);
  transform: scale(1.04);
  z-index: -1;
}

.play-grid {
  --play-canvas-width: min(100%, calc(100dvw - 24px), calc((100dvh - 204px) / 1.5));
  display: grid;
  place-items: center;
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.play-topbar {
  position: absolute;
  left: 50%;
  top: calc(50% - (var(--play-canvas-width) * 0.75) - 86px);
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

.play-controls-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  width: 100%;
  pointer-events: auto;
}

.play-controls-spacer {
  width: 56px;
  height: 40px;
}

.back-action {
  width: 56px;
  height: 40px;
  padding: 6px 10px;
  border-radius: 14px;
  overflow: visible;
  background: transparent;
  border: none;
  box-shadow: none;
}

.back-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
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
    height: 100dvh;
  }

  .play-grid {
    --play-canvas-width: min(calc(100dvw - 16px), calc((100dvh - 172px) / 1.5));
  }

  .play-topbar {
    top: calc(50% - (var(--play-canvas-width) * 0.75) - 70px);
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

  .play-controls-spacer {
    width: 56px;
    height: 40px;
  }
}
</style>
