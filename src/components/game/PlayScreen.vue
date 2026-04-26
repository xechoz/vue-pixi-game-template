<script setup lang="ts">
import { ref } from 'vue'

const assetBase = import.meta.env.BASE_URL
const canvasEl = ref<HTMLDivElement | null>(null)

defineExpose({ canvasEl })

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'restart'): void
}>()
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
      <div class="play-stage">
        <div class="play-actions-bar">
          <button class="circle-action secondary" type="button" aria-label="返回准备" @click="emit('back')">↩</button>
          <button class="circle-action primary" type="button" aria-label="重开本局" @click="emit('restart')">↻</button>
        </div>
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
  grid-template-columns: 1fr;
  position: relative;
  justify-items: center;
  width: 100%;
  z-index: 1;
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

.play-actions-bar {
  position: absolute;
  top: -200px;
  left: 4px;
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  width: auto;
  padding: 0;
  z-index: 2;
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

  .canvas-shell {
    min-height: unset;
    max-height: none;
    aspect-ratio: auto;
  }

  .play-actions-bar {
    top: -200px;
    left: 0;
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
