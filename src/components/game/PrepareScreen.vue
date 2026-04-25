<script setup lang="ts">
const props = defineProps<{
  mode: 1 | 2 | 3 | 4
  piecesPerPlayer: number
}>()

const emit = defineEmits<{
  (event: 'update:mode', value: 1 | 2 | 3 | 4): void
  (event: 'update:piecesPerPlayer', value: number): void
  (event: 'start'): void
  (event: 'reset'): void
}>()

const assetBase = import.meta.env.BASE_URL

const playerAvatars = [
  { src: `${assetBase}player-red.jpg`, alt: '红色玩家头像' },
  { src: `${assetBase}player-blue.jpg`, alt: '蓝色玩家头像' },
  { src: `${assetBase}player-green.jpg`, alt: '绿色玩家头像' },
  { src: `${assetBase}player-yellow.jpg`, alt: '黄色玩家头像' },
]

const modeOptions = [1, 2, 3, 4].map((value) => ({
  value: value as 1 | 2 | 3 | 4,
  avatars: playerAvatars.slice(0, value),
}))
</script>

<template>
  <section
    class="page page-prepare"
    :style="{
      backgroundImage: `url(${assetBase}prepare-bg.jpg)`,
      backgroundPosition: 'center center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
    }"
  >
    <div class="mode-shell">
      <div class="mode-grid">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          :class="['select-card', `card-${option.avatars.length}`, { active: props.mode === option.value }]"
          type="button"
          :aria-label="`${option.value}人模式`"
          @click="emit('update:mode', option.value); emit('start')"
        >
          <div class="card-glow"></div>
          <div class="avatar-stack" :class="`stack-${option.avatars.length}`">
            <img
              v-for="avatar in option.avatars"
              :key="avatar.src"
              class="avatar-icon"
              :src="avatar.src"
              :alt="avatar.alt"
            />
          </div>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  width: min(1120px, 100%);
  min-height: calc(100dvh - 28px);
  margin: 0 auto;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 16px;
  position: relative;
  isolation: isolate;
  background: none;
}

.page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0), transparent 30%),
    radial-gradient(circle at center, rgba(0, 0, 0, 0), transparent 55%);
  z-index: -2;
}

.page::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0), rgba(0, 34, 76, 0.18));
  z-index: -1;
}

.mode-shell {
  width: min(980px, calc(100% - 24px));
  margin: 0 auto;
  padding: 22px;
  border-radius: 32px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08)),
    rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow:
    0 26px 72px rgba(0, 49, 104, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(8px);
}

.mode-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.select-card {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(245, 249, 255, 0.78)),
    rgba(255, 255, 255, 0.76);
  color: rgba(0, 0, 0, 0.95);
  cursor: pointer;
  min-height: 250px;
  padding: 18px;
  display: grid;
  align-items: center;
  justify-items: center;
  position: relative;
  overflow: hidden;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
  touch-action: manipulation;
  box-shadow:
    0 12px 26px rgba(0, 31, 61, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.select-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.58), transparent 32%),
    radial-gradient(circle at 50% 68%, rgba(0, 117, 222, 0.05), transparent 45%);
  pointer-events: none;
}

.card-glow {
  position: absolute;
  inset: 10px;
  border-radius: 24px;
  background: radial-gradient(circle at center, rgba(0, 117, 222, 0.14), transparent 62%);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.select-card:hover {
  transform: translateY(-3px);
  border-color: rgba(0, 117, 222, 0.18);
  box-shadow:
    0 18px 34px rgba(0, 67, 134, 0.14),
    0 3px 10px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.select-card.active {
  transform: translateY(-3px) scale(1.02);
  border-color: rgba(0, 117, 222, 0.5);
  box-shadow:
    0 0 0 1px rgba(0, 117, 222, 0.08) inset,
    0 22px 42px rgba(0, 117, 222, 0.16),
    0 12px 20px rgba(0, 31, 61, 0.08);
  filter: saturate(1.08);
}

.select-card.active .card-glow {
  opacity: 1;
}

.select-card.active::after {
  content: '✓';
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #0075de, #005bab);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  box-shadow: 0 6px 14px rgba(0, 117, 222, 0.24);
}

.avatar-stack {
  position: relative;
  width: min(78%, 180px);
  aspect-ratio: 1;
  min-height: 0;
  margin: 0 auto;
  z-index: 1;
}

.avatar-icon {
  position: absolute;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.98);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.16);
  background: #fff;
  transform: translate(-50%, -50%);
}

.avatar-stack.stack-1 .avatar-icon {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1.18);
}

.avatar-stack.stack-2 .avatar-icon:first-child {
  top: 50%;
  left: 34%;
}

.avatar-stack.stack-2 .avatar-icon:last-child {
  top: 50%;
  left: 66%;
}

.avatar-stack.stack-3 .avatar-icon:nth-child(1) {
  top: 28%;
  left: 50%;
}

.avatar-stack.stack-3 .avatar-icon:nth-child(2) {
  top: 74%;
  left: 28%;
}

.avatar-stack.stack-3 .avatar-icon:nth-child(3) {
  top: 74%;
  left: 72%;
}

.avatar-stack.stack-4 .avatar-icon:nth-child(1) {
  top: 28%;
  left: 28%;
}

.avatar-stack.stack-4 .avatar-icon:nth-child(2) {
  top: 28%;
  left: 72%;
}

.avatar-stack.stack-4 .avatar-icon:nth-child(3) {
  top: 72%;
  left: 28%;
}

.avatar-stack.stack-4 .avatar-icon:nth-child(4) {
  top: 72%;
  left: 72%;
}

@media (max-width: 540px) {
  .page {
    gap: 12px;
  }

  .mode-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .mode-shell {
    width: min(100%, calc(100% - 18px));
    padding: 16px;
    border-radius: 26px;
  }

  .select-card {
    min-height: 200px;
    padding: 14px;
    border-radius: 24px;
  }

  .avatar-icon {
    width: 62px;
    height: 62px;
  }
}
</style>
