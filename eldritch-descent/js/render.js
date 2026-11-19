// ============================================================
//  ELDRITCH DESCENT — pixel renderer: side-view arena + node map
// ============================================================
'use strict';

const THEMES = {
  docks: { wallA: '#262a2e', wallB: '#1c1f22', wallHi: '#3c4146', floorA: '#3a2a1c', floorB: '#2e2016', seam: '#160e08', sky: '#0b0d10', wallLo: '#0b0d10', dark: 0.5, accent: '#4a8ad0' },
  crypt: { wallA: '#2e2a2a', wallB: '#242020', wallHi: '#4a4444', floorA: '#3c4146', floorB: '#2f3338', seam: '#17191d', sky: '#0b0d10', wallLo: '#0b0d10', dark: 0.55, accent: '#c8a0e8' },
  rlyeh: { wallA: '#1a2e28', wallB: '#132420', wallHi: '#2a5a48', floorA: '#1e3a30', floorB: '#173029', seam: '#0b1714', sky: '#050b09', wallLo: '#050b09', dark: 0.6, accent: '#6aa77f' },
};

// 8x8 pixel icons
const ICONS = {
  skull: ['00111100', '01111110', '11011011', '11011011', '01111110', '00111100', '00101000', '00111100'],
  eye:   ['00000000', '00111100', '01100110', '11011011', '11011011', '01100110', '00111100', '00000000'],
  quest: ['00111100', '01100110', '00000110', '00001100', '00011000', '00011000', '00000000', '00011000'],
  fire:  ['00010000', '00011000', '00111000', '01111100', '01101100', '11101110', '11111110', '01111100'],
  coin:  ['00111100', '01111110', '11100111', '11011011', '11011011', '11100111', '01111110', '00111100'],
  chest: ['00000000', '01111110', '11111111', '10000001', '11111111', '11100111', '11111111', '11111111'],
  crown: ['00000000', '10010010', '11010110', '11111110', '11111110', '01111100', '01111100', '00000000'],
  sword: ['00000011', '00000111', '00001110', '01011100', '00111000', '00110000', '01001000', '10000000'],
  shield:['01111110', '11111111', '11111111', '11111111', '01111110', '01111110', '00111100', '00011000'],
  cross: ['00011000', '00011000', '00011000', '11111111', '11111111', '00011000', '00011000', '00011000'],
  up:    ['00011000', '00111100', '01111110', '11011011', '00011000', '00011000', '00011000', '00011000'],
  down:  ['00011000', '00011000', '00011000', '00011000', '11011011', '01111110', '00111100', '00011000'],
  drop:  ['00010000', '00010000', '00111000', '00111000', '01111100', '01111100', '01111100', '00111000'],
  star:  ['00010000', '00010000', '11111110', '01111100', '00111000', '01101100', '01000100', '00000000'],
  roar:  ['10000001', '01000010', '00111100', '01111110', '01011010', '01111110', '00100100', '00011000'],
  spike: ['00010000', '00111000', '00010000', '10010010', '01111100', '00111000', '01111100', '10010010'],
  ghost: ['00111100', '01111110', '11011011', '11111111', '11111111', '11111111', '11011011', '10010001'],
  swirl: ['00111100', '01000010', '10011001', '10100101', '10101001', '10010001', '01000010', '00111100'],
  crack: ['00010000', '00110000', '00011000', '00001100', '00011000', '00110000', '00011000', '00001000'],
  summon:['00111100', '01000010', '10100101', '10011001', '10011001', '10100101', '01000010', '00111100'],
  dream: ['11111111', '10000001', '10111101', '10100101', '10100101', '10111101', '10000001', '11111111'],
  zz:    ['11110000', '00100000', '01000000', '11110000', '00001111', '00000010', '00000100', '00001111'],
  door:  ['00111100', '01111110', '11100111', '11000011', '11000011', '11010011', '11000011', '11000011'],
  sign:  ['00010000', '00111000', '11111110', '01111100', '00111000', '01101100', '11000110', '00000000'],
};
function drawIcon(ctx, name, x, y, color, scale = 1) {
  const g = ICONS[name]; if (!g) return;
  ctx.fillStyle = color;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g[r][c] === '1') ctx.fillRect(Math.round(x) + c * scale, Math.round(y) + r * scale, scale, scale);
}
function iconOutline(ctx, name, x, y, color, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawIcon(ctx, name, x + dx * scale, y + dy * scale, '#05070a', scale);
  drawIcon(ctx, name, x, y, color, scale);
}

