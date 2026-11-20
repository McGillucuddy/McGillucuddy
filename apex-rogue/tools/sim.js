// Headless balance / sanity simulation: node tools/sim.js [races] [botSkill]
// Runs full races with a bot driving the player car and reports results.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['util.js', 'track.js', 'upgrades.js', 'car.js', 'ai.js', 'race.js', 'campaign.js'];
const src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n');
const ctx = vm.createContext({ console, Math, Object, Set, Float32Array, Date });
vm.runInContext(src + '\n;this.api = { generateTrack, Race, Car, AIDriver, computeStats, newRun, BIOMES, buildOpponents, mulberry32, RACE_PLAN };', ctx);
const api = ctx.api;

const races = +(process.argv[2] || 12);
const botSkill = +(process.argv[3] || 0.9);
const results = [];
for (let r = 0; r < races; r++) {
  const raceIndex = r % 8;
  const biome = Object.keys(api.BIOMES)[r % 4];
  const seed = 1000 + r * 7919;
  const t0 = Date.now();
  const track = api.generateTrack(seed, biome, { hazardLevel: 1 });
  const genMs = Date.now() - t0;
  const run = api.newRun('comet', seed);
  const stats = api.computeStats(run);
  stats.aLat = (1050 + 650 * (botSkill - 0.8)) * Math.sqrt(track.biome.grip);
  const player = new api.Car({ name: 'Player', color: '#f00', isPlayer: true, stats, perks: [] });
  const rng = api.mulberry32(seed);
  const plan = api.RACE_PLAN[raceIndex];
  const race = new api.Race({
    track, laps: 3, playerCar: player, rng, qualify: plan.qualify, headless: true,
    opponents: api.buildOpponents(rng, raceIndex, { aiBonus: 0 }, false),
  });
  const bot = new api.AIDriver(player, botSkill, rng);
  const dt = 1 / 60;
  let steps = 0;
  while (race.state !== 'done' && steps < 60 * 400) {
    const inp = race.state === 'racing' ? bot.update(race, dt) : { throttle: 0, brake: 0, steer: 0 };
    race.update(dt, inp);
    steps++;
  }
  const finished = race.cars.filter((c) => c.finished).length;
  const hits = race.cars.reduce((a, c) => a + c.wallHits, 0);
  results.push(player.place);
  console.log(`race ${r} idx${raceIndex} ${biome.padEnd(7)} len=${Math.round(track.length)} gen=${genMs}ms ` +
    `time=${race.time.toFixed(1)}s place=${player.place}/${race.cars.length} need<=${plan.qualify} ` +
    `finishedCars=${finished} wallHits=${hits} playerHp=${player.hp.toFixed(0)} oppHp=${race.cars.filter(c=>c.ai).map(c=>c.hp.toFixed(0)).join(',')}`);
}
console.log('avg place', (results.reduce((a, b) => a + b, 0) / results.length).toFixed(2));
