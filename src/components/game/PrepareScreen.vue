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
  { src: `${assetBase}player-red.png`, alt: '红色玩家头像' },
  { src: `${assetBase}player-blue.png`, alt: '蓝色玩家头像' },
  { src: `${assetBase}player-green.png`, alt: '绿色玩家头像' },
  { src: `${assetBase}player-yellow.png`, alt: '黄色玩家头像' },
]

const modeOptions = [
  {
    value: 1 as const,
    avatars: playerAvatars.slice(0, 1),
    title: '单人闯关',
    hint: '稳一点',
    accent: '#ffb347',
  },
  {
    value: 2 as const,
    avatars: playerAvatars.slice(0, 2),
    title: '双人对战',
    hint: '刚刚好',
    accent: '#5f9cff',
  },
  {
    value: 3 as const,
    avatars: playerAvatars.slice(0, 3),
    title: '三人混战',
    hint: '更热闹',
    accent: '#56d38f',
  },
  {
    value: 4 as const,
    avatars: playerAvatars.slice(0, 4),
    title: '四人乱斗',
    hint: '经典局',
    accent: '#f56f7f',
  },
]

</script>

<template>
  <section class="page page-prepare">
    <div class="mode-shell">
      <div class="mode-grid">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          :class="['select-card', `card-${option.avatars.length}`, { active: props.mode === option.value }]"
          type="button"
          :aria-label="`${option.value}人模式`"
          :style="{ '--accent': option.accent }"
          @click="emit('update:mode', option.value); emit('start')"
        >
          <div class="card-topbar"></div>
          <div class="card-glow"></div>
          <div class="card-board"></div>
          <div class="card-route"></div>
          <div class="card-corners" aria-hidden="true">
            <span class="corner corner-a"></span>
            <span class="corner corner-b"></span>
            <span class="corner corner-c"></span>
            <span class="corner corner-d"></span>
          </div>
          <div class="card-header">
            <span class="mode-badge">{{ option.value }}P</span>
            <span class="mode-copy">
              <strong>{{ option.title }}</strong>
              <small>{{ option.hint }}</small>
            </span>
          </div>
          <div class="avatar-stack" :class="`stack-${option.avatars.length}`">
            <img
              v-for="avatar in option.avatars"
              :key="avatar.src"
              class="avatar-icon"
              :src="avatar.src"
              :alt="avatar.alt"
            />
          </div>
          <div class="card-track" aria-hidden="true">
            <span
              v-for="cell in 12"
              :key="cell"
              class="track-cell"
              :class="{ 'track-cell--accent': cell === 3 || cell === 10 }"
            ></span>
          </div>
          <div class="card-footer" aria-hidden="true">
            <span class="foot-piece"></span>
            <span class="foot-piece"></span>
            <span class="foot-piece"></span>
            <span class="foot-piece"></span>
          </div>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  width: 100%;
  min-height: 100dvh;
  margin: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 16px;
  position: relative;
  isolation: isolate;
  background: none;
  overflow: hidden;
}


.page::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0), rgba(0, 34, 76, 0.18)),
    linear-gradient(180deg, rgba(4, 14, 28, 0.12), rgba(4, 14, 28, 0.26));
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

.mode-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.select-card {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.16)),
    rgba(255, 255, 255, 0.12);
  color: rgba(0, 0, 0, 0.95);
  cursor: pointer;
  min-height: 250px;
  padding: 18px 18px 16px;
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
    0 14px 28px rgba(0, 31, 61, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(6px);
}

.select-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.42), transparent 20%),
    radial-gradient(circle at 80% 18%, rgba(255, 255, 255, 0.34), transparent 18%),
    radial-gradient(circle at 50% 76%, rgba(255, 255, 255, 0.18), transparent 42%);
  pointer-events: none;
}

.select-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, transparent 0 18%, rgba(255, 255, 255, 0.2) 18% 19%, transparent 19% 100%),
    linear-gradient(315deg, transparent 0 18%, rgba(255, 255, 255, 0.18) 18% 19%, transparent 19% 100%);
  pointer-events: none;
  opacity: 0.9;
}

