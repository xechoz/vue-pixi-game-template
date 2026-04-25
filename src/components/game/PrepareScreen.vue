<script setup lang="ts">
const modeOptions: Array<{ value: 1 | 2 | 3 | 4; label: string; hint: string }> = [
  { value: 1, label: '1 人模式', hint: '1 位玩家手动，3 位电脑' },
  { value: 2, label: '2 人模式', hint: '2 位玩家手动，2 位电脑' },
  { value: 3, label: '3 人模式', hint: '3 位玩家手动，1 位电脑' },
  { value: 4, label: '4 人模式', hint: '4 位玩家手动，对战电脑关闭' },
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
    <div class="hero-card glass-card">
      <p class="eyebrow">简化版飞行棋</p>
      <h1>准备</h1>
      <p class="intro">选好模式，直接开局。</p>
    </div>

    <div class="grid two-col">
      <aside class="panel prep-panel">
        <div class="section">
          <h2>玩家模式</h2>
          <div class="button-row chips">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              :class="['choice-button', 'chip-button', { active: mode === option.value }]"
              type="button"
              @click="emit('update:mode', option.value)"
            >
              <strong>{{ option.label }}</strong>
              <small>{{ option.hint }}</small>
            </button>
          </div>
        </div>

        <div class="section">
          <h2>每位玩家棋子数</h2>
          <div class="button-row compact chips">
            <button
              v-for="count in pieceOptions"
              :key="count"
              :class="['choice-button', 'count-button', 'chip-button', { active: piecesPerPlayer === count }]"
              type="button"
              @click="emit('update:piecesPerPlayer', count)"
            >
              {{ count }}
            </button>
          </div>
        </div>

        <div class="actions">
          <button class="primary" type="button" @click="emit('start')">开始游戏</button>
          <button class="secondary" type="button" @click="emit('reset')">重置选项</button>
        </div>
      </aside>
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

.hero-card,
.result-card {
  padding: 16px;
}

.hero-card h1,
.result-card h1 {
  margin: 0;
  font-size: clamp(1.9rem, 6vw, 3rem);
  line-height: 1.05;
}

.eyebrow {
  margin: 0 0 6px;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.74rem;
}

.intro,
.result-name,
.status-text {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.grid {
  display: grid;
  gap: 14px;
}

.panel {
  padding: 16px;
  display: grid;
  gap: 14px;
}

.section {
  display: grid;
  gap: 10px;
}

h2 {
  margin: 0;
  color: #e2e8f0;
  font-size: 0.96rem;
}

.button-row {
  display: grid;
  gap: 10px;
}

.button-row.compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.choice-button,
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

.choice-button {
  padding: 14px 16px;
  display: grid;
  gap: 3px;
  text-align: left;
}

.choice-button small {
  color: #94a3b8;
}

.choice-button.active {
  border-color: rgba(56, 189, 248, 0.62);
  background: rgba(8, 47, 73, 0.92);
}

.choice-button:hover,
.primary:hover,
.secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.45);
}

.choice-button:active,
.primary:active,
.secondary:active {
  transform: translateY(0);
}

.count-button {
  justify-items: center;
  text-align: center;
}

.actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
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

@media (min-width: 860px) {
  .two-col {
    grid-template-columns: minmax(320px, 0.95fr) minmax(260px, 0.65fr);
    align-items: start;
  }
}

@media (max-width: 859px) {
  .page {
    width: 100%;
    gap: 12px;
  }

  .hero-card,
  .result-card,
  .panel {
    padding: 14px;
  }

  .button-row.compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .choice-button,
  .primary,
  .secondary {
    min-height: 48px;
  }
}
</style>
