'use strict';
// The TV: where you pick tonight's stop. Every stop on the act's route (js/runmap.js) is a channel, and each night
// the warden's office books you onto one of the channels that will have you. Races are shows (with a name, a
// format, the purse and the weather in a caption), the commissary is the home shopping channel, the mechanic is a
// test card, events are the news, a stash is a pirate signal, and the boss is a special presentation.
// The picture on each channel is a small animated broadcast drawn in 2D, chunky like the rest of the game.
// The full route (to plan ahead) is the TV guide: the old route sheet, one button away.

const TV = {
  W: 256, H: 192, // the picture's own resolution, scaled up pixelated

  // Channel blocks per act (DESIGN.md: the dial).
  BLOCKS: [[2, 9, 'PUBLIC ACCESS'], [10, 29, 'CABLE'], [30, 59, 'PREMIUM'], [60, 99, 'PRIME TIME']],
  RACE_SHOWS: [
    ['MIDNIGHT DERBY', 'SEWER RUN', 'THE GRIND', 'LIGHTS OUT', 'CELLBLOCK SPRINT', "DEAD MAN'S LAP"],
    ['SMOG RALLY', 'FOUNDRY 500', 'RUST BELT', 'STACK ATTACK', 'THE SLAG RUN', 'NIGHT SHIFT'],
    ['GOLDEN HOUR', 'GARDEN PARTY', 'VILLA GRAND PRIX', 'THE TERRACE CUP', 'CHAMPAGNE LAP', 'TEA TIME'],
    ['PRIME TIME', 'CROWN CIRCUIT', 'THE SPIRE STAKES', 'GRANDSTAND', 'THE MAIN EVENT', 'HEADLINER'],
  ],
  ELITE_SHOWS: ['BLOOD MONEY', 'PRIME CUTS', 'NO MERCY', 'THE KILLING FLOOR'],
  NEWS_SHOWS: ['C9 NEWS AT TEN', 'THE WARDEN ADDRESSES', 'CALL-IN HOUR', 'CELL BLOCK TONIGHT'],

  hash(a, b) { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; },

  // A stop as a programme: channel number, show name, the kind of picture, and the caption's lines.
  show(run, node, b) {
    const act = run.act, [lo, hi, tier] = TV.BLOCKS[act] || TV.BLOCKS[0], h = TV.hash(node.id + 1, (run.seed || 7) + act * 31);
    const boss = BOSSES[act], wx = ['race', 'elite', 'bounty', 'boss'].includes(node.type) ? wxOf(weatherFor(run.seed || 0, act, node.id)) : null;
    const lux = ACT_LUXURY(act), purse = `win ${PLACE_PURSE[0][0]}-${PLACE_PURSE[0][1]}, a bounty on every rival`;
    const S = { node, ch: lo + (h % (hi - lo + 1)), tier, kind: node.type, wx, h };
    const lay = ['race', 'elite', 'bounty', 'boss'].includes(node.type) ? LAYOUTS[layoutFor(run.seed || 0, act, node.id, node.type === 'boss')].name : ''; // the course (js/track.js)
    switch (node.type) {
      case 'race': Object.assign(S, { name: TV.RACE_SHOWS[act][h % 6], line: `${lay} · 3 laps · 6 rivals · finish top 3`, line2: `Purse: ${purse}` }); break;
      case 'elite': Object.assign(S, { name: TV.ELITE_SHOWS[h % 4], line: `${lay} · sharper drivers, more guns · a trinket guaranteed`, line2: `Pays 40% more · ${purse}` }); break;
      case 'bounty': Object.assign(S, { name: 'MOST WANTED', amt: 150 + act * 50, line: `${lay} · the warden's put ${150 + act * 50} scrap on one rival's head`, line2: 'Wreck them for it · still finish top 3' }); break;
      case 'boss': Object.assign(S, { name: 'SPECIAL PRESENTATION', sub: boss.name.toUpperCase(), line: `${boss.title}. ${boss.desc}`, line2: boss.mustWin ? 'Win it and you walk free' : `Beat ${boss.name} to move up · purse ${BOSS_PURSE[0]}-${BOSS_PURSE[1]}` }); break;
      case 'shop': Object.assign(S, { name: lux ? 'AUREUM SHOPPING NETWORK' : 'C9 HOME SHOPPING', line: 'Legal goods: parts, guns, mods, ammo', line2: 'Opens the commissary in your garage · no race' }); break;
      case 'event': Object.assign(S, { name: TV.NEWS_SHOWS[h % 4], line: "Something's happening in the cell block", line2: 'Tune in and choose how to handle it · no race' }); break;
      case 'repair': Object.assign(S, { name: 'PLEASE STAND BY', line: 'Technical difficulties: an old lifer patches your car for free', line2: `Hull ${Math.ceil(b.hull)}/${b.maxHull} · no race` }); break;
      case 'stash': Object.assign(S, { name: 'PIRATE SIGNAL', line: "Someone's broadcasting where a stash is hidden", line2: 'Take one of two things · no race' }); break;
      default: Object.assign(S, { name: (NODE_TYPES_RUN[node.type] || {}).label || 'STATIC', line: '', line2: '' });
    }
    return S;
  },

  // Tonight's channels: what's reachable, in channel order, with no two on the same number.
  lineup(run, b) {
    const reach = reachableNodes(run.map, run.cur).map((id) => mapNode(run.map, id));
    const shows = reach.map((n) => TV.show(run, n, b)), [lo, hi] = TV.BLOCKS[run.act] || TV.BLOCKS[0];
    shows.sort((a, c) => a.ch - c.ch);
    const pools = { race: TV.RACE_SHOWS[run.act] || TV.RACE_SHOWS[0], elite: TV.ELITE_SHOWS, event: TV.NEWS_SHOWS }, used = new Set();
    for (const s of shows) { // no two shows with the same name on one night
      const pool = pools[s.kind];
      for (let k = 1; pool && used.has(s.name) && k < pool.length; k++) s.name = pool[(s.h + k) % pool.length];
      used.add(s.name);
    }
    for (let i = 1; i < shows.length; i++) if (shows[i].ch <= shows[i - 1].ch) shows[i].ch = Math.min(hi, shows[i - 1].ch + 1 + (shows[i].h % 3));
    return shows;
  },

  // ---------- The picture ----------

  // Run the picture on a canvas until it leaves the page. get() returns { show, staticT } each frame.
  // Every screen on the wall runs off one animation loop. get() returns { show, staticT } each frame; the little
  // screens round the edge (slow: true) only redraw every other frame.
  screens: [],
  run(canvas, get, slow) {
    canvas.width = TV.W; canvas.height = TV.H;
    TV.screens.push({ canvas, g: canvas.getContext('2d'), get, slow, t: Math.random() * 10 });
    if (TV.looping) return;
    TV.looping = true;
    let last = performance.now(), n = 0;
    const frame = (now) => {
      TV.screens = TV.screens.filter((S) => S.canvas.isConnected);
      if (!TV.screens.length) { TV.looping = false; return; }
      n++;
      if (n % 2) { requestAnimationFrame(frame); return; } // 30 frames a second is plenty for a CRT
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      for (const S of TV.screens) {
        S.t += dt;
        if (S.slow && n % 4) continue; // the little sets round the edge: 15
        const st = S.get();
        if (st.staticT > 0) { st.staticT -= dt; TV.snow(S.g, 1); } else if (st.show) TV.draw(S.g, st.show, S.t);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  // Snow from a few pre-made noise frames (fresh noise on a dozen screens every frame is too slow).
  snow(g, k) {
    if (!TV.noise) {
      TV.noise = [0, 1, 2, 3].map(() => {
        const c = document.createElement('canvas'); c.width = TV.W; c.height = TV.H;
        const x = c.getContext('2d'), img = x.createImageData(TV.W, TV.H), d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        x.putImageData(img, 0, 0);
        return c;
      });
    }
    g.fillStyle = '#000'; g.fillRect(0, 0, TV.W, TV.H);
    g.globalAlpha = k;
    g.drawImage(TV.noise[Math.floor(Math.random() * 4)], (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, TV.W + 20, TV.H + 20);
    g.globalAlpha = 1;
  },

  // The other screens on the wall: what else is on tonight. Not bookable; there for the noise of it.
  FILLERS: ['static', 'ad', 'warden', 'ident', 'toll', 'ad', 'static', 'weather', 'ad'],
  ADS: [['AUREUM', 'OWN TOMORROW', '#c9a443', '#141210'], ['HELIX', 'LIVE FOREVER', '#3fb87a', '#f4f4ee'], ['CROWN BANK', 'TRUST IS GOLD', '#d8b83a', '#1a2a5a'], ['WARDEN CORP', 'WE KEEP YOU SAFE', '#e8e2c8', '#3a3a3a'], ['HELIX', 'BREATHE EASY', '#3fb87a', '#203028']],
  fillers(run, n) {
    const out = [], r = mulberry32(((run.seed || 7) + (run.cur ?? -1) * 977 + run.act * 31) >>> 0);
    for (let i = 0; i < n; i++) {
      const f = TV.FILLERS[Math.floor(r() * TV.FILLERS.length)];
      out.push({ kind: 'filler', f, ad: TV.ADS[Math.floor(r() * TV.ADS.length)], h: Math.floor(r() * 1e9), ch: f === 'static' ? null : 2 + Math.floor(r() * 97) });
    }
    return out;
  },

  title(g, txt, y, size, col, shadow) {
    g.font = `bold ${size}px "Courier New", monospace`; g.textAlign = 'center';
    let s = size;
    while (g.measureText(txt).width > TV.W - 16 && s > 9) { s--; g.font = `bold ${s}px "Courier New", monospace`; }
    g.fillStyle = shadow || '#000'; g.fillText(txt, TV.W / 2 + 2, y + 2);
    g.fillStyle = col; g.fillText(txt, TV.W / 2, y);
  },

  draw(g, S, t) {
    const W = TV.W, H = TV.H, k = S.kind;
    g.save();
    if (k === 'race' || k === 'elite' || k === 'bounty') TV.picRace(g, S, t);
    else if (k === 'boss') TV.picBoss(g, S, t);
    else if (k === 'shop') TV.picShop(g, S, t);
    else if (k === 'event') TV.picNews(g, S, t);
    else if (k === 'repair') TV.picBars(g, S, t);
    else if (k === 'filler') TV.picFiller(g, S, t);
    else TV.picPirate(g, S, t);
    g.restore();
    // A LIVE bug on the shows that are live.
    if (['race', 'elite', 'bounty', 'boss'].includes(k)) {
      g.fillStyle = '#c8141a'; g.fillRect(8, 16, 36, 12); // under the night line, clear of the channel number
      g.fillStyle = '#fff'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText((Math.floor(t * 2) % 2 ? '●' : '○') + ' LIVE', 26, 25);
    }
    // A little interference now and then: a rolling band.
    const band = ((t * 40) % (H + 40)) - 20;
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, band, W, 6);
  },

  // A night race: city towers against the sky, the road running off to the horizon, rivals' tail lights ahead.
  picRace(g, S, t) {
    const W = TV.W, H = TV.H, rnd = mulberry32(S.h);
    const elite = S.kind === 'elite', bounty = S.kind === 'bounty', hy = H * 0.55;
    if (!S.bg) { // the sky, the towers and the road don't move: drawn once
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const b = c.getContext('2d'), r = mulberry32(S.h);
      const sky = b.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, elite ? '#1a0406' : '#0a0c18'); sky.addColorStop(1, elite ? '#6a1a10' : '#3a2a3a');
      b.fillStyle = sky; b.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) { // towers with lit windows
        const x = r() * W, w = 10 + r() * 22, h = 30 + r() * 70;
        b.fillStyle = '#0c0c12'; b.fillRect(x, H * 0.55 - h, w, h);
        b.fillStyle = 'rgba(255,200,110,0.6)';
        for (let y = H * 0.55 - h + 4; y < H * 0.55 - 4; y += 6) for (let xx = x + 2; xx < x + w - 2; xx += 5) if (r() < 0.3) b.fillRect(xx, y, 2, 2);
      }
      b.fillStyle = '#16151a'; b.fillRect(0, hy, W, H - hy); // the road
      b.fillStyle = '#2a2830';
      b.beginPath(); b.moveTo(W / 2 - 10, hy); b.lineTo(W / 2 + 10, hy); b.lineTo(W * 0.95, H); b.lineTo(W * 0.05, H); b.closePath(); b.fill();
      Object.defineProperty(S, 'bg', { value: c, enumerable: false }); // kept out of saves
    }
    g.drawImage(S.bg, 0, 0);
    g.fillStyle = '#d8c060';
    for (let i = 0; i < 8; i++) { // dashes rushing at you
      const f = ((i / 8 + t * 0.9) % 1), y = hy + f * f * (H - hy), hh = 2 + f * 10, w = 1 + f * 4;
      g.fillRect(W / 2 - w / 2, y, w, hh);
    }
    const cars = 3;
    for (let i = 0; i < cars; i++) { // rivals ahead, weaving
      const f = 0.25 + i * 0.22, y = hy + f * f * (H - hy) + 6, s = 6 + f * 26, x = W / 2 + Math.sin(t * (0.8 + i * 0.3) + i * 2) * (20 + f * 60);
      g.fillStyle = '#0a0a0a'; g.fillRect(x - s / 2, y - s * 0.45, s, s * 0.45);
      g.fillStyle = '#ff2a1a'; g.fillRect(x - s / 2 + 1, y - s * 0.3, s * 0.18, s * 0.1); g.fillRect(x + s / 2 - 1 - s * 0.18, y - s * 0.3, s * 0.18, s * 0.1);
      if (bounty && i === 1) { g.strokeStyle = Math.floor(t * 4) % 2 ? '#ffd23f' : '#ff3b1f'; g.lineWidth = 1; g.strokeRect(x - s / 2 - 3, y - s * 0.45 - 3, s + 6, s * 0.45 + 6); g.fillStyle = '#ffd23f'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText('$', x, y - s * 0.45 - 6); }
    }
    if (S.wx && S.wx !== WEATHER.clear) { // weather over the picture
      g.strokeStyle = 'rgba(180,200,220,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const x = (rnd() * W + t * 60) % W, y = (rnd() * H + t * 240) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 7); g.stroke(); }
    }
    TV.title(g, S.name, 48, 22, elite ? '#ff5a3a' : bounty ? '#ffd23f' : '#f4f0e6');
    if (elite) TV.title(g, '☠', 70, 18, '#ff5a3a');
    if (bounty) TV.title(g, `$${S.amt}`, 68, 14, '#ffd23f');
  },

  // The boss's special: their mugshot (the route sheet's), a spotlight, and the name in lights.
  picBoss(g, S, t) {
    const W = TV.W, H = TV.H;
    g.fillStyle = '#0a0606'; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, 120);
    rg.addColorStop(0, 'rgba(255,220,150,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    if (!TV.mug || TV.mug.boss !== S.sub) {
      const c = document.createElement('canvas'); c.width = 120; c.height = 140;
      try { RouteSheet.mugshot(c, BOSSES.find((x) => x.name.toUpperCase() === S.sub) || BOSSES[0]); } catch (e) { /* no mugshot */ }
      TV.mug = { boss: S.sub, c };
    }
    const s = 0.95 + Math.sin(t * 0.8) * 0.03;
    g.drawImage(TV.mug.c, W / 2 - 42 * s, 62, 84 * s, 98 * s);
    TV.title(g, 'SPECIAL PRESENTATION', 36, 12, '#ffd23f');
    TV.title(g, S.sub, 56, 18, Math.floor(t * 3) % 2 ? '#ff3b1f' : '#f4f0e6');
  },

  // Home shopping: a studio, the host, a product turning on a plinth and a starburst price.
  picShop(g, S, t) {
    const W = TV.W, H = TV.H, lux = S.name.startsWith('AUREUM');
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, lux ? '#1a1406' : '#2a0a3a'); bg.addColorStop(1, lux ? '#6a5418' : '#0a5a6a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = lux ? '#c9a443' : '#ff6ad5'; g.fillRect(0, H - 34, W, 34);
    // The host: a big grin and a jacket.
    g.fillStyle = '#e0b89a'; g.beginPath(); g.arc(70, 92, 18, 0, TAU); g.fill();
    g.fillStyle = '#2a2a2a'; g.fillRect(52, 70, 36, 8);
    g.fillStyle = '#fff'; g.fillRect(62, 98, 16, 4);
    g.fillStyle = lux ? '#141210' : '#c84a8a'; g.fillRect(46, 110, 48, 50);
    // The product: a box spinning on a plinth.
    const a = t * 1.5, cx = 180, cy = 108, w = 30 * Math.abs(Math.cos(a)) + 6;
    g.fillStyle = '#444'; g.fillRect(cx - 24, cy + 22, 48, 26);
    g.fillStyle = '#4a5a2a'; g.fillRect(cx - w / 2, cy - 14, w, 34);
    g.fillStyle = '#d8c060'; g.fillRect(cx - w / 2, cy - 4, w, 4);
    // Starburst price.
    g.save(); g.translate(206, 66); g.rotate(Math.sin(t * 3) * 0.15);
    g.fillStyle = '#ffd23f'; g.beginPath();
    for (let i = 0; i < 24; i++) { const r = i % 2 ? 14 : 24, an = (i / 24) * TAU; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    g.fill(); g.fillStyle = '#c8141a'; g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.fillText('CALL', 0, -1); g.fillText('NOW!', 0, 9);
    g.restore();
    TV.title(g, S.name, 44, 18, '#fff');
  },

  // The news: a desk, an anchor, a BREAKING bar and a ticker.
  picNews(g, S, t) {
    const W = TV.W, H = TV.H;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1a3a'); bg.addColorStop(1, '#03060f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,140,255,0.25)';
    for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * 0.6); g.stroke(); }
    g.fillStyle = '#c48a64'; g.beginPath(); g.arc(W / 2, 84, 17, 0, TAU); g.fill(); // anchor
    g.fillStyle = '#1a1a2a'; g.fillRect(W / 2 - 26, 102, 52, 40);
    g.fillStyle = '#d8d4cc'; g.fillRect(W / 2 - 4, 104, 8, 18);
    g.fillStyle = '#2a3a6a'; g.fillRect(30, 128, W - 60, 30); // desk
    g.fillStyle = '#c8141a'; g.fillRect(0, 108, W, 14); // above the caption
    g.fillStyle = '#fff'; g.font = 'bold 10px monospace'; g.textAlign = 'left';
    g.fillText(' BREAKING · TROUBLE IN THE CELL BLOCK · REMAIN IN YOUR CELLS · '.repeat(2).slice(Math.floor(t * 6) % 62), 0, 118);
    TV.title(g, S.name, 46, 16, '#f4f0e6');
  },

  // The test card: colour bars, a tone you can almost hear, PLEASE STAND BY.
  picBars(g, S, t) {
    const W = TV.W, H = TV.H, cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * W) / 7, 0, W / 7 + 1, H * 0.66); });
    ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'].forEach((c, i) => { g.fillStyle = c; g.fillRect((i * W) / 7, H * 0.66, W / 7 + 1, H * 0.08); });
    g.fillStyle = '#101010'; g.fillRect(0, H * 0.74, W, H * 0.26);
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(28, 46, W - 56, 40);
    TV.title(g, 'PLEASE STAND BY', 72, 20, Math.floor(t * 1.5) % 2 ? '#fff' : '#ffd23f');
  },

  // Everything else on the wall.
  picFiller(g, S, t) {
    const W = TV.W, H = TV.H;
    if (S.f === 'static') { TV.snow(g, 0.85); return; }
    if (S.f === 'ad') { // a sponsor's spot: the name, the slogan, a slow zoom
      const [name, slogan, fg, bg] = S.ad;
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const z = 1 + (t % 6) * 0.03;
      g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
      g.strokeStyle = fg; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H * 0.4, 30, 0, TAU); g.stroke();
      TV.title(g, name, H * 0.44 + 6, 20, fg, 'rgba(0,0,0,0.4)');
      g.restore();
      TV.title(g, slogan, H * 0.78, 14, fg, 'rgba(0,0,0,0.4)');
      return;
    }
    if (S.f === 'warden') { // the warden's address: a silhouette at a podium and the slogan
      g.fillStyle = '#1a1c22'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#5a1a14'; g.fillRect(W * 0.3, 0, W * 0.4, H);
      g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(W / 2, H * 0.42, 20, 0, TAU); g.fill();
      g.fillRect(W / 2 - 34, H * 0.52, 68, 60);
      g.fillStyle = '#3a3a40'; g.fillRect(W / 2 - 44, H * 0.7, 88, 50);
      TV.title(g, ['WORK. OBEY. RACE.', 'THE WARDEN KEEPS YOU SAFE', 'ORDER WILL BE KEPT'][S.h % 3], 26, 14, '#e8e2c8');
      return;
    }
    if (S.f === 'ident') { // the channel's ident: C9TV spinning
      g.fillStyle = '#06080e'; g.fillRect(0, 0, W, H);
      const a = t * 1.2, w = Math.abs(Math.cos(a));
      g.save(); g.translate(W / 2, H / 2); g.scale(Math.max(0.08, w), 1);
      g.fillStyle = '#c8141a'; g.fillRect(-60, -34, 120, 68);
      g.fillStyle = '#fff'; g.font = 'bold 34px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('C9TV', 0, 12);
      g.restore();
      TV.title(g, 'DERBY XLI · LIVE ALL NIGHT', H - 18, 12, '#e8e2c8');
      return;
    }
    if (S.f === 'toll') { // the season's death toll, ticking
      g.fillStyle = '#0a0404'; g.fillRect(0, 0, W, H);
      TV.title(g, 'DERBY XLI', 40, 16, '#ff5a3a');
      TV.title(g, String(300 + (S.h % 40) + Math.floor(t / 7)).padStart(4, '0'), H * 0.62, 46, '#ff3b1f');
      TV.title(g, 'AND COUNTING', H - 22, 12, '#e8e2c8');
      return;
    }
    // weather: the forecast map
    g.fillStyle = '#0a2a4a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2a4a2a'; g.beginPath(); g.ellipse(W * 0.5, H * 0.56, 90, 56, 0.2, 0, TAU); g.fill();
    g.fillStyle = '#d8d4cc';
    for (let i = 0; i < 3; i++) { const x = (W * (0.2 + i * 0.3) + t * 8) % W; g.beginPath(); g.arc(x, H * 0.45, 12, 0, TAU); g.arc(x + 12, H * 0.42, 14, 0, TAU); g.fill(); }
    TV.title(g, 'ACID DRIP ADVISORY', 26, 13, '#ffd23f');
  },

  // The pirate signal: mostly snow, a crate and a hand-held message flickering through.
  picPirate(g, S, t) {
    TV.snow(g, 0.6);
    const on = Math.sin(t * 2.3) > -0.2;
    if (on) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(40, 50, TV.W - 80, 90);
      g.fillStyle = '#8a6a42'; g.fillRect(TV.W / 2 - 22, 92, 44, 30);
      g.strokeStyle = '#3a2a1a'; g.strokeRect(TV.W / 2 - 22, 92, 44, 30);
      TV.title(g, S.name, 76, 16, '#7CFC00');
    }
  },
};