.card-topbar,
.card-board,
.card-route,
.card-corners,
.card-header,
.card-footer,
.card-track,
.card-glow {
  position: absolute;
  pointer-events: none;
}

.card-topbar {
  top: 0;
  left: 0;
  right: 0;
  height: 16px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 88%, white), transparent);
  opacity: 0.9;
}

.card-board {
  inset: 14px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.14), transparent 56%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.card-route {
  inset: 31% 16% 26%;
  border-radius: 20px;
  border: 2px dashed rgba(255, 255, 255, 0.42);
  opacity: 0.8;
}

.card-corners {
  inset: 18px;
}

.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 80%, white);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
}

.corner-a { top: 0; left: 0; }
.corner-b { top: 0; right: 0; }
.corner-c { bottom: 0; left: 0; }
.corner-d { bottom: 0; right: 0; }

.card-header {
  top: 18px;
  left: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  z-index: 2;
}

.mode-badge {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 92%, white), color-mix(in srgb, var(--accent) 78%, black));
  box-shadow: 0 10px 20px color-mix(in srgb, var(--accent) 22%, transparent);
}

.mode-copy {
  min-width: 0;
  display: grid;
  justify-items: end;
  gap: 2px;
  text-align: right;
}

.mode-copy strong {
  font-size: 18px;
  line-height: 1;
  letter-spacing: 0.02em;
  color: #123;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.42);
}

.mode-copy small {
  font-size: 12px;
  line-height: 1;
  color: rgba(18, 38, 62, 0.72);
}

.card-glow {
  inset: 14px;
  border-radius: 24px;
  background:
    radial-gradient(circle at center, color-mix(in srgb, var(--accent) 24%, transparent), transparent 58%),
    radial-gradient(circle at 50% 36%, rgba(255, 255, 255, 0.12), transparent 42%);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.card-track {
  left: 22px;
  right: 22px;
  bottom: 48px;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  z-index: 1;
}

.track-cell {
  height: 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.06);
}

.track-cell--accent {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, white), color-mix(in srgb, var(--accent) 72%, black));
}

.card-footer {
  left: 18px;
  right: 18px;
  bottom: 18px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  z-index: 2;
}

.foot-piece {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 90%, white), rgba(255, 255, 255, 0.55));
  opacity: 0.72;
}

.select-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--accent) 58%, white);
  box-shadow:
    0 18px 34px rgba(0, 67, 134, 0.14),
    0 3px 10px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.select-card.active {
  transform: translateY(-3px) scale(1.02);
  border-color: color-mix(in srgb, var(--accent) 62%, white);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.15) inset,
    0 22px 42px color-mix(in srgb, var(--accent) 20%, rgba(0, 117, 222, 0.12)),
    0 12px 20px rgba(0, 31, 61, 0.08);
  filter: saturate(1.08);
}

.select-card.active .card-glow {
  opacity: 1;
}

.select-card.active::after {
  content: '';
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
  border: 0;
  box-shadow: none;
  background: transparent;
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
    padding: 14px 14px 12px;
    border-radius: 24px;
  }

  .card-topbar {
    height: 14px;
  }

  .card-board {
    inset: 12px;
  }

  .card-route {
    inset: 33% 15% 27%;
  }

  .card-header {
    top: 14px;
    left: 14px;
    right: 14px;
  }

  .mode-badge {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    font-size: 13px;
  }

  .mode-copy strong {
    font-size: 15px;
  }

  .mode-copy small {
    font-size: 11px;
  }

  .card-track {
    left: 16px;
    right: 16px;
    bottom: 42px;
    gap: 3px;
  }

  .track-cell {
    height: 8px;
  }

  .card-footer {
    left: 14px;
    right: 14px;
    bottom: 14px;
    gap: 6px;
  }

  .foot-piece {
    height: 6px;
  }

  .avatar-icon {
    width: 62px;
    height: 62px;
  }
}
</style>
