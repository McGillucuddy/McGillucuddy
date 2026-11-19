// ============================================================
//  ELDRITCH DESCENT — low-resolution pixel renderer (480x272)
// ============================================================
'use strict';

const THEMES = {
  docks: { floorA: '#3a2a1c', floorB: '#2e2016', seam: '#160e08', wall: '#262a2e', wallHi: '#3c4146', wallLo: '#0b0d10', dark: 0.7, accent: '#4a8ad0' },
  crypt: { floorA: '#3c4146', floorB: '#2f3338', seam: '#17191d', wall: '#2e2a2a', wallHi: '#4a4444', wallLo: '#0b0d10', dark: 0.74, accent: '#c8a0e8' },
  rlyeh: { floorA: '#1e3a30', floorB: '#173029', seam: '#0b1714', wall: '#1a2e28', wallHi: '#2a5a48', wallLo: '#050b09', dark: 0.78, accent: '#6aa77f' },
};
const ROLE_RING = { warden: '#4a8ad0', occultist: '#9a2a24', hunter: '#9a2a24', physician: '#3f7f62' };

// 8x8 door icons
const ICONS = {
  skull: ['00111100', '01111110', '11011011', '11011011', '01111110', '00111100', '00101000', '00111100'],
  eye:   ['00000000', '00111100', '01100110', '11011011', '11011011', '01100110', '00111100', '00000000'],
  sign:  ['00010000', '00111000', '11111110', '01111100', '00111000', '01101100', '11000110', '00000000'],
  fire:  ['00010000', '00011000', '00111000', '01111100', '01101100', '11101110', '11111110', '01111100'],
  coin:  ['00111100', '01111110', '11100111', '11011011', '11011011', '11100111', '01111110', '00111100'],
  chest: ['00000000', '01111110', '11111111', '10000001', '11111111', '11100111', '11111111', '11111111'],
  crown: ['00000000', '10010010', '11010110', '11111110', '11111110', '01111100', '01111100', '00000000'],
};
function drawIcon(ctx, name, x, y, color, scale = 1) {
  const g = ICONS[name]; if (!g) return;
  ctx.fillStyle = color;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g[r][c] === '1') ctx.fillRect(Math.round(x) + c * scale, Math.round(y) + r * scale, scale, scale);
}

