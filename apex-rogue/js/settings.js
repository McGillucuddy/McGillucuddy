'use strict';
// Player settings, kept between sessions.

const SETTINGS_KEY = 'apexrogue_settings_v1';
const SWAY_LEVELS = { off: 0, subtle: 0.5, full: 1 };

const Settings = {
  data: { cabinSway: 'subtle', sens: 1, volume: 0.8, music: 0.7 },

  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (e) { /* storage unavailable */ }
    this.apply();
  },

  save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
    this.apply();
  },

  apply() {
    Sound.volume = this.data.volume;
    if (Sound.master) Sound.master.gain.value = Sound.muted ? 0 : 0.5 * Sound.volume;
    if (typeof Music !== 'undefined') Music.setLevel();
  },

  get sway() { return SWAY_LEVELS[this.data.cabinSway] ?? 0.5; },
};
