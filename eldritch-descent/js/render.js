// ============================================================
//  ELDRITCH DESCENT — pixel renderer: side-view arena + node map
// ============================================================
'use strict';

const THEMES = {
  docks: { wallA: '#262a2e', wallB: '#1c1f22', wallHi: '#3c4146', floorA: '#3a2a1c', floorB: '#2e2016', seam: '#160e08', sky: '#0b0d10', dark: 0.5, accent: '#4a8ad0' },
  crypt: { wallA: '#2e2a2a', wallB: '#242020', wallHi: '#4a4444', floorA: '#3c4146', floorB: '#2f3338', seam: '#17191d', sky: '#0b0d10', dark: 0.55, accent: '#c8a0e8' },
  rlyeh: { wallA: '#1a2e28', wallB: '#132420', wallHi: '#2a5a48', floorA: '#1e3a30', floorB: '#173029', seam: '#0b1714', sky: '#050b09', dark: 0.6, accent: '#6aa77f' },
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
      const hgt = d.size * sc * 2.3;
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

  // ---------- map ----------
  nodePos(n) { if (n.id === 'boss') return { x: 240, y: 26 }; return { x: 120 + n.l * 60 + n.jx, y: 248 - n.r * 30 + n.jy }; }
  drawMap(ctx, g, ui, dt) {
    const t = this.time, th = THEMES[FLOORS[g.floor].theme];
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, W, H);
    const gr = ctx.createRadialGradient(240, 140, 30, 240, 140, 260); gr.addColorStop(0, hexA(th.wallHi, 0.35)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // parchment-ish scratches
    const rng = mulberry32(g.floor * 13 + 7);
    ctx.fillStyle = 'rgba(200,190,150,0.05)'; for (let i = 0; i < 120; i++) ctx.fillRect(Math.round(rng() * W), Math.round(rng() * H), Math.round(rng() * 12), 1);
    const m = g.map, reach = new Set(g.mode === 'map' ? g.reachable().map(n => n.id) : []);
    // edges
    for (const n of Object.values(m.nodes)) {
      const a = this.nodePos(n);
      for (const k of n.next) {
        const b = this.nodePos(m.nodes[k]);
        const walked = m.visited.has(n.id) && m.visited.has(k);
        const live = m.at === n.id && reach.has(k);
        ctx.fillStyle = walked ? '#f0d870' : live ? '#eeeae0' : '#6a7076';
        const d = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.floor(d / 4);
        for (let i = 2; i < steps - 1; i++) { const q = i / steps; ctx.fillRect(Math.round(a.x + (b.x - a.x) * q), Math.round(a.y + (b.y - a.y) * q), live || walked ? 2 : 1, live || walked ? 2 : 1); }
      }
    }
    // nodes
    for (const n of Object.values(m.nodes)) {
      const p = this.nodePos(n), nt = NODE_TYPES[n.type];
      const isBoss = n.id === 'boss', r = isBoss ? 16 : 9;
      const vis = m.visited.has(n.id), can = reach.has(n.id), here = m.at === n.id;
      const hov = ui.hoverNode === n;
      ctx.fillStyle = vis ? '#262a2e' : '#111517'; pxCircle(ctx, p.x, p.y, r);
      ctx.fillStyle = can ? (Math.floor(t * 4) % 2 ? nt.color : '#eeeae0') : vis ? '#5d636a' : '#3c4146'; pxRing(ctx, p.x, p.y, r);
      if (hov && can) pxRing(ctx, p.x, p.y, r + 2);
      if (isBoss) {
        const s = foeSprite(FLOORS[g.floor].boss);
        ctx.save(); ctx.globalAlpha = can ? 1 : 0.7; const sc = 30 / s.h; ctx.translate(p.x, p.y + 3); ctx.scale(sc * 1.2, sc * 1.2); ctx.drawImage(s.frames[frameOf(s, t * 3)], -s.ox, -s.oy); ctx.restore();
      } else drawIcon(ctx, nt.icon, p.x - 8, p.y - 8, vis ? '#5d636a' : can ? nt.color : hexA(nt.color, 0.55), 2);
      if (here) { const hs = heroSprite(g.cls); ctx.drawImage(hs.frames[frameOf(hs, t * 6)], p.x - hs.ox + 12, p.y - hs.oy - 4); }
    }
    if (!m.at) pxText(ctx, 'CHOOSE WHERE TO BEGIN', 240, 262, '#c3c7cb');
  }
  hitNode(g, x, y) {
    for (const n of Object.values(g.map.nodes)) { const p = this.nodePos(n), r = n.id === 'boss' ? 18 : 11; if (dist2(p.x, p.y, x, y) <= r * r) return n; }
    return null;
  }
  hitUnit(g, x, y) {
    const all = [...(g.foes || []), ...g.heroes];
    for (const u of all) { const b = u.box; if (b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 + 22) return u; }
    return null;
  }
}
