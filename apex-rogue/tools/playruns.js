// Bot playtest: plays N full runs through the real game (tools/playbot.js is the player) and writes OUT.json with
// every race (place, damage, hull, rack, scrap, strikes), the rewards and shop buys, plus a few cockpit snapshots.
// Usage: node tools/playruns.js [runs=3] [out=runs]   (needs Playwright with Chromium; set PLAYWRIGHT to its path)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const N = +(process.argv[2] || 3), OUT = process.argv[3] || 'runs';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + require('path').resolve(__dirname, '../prototype.html') + '?nointro', { timeout: 180000 }); await p.waitForTimeout(2000);
  await p.addScriptTag({ path: __dirname + '/playbot.js' });
  await p.evaluate(() => { Proto.frame = () => {}; Proto.cockpit && Proto.cockpit.resize(960, 540); localStorage.removeItem('apexrogue_run_v1'); });
  const t0 = Date.now();
  for (let r = 0; r < N; r++) {
    await p.evaluate(() => Bot.startRun());
    let st = 'running', last = '';
    const tr = Date.now();
    while (st === 'running' && Date.now() - tr < 40 * 60000) {
      st = await p.evaluate(() => Bot.step(3000));
      const prog = await p.evaluate(() => { const r = Bot.run; return `run ${Bot.log.runs.length}: act ${Proto.run ? Proto.run.act + 1 : '?'}, ${r.races.length} races, strikes ${Proto.build ? Proto.build.strikes : '?'}, state ${Proto.state}`; });
      if (prog !== last) { console.log(((Date.now() - t0) / 60000).toFixed(1) + 'm ' + prog); last = prog; }
    }
    console.log('run', r + 1, 'ended:', st);
    fs.writeFileSync(OUT + '.json', JSON.stringify(await p.evaluate(() => Bot.log), null, 1));
    if (st !== 'over') break;
  }
  const pics = await p.evaluate(() => Bot.pics);
  pics.forEach((u, k) => fs.writeFileSync(`${OUT}_pic${k}.jpg`, Buffer.from(u.split(',')[1], 'base64')));
  fs.writeFileSync(OUT + '_errors.json', JSON.stringify(errs, null, 1));
  console.log('done; page errors:', errs.length); await b.close();
})();
