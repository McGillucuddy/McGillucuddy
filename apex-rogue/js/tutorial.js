'use strict';
// Tutorial: a practice race with a coach card that ticks off each skill as you use it.
// No strikes, no scrap, no rep; the rivals are unarmed and slower, and your hull is reinforced.

const TUTORIAL_STEPS = [
  { id: 'look', title: 'Look around', text: 'Move the <kbd>Mouse</kbd> to look around. Your driver steers the car; you ride shotgun as the gunner.', done: (t) => t.look > 1.6 },
  { id: 'fire', title: 'Open fire', text: 'Hold <kbd>LMB</kbd> to fire the SMG. Watch the heat bar: let go before it overheats and jams.', done: (t) => t.n.shoot >= 12 },
  { id: 'hit', title: 'Hit a rival', text: 'Put rounds into a rival car. The crosshair flashes when you land a hit.', done: (t) => t.g.combat.stats.dealt - t.dealt0 >= 15 },
  { id: 'reload', title: 'Reload', text: 'Press <kbd>R</kbd> to reload. Ammo is limited: top up between races in the garage.', done: (t) => t.n.reload >= 1 },
  { id: 'switch', title: 'Swap guns', text: 'Press <kbd>2</kbd> for the rocket launcher. <kbd>1</kbd>-<kbd>3</kbd>, <kbd>Q</kbd> or the mouse wheel swap guns.', done: (t) => t.n.switch >= 1 },
  { id: 'rocket', title: 'Fire a rocket', text: 'Click to fire a rocket at a rival. Rockets are slow and hit hard, so aim ahead of your target.', done: (t) => t.n.rocket >= 1 },
  { id: 'swerve', title: 'Swerve', text: 'Press <kbd>A</kbd> or <kbd>D</kbd> to order the driver to swerve. Use it to dodge fire or slam into a rival.', done: (t) => t.n.swerve >= 1 },
  { id: 'grenade', title: 'Grenade', text: 'Press <kbd>G</kbd> or <kbd>RMB</kbd> to lob a grenade out of the window. Look higher to throw further.', done: (t) => t.n.throw >= 1 },
  { id: 'shield', title: 'Ability', text: 'Press <kbd>Space</kbd> to raise your shield. It blocks everything for a moment, then has to recharge.', done: (t) => t.n.shield >= 1 },
  { id: 'threats', title: 'Know the threats', text: 'In real races some rivals carry rockets, mines and guns. A <b class="bad">red laser</b> on you means a lock: swerve, shield, or shoot the rocket down.', time: 9 },
  { id: 'finish', title: 'Finish the race', text: 'That is the job. Finish in the <b>top 3</b> to qualify. Miss the cut three times and you go back to your cell.', final: true },
];

class Tutorial {
  constructor(game) {
    this.g = game;
    this.i = 0;
    this.t = 0;
    this.look = 0;
    this.lastLook = null;
    this.n = {};
    this.dealt0 = 0;
    this.flash = 0;
    this.el = document.createElement('div');
    this.el.id = 'coach';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.drawn = '';
  }

  get step() { return TUTORIAL_STEPS[this.i]; }

  onEvent(ev) { this.n[ev.type] = (this.n[ev.type] || 0) + 1; }

  // Called every frame while the tutorial race is on screen.
  update(dt) {
    const g = this.g, race = g.race, showing = g.state === 'race';
    this.el.classList.toggle('hidden', !showing);
    if (!showing) return;
    const live = race.state === 'racing' && !(g.view === 'cockpit' && !g.locked && !g.noLock);
    if (live) {
      // Look: count how far the aim has travelled relative to the car.
      const lk = g.view === 'cockpit' && g.cockpit ? g.cockpit.look.yaw + g.cockpit.look.pitch : wrapAngle(g.aimAngle() - race.player.heading);
      if (this.lastLook != null) this.look += Math.min(0.4, Math.abs(lk - this.lastLook));
      this.lastLook = lk;
      this.t += dt;
      if (this.flash > 0) {
        this.flash -= dt;
        if (this.flash <= 0) this.advance();
      } else {
        const s = this.step;
        if (Input.consume('Enter') && !s.final) this.pass(true);
        else if (s.done ? s.done(this) : s.time && this.t > s.time) this.pass();
      }
    }
    this.render(race, live);
  }

  pass(skipped) {
    this.flash = skipped ? 0.01 : 1.1;
    if (!skipped) Sound.play({ type: 'reloaded' });
  }

  advance() {
    if (this.i < TUTORIAL_STEPS.length - 1) this.i++;
    this.t = 0;
    this.n = {}; // each step wants a fresh action, not one you did earlier
    this.look = 0;
    this.dealt0 = this.g.combat.stats.dealt;
  }

  render(race, live) {
    const s = this.step, done = this.flash > 0;
    const dots = TUTORIAL_STEPS.map((_, k) => `<i class="${k < this.i || (k === this.i && done) ? 'on' : k === this.i ? 'cur' : ''}"></i>`).join('');
    let body;
    if (race.state === 'countdown') body = '<h3>Get ready</h3><p>The race starts after the countdown. Your coach will talk you through the guns.</p>';
    else if (!live) body = '<h3>Grab your gun</h3><p>Click the screen to take control of aiming.</p>';
    else body = `<h3>${done ? '✓ ' : ''}${s.title}</h3><p>${s.text}</p>${s.final || done ? '' : '<small>Stuck? <kbd>Enter</kbd> skips this step.</small>'}`;
    const html = `<div class="coach-head"><b>Tutorial</b><span>Step ${this.i + 1} of ${TUTORIAL_STEPS.length}</span></div><div class="coach-dots">${dots}</div><div class="coach-body ${done ? 'done' : ''}">${body}</div>`;
    if (html !== this.drawn) { this.el.innerHTML = html; this.drawn = html; }
  }

  destroy() { this.el.remove(); }
}
