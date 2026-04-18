import { clampConfig, deepClone, defaultConfig } from "../src/sim/config.js";
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

function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeed(seed, task) {
  const originalRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    return task();
  } finally {
    Math.random = originalRandom;
  }
}

function entropyFromCounts(counts) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || counts.length <= 1) {
    return 0;
  }

  let entropy = 0;
  for (const count of counts) {
    if (count <= 0) {
      continue;
    }
    const p = count / total;
    entropy -= p * Math.log(p);
  }
  return entropy / Math.log(counts.length);
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values, average = mean(values)) {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function saturate(value, target) {
  if (target <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / target));
}

function distributionDelta(currentCounts, previousCounts) {
  if (!previousCounts) {
    return 0;
  }

  const totalCurrent = [...currentCounts.values()].reduce((sum, value) => sum + value, 0);
  const totalPrevious = [...previousCounts.values()].reduce((sum, value) => sum + value, 0);
  if (totalCurrent <= 0 || totalPrevious <= 0) {
    return 0;
  }

  const allKeys = new Set([...currentCounts.keys(), ...previousCounts.keys()]);
  let delta = 0;
  for (const key of allKeys) {
    const currentShare = (currentCounts.get(key) ?? 0) / totalCurrent;
    const previousShare = (previousCounts.get(key) ?? 0) / totalPrevious;
    delta += Math.abs(currentShare - previousShare);
  }
  return delta * 0.5;
}

function collectMetrics(simulation, previousSample = null, sampleSeconds = 1) {
  const lineageCounts = new Map();
  const speciesCounts = new Map();
  let living = 0;
  let totalSpeed = 0;

  for (const organism of simulation.organisms) {
    if (!organism.alive) {
      continue;
    }
    living += 1;
    totalSpeed += Math.hypot(organism.vx, organism.vy);
    lineageCounts.set(
      organism.lineageId,
      (lineageCounts.get(organism.lineageId) ?? 0) + 1
    );
    speciesCounts.set(
      organism.speciesIndex,
      (speciesCounts.get(organism.speciesIndex) ?? 0) + 1
    );
  }

  const lineageValues = [...lineageCounts.values()];
  const speciesValues = [...speciesCounts.values()];
  let dominantLineageId = null;
  let dominantLineageShare = 0;
  for (const [lineageId, count] of lineageCounts) {
    if (count > dominantLineageShare) {
      dominantLineageShare = count;
      dominantLineageId = lineageId;
    }
  }
  dominantLineageShare = living > 0 ? dominantLineageShare / living : 0;

  const birthDelta = simulation.births - (previousSample?.births ?? 0);
  const deathDelta = simulation.deaths - (previousSample?.deaths ?? 0);
  const killDelta = simulation.kills - (previousSample?.kills ?? 0);
  const speciationDelta = simulation.speciations - (previousSample?.speciations ?? 0);

  return {
    living,
    lineages: lineageCounts.size,
    species: speciesCounts.size,
    lineageEntropy: entropyFromCounts(lineageValues),
    speciesEntropy: entropyFromCounts(speciesValues),
    avgSpeed: living > 0 ? totalSpeed / living : 0,
    eventRate: sampleSeconds > 0 ? (birthDelta + deathDelta) / sampleSeconds : 0,
    killRate: sampleSeconds > 0 ? killDelta / sampleSeconds : 0,
    speciationRate: sampleSeconds > 0 ? speciationDelta / sampleSeconds : 0,
    dominantLineageId,
    dominantLineageShare,
    compositionDelta: distributionDelta(lineageCounts, previousSample?.lineageCounts ?? null),
    lineageCounts,
    speciesCounts,
    births: simulation.births,
    deaths: simulation.deaths,
    kills: simulation.kills,
    speciations: simulation.speciations
  };
}

function updatePersistence(map, counts) {
  for (const [key, count] of counts) {
    const entry = map.get(key) ?? { samples: 0, countSum: 0 };
    entry.samples += 1;
    entry.countSum += count;
    map.set(key, entry);
  }
}

