import { defineStore } from 'pinia';
import {
  DEFAULT_ACCENT_COLOR,
  LEGACY_DEFAULT_ACCENTS,
  normalizeAccentColor,
  resolveAccentColor,
} from '../config/accentPresets.js';
import { applyAccentCssVars } from '../utils/accentColor.js';

const STORAGE_KEY = 'portal.accentColor';

function resolveInitialAccent() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_ACCENT_COLOR;
  return resolveAccentColor(stored);
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: localStorage.getItem('theme') || 'dark',
    accentColor: resolveInitialAccent(),
    savingAccent: false,
  }),
  actions: {
    init() {
      document.documentElement.dataset.theme = this.mode;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LEGACY_DEFAULT_ACCENTS.has(normalizeAccentColor(stored))) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_ACCENT_COLOR);
        this.accentColor = DEFAULT_ACCENT_COLOR;
      }

      try {
        const auth = JSON.parse(localStorage.getItem('portal.auth') || '{}');
        const profileAccent = auth.user?.preferences?.accentColor;
        if (profileAccent) {
          this.accentColor = resolveAccentColor(profileAccent);
          localStorage.setItem(STORAGE_KEY, this.accentColor);
        }
      } catch {
        /* Auth-Cache ignorieren */
      }

      this.applyAccent();
    },
    toggle() {
      this.mode = this.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', this.mode);
      document.documentElement.dataset.theme = this.mode;
    },
    setAccentColor(color, { persist = true } = {}) {
      this.accentColor = resolveAccentColor(color);
      if (persist) {
        localStorage.setItem(STORAGE_KEY, this.accentColor);
      }
      this.applyAccent();
    },
    /**
     * Profil-Akzent laden. Grün-Presets und alte Defaults → Portal-Blau.
     * @returns {boolean} true wenn migriert wurde
     */
    initFromUser(user) {
      const color = user?.preferences?.accentColor;
      if (!color) return false;

      const previous = normalizeAccentColor(color);
      const resolved = resolveAccentColor(color);
      this.setAccentColor(resolved);
      return resolved !== previous;
    },
    applyAccent() {
      applyAccentCssVars(document.documentElement, this.accentColor);
    },
  },
});
