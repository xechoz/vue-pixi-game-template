<script setup lang="ts">
import { onMounted, ref, watch, toRef } from 'vue'
import { useI18n } from '../../i18n'

import PlayScreen from './PlayScreen.vue'
import { type AppPage, useFlightLudoPlayScene } from '../../composables/useFlightLudoPlayScene'
import { type BoardPresetId, type GameMode } from '../../game'

const props = defineProps<{
  mode: GameMode
  piecesPerPlayer: number
  boardPresetId: BoardPresetId
  autoPlayMode: boolean
}>()

const emit = defineEmits({
  back: null,
  'winner-change': null,
  'update:board-preset-id': null,
})

const page = ref<AppPage>('play')
const playScreenRef = ref<{ canvasEl: HTMLDivElement | null } | null>(null)

const { t } = useI18n()

const {
  winner,
  startGame,
  goToPrepare,
} = useFlightLudoPlayScene({
  page,
  mode: toRef(props, 'mode'),
  piecesPerPlayer: toRef(props, 'piecesPerPlayer'),
  boardPresetId: toRef(props, 'boardPresetId'),
  autoPlayMode: toRef(props, 'autoPlayMode'),
  playScreenRef,
})

watch(
  () => winner.value,
  (player) => {
    if (player) {
      emit('winner-change', {
        name: t(`${player.name}Player`),
        color: player.color,
        index: player.index,
      })
    }
  },
  { immediate: true },
)

function handleBack() {
  goToPrepare()
  emit('back')
}

function handleBoardPresetId(nextBoardPresetId: BoardPresetId) {
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
    @winner-change="emit('winner-change', $event)"
    @update:board-preset-id="handleBoardPresetId"
  />
</template>
