<script setup lang="ts">
import { ref } from 'vue'

import PrepareScreen from './components/game/PrepareScreen.vue'
import ResultScreen from './components/game/ResultScreen.vue'
import PlayScreen from './components/game/PlayScreen.vue'
import { type AppPage, useFlightLudoPlayScene } from './composables/useFlightLudoPlayScene'
import { type BoardPresetId, type GameMode } from './game'

const mode = ref<GameMode>(1)
const piecesPerPlayer = ref(4)
const boardPresetId = ref<BoardPresetId>('tiny-4')
const page = ref<AppPage>('prepare')
const autoPlayMode = ref(true)
const playScreenRef = ref<{ canvasEl: HTMLDivElement | null } | null>(null)

const {
  winner,
  startGame,
  replayGame,
  goToPrepare,
  setMode,
  setPiecesPerPlayer,
  setBoardPresetId,
} = useFlightLudoPlayScene({
  page,
  mode,
  piecesPerPlayer,
  boardPresetId,
  autoPlayMode,
  playScreenRef,
})
</script>

<template>
  <main class="shell">
    <PrepareScreen
      v-if="page === 'prepare'"
      :mode="mode"
      :pieces-per-player="piecesPerPlayer"
      @update:mode="setMode"
      @update:pieces-per-player="setPiecesPerPlayer"
      @start="startGame"
    />

    <PlayScreen
      v-else-if="page === 'play'"
      ref="playScreenRef"
      :board-preset-id="boardPresetId"
      @back="goToPrepare"
      @update:board-preset-id="setBoardPresetId"
    />

    <ResultScreen
      v-else
      :winner-name="winner?.name ?? '已结束'"
      @replay="replayGame"
      @prepare="goToPrepare"
    />
  </main>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  padding: 0;
}
</style>
