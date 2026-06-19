<template>
  <section class="landing">
    <img
      class="landing__backdrop-image"
      src="/images/detailed-scheduling-hero.svg"
      alt=""
      aria-hidden="true"
    />
    <div class="landing__backdrop-overlay" aria-hidden="true" />

    <div class="landing__toolbar">
      <label class="landing__lang">
        <span>{{ t('landing.language') }}</span>
        <select :value="locale.locale" @change="onLocaleChange">
          <option value="de">🇩🇪 Deutsch</option>
          <option value="en">🇬🇧 English</option>
        </select>
      </label>
    </div>

    <div class="landing__grid">
      <div class="landing__hero">
        <h1 class="landing__headline">
          <span>{{ t('landing.headline1') }}</span>
          <span class="landing__headline-accent">{{ t('landing.headline2') }}</span>
        </h1>
        <p class="landing__subtitle">{{ t('landing.subtitle') }}</p>
      </div>

      <div class="landing__auth">
        <LandingAuthPanel />
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useLocaleStore } from '../stores/localeStore';
import LandingAuthPanel from '../components/landing/LandingAuthPanel.vue';

const { t } = useI18n();
const locale = useLocaleStore();

function onLocaleChange(event) {
  locale.setLocale(event.target.value);
}
</script>

<style scoped>
.landing {
  position: relative;
  min-height: calc(100vh - 0px);
  padding: 1.25rem clamp(1rem, 3vw, 2.5rem) 2rem;
  overflow: hidden;
  color: #fff;
}

.landing__backdrop-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 72% center;
  z-index: 0;
}

.landing__backdrop-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      105deg,
      rgba(7, 22, 18, 0.82) 0%,
      rgba(7, 22, 18, 0.58) 42%,
      rgba(7, 22, 18, 0.35) 68%,
      rgba(7, 22, 18, 0.55) 100%
    );
  z-index: 1;
}

.landing__toolbar,
.landing__grid {
  position: relative;
  z-index: 2;
}

.landing__toolbar {
  margin-bottom: clamp(2rem, 8vh, 5rem);
}

.landing__lang {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.75);
}

.landing__lang select {
  border: none;
  background: transparent;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.landing__lang select option {
  color: #111;
}

.landing__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 420px);
  gap: clamp(1.5rem, 4vw, 4rem);
  align-items: start;
  max-width: 1180px;
}

.landing__hero {
  padding-top: clamp(0.5rem, 4vh, 2rem);
}

.landing__headline {
  display: grid;
  gap: 0.1rem;
  margin: 0;
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  line-height: 1.02;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.landing__headline-accent {
  color: var(--color-accent);
}

.landing__subtitle {
  max-width: 34rem;
  margin: 1.25rem 0 0;
  font-size: clamp(0.95rem, 1.5vw, 1.05rem);
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
}

.landing__auth {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

@media (max-width: 900px) {
  .landing__grid {
    grid-template-columns: 1fr;
  }

  .landing__auth {
    justify-content: stretch;
  }
}
</style>
