'use strict';
// Player settings, kept between sessions.

const SETTINGS_KEY = 'apexrogue_settings_v1';
const SWAY_LEVELS = { off: 0, subtle: 0.5, full: 1 };
// Graphics presets: render height, how many towers stand round the track, weather particle density.
const QUALITY = {
  low: { height: 320, towers: 0.5, particles: 0.5 },
  medium: { height: 480, towers: 1, particles: 1 },
  high: { height: 640, towers: 1, particles: 1 },
};

const Settings = {
  data: { cabinSway: 'subtle', speed: 'normal', people: 'poly', sens: 1, adsSens: 0.7, invertY: false, volume: 0.8, music: 0.7, raceMusic: 0.6, tutorialDone: false, introSeen: false, quality: 'medium', showFps: false, slowmo: true, flicker: true, friendlyFire: true },

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
    // Graphics quality: the internal render height (the retro pass renders this many lines, then scales up).
    if (typeof PSX !== 'undefined') PSX.height = QUALITY[this.data.quality] ? QUALITY[this.data.quality].height : 480;
  },

  get q() { return QUALITY[this.data.quality] || QUALITY.medium; },

  get sway() { return SWAY_LEVELS[this.data.cabinSway] ?? 0.5; },
};