// ---------------- sprite registry ----------------
function heroSprite(cls) {
  return SPRITES['hero_' + cls] || bakeSprite('hero_' + cls, (k, s, t) => HeroArt[cls](k, s, t), 9, { scale: 0.95, span: 4.0, oy: 0.62, frames: 6, t0: 0, dt: 0.06 });
}
function foeSprite(type) {
  const d = FOES[type], art = d.art || type, key = 'foe_' + type;
  if (SPRITES[key]) return SPRITES[key];
  const size = type === 'mask' ? 14 : d.size;
  const flying = ['nightgaunt', 'byakhee', 'haunter'].includes(art);
  return bakeSprite(key, (k, s, t) => EnemyArt[art](k, s, t, { id: 11 }), size, { scale: 0.9, span: flying ? 5.2 : art === 'cthulhu' ? 5.0 : 4.6, oy: flying ? 0.5 : 0.6, frames: 6 });
}
function propSprite(kind, theme) {
  const key = 'prop_' + kind + '_' + (theme || '');
  if (SPRITES[key]) return SPRITES[key];
  const fns = {
    pillar: [(k, s, t) => PropArt.pillar(k, s, t, theme), 8, { span: 4.2, oy: 0.62, frames: 1 }],
    chest: [(k, s, t) => PropArt.chest(k, s, t, false), 9, { span: 3, frames: 1 }],
    chestOpen: [(k, s, t) => PropArt.chest(k, s, t, true), 9, { span: 3, frames: 1 }],
    altar: [(k, s, t) => PropArt.altar(k, s, t), 10, { span: 3.4, frames: 6, dt: 0.25 }],
    campfire: [(k, s, t) => PropArt.campfire(k, s, t), 9, { span: 3.4, oy: 0.7, frames: 6, dt: 0.09 }],
    merchant: [(k, s, t) => HeroArt.merchant(k, s, t), 10, { span: 4.2, frames: 6, dt: 0.08 }],
  };
  const [fn, s, o] = fns[kind];
  return bakeSprite(key, fn, s, Object.assign({ scale: 1 }, o));
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas; canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.dark = document.createElement('canvas'); this.dark.width = W; this.dark.height = H;
    this.dctx = this.dark.getContext('2d');
    this.time = 0; this.shake = 0; this.roomKey = null;
    this.dust = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(2, 6) }));
  }

  // ---------- static room ----------
  buildRoom(g) {
    const th = THEMES[FLOORS[g.floor].theme], theme = FLOORS[g.floor].theme;
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const c = bg.getContext('2d'), rng = mulberry32(g.seed);
    // floor
    for (let ty = 0; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
      c.fillStyle = rng() < 0.5 ? th.floorA : th.floorB; c.fillRect(tx, ty, TILE, TILE);
      if (theme === 'docks') {
        c.fillStyle = th.seam; c.fillRect(tx, ty + 7, TILE, 1); c.fillRect(tx, ty + 15, TILE, 1);
        if (rng() < 0.5) c.fillRect(tx + Math.floor(rng() * 16), ty, 1, 7);
        c.fillStyle = '#5d636a'; c.fillRect(tx + 2, ty + 3, 1, 1); c.fillRect(tx + 13, ty + 11, 1, 1);
        if (rng() < 0.08) { c.fillStyle = '#0e1f1a'; c.fillRect(tx + 3, ty + 8, 10, 6); c.fillStyle = '#12203a'; c.fillRect(tx + 4, ty + 9, 8, 4); }
      } else if (theme === 'crypt') {
        c.fillStyle = th.seam; c.fillRect(tx, ty, TILE, 1); c.fillRect(tx, ty, 1, TILE);
        if (rng() < 0.3) { c.fillStyle = '#17191d'; let x = tx + 3 + Math.floor(rng() * 8), y = ty + 2; for (let i = 0; i < 6; i++) { c.fillRect(x, y, 1, 2); x += rng() < 0.5 ? 1 : -1; y += 2; } }
        if (rng() < 0.15) { c.fillStyle = '#2a5a48'; c.fillRect(tx + Math.floor(rng() * 12), ty + 14, 4, 2); }
        if (rng() < 0.05) { c.fillStyle = '#c3c7cb'; c.fillRect(tx + 6, ty + 6, 3, 2); c.fillRect(tx + 9, ty + 7, 2, 1); }
      } else {
        c.fillStyle = th.seam;
        const sk = Math.floor(rng() * 6) - 3;
        for (let i = 0; i < TILE; i++) c.fillRect(tx + i, ty + clamp(Math.round(i * sk / TILE) + 2, 0, 15), 1, 1);
        c.fillRect(tx, ty, 1, TILE);
        if (rng() < 0.08) { c.fillStyle = '#3f7f62'; const gx = tx + 4, gy = ty + 5; c.fillRect(gx, gy, 6, 1); c.fillRect(gx + 2, gy - 2, 1, 6); c.fillRect(gx + 5, gy + 2, 1, 3); }
        if (rng() < 0.1) { c.fillStyle = '#0e1f1a'; c.fillRect(tx + 2, ty + 9, 9, 4); }
      }
    }
    // walls
    c.fillStyle = th.wallLo; c.fillRect(0, 0, W, 40); c.fillRect(0, 0, 16, H); c.fillRect(W - 16, 0, 16, H); c.fillRect(0, H - 8, W, 8);
    for (let y = 4; y < 38; y += 8) for (let x = ((y / 8) % 2) * 8; x < W; x += 16) {
      c.fillStyle = rng() < 0.5 ? th.wall : th.wallHi; c.fillRect(x + 1, y, 15, 7);
      c.fillStyle = th.wallLo; c.fillRect(x + 1, y + 6, 15, 1);
    }
    c.fillStyle = th.wallHi; c.fillRect(0, 38, W, 2); c.fillStyle = '#000'; c.fillRect(0, 40, W, 2);
    c.fillStyle = th.wall; c.fillRect(2, 40, 12, H - 48); c.fillRect(W - 14, 40, 12, H - 48);
    c.fillStyle = th.wallHi; c.fillRect(14, 40, 2, H - 48); c.fillRect(W - 16, 40, 2, H - 48);
    c.fillStyle = th.wall; c.fillRect(0, H - 8, W, 8); c.fillStyle = th.wallHi; c.fillRect(16, H - 8, W - 32, 1);
    // entry gap at the bottom
    c.fillStyle = '#000'; c.fillRect(W / 2 - 14, H - 8, 28, 8);
    // wall torches
    this.torches = [];
    for (const x of [64, W - 64, W / 2 - 160, W / 2 + 160]) {
      c.fillStyle = '#3a2418'; c.fillRect(x - 1, 20, 3, 8); c.fillStyle = '#5d636a'; c.fillRect(x - 2, 19, 5, 2);
      this.torches.push({ x, y: 16 });
    }
    // decorations along the floor edge
    for (let i = 0; i < 18; i++) {
      const x = 20 + Math.floor(rng() * (W - 40)), y = 44 + Math.floor(rng() * (H - 60));
      if (g.obstacles.some(o => dist2(o.x, o.y, x, y) < 400)) continue;
      if (theme === 'docks') { c.fillStyle = '#6b4428'; c.fillRect(x, y, 3, 1); c.fillRect(x + 1, y - 1, 1, 3); }
      else if (theme === 'crypt') { c.fillStyle = '#8a9097'; c.fillRect(x, y, 2, 1); c.fillRect(x + 3, y + 1, 3, 1); }
      else { c.fillStyle = '#2a5a48'; c.fillRect(x, y, 1, 1); c.fillRect(x + 2, y + 1, 1, 1); }
    }
    this.bg = bg; this.theme = theme; this.th = th;
    this.roomKey = g.seed + ':' + g.floor;
  }

  // ---------- frame ----------
  draw(g, ui, dt) {
    if (this.roomKey !== g.seed + ':' + g.floor) this.buildRoom(g);
    this.time += dt;
    const ctx = this.ctx, t = this.time;
    ctx.save();
    if (this.shake > 0) { ctx.translate(Math.round(rand(-1, 1) * this.shake), Math.round(rand(-1, 1) * this.shake)); this.shake = Math.max(0, this.shake - dt * 20); }
    ctx.drawImage(this.bg, 0, 0);
    this.drawDoors(ctx, g, t);
    this.drawZones(ctx, g, t);
    this.drawTeles(ctx, g, t);

    // y-sorted world
    const list = [];
    for (const o of g.obstacles) list.push({ y: o.y + 4, fn: () => this.drawSprite(ctx, propSprite('pillar', this.theme), 0, o.x, o.y, 1) });
    for (const p of g.props) list.push({ y: p.y + 6, fn: () => this.drawProp(ctx, g, p, t) });
    if (g.stairs) list.push({ y: g.stairs.y - 20, fn: () => this.drawStairs(ctx, g.stairs, t) });
    for (const h of g.heroes) list.push({ y: h.downed ? h.y - 6 : h.y, fn: () => this.drawHero(ctx, g, h, t) });
    for (const f of g.foes) list.push({ y: f.flying ? f.y + 10 : f.y, fn: () => this.drawFoe(ctx, g, f, t, ui) });
    list.sort((a, b) => a.y - b.y).forEach(o => o.fn());

    this.drawProjectiles(ctx, g, t);
    this.drawFx(ctx, g, t);
    this.drawDarkness(ctx, g, t);
    this.drawEyes(ctx, g, t);
    this.drawFloaters(ctx, g);
    // aim reticle
    if (ui && ui.showReticle && !g.player.downed) {
      const a = g.player.aim || { x: g.input.mx, y: g.input.my };
      ctx.fillStyle = '#eeeae0'; const x = Math.round(a.x), y = Math.round(a.y);
      ctx.fillRect(x - 3, y, 2, 1); ctx.fillRect(x + 2, y, 2, 1); ctx.fillRect(x, y - 3, 1, 2); ctx.fillRect(x, y + 2, 1, 2);
    }
    ctx.restore();
  }

  drawSprite(ctx, spr, fi, x, y, face = 1, flash = 0, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    const px = Math.round(x), py = Math.round(y);
    if (face < 0) { ctx.translate(px, py); ctx.scale(-1, 1); } else ctx.translate(px, py);
    ctx.drawImage(spr.frames[fi], -spr.ox, -spr.oy);
    if (flash > 0) { ctx.globalAlpha = alpha * flash; ctx.drawImage(spr.white[fi], -spr.ox, -spr.oy); }
    ctx.restore();
  }
  shadow(ctx, x, y, rx, ry, a = 0.45) { ctx.fillStyle = `rgba(0,0,0,${a})`; pxEllipse(ctx, x, y, rx, ry); }

  drawHero(ctx, g, h, t) {
    const spr = heroSprite(h.cls);
    if (h.downed) {
      this.shadow(ctx, h.x, h.y + 2, 9, 3);
      ctx.save(); ctx.translate(Math.round(h.x), Math.round(h.y)); ctx.rotate(Math.PI / 2 * (h.face || 1));
      ctx.globalAlpha = 0.75; ctx.drawImage(spr.frames[0], -spr.ox, -spr.oy); ctx.restore();
      ctx.fillStyle = '#9a2a24'; ctx.fillRect(Math.round(h.x) - 1, Math.round(h.y) - 16, 3, 5); ctx.fillRect(Math.round(h.x) - 1, Math.round(h.y) - 10, 3, 1);
      if (h.revive > 0) { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(h.x) - 9, Math.round(h.y) - 20, 18, 3); ctx.fillStyle = '#a8d08a'; ctx.fillRect(Math.round(h.x) - 8, Math.round(h.y) - 19, Math.round(16 * h.revive / 2.5), 1); }
      return;
    }
    // MMO-style role ring under the feet
    const fy = h.y + 9;
    ctx.fillStyle = h.player ? '#f0d870' : ROLE_RING[h.cls];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + (h.player ? t * 1.5 : 0); if (h.player || i % 2 === 0) ctx.fillRect(Math.round(h.x + Math.cos(a) * 8), Math.round(fy + Math.sin(a) * 3), 1, 1); }
    this.shadow(ctx, h.x, fy, 6, 2);
    if (h.buffs.wall > 0) { ctx.fillStyle = 'rgba(154,208,255,0.3)'; pxCircle(ctx, h.x, h.y - 2, 12); }
    if (h.buffs.shield > 0) { ctx.fillStyle = 'rgba(240,216,112,0.25)'; pxCircle(ctx, h.x, h.y - 2, 11); }
    const fi = h.moving ? frameOf(spr, h.anim) : 0;
    const blink = h.invuln > 0 && Math.floor(t * 20) % 2 === 0;
    this.drawSprite(ctx, spr, fi, h.x, h.y, h.face, h.hitFlash > 0.06 ? 0.6 : 0, blink ? 0.5 : 1);
    if (h.stun > 0) this.stunStars(ctx, h.x, h.y - 18, t);
    // small hp bar for companions, MMO-plate style
    if (!h.player && h.hp < h.maxHp) this.bar(ctx, h.x, h.y - 20, 14, h.hp / h.maxHp, '#6aa77f');
  }
  drawFoe(ctx, g, f, t, ui) {
    const spr = foeSprite(f.type);
    const hover = f.flying ? -6 + Math.round(Math.sin(t * 3 + f.id) * 1.5) : 0;
    const sz = f.d.size;
    this.shadow(ctx, f.x, f.y + sz * 0.85 - (f.flying ? -4 : 0), Math.max(4, sz * 0.7), Math.max(2, sz * 0.22), f.flying ? 0.3 : 0.45);
    if (f.taunt) { ctx.fillStyle = '#4a8ad0'; pxText(ctx, '!', f.x, f.y - sz * 1.6 + hover, '#4a8ad0'); }
    let alpha = 1;
    if (f.phased > 0) alpha = Math.floor(t * 18) % 2 ? 0.15 : 0.35;
    const fi = frameOf(spr, f.anim);
    // wind-up tell: a quick flash
    const flash = f.hitFlash > 0.07 ? (f.boss ? 0.35 : 0.55) : (f.windup > 0 && Math.floor(t * 16) % 2 === 0 ? 0.3 : 0);
    this.drawSprite(ctx, spr, fi, f.x, f.y + hover, f.face, flash, alpha);
    if (f.stun > 0) this.stunStars(ctx, f.x, f.y - sz * 1.4 + hover, t);
    if (f.slow > 0) { ctx.fillStyle = '#8d63b0'; ctx.fillRect(Math.round(f.x) - 3, Math.round(f.y + sz * 0.9), 7, 1); }
    if (!f.boss && (f.hp < f.maxHp || f.elite)) this.bar(ctx, f.x, f.y - sz * 1.3 + hover - 3, Math.max(12, Math.round(sz * 1.4)), f.hp / f.maxHp, f.elite ? '#d0503a' : '#9a2a24');
    // who is it chasing? a tiny marker when it isn't the tank (helps players read aggro)
    if (ui && ui.showAggro && f.target && f.target.cls !== 'warden' && !f.boss) { ctx.fillStyle = '#d0503a'; ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y - sz * 1.3 + hover - 8), 3, 3); }
  }
  bar(ctx, x, y, w, k, col) {
    x = Math.round(x - w / 2); y = Math.round(y);
    ctx.fillStyle = '#05070a'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#2a0a0c'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.round(w * clamp(k, 0, 1))), 2);
  }
  stunStars(ctx, x, y, t) { ctx.fillStyle = '#f0d870'; for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 2), 1, 1); } }
  drawProp(ctx, g, p, t) {
    if (p.kind === 'chest') { this.drawSprite(ctx, propSprite(p.used ? 'chestOpen' : 'chest'), 0, p.x, p.y); }
    else { const s = propSprite(p.kind); this.drawSprite(ctx, s, frameOf(s, t * 8), p.x, p.y); }
    const near = dist2(g.player.x, g.player.y, p.x, p.y) < 30 * 30;
    if ((!p.used || p.kind === 'merchant') && g.cleared) pxText(ctx, near ? 'E' : '.', p.x, p.y - 26 + Math.round(Math.sin(t * 4)), near ? '#f0d870' : '#8a9097');
  }
  drawStairs(ctx, s, t) {
    const x = Math.round(s.x), y = Math.round(s.y);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#3c4146', '#262a2e', '#17191d', '#0b0d10', '#000'][i]; ctx.fillRect(x - 14 + i, y - 8 + i * 3, 28 - i * 2, 3); }
    ctx.fillStyle = `rgba(200,160,232,${0.4 + 0.3 * Math.sin(t * 3)})`; ctx.fillRect(x - 10, y + 6, 20, 2);
    pxText(ctx, 'DESCEND', x, y - 18, '#c8a0e8');
  }
  drawDoors(ctx, g, t) {
    for (const d of g.doors) {
      const rt = ROOM_TYPES[d.type], x = d.x;
      ctx.fillStyle = '#000'; ctx.fillRect(x - 11, 14, 22, 26);
      ctx.fillRect(x - 9, 11, 18, 3); ctx.fillRect(x - 6, 9, 12, 2);
      const glow = 0.25 + 0.15 * Math.sin(t * 3 + x);
      ctx.fillStyle = hexA(rt.color, glow); ctx.fillRect(x - 9, 16, 18, 24);
      ctx.fillStyle = '#5d636a'; ctx.fillRect(x - 12, 12, 1, 28); ctx.fillRect(x + 11, 12, 1, 28);
      drawIcon(ctx, rt.icon, x - 4, 22, rt.color);
      pxText(ctx, rt.name, x, 3, rt.color);
    }
  }
  drawZones(ctx, g, t) {
    for (const z of g.zones) {
      const k = z.t / z.dur;
      if (z.kind === 'sanct') {
        ctx.fillStyle = `rgba(106,167,127,${0.18 + 0.06 * Math.sin(t * 4)})`; pxCircle(ctx, z.x, z.y, z.r);
        ctx.fillStyle = '#a8d08a'; pxRing(ctx, z.x, z.y, z.r);
        for (let i = 0; i < 4; i++) { const a = t * 0.8 + i * 1.57; ctx.fillRect(Math.round(z.x + Math.cos(a) * z.r * 0.6), Math.round(z.y + Math.sin(a) * z.r * 0.6 - ((t * 20 + i * 7) % 12)), 1, 2); }
      } else if (z.kind === 'rift') {
        ctx.fillStyle = 'rgba(28,16,40,0.65)'; pxCircle(ctx, z.x, z.y, z.r);
        ctx.fillStyle = '#5a3a78'; pxRing(ctx, z.x, z.y, z.r);
        ctx.fillStyle = '#c8a0e8';
        for (let i = 0; i < 10; i++) { const a = t * 2.5 + i * 0.63, r = (z.r * ((i * 0.37 + t * 0.6) % 1)); ctx.fillRect(Math.round(z.x + Math.cos(a) * r), Math.round(z.y + Math.sin(a) * r * 0.9), 1, 1); }
      } else if (z.kind === 'trap') {
        const x = Math.round(z.x), y = Math.round(z.y);
        ctx.fillStyle = '#5d636a'; ctx.fillRect(x - 5, y, 11, 1); ctx.fillRect(x - 5, y - 2, 1, 2); ctx.fillRect(x + 5, y - 2, 1, 2);
        ctx.fillStyle = '#c3c7cb'; for (let i = -4; i <= 4; i += 2) ctx.fillRect(x + i, y - 1, 1, 1);
        ctx.fillStyle = '#9a2a24'; ctx.fillRect(x, y + 1, 1, 1);
      } else if (z.kind === 'safe') {
        const pulse = Math.floor(t * 6) % 2;
        ctx.fillStyle = 'rgba(106,255,154,0.16)'; pxCircle(ctx, z.x, z.y, z.r);
        ctx.fillStyle = pulse ? '#a8d08a' : '#6aa77f'; pxRing(ctx, z.x, z.y, z.r); pxRing(ctx, z.x, z.y, z.r - 1);
        ctx.strokeStyle = '#a8d08a'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI * 2 / 5, r = z.r * 0.6; const x = Math.round(z.x + Math.cos(a) * r) + 0.5, y = Math.round(z.y + Math.sin(a) * r) + 0.5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    }
  }
  telePath(ctx, tl, scale = 1) {
    ctx.beginPath();
    if (tl.shape === 'circle') ctx.arc(tl.x, tl.y, tl.r * scale, 0, Math.PI * 2);
    else if (tl.shape === 'cone') { ctx.moveTo(tl.x, tl.y); ctx.arc(tl.x, tl.y, tl.r * scale, tl.ang - tl.arc / 2, tl.ang + tl.arc / 2); ctx.closePath(); }
    else { const cx = Math.cos(tl.ang), cy = Math.sin(tl.ang), nx = -cy * tl.w / 2, ny = cx * tl.w / 2, L = tl.len * scale; ctx.moveTo(tl.x + nx, tl.y + ny); ctx.lineTo(tl.x + cx * L + nx, tl.y + cy * L + ny); ctx.lineTo(tl.x + cx * L - nx, tl.y + cy * L - ny); ctx.lineTo(tl.x - nx, tl.y - ny); ctx.closePath(); }
  }
  drawTeles(ctx, g, t) {
    for (const tl of g.teles) {
      const k = clamp(tl.t / tl.delay, 0, 1);
      if (tl.shape === 'circle') {
        ctx.fillStyle = 'rgba(154,42,36,0.28)'; pxCircle(ctx, tl.x, tl.y, tl.r);
        ctx.fillStyle = 'rgba(208,80,58,0.45)'; pxCircle(ctx, tl.x, tl.y, tl.r * k);
        ctx.fillStyle = Math.floor(t * 10) % 2 ? '#d0503a' : '#9a2a24'; pxRing(ctx, tl.x, tl.y, tl.r);
      } else {
        ctx.fillStyle = 'rgba(154,42,36,0.28)'; this.telePath(ctx, tl); ctx.fill();
        ctx.fillStyle = 'rgba(208,80,58,0.45)'; this.telePath(ctx, tl, k); ctx.fill();
        ctx.strokeStyle = Math.floor(t * 10) % 2 ? '#d0503a' : '#9a2a24'; ctx.lineWidth = 1; this.telePath(ctx, tl); ctx.stroke();
      }
    }
  }
  drawProjectiles(ctx, g, t) {
    for (const p of g.projectiles) {
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.fillStyle = hexA(p.color, 0.35);
      const l = Math.hypot(p.vx, p.vy) || 1;
      for (let i = 1; i <= 3; i++) ctx.fillRect(Math.round(p.x - p.vx / l * i * 2), Math.round(p.y - p.vy / l * i * 2), 1, 1);
      ctx.fillStyle = p.color;
      if (p.kind === 'silver') { ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y, 3, 1); }
      else if (p.r >= 3) { pxCircle(ctx, x, y, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1); }
      else { ctx.fillRect(x - 1, y - 1, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1); }
    }
  }
  drawFx(ctx, g, t) {
    for (const f of g.fx) {
      const k = f.t / f.life;
      switch (f.kind) {
        case 'slash': {
          ctx.fillStyle = k < 0.5 ? '#eeeae0' : '#8a9097';
          for (let i = -6; i <= 6; i++) { const a = f.a + i * 0.13, r = f.r * (0.7 + 0.3 * (1 - Math.abs(i) / 6)); ctx.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y - 4 + Math.sin(a) * r), 1, 1); }
          break;
        }
        case 'cone': { ctx.fillStyle = hexA(f.color, 0.4 * (1 - k)); ctx.beginPath(); ctx.moveTo(f.x, f.y - 4); ctx.arc(f.x, f.y - 4, f.r * (0.4 + k * 0.6), f.a - f.arc / 2, f.a + f.arc / 2); ctx.closePath(); ctx.fill(); break; }
        case 'ring': { ctx.fillStyle = f.color; pxRing(ctx, f.x, f.y, Math.max(1, f.r * (0.3 + k * 0.7))); break; }
        case 'burst': case 'word': {
          ctx.fillStyle = hexA(f.kind === 'word' ? '#c8a0e8' : f.color, 0.35 * (1 - k)); pxCircle(ctx, f.x, f.y, f.r * (0.5 + k * 0.5));
          ctx.fillStyle = f.kind === 'word' ? '#c8a0e8' : f.color; pxRing(ctx, f.x, f.y, f.r * (0.5 + k * 0.5));
          break;
        }
        case 'spark': { ctx.fillStyle = f.color; for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.7; ctx.fillRect(Math.round(f.x + Math.cos(a) * k * 5), Math.round(f.y + Math.sin(a) * k * 5), 1, 1); } break; }
        case 'death': {
          ctx.fillStyle = f.color;
          const n = f.big ? 22 : 10;
          for (let i = 0; i < n; i++) { const a = i / n * 6.28 + f.x, d = k * f.r * (f.big ? 3.5 : 2) * (0.6 + (i % 3) * 0.25); ctx.fillRect(Math.round(f.x + Math.cos(a) * d), Math.round(f.y + Math.sin(a) * d * 0.6 - Math.sin(k * 3.14) * 6), 2, 2); }
          break;
        }
        case 'portal': {
          const r = (f.big ? 16 : 9) * Math.min(1, f.t * 3) * (k > 0.85 ? (1 - k) / 0.15 : 1);
          ctx.fillStyle = 'rgba(28,16,40,0.8)'; pxEllipse(ctx, f.x, f.y + 4, r, r * 0.45);
          ctx.fillStyle = '#5a3a78'; for (let i = 0; i < 8; i++) { const a = t * 4 + i * 0.785; ctx.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + 4 + Math.sin(a) * r * 0.45), 1, 1); }
          break;
        }
        case 'blink': { ctx.fillStyle = '#4a8ad0'; for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.fillRect(Math.round(f.x + Math.cos(a) * k * 12), Math.round(f.y - 6 + Math.sin(a) * k * 12), 1, 1); } break; }
        case 'mend': { ctx.fillStyle = '#a8d08a'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(f.x - 6 + i * 3), Math.round(f.y - 4 - k * 14 - (i % 2) * 3), 1, 2); ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y - 16 - k * 6), 3, 1); ctx.fillRect(Math.round(f.x), Math.round(f.y - 17 - k * 6), 1, 3); break; }
        case 'beam': case 'zap': {
          ctx.strokeStyle = f.kind === 'zap' ? '#9ad0ff' : f.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y);
          const n = 5; for (let i = 1; i <= n; i++) ctx.lineTo(f.x + (f.x2 - f.x) * i / n + (i < n && f.kind === 'zap' ? rand(-3, 3) : 0), f.y + (f.y2 - f.y) * i / n + (i < n && f.kind === 'zap' ? rand(-3, 3) : 0));
          ctx.stroke(); break;
        }
        case 'revive': { ctx.fillStyle = '#f0d870'; for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(f.x - 8 + i * 3), Math.round(f.y - k * 24 - (i % 2) * 4), 1, 3); break; }
        case 'dust': { ctx.fillStyle = 'rgba(138,144,151,0.5)'; ctx.fillRect(Math.round(f.x + rand(-2, 2)), Math.round(f.y - k * 3), 1, 1); break; }
        case 'claw': { ctx.fillStyle = '#d0503a'; for (let i = 0; i < 3; i++) { ctx.fillRect(Math.round(f.x - 3 + i * 3 + k * 3), Math.round(f.y - 4 + k * 6), 1, 2); } break; }
        case 'snap': { ctx.fillStyle = '#c3c7cb'; ctx.fillRect(Math.round(f.x) - 4, Math.round(f.y) - 3, 9, 1); ctx.fillRect(Math.round(f.x) - 4, Math.round(f.y) + 1, 9, 1); break; }
        case 'stone': { ctx.fillStyle = 'rgba(138,144,151,0.6)'; pxCircle(ctx, f.x, f.y - 6, 10 * (1 - k)); break; }
        case 'teleHit': {
          ctx.fillStyle = `rgba(240,216,112,${0.4 * (1 - k)})`;
          if (f.shape === 'circle') pxCircle(ctx, f.x, f.y, f.r); else { this.telePath(ctx, f); ctx.fill(); }
          break;
        }
        case 'shock': case 'dreampulse': { ctx.fillStyle = f.kind === 'dreampulse' ? '#6aa77f' : '#f0d870'; pxRing(ctx, f.x, f.y, 10 + k * 300); pxRing(ctx, f.x, f.y, 6 + k * 280); break; }
      }
    }
  }
  drawDarkness(ctx, g, t) {
    const d = this.dctx, th = this.th;
    const base = (g.nightmare ? 0.06 : 0) + th.dark;
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(2,3,6,${base})`; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const cut = (x, y, r, a = 1) => { if (r < 2) return; const gr = d.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.65})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2); };
    const flick = 0.95 + 0.05 * Math.sin(t * 13);
    for (const h of g.heroes) cut(h.x, h.y - 4, (h.player ? 86 : 64) * g.lightMul * flick * (h.downed ? 0.4 : 1), 0.95);
    for (const tc of this.torches) cut(tc.x, tc.y + 10, 46 * (0.9 + 0.1 * Math.sin(t * 9 + tc.x)), 0.8);
    for (const p of g.props) cut(p.x, p.y, p.kind === 'campfire' ? 110 : p.kind === 'altar' ? 60 : 40, 0.9);
    for (const p of g.projectiles) cut(p.x, p.y, 14, 0.6);
    for (const z of g.zones) if (z.kind !== 'trap') cut(z.x, z.y, z.r * 1.4, 0.6);
    for (const tl of g.teles) cut(tl.x, tl.y, (tl.shape === 'circle' ? tl.r : 40) * 1.1, 0.4);
    for (const f of g.fx) if (['burst', 'word', 'ring', 'teleHit', 'shock', 'dreampulse'].includes(f.kind)) cut(f.x, f.y, 40, 0.7 * (1 - f.t / f.life));
    for (const dr of g.doors) cut(dr.x, 28, 30, 0.7);
    if (g.boss) cut(g.boss.x, g.boss.y, 30, 0.35);
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.dark, 0, 0);
    // warm glow from torches and fire
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const tc of this.torches) {
      const f = 0.7 + 0.3 * Math.sin(t * 11 + tc.x);
      ctx.fillStyle = `rgba(240,160,60,${0.5 * f})`; ctx.fillRect(tc.x - 1, tc.y - 1, 3, 3);
      ctx.fillStyle = '#f0d870'; ctx.fillRect(tc.x, tc.y + Math.round(Math.sin(t * 13 + tc.x)), 1, 2);
    }
    ctx.restore();
  }
  drawEyes(ctx, g, t) {
    // glowing eyes stay visible in the dark
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of g.foes) {
      if (f.phased > 0 && Math.floor(t * 18) % 2) continue;
      const spr = foeSprite(f.type), fi = frameOf(spr, f.anim);
      const hover = f.flying ? -6 + Math.round(Math.sin(t * 3 + f.id) * 1.5) : 0;
      for (const e of spr.eyes[fi]) {
        const x = Math.round(f.x + e.x * f.face), y = Math.round(f.y + hover + e.y);
        ctx.fillStyle = hexA(e.color, 0.35); ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.fillStyle = e.color; ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }
  drawFloaters(ctx, g) {
    for (const f of g.floaters) pxText(ctx, f.text, f.x, f.y, f.color, '#05070a', f.crit ? 2 : 1);
  }
}