function weightedPersistence(persistenceMap, totalSamples) {
  if (totalSamples <= 0 || persistenceMap.size === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const entry of persistenceMap.values()) {
    const weight = Math.sqrt(entry.countSum);
    weightedSum += (entry.samples / totalSamples) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function persistentCount(persistenceMap, totalSamples, threshold = 0.35) {
  if (totalSamples <= 0) {
    return 0;
  }
  let count = 0;
  for (const entry of persistenceMap.values()) {
    if (entry.samples / totalSamples >= threshold) {
      count += 1;
    }
  }
  return count;
}

function createAggregate() {
  return {
    runs: 0,
    collapseRuns: 0,
    avgLineages: [],
    tailLineages: [],
    avgSpecies: [],
    tailSpecies: [],
    avgLineageEntropy: [],
    tailLineageEntropy: [],
    avgSpeciesEntropy: [],
    tailSpeciesEntropy: [],
    lineagePersistence: [],
    speciesPersistence: [],
    persistentLineages: [],
    avgEventRate: [],
    avgKillRate: [],
    avgSpeciationRate: [],
    tailSpeciationRate: [],
    avgCompositionDelta: [],
    dominantSwitchRate: [],
    avgSpeed: [],
    tailSpeed: [],
    finalLiving: []
  };
}

function addRunSummary(aggregate, summary) {
  aggregate.runs += 1;
  aggregate.collapseRuns += summary.collapsed ? 1 : 0;
  aggregate.avgLineages.push(summary.avgLineages);
  aggregate.tailLineages.push(summary.tailLineages);
  aggregate.avgSpecies.push(summary.avgSpecies);
  aggregate.tailSpecies.push(summary.tailSpecies);
  aggregate.avgLineageEntropy.push(summary.avgLineageEntropy);
  aggregate.tailLineageEntropy.push(summary.tailLineageEntropy);
  aggregate.avgSpeciesEntropy.push(summary.avgSpeciesEntropy);
  aggregate.tailSpeciesEntropy.push(summary.tailSpeciesEntropy);
  aggregate.lineagePersistence.push(summary.lineagePersistence);
  aggregate.speciesPersistence.push(summary.speciesPersistence);
  aggregate.persistentLineages.push(summary.persistentLineages);
  aggregate.avgEventRate.push(summary.avgEventRate);
  aggregate.avgKillRate.push(summary.avgKillRate);
  aggregate.avgSpeciationRate.push(summary.avgSpeciationRate);
  aggregate.tailSpeciationRate.push(summary.tailSpeciationRate);
  aggregate.avgCompositionDelta.push(summary.avgCompositionDelta);
  aggregate.dominantSwitchRate.push(summary.dominantSwitchRate);
  aggregate.avgSpeed.push(summary.avgSpeed);
  aggregate.tailSpeed.push(summary.tailSpeed);
  aggregate.finalLiving.push(summary.finalLiving);
}

function finalizeAggregate(aggregate, initialOrganisms) {
  const collapseRate = aggregate.collapseRuns / Math.max(1, aggregate.runs);
  const avgLineages = mean(aggregate.avgLineages);
  const tailLineages = mean(aggregate.tailLineages);
  const avgSpecies = mean(aggregate.avgSpecies);
  const tailSpecies = mean(aggregate.tailSpecies);
  const avgLineageEntropy = mean(aggregate.avgLineageEntropy);
  const tailLineageEntropy = mean(aggregate.tailLineageEntropy);
  const avgSpeciesEntropy = mean(aggregate.avgSpeciesEntropy);
  const tailSpeciesEntropy = mean(aggregate.tailSpeciesEntropy);
  const lineagePersistence = mean(aggregate.lineagePersistence);
  const speciesPersistence = mean(aggregate.speciesPersistence);
  const avgPersistentLineages = mean(aggregate.persistentLineages);
  const avgEventRate = mean(aggregate.avgEventRate);
  const avgKillRate = mean(aggregate.avgKillRate);
  const avgSpeciationRate = mean(aggregate.avgSpeciationRate);
  const tailSpeciationRate = mean(aggregate.tailSpeciationRate);
  const avgCompositionDelta = mean(aggregate.avgCompositionDelta);
  const dominantSwitchRate = mean(aggregate.dominantSwitchRate);
  const avgSpeed = mean(aggregate.avgSpeed);
  const tailSpeed = mean(aggregate.tailSpeed);

  const score =
    avgLineageEntropy * 0.17 +
    tailLineageEntropy * 0.15 +
    avgSpeciesEntropy * 0.1 +
    tailSpeciesEntropy * 0.08 +
    (avgLineages / initialOrganisms) * 0.07 +
    (tailLineages / initialOrganisms) * 0.05 +
    lineagePersistence * 0.14 +
    speciesPersistence * 0.08 +
    saturate(avgPersistentLineages, 18) * 0.06 +
    saturate(avgEventRate, 18) * 0.05 +
    saturate(avgSpeciationRate, 0.5) * 0.04 +
    saturate(tailSpeciationRate, 0.35) * 0.02 +
    saturate(avgCompositionDelta, 0.24) * 0.03 +
    saturate(dominantSwitchRate, 0.1) * 0.02 +
    saturate(avgSpeed, 10) * 0.02 +
    saturate(tailSpeed, 10) * 0.02 -
    collapseRate * 0.2;

  return {
    runs: aggregate.runs,
    score,
    collapseRate,
    avgLineages,
    tailLineages,
    avgSpecies,
    tailSpecies,
    avgLineageEntropy,
    tailLineageEntropy,
    avgSpeciesEntropy,
    tailSpeciesEntropy,
    lineagePersistence,
    speciesPersistence,
    avgPersistentLineages,
    avgEventRate,
    avgKillRate,
    avgSpeciationRate,
    tailSpeciationRate,
    avgCompositionDelta,
    dominantSwitchRate,
    avgSpeed,
    tailSpeed,
    finalLiving: mean(aggregate.finalLiving),
    lineagesStd: stddev(aggregate.avgLineages),
    eventStd: stddev(aggregate.avgEventRate)
  };
}

function runCandidate(candidate, options) {
  const config = clampConfig(mergeConfig(defaultConfig, candidate.override));
  const initialOrganisms = config.world.initialOrganisms;
  const aggregate = createAggregate();
  const tailStartFrame = Math.floor(options.frames * 0.55);
  const sampleSeconds = options.sampleEvery / 60;

  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    const seed = options.seedOffset + candidate.seedBias * 1000 + runIndex;
    const summary = withSeed(seed, () => {
      const simulation = new Simulation(config);
      const samples = [];
      const tailSamples = [];
      const lineagePersistenceMap = new Map();
      const speciesPersistenceMap = new Map();
      let previousSample = null;
      let dominantSwitches = 0;

      for (let frame = 0; frame < options.frames; frame += 1) {
        simulation.step(1 / 60);
        if ((frame + 1) % options.sampleEvery !== 0) {
          continue;
        }

        const metrics = collectMetrics(simulation, previousSample, sampleSeconds);
        samples.push(metrics);
        updatePersistence(lineagePersistenceMap, metrics.lineageCounts);
        updatePersistence(speciesPersistenceMap, metrics.speciesCounts);
        if (
          previousSample &&
          previousSample.dominantLineageId !== null &&
          metrics.dominantLineageId !== null &&
          previousSample.dominantLineageId !== metrics.dominantLineageId
        ) {
          dominantSwitches += 1;
        }
        if (frame + 1 >= tailStartFrame) {
          tailSamples.push(metrics);
        }
        previousSample = metrics;
      }

      const safeTailSamples = tailSamples.length ? tailSamples : samples;
      const finalMetrics = samples.at(-1) ?? collectMetrics(simulation, previousSample, sampleSeconds);
      const collapsed =
        finalMetrics.living < Math.max(18, initialOrganisms * 0.12) ||
        finalMetrics.lineages < Math.max(10, initialOrganisms * 0.06) ||
        mean(safeTailSamples.map((sample) => sample.lineageEntropy)) < 0.72;

      return {
        avgLineages: mean(samples.map((sample) => sample.lineages)),
        tailLineages: mean(safeTailSamples.map((sample) => sample.lineages)),
        avgSpecies: mean(samples.map((sample) => sample.species)),
        tailSpecies: mean(safeTailSamples.map((sample) => sample.species)),
        avgLineageEntropy: mean(samples.map((sample) => sample.lineageEntropy)),
        tailLineageEntropy: mean(safeTailSamples.map((sample) => sample.lineageEntropy)),
        avgSpeciesEntropy: mean(samples.map((sample) => sample.speciesEntropy)),
        tailSpeciesEntropy: mean(safeTailSamples.map((sample) => sample.speciesEntropy)),
        lineagePersistence: weightedPersistence(lineagePersistenceMap, samples.length),
        speciesPersistence: weightedPersistence(speciesPersistenceMap, samples.length),
        persistentLineages: persistentCount(lineagePersistenceMap, samples.length),
        avgEventRate: mean(samples.map((sample) => sample.eventRate)),
        avgKillRate: mean(samples.map((sample) => sample.killRate)),
        avgSpeciationRate: mean(samples.map((sample) => sample.speciationRate)),
        tailSpeciationRate: mean(safeTailSamples.map((sample) => sample.speciationRate)),
        avgCompositionDelta: mean(samples.map((sample) => sample.compositionDelta)),
        dominantSwitchRate:
          samples.length > 1 ? dominantSwitches / (samples.length - 1) : 0,
        avgSpeed: mean(samples.map((sample) => sample.avgSpeed)),
        tailSpeed: mean(safeTailSamples.map((sample) => sample.avgSpeed)),
        finalLiving: finalMetrics.living,
        collapsed
      };
    });

    addRunSummary(aggregate, summary);
  }

  return {
    name: candidate.name,
    config,
    ...finalizeAggregate(aggregate, initialOrganisms)
  };
}

function formatRatio(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printStage(title, results) {
  console.log(`\n${title}`);
  console.log(
    "name".padEnd(16),
    "score".padStart(7),
    "tailH".padStart(7),
    "persist".padStart(8),
    "event".padStart(7),
    "spec".padStart(7),
    "delta".padStart(7),
    "switch".padStart(8),
    "coll".padStart(8)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(16),
      result.score.toFixed(3).padStart(7),
      result.tailLineageEntropy.toFixed(3).padStart(7),
      formatRatio(result.lineagePersistence).padStart(8),
      result.avgEventRate.toFixed(2).padStart(7),
      result.avgSpeciationRate.toFixed(2).padStart(7),
      result.avgCompositionDelta.toFixed(3).padStart(7),
      formatRatio(result.dominantSwitchRate).padStart(8),
      formatRatio(result.collapseRate).padStart(8)
    );
  }
}

const candidates = [
  {
    name: "baseline",
    seedBias: 1,
    override: {}
  },
  {
    name: "soft-branch",
    seedBias: 2,
    override: {
      organisms: {
        minBirthThresholdMass: 44
      },
      economy: {
        corpseLootFraction: 0.18,
        resourceLifetime: 22
      },
      combat: {
        attackScale: 0.3,
        contactDamageRate: 0.76,
        rangedDamageScale: 0.67,
        shieldBlockFraction: 0.85
      },
      mutation: {
        slotTypeChance: 0.058,
        allocationJitter: 0.23,
        traitJitter: 0.16,
        speciationChance: 0.004,
        speciationDriftFactor: 0.18,
        speciesShiftSpeciationBonus: 0.09
      },
      springs: {
        interval: 0.34,
        pauseNearbyMass: 66
      }
    }
  },
  {
    name: "shift-bloom",
    seedBias: 3,
    override: {
      organisms: {
        minBirthThresholdMass: 44
      },
      economy: {
        corpseLootFraction: 0.18,
        resourceLifetime: 19
      },
      combat: {
        attackScale: 0.31,
        contactDamageRate: 0.78,
        rangedDamageScale: 0.68,
        shieldBlockFraction: 0.84
      },
      mutation: {
        slotCountChance: 0.032,
        slotTypeChance: 0.064,
        allocationJitter: 0.23,
        traitJitter: 0.18,
        speciationChance: 0.003,
        speciationDriftFactor: 0.14,
        speciesShiftSpeciationBonus: 0.22
      },
      springs: {
        packetMass: 3.3,
        interval: 0.3,
        pauseNearbyMass: 60
      }
    }
  },
  {
    name: "drift-weave",
    seedBias: 4,
    override: {
      organisms: {
        minBirthThresholdMass: 45
      },
      economy: {
        corpseLootFraction: 0.2,
        resourceLifetime: 18
      },
      combat: {
        attackScale: 0.31,
        contactDamageRate: 0.79,
        rangedDamageScale: 0.69,
        shieldBlockFraction: 0.84
      },
      mutation: {
        slotCountChance: 0.034,
        slotTypeChance: 0.066,
        allocationJitter: 0.24,
        traitJitter: 0.19,
        hueJitter: 12,
        speciationChance: 0.007,
        speciationDriftFactor: 0.28,
        speciesShiftSpeciationBonus: 0.08
      },
      springs: {
        packetMass: 3.2,
        interval: 0.3,
        scatter: 144,
        pauseNearbyMass: 62
      }
    }
  },
  {
    name: "durable-branch",
    seedBias: 5,
    override: {
      organisms: {
        baseLifespan: 144,
        lifespanSpread: 0.23,
        minBirthThresholdMass: 46
      },
      economy: {
        corpseLootFraction: 0.18,
        resourceLifetime: 22
      },
      combat: {
        attackScale: 0.3,
        contactDamageRate: 0.75,
        rangedDamageScale: 0.67,
        shieldBlockFraction: 0.85
      },
      mutation: {
        slotTypeChance: 0.058,
        allocationJitter: 0.22,
        traitJitter: 0.16,
        speciationChance: 0.005,
        speciationDriftFactor: 0.2,
        speciesShiftSpeciationBonus: 0.1
      },
      springs: {
        packetMass: 3.3,
        interval: 0.36,
        scatter: 140,
        pauseNearbyMass: 70
      }
    }
  },
  {
    name: "spec-rich",
    seedBias: 6,
    override: {
      organisms: {
        minBirthThresholdMass: 45
      },
      economy: {
        corpseLootFraction: 0.2,
        resourceLifetime: 17
      },
      combat: {
        attackScale: 0.32,
        contactDamageRate: 0.8,
        rangedDamageScale: 0.71,
        shieldBlockFraction: 0.84,
        lootEfficiency: 0.92
      },
      mutation: {
        slotCountChance: 0.036,
        slotTypeChance: 0.07,
        allocationJitter: 0.25,
        traitJitter: 0.2,
        speciationChance: 0.009,
        speciationDriftFactor: 0.3,
        speciesShiftSpeciationBonus: 0.16
      },
      springs: {
        packetMass: 3.5,
        interval: 0.29,
        pauseNearbyMass: 60
      }
    }
  },
  {
    name: "calm-weave",
    seedBias: 7,
    override: {
      organisms: {
        baseLifespan: 138,
        lifespanSpread: 0.22,
        minBirthThresholdMass: 45
      },
      economy: {
        corpseLootFraction: 0.18,
        resourceLifetime: 24
      },
      combat: {
        attackScale: 0.29,
        contactDamageRate: 0.74,
        rangedDamageScale: 0.66,
        shieldBlockFraction: 0.86,
        lootEfficiency: 0.9
      },
      mutation: {
        slotTypeChance: 0.056,
        allocationJitter: 0.22,
        traitJitter: 0.16,
        speciationChance: 0.004,
        speciationDriftFactor: 0.17,
        speciesShiftSpeciationBonus: 0.12
      },
      springs: {
        packetMass: 3.3,
        interval: 0.36,
        pauseNearbyMass: 68
      }
    }
  }
];

const stage1 = candidates
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 6,
      frames: 2400,
      sampleEvery: 120,
      seedOffset: 10000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 1 - ecosystem balance", stage1);

const finalists = stage1.slice(0, 3).map((result, index) => ({
  name: result.name,
  seedBias: 40 + index,
  override: candidates.find((candidate) => candidate.name === result.name)?.override ?? {}
}));

const stage2 = finalists
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 8,
      frames: 3600,
      sampleEvery: 150,
      seedOffset: 50000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 2 - confirmation", stage2);

console.log("\nChosen override:");
console.log(
  JSON.stringify(
    candidates.find((candidate) => candidate.name === stage2[0]?.name)?.override ?? {},
    null,
    2
  )
);
