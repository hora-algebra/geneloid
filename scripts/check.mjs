import { deepClone, defaultConfig } from "../src/sim/config.js";
import { Simulation } from "../src/sim/core.js";

const simulation = new Simulation(deepClone(defaultConfig));

for (let step = 0; step < 2400; step += 1) {
  simulation.step(1 / 60);
}

const stats = simulation.stats();
const drift = Math.abs(stats.drift);

if (!Number.isFinite(stats.totalMaterial) || drift > 1e-6) {
  console.error("Material conservation failed.", stats);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      living: stats.living,
      lineages: stats.lineages,
      births: stats.births,
      deaths: stats.deaths,
      totalMaterial: stats.totalMaterial,
      drift: stats.drift
    },
    null,
    2
  )
);
