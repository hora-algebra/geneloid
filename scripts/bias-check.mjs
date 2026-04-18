import { deepClone, defaultConfig } from "../src/sim/config.js";
import { Simulation } from "../src/sim/core.js";

function torusDelta(fromValue, toValue, size) {
  let delta = toValue - fromValue;
  if (delta > size * 0.5) {
    delta -= size;
  } else if (delta < -size * 0.5) {
    delta += size;
  }
  return delta;
}

function organismMaterial(simulation) {
  return simulation.organisms.reduce(
    (total, organism) =>
      total +
      organism.coreMass +
      organism.motorMass +
      organism.slotMasses.reduce((sum, mass) => sum + mass, 0),
    0
  );
}

function buildIsolatedConfig() {
  const config = deepClone(defaultConfig);
  config.world.width = 1200;
  config.world.height = 800;
  config.world.initialOrganisms = 1;
  config.world.initialOrganismMass = 22;
  config.world.totalMaterial = 40;
  config.organisms.baseLifespan = 10000;
  config.organisms.lifespanSpread = 0;
  config.economy.upkeepBase = 0;
  config.economy.upkeepMassFactor = 0;
  config.economy.gadgetMaintenanceFactor = 0;
  return config;
}

function buildPopulationConfig() {
  const config = deepClone(defaultConfig);
  config.organisms.baseLifespan = Math.max(config.organisms.baseLifespan, 260);
  return config;
}

function runIsolatedScenario(runs = 120, durationSeconds = 90, dt = 0.05) {
  let driftRateX = 0;
  let driftRateY = 0;
  let headingBiasX = 0;
  let headingBiasY = 0;

  for (let run = 0; run < runs; run += 1) {
    const simulation = new Simulation(buildIsolatedConfig());
    simulation.resources = [];
    simulation.resourceSpatialIndex = null;
    simulation.config.world.totalMaterial = organismMaterial(simulation);

    const organism = simulation.organisms[0];
    organism.age = 0;
    organism.lastDamagerId = null;

    let prevX = organism.x;
    let prevY = organism.y;
    let pathX = 0;
    let pathY = 0;
    let headingX = 0;
    let headingY = 0;
    let headingSamples = 0;

    const steps = Math.floor(durationSeconds / dt);
    for (let step = 0; step < steps; step += 1) {
      simulation.step(dt);
      const current = simulation.organisms[0];
      pathX += torusDelta(prevX, current.x, simulation.config.world.width);
      pathY += torusDelta(prevY, current.y, simulation.config.world.height);
      prevX = current.x;
      prevY = current.y;
      headingX += Math.cos(current.heading);
      headingY += Math.sin(current.heading);
      headingSamples += 1;
    }

    driftRateX += pathX / durationSeconds;
    driftRateY += pathY / durationSeconds;
    headingBiasX += headingX / headingSamples;
    headingBiasY += headingY / headingSamples;
  }

  return {
    runs,
    durationSeconds,
    meanDriftRateX: driftRateX / runs,
    meanDriftRateY: driftRateY / runs,
    meanHeadingX: headingBiasX / runs,
    meanHeadingY: headingBiasY / runs
  };
}

function runPopulationScenario(runs = 24, durationSeconds = 35, dt = 0.05) {
  let meanVelocityX = 0;
  let meanVelocityY = 0;
  let meanHeadingX = 0;
  let meanHeadingY = 0;
  let totalSamples = 0;

  for (let run = 0; run < runs; run += 1) {
    const simulation = new Simulation(buildPopulationConfig());
    const steps = Math.floor(durationSeconds / dt);

    for (let step = 0; step < steps; step += 1) {
      simulation.step(dt);
      const count = Math.max(1, simulation.organisms.length);
      const sample = simulation.organisms.reduce(
        (totals, organism) => {
          totals.vx += organism.vx;
          totals.vy += organism.vy;
          totals.hx += Math.cos(organism.heading);
          totals.hy += Math.sin(organism.heading);
          return totals;
        },
        { vx: 0, vy: 0, hx: 0, hy: 0 }
      );
      meanVelocityX += sample.vx / count;
      meanVelocityY += sample.vy / count;
      meanHeadingX += sample.hx / count;
      meanHeadingY += sample.hy / count;
      totalSamples += 1;
    }
  }

  return {
    runs,
    durationSeconds,
    meanVelocityX: meanVelocityX / totalSamples,
    meanVelocityY: meanVelocityY / totalSamples,
    meanHeadingX: meanHeadingX / totalSamples,
    meanHeadingY: meanHeadingY / totalSamples
  };
}

const isolated = runIsolatedScenario();
const population = runPopulationScenario();

console.log(
  JSON.stringify(
    {
      isolated,
      population
    },
    null,
    2
  )
);
