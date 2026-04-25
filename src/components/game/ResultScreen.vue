<script setup lang="ts">
defineProps<{
  winnerName: string
}>()

const emit = defineEmits<{
  (event: 'replay'): void
  (event: 'prepare'): void
}>()
</script>

<template>
  <section class="page page-result">
    <div class="result-card glass-card">
      <p class="eyebrow">游戏结束</p>
      <h1>结果</h1>
      <p class="result-name">{{ winnerName }}</p>
      <p class="intro">你可以重新开始，或者返回准备页调整模式。</p>

      <div class="actions">
        <button class="primary" type="button" @click="emit('replay')">再玩一次</button>
        <button class="secondary" type="button" @click="emit('prepare')">去准备页</button>
      </div>
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

.glass-card {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.92)),
    radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 45%);
  box-shadow: 0 20px 60px rgba(2, 6, 23, 0.45);
  backdrop-filter: blur(14px);
}

.result-card {
  padding: 16px;
}

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

.actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 14px;
}

.primary,
.secondary {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 14px 16px;
  color: #e2e8f0;
  cursor: pointer;
  font-weight: 700;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
  touch-action: manipulation;
}

.primary {
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.95), rgba(8, 145, 178, 0.9));
}

.secondary {
  background: rgba(15, 23, 42, 0.92);
}

.primary:hover,
.secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.45);
}

.primary:active,
.secondary:active {
  transform: translateY(0);
}
</style>
