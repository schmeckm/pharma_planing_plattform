<template>
  <div class="layers-diagram">
    <h4 v-if="title" class="layers-diagram__heading">{{ title }}</h4>
    <div class="layers-diagram__grid">
      <div class="layers-diagram__card layers-diagram__card--country">
        <div class="layers-diagram__card-head">
          <strong>{{ diagram.countryRules.title }}</strong>
          <span>{{ diagram.countryRules.subtitle }}</span>
        </div>
        <ul>
          <li v-for="(item, i) in diagram.countryRules.items" :key="item">
            {{ item }}
            <code v-if="diagram.countryRules.feeds[i]" class="layers-diagram__code">
              {{ diagram.countryRules.feeds[i] }}
            </code>
          </li>
        </ul>
      </div>

      <div class="layers-diagram__bridge" aria-hidden="true">
        <span class="layers-diagram__bridge-line" />
        <span class="layers-diagram__bridge-label">Parameter für</span>
        <span class="layers-diagram__bridge-arrow">→</span>
      </div>

      <div class="layers-diagram__card layers-diagram__card--rules">
        <div class="layers-diagram__card-head">
          <strong>{{ diagram.ruleDefinitions.title }}</strong>
          <span>{{ diagram.ruleDefinitions.subtitle }}</span>
        </div>
        <ul>
          <li v-for="item in diagram.ruleDefinitions.items" :key="item">{{ item }}</li>
        </ul>
      </div>
    </div>
    <p class="layers-diagram__note">
      Gate-Regeln ohne Country-Bezug (Qualität, ATP, FIFO …) laufen für alle Länder gleich.
    </p>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  diagram: { type: Object, required: true },
});
</script>

<style scoped>
.layers-diagram__heading {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}

.layers-diagram__grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: stretch;
}

@media (max-width: 768px) {
  .layers-diagram__grid {
    grid-template-columns: 1fr;
  }
  .layers-diagram__bridge {
    flex-direction: row !important;
    justify-content: center;
    min-height: auto !important;
    padding: 8px 0;
  }
  .layers-diagram__bridge-line { display: none; }
  .layers-diagram__bridge-arrow { transform: rotate(90deg); }
}

.layers-diagram__card {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.layers-diagram__card--rules {
  border-color: #93c5fd;
  background: #eff6ff;
}

.layers-diagram__card--country {
  border-color: #86efac;
  background: #f0fdf4;
}

.layers-diagram__card-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.layers-diagram__card-head strong {
  font-size: 13px;
}

.layers-diagram__card-head span {
  font-size: 11px;
  color: #64748b;
}

.layers-diagram__card ul {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 12px;
  line-height: 1.55;
}

.layers-diagram__code {
  margin-left: 6px;
  padding: 1px 5px;
  font-size: 10px;
  background: rgb(255 255 255 / 70%);
  border-radius: 4px;
}

.layers-diagram__bridge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  gap: 4px;
  color: #64748b;
  font-size: 11px;
}

.layers-diagram__bridge-line {
  flex: 1;
  width: 2px;
  background: #cbd5e1;
}

.layers-diagram__bridge-arrow {
  font-size: 18px;
  font-weight: 700;
  color: #475569;
}

.layers-diagram__note {
  margin: 10px 0 0;
  font-size: 11px;
  color: #64748b;
  font-style: italic;
}
</style>