// ---------------- sprites at arena scale ----------------
const FLYERS = ['nightgaunt', 'byakhee'];
// silhouettes that stand taller than 2.3 sizes (so intents sit above them, not on them)
const TALL = { cthulhu: 3.35, dagon: 3.1, nyarlathotep: 2.85 };
function heroSpriteA(cls) {
  return SPRITES['A_hero_' + cls] || bakeSprite('A_hero_' + cls, (k, s, t) => HeroArt[cls](k, s, t * 0.25), 9, { scale: 1.75, span: 4.0, oy: 0.62, frames: 6, t0: 0, dt: 0.12 });
}
function foeSpriteA(type) {
  const key = 'A_foe_' + type; if (SPRITES[key]) return SPRITES[key];
  const d = FOES[type], art = d.art || type;
  const sc = d.boss ? (type === 'cthulhu' ? 1.3 : 1.45) : d.elite ? 1.4 : 1.65;
  return bakeSprite(key, (k, s, t) => EnemyArt[art](k, s, t, { id: 11 }), d.size, { scale: sc, span: FLYERS.includes(art) ? 5.0 : art === 'cthulhu' ? 4.8 : 4.4, oy: FLYERS.includes(art) ? 0.5 : 0.6, frames: 6, dt: 0.1 });
}
// small sprites for portraits / map / title
function heroSprite(cls) { return SPRITES['hero_' + cls] || bakeSprite('hero_' + cls, (k, s, t) => HeroArt[cls](k, s, t), 9, { scale: 0.95, span: 4.0, oy: 0.62, frames: 6, t0: 0, dt: 0.06 }); }
function foeSprite(type) {
  const key = 'foe_' + type; if (SPRITES[key]) return SPRITES[key];
  const d = FOES[type], art = d.art || type;
  return bakeSprite(key, (k, s, t) => EnemyArt[art](k, s, t, { id: 11 }), d.size, { scale: 0.9, span: FLYERS.includes(art) ? 5.2 : art === 'cthulhu' ? 5.0 : 4.6, oy: FLYERS.includes(art) ? 0.5 : 0.6, frames: 6 });
}

const FEET = 206;
const HERO_X = { 1: 200, 2: 160, 3: 121, 4: 82 };

