<script setup lang="ts">
import { onMounted, ref, watch, toRef } from 'vue'

import PlayScreen from './PlayScreen.vue'
import { type AppPage, useFlightLudoPlayScene } from '../../composables/useFlightLudoPlayScene'
import { type BoardPresetId, type GameMode } from '../../game'

const props = defineProps<{
  mode: GameMode
  piecesPerPlayer: number
  boardPresetId: BoardPresetId
  autoPlayMode: boolean
}>()

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'winner-change', value: string): void
  (event: 'update:board-preset-id', value: BoardPresetId): void
}>()

const page = ref<AppPage>('play')
const playScreenRef = ref<{ canvasEl: HTMLDivElement | null } | null>(null)

const {
  winner,
  startGame,
  goToPrepare,
  setBoardPresetId,
} = useFlightLudoPlayScene({
  page,
  mode: toRef(props, 'mode'),
  piecesPerPlayer: toRef(props, 'piecesPerPlayer'),
  boardPresetId: toRef(props, 'boardPresetId'),
  autoPlayMode: toRef(props, 'autoPlayMode'),
  playScreenRef,
})

watch(
  () => winner.value?.name ?? null,
  (name) => {
    if (name) {
      emit('winner-change', name)
    }
  },
  { immediate: true },
)

function handleBack() {
  goToPrepare()
  emit('back')
}

function handleBoardPresetId(nextBoardPresetId: BoardPresetId) {
  setBoardPresetId(nextBoardPresetId)
  emit('update:board-preset-id', nextBoardPresetId)
}

onMounted(() => {
  void startGame()
})
</script>

<template>
  <PlayScreen
    ref="playScreenRef"
    :board-preset-id="boardPresetId"
    @back="handleBack"
    @update:board-preset-id="handleBoardPresetId"
  />
</template>
