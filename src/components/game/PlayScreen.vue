<script setup lang="ts">
import { ref } from 'vue'

const canvasEl = ref<HTMLDivElement | null>(null)

defineExpose({ canvasEl })

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'restart'): void
}>()
</script>

<template>
  <section class="page page-play">
    <div class="grid play-grid">
      <div class="play-actions-bar">
        <button class="circle-action secondary" type="button" aria-label="返回准备" @click="emit('back')">↩</button>
        <button class="circle-action primary" type="button" aria-label="重开本局" @click="emit('restart')">↻</button>
      </div>
      <section ref="canvasEl" class="canvas-shell play-canvas-shell" aria-label="飞行棋游戏画布" />
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
  min-height: calc(100dvh - 28px);
  align-content: center;
}

.grid {
  display: grid;
  gap: 14px;
}

.play-grid {
  grid-template-columns: 1fr;
  position: relative;
  justify-items: center;
  width: 100%;
}

.play-actions-bar {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  width: min(100%, 92vw, 88vh);
  padding: 0 4px;
  margin-top: -50px;
}

.play-canvas-shell {
  min-height: min(92vh, 980px);
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
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.92)),
    radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 45%);
  box-shadow: 0 20px 60px rgba(2, 6, 23, 0.45);
  backdrop-filter: blur(14px);
  min-height: 78vh;
  width: min(100%, 92vw, 88vh);
  aspect-ratio: 1 / 1;
  max-height: 88vh;
  overflow: visible;
}

.canvas-shell :deep(canvas) {
  display: block;
}

@media (max-width: 859px) {
  .page {
    width: 100%;
  }

  .play-canvas-shell {
    min-height: unset;
    max-height: unset;
  }

  .canvas-shell {
    width: min(calc(100dvw - 16px), calc(100dvh - 172px));
    height: min(calc(100dvw - 16px), calc(100dvh - 172px));
    min-height: unset;
    max-height: none;
    aspect-ratio: 1 / 1;
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
