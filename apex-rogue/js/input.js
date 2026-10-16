'use strict';
// Keyboard, gamepad and touch input merged into one control state.

const Input = {
  keys: new Set(),
  justPressed: new Set(),
  touch: { left: false, right: false, gas: false, brake: false, nitro: false, drift: false },
  steer: 0,

  init() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.initTouch();
  },

  initTouch() {
    const pad = document.getElementById('touch');
    if (!pad) return;
    if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) return;
    pad.classList.add('enabled');
    pad.querySelectorAll('[data-t]').forEach((el) => {
      const k = el.dataset.t;
      const on = (e) => { e.preventDefault(); this.touch[k] = true; el.classList.add('down'); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; el.classList.remove('down'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  },

  consume(code) {
    const had = this.justPressed.has(code);
    this.justPressed.delete(code);
    return had;
  },

  endFrame() { this.justPressed.clear(); },

  read(dt) {
    const k = this.keys, t = this.touch;
    let throttle = k.has('ArrowUp') || k.has('KeyW') || t.gas ? 1 : 0;
    let brake = k.has('ArrowDown') || k.has('KeyS') || t.brake ? 1 : 0;
    let target = 0;
    if (k.has('ArrowLeft') || k.has('KeyA') || t.left) target -= 1;
    if (k.has('ArrowRight') || k.has('KeyD') || t.right) target += 1;
    let handbrake = k.has('Space') || t.drift;
    let nitro = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.nitro;

    // Keyboard steering eases in so taps make small corrections.
    const rate = target === 0 ? 10 : Math.sign(target) !== Math.sign(this.steer) ? 12 : 6;
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    let steer = this.steer;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.15) steer = ax;
      const b = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      if (b(7) > 0.1) throttle = Math.max(throttle, b(7));
      if (b(6) > 0.1) brake = Math.max(brake, b(6));
      if (b(0) > 0.5) throttle = 1;
      if (b(1) > 0.5 || b(5) > 0.5) nitro = true;
      if (b(2) > 0.5 || b(4) > 0.5) handbrake = true;
      if (b(9) > 0.5 && !this.gpStart) this.justPressed.add('Escape');
      this.gpStart = b(9) > 0.5;
      break;
    }
    return { throttle, brake, steer, handbrake, nitro };
  },
};
