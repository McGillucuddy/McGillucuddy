'use strict';
// The season tape: when a run ends, win or lose, the broadcast's own recap on a worn VHS cassette. Every race is an
// episode (where you finished, the big moments the broadcast cut to), then the car, your drivers and the dead.

const SeasonTape = {
  // After each race (Proto.showResults): one episode.
  record(run, b, race, combat, ok) {
    const p = race.player, T = run.flags.tape || (run.flags.tape = []);
    T.push({
      n: b.race + 1, act: run.act, place: p.dnf ? 0 : p.place, ok: !!ok, boss: race.boss ? race.boss.name : null,
      kills: race.cars.filter((c) => c !== p && c.downed && c.downed.how !== 'crowd').length,
      moments: [...new Set(combat.tape || [])].slice(0, 3),
      driver: combat.crew ? combat.crew.short : null, lost: !!combat.ownDriverDead,
    });
    if (T.length > 40) T.splice(0, T.length - 40);
  },

  html(run, b, cos, won) {
    const T = (run && run.flags && run.flags.tape) || [], esc = (s) => String(s).replace(/[<>&"]/g, '');
    const N = esc((cos && cos.inmate) || '4471'), car = CarHistory.of(b), lost = (run && run.flags.lostDrivers) || [];
    const ep = (e) => {
      const res = e.place ? ordinal(e.place) : 'wrecked';
      const tag = e.boss ? (e.ok ? `beat ${esc(e.boss)}` : `lost to ${esc(e.boss)}`) : e.ok ? 'made the cut' : 'strike';
      return `<li><span class="tape-ep">EP ${e.n}</span><span class="tape-act">${ROMAN[e.act] || ''}</span>
        <b class="${e.ok ? 'good' : 'bad'}">${res}</b> <span class="muted">${tag}${e.kills ? ` · ${e.kills} down` : ''}${e.lost ? ` · ${esc(e.driver || 'driver')} killed` : ''}</span>
        ${e.moments.length ? `<div class="tape-moments">${e.moments.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}</li>`;
    };
    // Every driver who rode with you this run, and how close you got.
    const bond = Object.entries(b.bond || {}).filter(([, r]) => r.races).map(([k, r]) => {
      const [trait, gen] = k.split(':'), saved = Crew.gens;
      Crew.gens = Object.assign({}, saved, { [trait]: +gen });
      const who = Crew.id(trait);
      Crew.gens = saved;
      const dead = lost.includes(who.nick.toUpperCase() + ' ' + who.last.toUpperCase());
      return `<li>${dead ? '✝ ' : ''}<b>${esc(who.name)}</b> <span class="muted">${BOND_LEVELS[Bond.level(r.xp)].name} · ${r.races} race${r.races === 1 ? '' : 's'} · ${r.kills} kill${r.kills === 1 ? '' : 's'}${dead ? ' · died at the wheel' : ''}</span></li>`;
    }).join('');
    const label = `${won ? 'FINAL' : 'CANCELLED'} · INMATE ${N}`;
    return `<div class="season-tape">
      <div class="tape-label"><span class="tape-brand">C9TV</span><span class="tape-title">DEATH ROW DERBY<br><small>${label}</small></span><span class="tape-car">"${esc(car.name).toUpperCase()}"</span></div>
      <div class="tape-screen">
        <div class="tape-osd"><span>▶ PLAY</span><span>SP ${String(T.length).padStart(2, '0')}:00</span></div>
        <h3>The season of ${N}${won ? ': walked free' : ': back to the cell'}</h3>
        <ol class="tape-eps">${T.map(ep).join('') || '<li class="muted">Nothing on the tape.</li>'}</ol>
        <div class="tape-cols">
          <div><h4>The car</h4><p>${esc(car.name)} · ${car.kills.length} kill mark${car.kills.length === 1 ? '' : 's'}${car.trophies.length ? ` · trophies: ${car.trophies.map((a) => esc(BOSSES[a] ? BOSSES[a].name : '?')).join(', ')}` : ''}</p>
            <p class="muted">${b.infamy || 0} Infamy earned · ${b.wins} win${b.wins === 1 ? '' : 's'} in ${b.race} race${b.race === 1 ? '' : 's'}</p></div>
          <div><h4>Who drove</h4><ul class="tape-crew">${bond || '<li class="muted">Nobody lasted a race.</li>'}</ul></div>
        </div>
      </div>
    </div>`;
  },
};