class Renderer {
  constructor(canvas) {
    this.canvas = canvas; canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.time = 0; this.shake = 0; this.bgKey = null;
    this.motes = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(2, 7), p: Math.random() * 6 }));
  }

  // ---------- arena background ----------
  buildArena(g) {
    const theme = FLOORS[g.floor].theme, th = THEMES[theme];
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const c = bg.getContext('2d'), rng = mulberry32(g.floor * 977 + (g.stats.nodes || 0) * 31);
    c.fillStyle = th.sky; c.fillRect(0, 0, W, H);
    // back wall of big blocks
    for (let y = 0; y < 150; y += 12) for (let x = -((y / 12) % 2) * 12; x < W; x += 24) {
      c.fillStyle = rng() < 0.5 ? th.wallA : th.wallB; c.fillRect(x + 1, y + 1, 23, 11);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 1, y + 11, 23, 1);
      if (rng() < 0.08) { c.fillStyle = th.wallHi; c.fillRect(x + 3, y + 3, 6, 1); }
    }
    // arches / alcoves
    for (const ax of [60, 240, 420]) {
      c.fillStyle = '#05070a'; c.fillRect(ax - 28, 40, 56, 110);
      for (let i = 0; i < 28; i++) { const w = Math.round(Math.sqrt(28 * 28 - (28 - i) * (28 - i))); c.fillRect(ax - w, 40 - i * 0.9 + 12, w * 2, 1); }
      c.fillStyle = th.wallHi; c.fillRect(ax - 31, 50, 3, 100); c.fillRect(ax + 28, 50, 3, 100);
    }
    if (theme === 'docks') { // water glimpsed through the arches + hanging nets
      for (const ax of [60, 240, 420]) { c.fillStyle = '#0e1f1a'; c.fillRect(ax - 26, 120, 52, 30); c.fillStyle = '#12203a'; for (let i = 0; i < 6; i++) c.fillRect(ax - 22 + i * 8, 126 + (i % 2) * 6, 5, 1); }
      c.strokeStyle = 'rgba(160,140,100,0.35)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(130 + i * 8, 10); c.lineTo(126 + i * 9, 60); c.stroke(); }
    } else if (theme === 'crypt') { // skull niches
      for (let i = 0; i < 16; i++) { const x = 100 + (i % 8) * 36 + (i > 7 ? 18 : 0), y = 70 + Math.floor(i / 8) * 36; if (Math.abs(x - 240) < 40) continue; c.fillStyle = '#05070a'; c.fillRect(x - 6, y - 5, 12, 10); c.fillStyle = '#8a9097'; c.fillRect(x - 3, y - 2, 6, 5); c.fillStyle = '#05070a'; c.fillRect(x - 2, y, 1, 1); c.fillRect(x + 1, y, 1, 1); }
    } else { // R'lyeh: impossible angles + glyphs
      c.strokeStyle = '#2a5a48'; c.lineWidth = 1;
      for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(90 + i * 50, 12); c.lineTo(110 + i * 47, 148); c.stroke(); }
      for (let i = 0; i < 14; i++) { c.fillStyle = '#3f7f62'; const x = 20 + rng() * 440, y = 14 + rng() * 120; c.fillRect(x, y, 5, 1); c.fillRect(x + 2, y - 2, 1, 5); }
    }
    // floor
    for (let y = 150; y < H; y += 6) {
      const k = (y - 150) / (H - 150), tw = 18 + k * 26, off = (y / 6) % 2 ? tw / 2 : 0;
      for (let x = -off; x < W; x += tw) { c.fillStyle = rng() < 0.5 ? th.floorA : th.floorB; c.fillRect(Math.round(x) + 1, y, Math.round(tw) - 1, 5); }
      c.fillStyle = th.seam; c.fillRect(0, y + 5, W, 1);
    }
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 150, W, 4);
    // torches on the wall
    this.torches = [{ x: 150, y: 70 }, { x: 330, y: 70 }];
    for (const t of this.torches) { c.fillStyle = '#3a2418'; c.fillRect(t.x - 1, t.y, 3, 10); c.fillStyle = '#5d636a'; c.fillRect(t.x - 3, t.y - 1, 7, 2); }
    this.arena = bg; this.th = th; this.theme = theme;
    this.bgKey = 'arena:' + g.floor + ':' + g.stats.nodes;
  }

  // ---------- layout ----------
  layout(g) {
    for (const h of g.heroes) {
      const spr = heroSpriteA(h.cls);
      h.sx = HERO_X[h.rank]; h.sy = FEET - 9 * 1.75 * 0.95;
      h.box = { x0: h.sx - 14, y0: h.sy - 26, x1: h.sx + 14, y1: FEET + 4 };
      h.spr = spr;
    }
    const foes = g.foes || [];
    let x = 278;
    for (const f of foes) {
      const spr = foeSpriteA(f.type), d = f.d;
      const vis = Math.max(30, Math.round(d.size * (d.boss ? 2.4 : d.elite ? 2.6 : 2.6)));
      const fly = FLYERS.includes(f.art);
      const sc = d.boss ? (f.type === 'cthulhu' ? 1.3 : 1.45) : d.elite ? 1.4 : 1.65;
      f.tx = x + vis / 2;
      if (f.sx === undefined) f.sx = f.tx + 30;
      f.sy = FEET - d.size * sc * (fly ? 1.5 : 0.92);
      f.spr = spr;
      const hgt = d.size * sc * (TALL[f.art] || 2.3);
      f.box = { x0: f.sx - vis / 2, y0: FEET - hgt - (fly ? 14 : 0), x1: f.sx + vis / 2, y1: FEET + 4 };
      x += vis + 6;
    }
  }

  // ---------- frame ----------
  draw(g, ui, dt) {
    this.time += dt;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (g.mode === 'combat' || g.mode === 'reward' || (g.mode === 'over' && g.foes)) this.drawArena(ctx, g, ui, dt);
    else this.drawMap(ctx, g, ui, dt);
  }

  drawArena(ctx, g, ui, dt) {
    const key = 'arena:' + g.floor + ':' + g.stats.nodes;
    if (this.bgKey !== key) this.buildArena(g);
    this.layout(g);
    const t = this.time;
    for (const f of g.foes || []) f.sx += (f.tx - f.sx) * Math.min(1, dt * 8);
    ctx.save();
    if (this.shake > 0) { ctx.translate(Math.round(rand(-1, 1) * this.shake), Math.round(rand(-1, 1) * this.shake)); this.shake = Math.max(0, this.shake - dt * 18); }
    ctx.drawImage(this.arena, 0, 0);
    // torch glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const tc of this.torches) {
      const f = 0.8 + 0.2 * Math.sin(t * 11 + tc.x);
      const gr = ctx.createRadialGradient(tc.x, tc.y - 4, 0, tc.x, tc.y - 4, 60); gr.addColorStop(0, `rgba(240,150,60,${0.22 * f})`); gr.addColorStop(1, 'rgba(240,150,60,0)');
      ctx.fillStyle = gr; ctx.fillRect(tc.x - 60, tc.y - 64, 120, 120);
      ctx.fillStyle = '#f0d870'; ctx.fillRect(tc.x - 1, tc.y - 5 + Math.round(Math.sin(t * 13 + tc.x)), 3, 4); ctx.fillStyle = '#d0503a'; ctx.fillRect(tc.x - 1, tc.y - 2, 3, 2);
    }
    ctx.restore();

    const sel = ui.selCard, targets = sel ? new Set(g.validTargets(sel)) : null;
    const hov = ui.hover;
    // aggro lines for the hovered horror
    if (hov && hov.team === 'foe' && hov.intent && hov.intent.targets) {
      ctx.fillStyle = '#d0503a';
      for (const h of hov.intent.targets) this.dotLine(ctx, hov.sx, hov.box.y0 - 6, h.sx, h.box.y0 - 2);
    }
    // units
    for (const h of g.heroes) this.drawUnit(ctx, g, h, t, targets && targets.has(h), hov === h);
    for (const f of g.foes || []) this.drawUnit(ctx, g, f, t, targets && targets.has(f), hov === f);
    for (const f of g.dying || []) this.drawUnit(ctx, g, f, t, false, false);
    // fx
    for (const f of g.fx) this.drawFx(ctx, g, f, t);
    // UI overlays on units
    for (const h of g.heroes) this.drawPlates(ctx, g, h, t);
    for (const f of g.foes || []) this.drawPlates(ctx, g, f, t);
    // floaters
    for (const fl of g.floaters) {
      const who = fl.who; if (!who.box) continue;
      if (fl.t < 0) continue;
      const k = fl.t / 1.1;
      pxText(ctx, fl.text, who.sx + fl.dx, who.box.y0 - 6 - k * 18, fl.color, '#05070a', fl.big ? 2 : 1);
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.62, H * 0.3, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${this.th.dark})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // drifting motes
    ctx.fillStyle = 'rgba(200,200,180,0.25)';
    for (const m of this.motes) { m.y -= m.v * dt; m.x += Math.sin(t + m.p) * 0.2; if (m.y < 0) { m.y = H; m.x = Math.random() * W; } ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1); }
    ctx.restore();
  }
  dotLine(ctx, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(d / 3);
    for (let i = 0; i <= n; i++) { const k = i / n, arc = Math.sin(k * Math.PI) * -18; ctx.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k + arc), 1, 1); }
  }
  drawUnit(ctx, g, u, t, targetable, hovered) {
    const spr = u.spr || (u.team === 'hero' ? heroSpriteA(u.cls) : foeSpriteA(u.type));
    const isHero = u.team === 'hero';
    const lunge = u.anim.lunge > 0 ? Math.sin((1 - u.anim.lunge / 0.28) * Math.PI) * 12 * (isHero ? 1 : -1) : 0;
    const shakeX = u.anim.hit > 0 ? Math.round(Math.sin(u.anim.hit * 60) * 2) : 0;
    let x = u.sx + lunge + shakeX, y = u.sy;
    const fly = !isHero && FLYERS.includes(u.art);
    if (fly) y += Math.round(Math.sin(t * 2.5 + u.uid) * 2);
    let alpha = 1;
    if (u.anim.enter > 0) alpha = 1 - u.anim.enter / 0.6;
    if (u.anim.die !== undefined) { alpha = Math.max(0, 1 - u.anim.die / 0.9); y += u.anim.die * 10; }
    if (!isHero && u.st.intangible > 0) alpha *= 0.45 + 0.15 * Math.sin(t * 9);
    // shadow + target ring
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; pxEllipse(ctx, u.sx, FEET, isHero ? 12 : Math.max(10, u.d.size * 1.1), 3);
    if (targetable) { ctx.fillStyle = Math.floor(t * 6) % 2 ? '#f0d870' : '#a0703c'; this.ringE(ctx, u.sx, FEET, isHero ? 15 : Math.max(13, u.d.size * 1.3), 4); }
    else if (hovered) { ctx.fillStyle = '#c3c7cb'; this.ringE(ctx, u.sx, FEET, isHero ? 15 : Math.max(13, u.d.size * 1.3), 4); }
    if (isHero && u.dead) {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.translate(Math.round(u.sx), FEET - 4); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(spr.frames[0], -spr.ox, -spr.oy); ctx.restore();
      pxText(ctx, 'FALLEN', u.sx, FEET + 6, '#9a2a24');
      return;
    }
    const fi = frameOf(spr, u.anim.t * 4);
    const face = isHero ? 1 : -1;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr.frames[fi], -spr.ox, -spr.oy);
    if (u.anim.hit > 0.15) { ctx.globalAlpha = alpha * 0.6; ctx.drawImage(spr.white[fi], -spr.ox, -spr.oy); }
    ctx.restore();
    // glowing eyes
    if (!isHero && alpha > 0.3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const e of spr.eyes[fi]) { const ex = Math.round(x - e.x), ey = Math.round(y + e.y); ctx.fillStyle = hexA(e.color, 0.35 * alpha); ctx.fillRect(ex - 1, ey - 1, 3, 3); }
      ctx.restore();
    }
  }
  ringE(ctx, x, y, rx, ry) { for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1); } }

  drawPlates(ctx, g, u, t) {
    if (u.dead || u.anim.die !== undefined) return;
    const isHero = u.team === 'hero';
    const w = isHero ? 34 : Math.max(34, Math.min(70, Math.round(u.d.size * 2.6)));
    const x = Math.round(u.sx - w / 2), y = FEET + 7;
    // hp bar
    ctx.fillStyle = '#05070a'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = '#2a0a0c'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = isHero ? '#3f7f62' : '#9a2a24'; ctx.fillRect(x, y, Math.round(w * clamp(u.hp / u.maxHp, 0, 1)), 4);
    if (u.st.block) { ctx.fillStyle = '#4a8ad0'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 3, w, 1); }
    pxText(ctx, `${Math.max(0, Math.ceil(u.hp))}/${u.maxHp}`, u.sx, y + 7, '#c3c7cb');
    if (u.st.block) { iconOutline(ctx, 'shield', x - 11, y - 2, '#9ad0ff'); pxText(ctx, u.st.block, x - 7, y + 7, '#9ad0ff'); }
    // statuses
    const sts = Object.entries(u.st).filter(([k, v]) => v > 0 && k !== 'block' && STATUS[k]);
    let sx = Math.round(u.sx - sts.length * 6);
    for (const [k, v] of sts) {
      drawIcon(ctx, STATUS[k].icon, sx, y + 14, STATUS[k].color);
      if (v > 1 || ['str', 'bleed', 'thorns'].includes(k)) pxText(ctx, v, sx + 9, y + 18, '#eeeae0');
      sx += 12;
    }
    // intents
    const top = u.box.y0 - 2;
    if (isHero) {
      if (u.intent && !u.player) this.drawCompIntent(ctx, g, u, top, t);
      const inc = g.incoming(u);
      if (inc > 0 && g.phase === 'player') {
        const net = Math.max(0, inc - (u.st.block || 0));
        iconOutline(ctx, 'sword', x + w + 2, y - 3, net > 0 ? '#d0503a' : '#8a9097');
        pxText(ctx, net > 0 ? net : 0, x + w + 15, y - 1, net > 0 ? '#d0503a' : '#8a9097');
      }
      if (u.player) pxText(ctx, 'YOU', u.sx, u.box.y0 - 4, '#f0d870');
    } else if (u.intent) this.drawFoeIntent(ctx, g, u, top, t);
  }
  drawFoeIntent(ctx, g, f, top, t) {
    const it = f.intent, bob = Math.round(Math.sin(t * 3 + f.uid) * 1.5);
    let icon = 'quest', col = '#c3c7cb', label = '';
    if (f.st.stun > 0) { icon = 'zz'; col = '#f0d870'; label = ''; }
    else if (it.kind === 'attack' || it.kind === 'debuff') {
      icon = it.kind === 'debuff' ? 'skull' : 'sword'; col = '#d0503a';
      const tgt = it.targets[0] || g.player;
      const per = g.dmgCalc(f, tgt, it.dmg || 0);
      label = (it.hits || 1) > 1 ? `${per}X${it.hits}` : `${per}`;
      if (it.all) label += ' ALL';
    } else if (it.kind === 'block') { icon = 'shield'; col = '#9ad0ff'; }
    else if (it.kind === 'buff') { icon = 'up'; col = '#f0d870'; }
    else if (it.kind === 'summon') { icon = 'summon'; col = '#c8a0e8'; }
    else if (it.kind === 'charge') { icon = 'dream'; col = '#6aa77f'; label = it.key === 'dream1' ? '1' : '2'; }
    const tw = label.length * 4 + (label ? 3 : 0);
    const x = Math.round(f.sx - (8 + tw) / 2), y = top - 10 + bob;
    iconOutline(ctx, icon, x, y, col);
    if (label) pxText(ctx, label, x + 10 + tw / 2, y + 2, col);
  }
  drawCompIntent(ctx, g, h, top, t) {
    const it = h.intent, bob = Math.round(Math.sin(t * 3 + h.uid) * 1.5);
    const sk = it.sk;
    const col = { sword: '#f0d870', shield: '#9ad0ff', cross: '#a8d08a', roar: '#4a8ad0', eye: '#d0503a', swirl: '#c8a0e8' }[sk.icon] || '#c3c7cb';
    const label = sk.show(g).replace(/×/g, 'X').replace(/[^0-9X+ ]/g, '').trim().split(' ')[0] || '';
    const tw = label.length * 4 + (label ? 3 : 0);
    const x = Math.round(h.sx - (8 + tw) / 2), y = top - 10 + bob;
    ctx.fillStyle = 'rgba(5,7,10,0.6)'; ctx.fillRect(x - 2, y - 2, 12 + tw, 12);
    iconOutline(ctx, sk.icon, x, y, col);
    if (label) pxText(ctx, label, x + 10 + tw / 2, y + 2, col);
  }
  drawFx(ctx, g, f, t) {
    const k = f.t / f.life, u = f.who;
    if (f.kind === 'zapAll') { ctx.fillStyle = `rgba(154,208,255,${0.25 * (1 - k)})`; ctx.fillRect(0, 0, W, H); return; }
    if (!u || u.sx === undefined) return;
    const cx = u.sx, cy = (u.box ? (u.box.y0 + FEET) / 2 : u.sy);
    if (f.kind === 'hit') { ctx.fillStyle = '#eeeae0'; for (let i = 0; i < 6; i++) { const a = i * 1.05 + u.uid; ctx.fillRect(Math.round(cx + Math.cos(a) * k * 16), Math.round(cy + Math.sin(a) * k * 12), 2, 2); } }
    if (f.kind === 'shield') { ctx.fillStyle = `rgba(154,208,255,${0.5 * (1 - k)})`; pxRing(ctx, cx, cy, 12 + k * 6); }
    if (f.kind === 'heal') { ctx.fillStyle = '#a8d08a'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(cx - 8 + i * 4), Math.round(cy + 10 - k * 26 - (i % 2) * 4), 1, 3); }
    if (f.kind === 'portal') { ctx.fillStyle = 'rgba(90,58,120,0.6)'; pxEllipse(ctx, cx, FEET, 18 * (1 - k * 0.5), 5); }
    if (f.kind === 'dream') { ctx.fillStyle = `rgba(106,167,127,${0.5 * (1 - k)})`; pxRing(ctx, cx, cy, 20 + k * 60); pxRing(ctx, cx, cy, 14 + k * 50); }
  }

  // ---------- map: Lantern & Gloam ----------
  nodePos(n) { return { x: 50 + n.c * 62, y: 52 + n.r * 44 }; }
  drawMap(ctx, g, ui, dt) {
    const t = this.time, m = g.map, th = THEMES[FLOORS[g.floor].theme];
    const RW = 44, RH = 30;
    if (!this.mapDark) { this.mapDark = document.createElement('canvas'); this.mapDark.width = W; this.mapDark.height = H; }
    ctx.fillStyle = '#060809'; ctx.fillRect(0, 0, W, H);
    // rough bedrock
    const rng = mulberry32(g.floor * 131 + 7);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = rng() < 0.5 ? '#0d1012' : '#121619'; ctx.fillRect(Math.round(rng() * W), Math.round(rng() * H), 2 + Math.round(rng() * 8), 2 + Math.round(rng() * 4)); }
    const cells = m.cells.flat().filter(n => n.type !== 'void');
    const reach = new Set(g.reachable().map(n => n.id));
    // passages
    for (const a of cells) for (const b of g.adj(a)) {
      if (b.id < a.id || !(a.seen || b.seen)) continue;
      const pa = this.nodePos(a), pb = this.nodePos(b);
      ctx.fillStyle = th.floorB;
      if (pa.y === pb.y) ctx.fillRect(Math.min(pa.x, pb.x), pa.y - 4, Math.abs(pb.x - pa.x), 9);
      else ctx.fillRect(pa.x - 5, Math.min(pa.y, pb.y), 11, Math.abs(pb.y - pa.y));
      ctx.fillStyle = th.seam;
      if (pa.y === pb.y) { ctx.fillRect(Math.min(pa.x, pb.x), pa.y - 5, Math.abs(pb.x - pa.x), 1); ctx.fillRect(Math.min(pa.x, pb.x), pa.y + 5, Math.abs(pb.x - pa.x), 1); }
      else { ctx.fillRect(pa.x - 6, Math.min(pa.y, pb.y), 1, Math.abs(pb.y - pa.y)); ctx.fillRect(pa.x + 6, Math.min(pa.y, pb.y), 1, Math.abs(pb.y - pa.y)); }
    }
    // rooms
    for (const n of cells) {
      const p = this.nodePos(n), boss = n.type === 'boss';
      const w = boss ? 52 : RW, h = boss ? 44 : RH, x0 = Math.round(p.x - w / 2), y0 = Math.round(p.y - h / 2);
      if (!n.seen) { ctx.fillStyle = '#0b0d10'; ctx.fillRect(x0, y0, w, h); ctx.fillStyle = '#17191d'; ctx.fillRect(x0, y0, w, 1); ctx.fillRect(x0, y0 + h - 1, w, 1); ctx.fillRect(x0, y0, 1, h); ctx.fillRect(x0 + w - 1, y0, 1, h); continue; }
      ctx.fillStyle = th.wallLo || '#0b0d10'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
      for (let yy = 0; yy < h; yy += 6) for (let xx = (yy / 6 % 2) * 4; xx < w; xx += 8) { ctx.fillStyle = (xx + yy + n.c) % 3 ? th.floorA : th.floorB; ctx.fillRect(x0 + xx, y0 + yy, Math.min(7, w - xx), Math.min(5, h - yy)); }
      ctx.fillStyle = th.wallHi; ctx.fillRect(x0 - 2, y0 - 2, w + 4, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0, y0 + h - 4, w, 4);
      const nt = NODE_TYPES[n.type];
      if (boss) {
        const s = foeSprite(FLOORS[g.floor].boss), sc = 40 / s.h;
        ctx.save(); ctx.translate(p.x, p.y + 6); ctx.scale(sc * 1.15, sc * 1.15); ctx.drawImage(s.frames[frameOf(s, t * 3)], -s.ox, -s.oy); ctx.restore();
      } else if (n.type !== 'start') {
        const col = n.visited ? '#3c4146' : nt.color;
        drawIcon(ctx, nt.icon, p.x - 8 + 1, p.y - 8 + 1, '#05070a', 2);
        drawIcon(ctx, nt.icon, p.x - 8, p.y - 8, col, 2);
      } else drawIcon(ctx, 'door', p.x - 8, p.y - 8, '#5d636a', 2);
      if (reach.has(n.id)) { ctx.fillStyle = Math.floor(t * 4) % 2 ? '#f0d870' : '#eeeae0'; for (let i = 0; i < w + 4; i += 2) { ctx.fillRect(x0 - 2 + i, y0 - 3, 1, 1); ctx.fillRect(x0 - 2 + i, y0 + h + 2, 1, 1); } for (let i = 0; i < h + 4; i += 2) { ctx.fillRect(x0 - 3, y0 - 2 + i, 1, 1); ctx.fillRect(x0 + w + 2, y0 - 2 + i, 1, 1); } }
      if (ui.hoverNode === n && reach.has(n.id)) { ctx.fillStyle = '#f0d870'; ctx.fillRect(x0 - 3, y0 - 3, w + 6, 1); ctx.fillRect(x0 - 3, y0 + h + 2, w + 6, 1); ctx.fillRect(x0 - 3, y0 - 3, 1, h + 6); ctx.fillRect(x0 + w + 2, y0 - 3, 1, h + 6); }
    }
    // party token in the current room
    const here = g.here(), hp = this.nodePos(here);
    const hs = heroSprite(g.cls);
    ctx.drawImage(hs.frames[frameOf(hs, t * 6)], hp.x - hs.ox + 12, hp.y - hs.oy + 4);
    // darkness with lantern light
    const d = this.mapDark.getContext('2d');
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(3,4,6,0.72)'; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const cut = (x, y, r, a) => { const gr = d.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2); };
    const flick = 0.96 + 0.04 * Math.sin(t * 11);
    cut(hp.x, hp.y, (70 + 50 * (g.lantern() - 1)) * flick, 1);
    for (const n of cells) if (n.seen && !n.visited) { const p = this.nodePos(n); cut(p.x, p.y, 30, 0.55); }
    for (const n of cells) if (n.visited) { const p = this.nodePos(n); cut(p.x, p.y, 26, 0.35); }
    const lp = this.nodePos(cells.find(n => n.type === 'boss')); cut(lp.x, lp.y, 40, 0.7);
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.mapDark, 0, 0);
    // warm lantern glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 60); lg.addColorStop(0, 'rgba(240,170,80,0.18)'); lg.addColorStop(1, 'rgba(240,170,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(hp.x - 60, hp.y - 60, 120, 120);
    const bl = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 50); bl.addColorStop(0, `rgba(160,30,30,${0.18 + 0.08 * Math.sin(t * 2)})`); bl.addColorStop(1, 'rgba(160,30,30,0)');
    ctx.fillStyle = bl; ctx.fillRect(lp.x - 50, lp.y - 50, 100, 100);
    ctx.restore();
    // the Gloam
    const edge = m.gloam >= 0 ? 50 + m.gloam * 62 + 31 : -40;
    const warn = g.gloamIn() === 1 && m.gloam < m.cols - 2;
    for (let y = 0; y < H; y += 2) {
      const wob = Math.round(Math.sin(y * 0.09 + t * 1.6) * 4 + Math.sin(y * 0.23 - t * 2.3) * 2);
      const ex = edge + wob;
      if (ex > 0) { ctx.fillStyle = '#020203'; ctx.fillRect(0, y, ex, 2); ctx.fillStyle = 'rgba(60,20,70,0.8)'; ctx.fillRect(ex, y, 2, 2); ctx.fillStyle = 'rgba(40,10,50,0.4)'; ctx.fillRect(ex + 2, y, 3, 2); }
      if (warn) { const nx = edge + 62; ctx.fillStyle = `rgba(90,20,60,${0.08 + 0.05 * Math.sin(t * 6)})`; ctx.fillRect(Math.max(0, edge + 5), y, nx - Math.max(0, edge + 5) + wob, 2); }
    }
    if (edge > 0) {
      const er = mulberry32(m.gloam * 7 + 3);
      for (let i = 0; i < 6 + m.gloam * 3; i++) {
        const ex = Math.round(er() * (edge - 10)), ey = Math.round(er() * H), blink = Math.sin(t * (0.6 + er()) + i * 3) > -0.6;
        if (!blink) continue;
        ctx.fillStyle = er() < 0.5 ? '#c8a0e8' : '#d0503a'; ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex + 3, ey, 1, 1);
      }
    }
    if (g.mode === 'map') {
      const n = g.gloamIn();
      pxText(ctx, n === Infinity ? 'THE GLOAM HAS STOPPED. THE LAIR IS OPEN.' : n === 1 ? 'THE GLOAM ADVANCES AFTER YOUR NEXT MOVE' : `THE GLOAM ADVANCES IN ${n} MOVES`, 240, 262, n === 1 ? '#d0503a' : '#8a9097');
    }
  }
  hitNode(g, x, y) {
    for (const n of g.map.cells.flat()) {
      if (n.type === 'void') continue;
      const p = this.nodePos(n), w = n.type === 'boss' ? 52 : 44, h = n.type === 'boss' ? 44 : 30;
      if (Math.abs(x - p.x) <= w / 2 + 3 && Math.abs(y - p.y) <= h / 2 + 3) return n;
    }
    return null;
  }
  hitUnit(g, x, y) {
    const all = [...(g.foes || []), ...g.heroes];
    for (const u of all) { const b = u.box; if (b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 + 22) return u; }
    return null;
  }
}
