<script setup lang="ts">
import { ref } from 'vue'

import PrepareScreen from './components/game/PrepareScreen.vue'
import ResultScreen from './components/game/ResultScreen.vue'
import PlayScreen from './components/game/PlayScreen.vue'
import { type AppPage, useFlightLudoPlayScene } from './composables/useFlightLudoPlayScene'
import { type GameMode, createGame } from './game'

const mode = ref<GameMode>(1)
const piecesPerPlayer = ref(2)
const page = ref<AppPage>('prepare')
const game = ref(
  createGame({
    mode: mode.value,
    piecesPerPlayer: piecesPerPlayer.value,
  }),
)
const autoPlayMode = ref(true)
const playScreenRef = ref<{ canvasEl: HTMLDivElement | null } | null>(null)

const {
  winner,
  restartGame,
  startGame,
  replayGame,
  goToPrepare,
  setMode,
  setPiecesPerPlayer,
} = useFlightLudoPlayScene({
  page,
  game,
  mode,
  piecesPerPlayer,
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
      @reset="restartGame"
    />

    <PlayScreen
      v-else-if="page === 'play'"
      ref="playScreenRef"
      @back="goToPrepare"
      @restart="restartGame"
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
  min-height: 100vh;
  padding: 14px;
}
</style>
