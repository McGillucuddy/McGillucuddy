'use strict';
// Race HUD drawn on the 2D canvas (shared by the game and the prototype).

function hudPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,10,20,0.6)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
}

function drawHUD(ctx, race, W, H, t, wrongWay) {
  const p = race.player;
  const n = race.cars.length;
  const compact = W < 700;
  ctx.textBaseline = 'alphabetic';

  // Position & lap
  hudPanel(ctx, 12, 12, 170, 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = p.place <= race.qualify ? '#7CFC00' : '#ff6b6b';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(ordinal(p.place), 24, 58);
  const posW = ctx.measureText(ordinal(p.place)).width;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`/ ${n}`, 24 + posW + 6, 58);
  ctx.fillStyle = '#fff';
  ctx.font = '15px system-ui, sans-serif';
  const lap = clamp(Math.floor(p.progress / race.track.N) + 1, 1, race.laps);
  ctx.fillText(`Lap ${p.finished ? race.laps : lap}/${race.laps}   ${fmtTime(p.finished ? p.finishTime : race.time)}`, 24, 92);

  // Standings
  if (!compact) {
    const list = race.ranking;
    hudPanel(ctx, 12, 116, 170, 12 + list.length * 18);
    ctx.font = '13px system-ui, sans-serif';
    list.forEach((c, i) => {
      const y = 133 + i * 18;
      ctx.fillStyle = c.color;
      ctx.fillRect(22, y - 9, 8, 8);
      ctx.fillStyle = c.isPlayer ? '#ffd23f' : i + 1 <= race.qualify ? '#fff' : 'rgba(255,255,255,0.55)';
      ctx.fillText(`${i + 1}. ${c.isPlayer ? 'YOU' : c.name.split(' ')[0]}${c.finished ? ' ✓' : ''}`, 36, y);
      if (i + 1 === race.qualify && i < list.length - 1) {
        ctx.strokeStyle = 'rgba(255,107,107,0.8)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(20, y + 5); ctx.lineTo(172, y + 5); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // Qualify banner
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const ok = p.place <= race.qualify;
  const txt = race.qualify === 1 ? 'WIN TO TAKE THE CHAMPIONSHIP' : `FINISH TOP ${race.qualify} TO ADVANCE`;
  const tw = ctx.measureText(txt).width + 24;
  ctx.fillStyle = ok ? 'rgba(40,140,60,0.75)' : 'rgba(170,40,40,0.75)';
  roundRect(ctx, W / 2 - tw / 2, 12, tw, 26, 13);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(txt, W / 2, 30);

  // Minimap
  const mm = race.track.minimap;
  const ms = compact ? 120 : 180;
  const mx = W - ms - 12, my = 12;
  hudPanel(ctx, mx, my, ms, ms);
  ctx.drawImage(mm.canvas, mx, my, ms, ms);
  const k = ms / mm.size;
  for (const c of race.cars) {
    const m = mm.map(c);
    ctx.fillStyle = c.isPlayer ? '#ffd23f' : c.color;
    ctx.beginPath();
    ctx.arc(mx + m.x * k, my + m.y * k, c.isPlayer ? 5 : 3.5, 0, TAU);
    ctx.fill();
    if (c.isPlayer) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  // Speed, HP, nitro
  const bx = 12, by = H - 96;
  hudPanel(ctx, bx, by, 240, 84);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  const kmh = Math.round(p.speed * 0.36);
  ctx.fillText(kmh, bx + 12, by + 40);
  const kmhW = ctx.measureText(String(kmh)).width;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('km/h', bx + 18 + kmhW, by + 40);
  const bar = (y, frac, col, label) => {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx + 12, y, 216, 10);
    ctx.fillStyle = col;
    ctx.fillRect(bx + 12, y, 216 * clamp(frac, 0, 1), 10);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, bx + 228, y - 2);
    ctx.textAlign = 'left';
  };
  const hpf = p.hp / p.stats.maxHp;
  bar(by + 56, hpf, hpf < 0.3 ? (Math.floor(t * 4) % 2 ? '#ff3030' : '#a01010') : '#4cd964', `HP ${Math.ceil(p.hp)}`);
  bar(by + 72, p.nitro / p.stats.nitroCap, p.nitroOn ? '#9ef' : '#2fa8ff', 'NITRO');

  // Countdown
  if (race.state === 'countdown') {
    const c = Math.ceil(race.countdown);
    if (c <= 3) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 120px system-ui, sans-serif';
      ctx.fillStyle = ['#7CFC00', '#ffd23f', '#ff9f1c', '#ff4040'][c];
      ctx.globalAlpha = 0.5 + 0.5 * (race.countdown % 1);
      ctx.fillText(c, W / 2, H / 2 - 40);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Hit the gas right on GO for a perfect launch', W / 2, H / 2 + 10);
  }

  // Messages
  ctx.textAlign = 'center';
  let my2 = H * 0.3;
  for (const m of race.messages) {
    const a = clamp(Math.min(m.t * 6, (m.life - m.t) * 3), 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `bold ${m.big ? 48 : 24}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(m.text, W / 2 + 2, my2 + 2);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, W / 2, my2);
    my2 += m.big ? 56 : 32;
  }
  ctx.globalAlpha = 1;

  if (wrongWay && Math.floor(t * 3) % 2) {
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillStyle = '#ff4040';
    ctx.fillText('WRONG WAY', W / 2, H * 0.62);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press R to reset', W / 2, H * 0.62 + 26);
  }
}
