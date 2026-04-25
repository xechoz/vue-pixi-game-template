<script setup lang="ts">
import heroImage from '../../assets/hero.png'

const modeOptions: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
  { value: 1, label: '1P' },
  { value: 2, label: '2P' },
  { value: 3, label: '3P' },
  { value: 4, label: '4P' },
]

const pieceOptions = [1, 2, 3, 4]

defineProps<{
  mode: 1 | 2 | 3 | 4
  piecesPerPlayer: number
}>()

const emit = defineEmits<{
  (event: 'update:mode', value: 1 | 2 | 3 | 4): void
  (event: 'update:piecesPerPlayer', value: number): void
  (event: 'start'): void
  (event: 'reset'): void
}>()
</script>

<template>
  <section class="page page-prepare">
    <div class="hero-shell glass-card">
      <div class="hero-copy">
        <p class="eyebrow">Flight Ludo</p>
        <h1>飞行棋</h1>
        <p class="intro">选好模式，马上开局。</p>
        <div class="hero-badges">
          <span>快速对战</span>
          <span>棋盘对局</span>
          <span>轻量简洁</span>
        </div>
      </div>
      <img class="hero-art" :src="heroImage" alt="飞行棋插画" />
    </div>

    <div class="grid prep-grid">
      <section class="panel">
        <div class="section-head">
          <h2>玩家模式</h2>
          <p>选择手动玩家人数，其余由电脑控制。</p>
        </div>
        <div class="mode-grid">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            :class="['mode-card', { active: mode === option.value }]"
            type="button"
            @click="emit('update:mode', option.value)"
          >
            <span>{{ option.label }}</span>
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>棋子数量</h2>
          <p>每位玩家携带几枚棋子。</p>
        </div>
        <div class="count-grid">
          <button
            v-for="count in pieceOptions"
            :key="count"
            :class="['mode-card', 'count-card', { active: piecesPerPlayer === count }]"
            type="button"
            @click="emit('update:piecesPerPlayer', count)"
          >
            <span>{{ count }}</span>
            <small>枚</small>
          </button>
        </div>
        <div class="actions">
          <button class="primary start-button" type="button" @click="emit('start')">开始游戏</button>
          <button class="secondary" type="button" @click="emit('reset')">重置选项</button>
        </div>
      </section>
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

.glass-card,
.panel {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.92)),
    radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 45%);
  box-shadow: 0 20px 60px rgba(2, 6, 23, 0.45);
  backdrop-filter: blur(14px);
}

.hero-shell {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 16px;
  padding: 16px;
  align-items: center;
}

.hero-copy {
  display: grid;
  gap: 10px;
}

.hero-shell h1 {
  margin: 0;
  font-size: clamp(2.2rem, 7vw, 3.4rem);
  line-height: 1;
}

.eyebrow {
  margin: 0;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.74rem;
}

.intro,
.section-head p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.5;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-badges span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(8, 47, 73, 0.72);
  border: 1px solid rgba(56, 189, 248, 0.22);
  color: #dbeafe;
  font-size: 0.82rem;
}

.hero-art {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid rgba(56, 189, 248, 0.18);
  background: rgba(2, 6, 23, 0.42);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.06);
}

.prep-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel {
  padding: 16px;
  display: grid;
  gap: 14px;
}

.section-head {
  display: grid;
  gap: 4px;
}

h2 {
  margin: 0;
  color: #e2e8f0;
  font-size: 1rem;
}

.mode-grid,
.count-grid {
  display: grid;
  gap: 10px;
}

.mode-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.count-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.mode-card,
.primary,
.secondary {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
  touch-action: manipulation;
}

.mode-card {
  padding: 16px 12px;
  display: grid;
  place-items: center;
  min-height: 62px;
  font-size: 1.1rem;
  font-weight: 800;
}

.mode-card small {
  color: #94a3b8;
  font-size: 0.72rem;
}

.mode-card.active {
  border-color: rgba(56, 189, 248, 0.62);
  background: rgba(8, 47, 73, 0.92);
}

.mode-card:hover,
.primary:hover,
.secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.45);
}

.mode-card:active,
.primary:active,
.secondary:active {
  transform: translateY(0);
}

.count-card {
  min-height: 72px;
  gap: 3px;
}

.actions {
  display: grid;
  gap: 10px;
  margin-top: 2px;
}

.primary,
.secondary {
  padding: 14px 16px;
  font-weight: 700;
}

.primary {
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.95), rgba(8, 145, 178, 0.9));
}

.secondary {
  background: rgba(15, 23, 42, 0.92);
}

.start-button {
  font-size: 1.02rem;
}

@media (max-width: 859px) {
  .hero-shell,
  .prep-grid {
    grid-template-columns: 1fr;
  }

  .count-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
