<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

import PrepareScreen from './components/game/PrepareScreen.vue'
import { type AppPage } from './composables/useFlightLudoPlayScene'
import { type BoardPresetId, type GameMode } from './game'

const assetBase = import.meta.env.BASE_URL
const appBg = `${assetBase}prepare-bg.png`

const loadResultScreen = () => import('./components/game/ResultScreen.vue')
const loadPlayPage = () => import('./components/game/PlayScreen.Content.vue')

const ResultScreen = defineAsyncComponent(loadResultScreen)
const PlayPage = defineAsyncComponent(loadPlayPage)

const mode = ref<GameMode>(1)
const piecesPerPlayer = ref(4)
const boardPresetId = ref<BoardPresetId>('tiny-3')
const page = ref<AppPage>('prepare')
const autoPlayMode = ref(true)
const winnerName = ref('')
const winnerIndex = ref(0)

async function startGame() {
  await loadPlayPage()
  page.value = 'play'
}

function goToPrepare() {
  page.value = 'prepare'
}

function replayGame() {
  page.value = 'play'
}

function setMode(nextMode: GameMode) {
  mode.value = nextMode
}

function setPiecesPerPlayer(nextCount: number) {
  piecesPerPlayer.value = nextCount
}

function setBoardPresetId(nextBoardPresetId: BoardPresetId) {
  boardPresetId.value = nextBoardPresetId
}

function handleWinnerChange(nextWinner: { name: string; color: string; index: number }) {
  winnerName.value = nextWinner.name
  winnerIndex.value = nextWinner.index
  page.value = 'result'
}
</script>

<template>
  <main class="shell">
    <img class="app-bg" :src="appBg" alt="" aria-hidden="true" />

    <PrepareScreen
      v-if="page === 'prepare'"
      :mode="mode"
      :pieces-per-player="piecesPerPlayer"
      @update:mode="setMode"
      @update:pieces-per-player="setPiecesPerPlayer"
      @start="startGame"
    />

    <PlayPage
      v-else-if="page === 'play' || page === 'result'"
      :mode="mode"
      :pieces-per-player="piecesPerPlayer"
      :board-preset-id="boardPresetId"
      :auto-play-mode="autoPlayMode"
      @back="goToPrepare"
      @winner-change="handleWinnerChange"
      @update:board-preset-id="setBoardPresetId"
    />

    <ResultScreen
      v-if="page === 'result'"
      :winner-name="winnerName"
      :winner-index="winnerIndex"
      @replay="replayGame"
      @prepare="goToPrepare"
    />
  </main>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  padding: 0;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: none;
}

.app-bg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(14px);
  transform: scale(1.04);
  z-index: -2;
  pointer-events: none;
}
</style>
