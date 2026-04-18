import { deepClone, defaultConfig } from "../src/sim/config.js";
import { Simulation } from "../src/sim/core.js";

function mergeConfig(base, override) {
  const next = deepClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      next[key] = mergeConfig(next[key] ?? {}, value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function formatMs(value) {
  return `${value.toFixed(3)} ms`;
}

function runScenario(name, override = {}, frames = 900, statsEvery = 15) {
  const config = mergeConfig(defaultConfig, override);
  const simulation = new Simulation(config);
  simulation.profileEnabled = true;
  simulation.resetProfile();

  for (let frame = 0; frame < frames; frame += 1) {
    simulation.step(1 / 60);
    if (frame % statsEvery === 0) {
      simulation.stats();
    }
  }

  const profile = simulation.profile;
  const avgStepMs = profile.stepMs / Math.max(1, profile.frames);
  const avgStatsMs = profile.statsMs / Math.max(1, Math.ceil(frames / statsEvery));
  const phaseSummary = Object.fromEntries(
    Object.entries(profile.totals)
      .sort((left, right) => right[1] - left[1])
      .map(([key, total]) => [key, total / Math.max(1, profile.frames)])
  );

  return {
    name,
    organisms: profile.organisms,
    resources: profile.resources,
    avgStepMs,
    avgStatsMs,
    phases: phaseSummary
  };
}

const scenarios = [
  ["default", {}],
  [
    "dense",
    {
      world: {
        initialOrganisms: 110,
        resourceNodeCap: 520
      }
    }
  ]
];

for (const [name, override] of scenarios) {
  const result = runScenario(name, override);
  console.log(`\n[${result.name}] organisms=${result.organisms} resources=${result.resources}`);
  console.log(`step: ${formatMs(result.avgStepMs)}  stats: ${formatMs(result.avgStatsMs)}`);
  for (const [phase, avgMs] of Object.entries(result.phases)) {
    console.log(`  ${phase.padEnd(12)} ${formatMs(avgMs)}`);
  }
}
