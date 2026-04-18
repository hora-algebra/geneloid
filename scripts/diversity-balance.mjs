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
  const speciationDelta = simulation.speciations - (previousSample?.speciations ?? 0);

  return {
    living,
    lineages: lineageCounts.size,
    species: speciesCounts.size,
    lineageEntropy: entropyFromCounts(lineageValues),
    speciesEntropy: entropyFromCounts(speciesValues),
    avgSpeed: living > 0 ? totalSpeed / living : 0,
    eventRate: sampleSeconds > 0 ? (birthDelta + deathDelta) / sampleSeconds : 0,
    speciationRate: sampleSeconds > 0 ? speciationDelta / sampleSeconds : 0,
    dominantLineageId,
    dominantLineageShare,
    compositionDelta: distributionDelta(lineageCounts, previousSample?.lineageCounts ?? null),
    lineageCounts,
    speciesCounts,
    births: simulation.births,
    deaths: simulation.deaths,
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
    avgSpeciationRate: [],
    tailSpeciationRate: [],
    avgDominantShare: [],
    tailDominantShare: [],
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
  aggregate.avgSpeciationRate.push(summary.avgSpeciationRate);
  aggregate.tailSpeciationRate.push(summary.tailSpeciationRate);
  aggregate.avgDominantShare.push(summary.avgDominantShare);
  aggregate.tailDominantShare.push(summary.tailDominantShare);
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
  const avgSpeciationRate = mean(aggregate.avgSpeciationRate);
  const tailSpeciationRate = mean(aggregate.tailSpeciationRate);
  const avgDominantShare = mean(aggregate.avgDominantShare);
  const tailDominantShare = mean(aggregate.tailDominantShare);
  const avgCompositionDelta = mean(aggregate.avgCompositionDelta);
  const dominantSwitchRate = mean(aggregate.dominantSwitchRate);
  const avgSpeed = mean(aggregate.avgSpeed);
  const tailSpeed = mean(aggregate.tailSpeed);

  const score =
    avgLineageEntropy * 0.13 +
    tailLineageEntropy * 0.18 +
    avgSpeciesEntropy * 0.05 +
    tailSpeciesEntropy * 0.08 +
    lineagePersistence * 0.11 +
    speciesPersistence * 0.06 +
    saturate(avgPersistentLineages, 22) * 0.05 +
    saturate(avgEventRate, 16) * 0.05 +
    saturate(avgSpeciationRate, 0.55) * 0.04 +
    saturate(tailSpeciationRate, 0.42) * 0.03 +
    saturate(avgCompositionDelta, 0.24) * 0.09 +
    saturate(dominantSwitchRate, 0.15) * 0.12 +
    (1 - saturate(avgDominantShare, 0.35)) * 0.03 +
    (1 - saturate(tailDominantShare, 0.31)) * 0.08 +
    saturate(avgSpeed, 11) * 0.04 +
    saturate(tailSpeed, 11) * 0.03 +
    (avgLineages / initialOrganisms) * 0.03 +
    (tailLineages / initialOrganisms) * 0.04 -
    collapseRate * 0.16;

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
    avgSpeciationRate,
    tailSpeciationRate,
    avgDominantShare,
    tailDominantShare,
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

  console.log(
    `[${candidate.name}] runs=${options.runs} frames=${options.frames} sampleEvery=${options.sampleEvery}`
  );
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
      const finalMetrics =
        samples.at(-1) ?? collectMetrics(simulation, previousSample, sampleSeconds);
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
        avgSpeciationRate: mean(samples.map((sample) => sample.speciationRate)),
        tailSpeciationRate: mean(safeTailSamples.map((sample) => sample.speciationRate)),
        avgDominantShare: mean(samples.map((sample) => sample.dominantLineageShare)),
        tailDominantShare: mean(
          safeTailSamples.map((sample) => sample.dominantLineageShare)
        ),
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
    "name".padEnd(18),
    "score".padStart(7),
    "tailH".padStart(7),
    "persist".padStart(8),
    "spec".padStart(7),
    "share".padStart(7),
    "delta".padStart(7),
    "switch".padStart(8),
    "speed".padStart(7),
    "coll".padStart(8)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(18),
      result.score.toFixed(3).padStart(7),
      result.tailLineageEntropy.toFixed(3).padStart(7),
      formatRatio(result.lineagePersistence).padStart(8),
      result.avgSpeciationRate.toFixed(2).padStart(7),
      formatRatio(result.tailDominantShare).padStart(7),
      result.avgCompositionDelta.toFixed(3).padStart(7),
      formatRatio(result.dominantSwitchRate).padStart(8),
      result.tailSpeed.toFixed(2).padStart(7),
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
    name: "open-canopy",
    seedBias: 2,
    override: {
      terrain: {
        peakCount: 4,
        radiusMin: 170,
        radiusMax: 340,
        slowdownStart: 0.47,
        dragBoost: 0.82,
        blockThreshold: 0.92,
        minTraversal: 0.58
      },
      economy: {
        corpseLootFraction: 0.18,
        globalRespawnFraction: 0.25,
        resourceLifetime: 15
      },
      springs: {
        packetMass: 2.0,
        interval: 0.34,
        scatter: 184,
        pauseNearbyMass: 54
      },
      mutation: {
        slotTypeChance: 0.078,
        allocationJitter: 0.28,
        traitJitter: 0.24,
        speciationChance: 0.014,
        speciationDriftFactor: 0.35,
        speciesShiftSpeciationBonus: 0.2
      },
      combat: {
        attackScale: 0.28,
        contactDamageRate: 0.69,
        rangedDamageScale: 0.8,
        shieldBlockFraction: 0.84,
        lootEfficiency: 0.82
      }
    }
  },
  {
    name: "braid-plain",
    seedBias: 3,
    override: {
      terrain: {
        peakCount: 3,
        radiusMin: 220,
        radiusMax: 420,
        slowdownStart: 0.49,
        dragBoost: 0.7,
        blockThreshold: 0.94,
        minTraversal: 0.64
      },
      organisms: {
        baseThrust: 15.8,
        dragPerSecond: 1.2,
        minBirthThresholdMass: 48
      },
      flocking: {
        influenceScale: 1.02,
        alignmentWeight: 0.92,
        cohesionWeight: 1.16,
        separationWeight: 0.92,
        countInfluence: 0.08
      },
      economy: {
        corpseLootFraction: 0.17,
        globalRespawnFraction: 0.24,
        resourceLifetime: 15
      },
      springs: {
        packetMass: 2.05,
        interval: 0.33,
        scatter: 188,
        pauseNearbyMass: 52
      },
      mutation: {
        slotCountChance: 0.044,
        slotTypeChance: 0.08,
        allocationJitter: 0.28,
        traitJitter: 0.24,
        speciationChance: 0.015,
        speciationDriftFactor: 0.34,
        speciesShiftSpeciationBonus: 0.22
      },
      combat: {
        attackScale: 0.28,
        contactDamageRate: 0.68,
        rangedDamageScale: 0.81,
        shieldBlockFraction: 0.84,
        lootEfficiency: 0.82
      },
      gadgets: {
        melee: {
          attack: 1.14,
          upkeep: 1.3
        },
        ranged: {
          attack: 1.22,
          range: 236,
          cooldown: 0.98
        },
        shield: {
          defense: 0.98
        }
      }
    }
  },
  {
    name: "soft-arch",
    seedBias: 4,
    override: {
      terrain: {
        peakCount: 5,
        radiusMin: 160,
        radiusMax: 320,
        slowdownStart: 0.46,
        dragBoost: 0.86,
        blockThreshold: 0.92,
        minTraversal: 0.56
      },
      organisms: {
        baseLifespan: 126,
        lifespanSpread: 0.24,
        minBirthThresholdMass: 47
      },
      economy: {
        corpseLootFraction: 0.17,
        globalRespawnFraction: 0.24,
        resourceLifetime: 16
      },
      springs: {
        packetMass: 1.95,
        interval: 0.32,
        scatter: 178,
        pauseNearbyMass: 52
      },
      mutation: {
        slotCountChance: 0.042,
        slotTypeChance: 0.078,
        allocationJitter: 0.29,
        traitJitter: 0.25,
        speciationChance: 0.016,
        speciationDriftFactor: 0.36,
        speciesShiftSpeciationBonus: 0.24
      },
      combat: {
        attackScale: 0.27,
        contactDamageRate: 0.67,
        rangedDamageScale: 0.8,
        shieldBlockFraction: 0.83,
        lootEfficiency: 0.8
      }
    }
  },
  {
    name: "rill-swarm",
    seedBias: 5,
    override: {
      terrain: {
        peakCount: 6,
        radiusMin: 150,
        radiusMax: 290,
        slowdownStart: 0.45,
        dragBoost: 0.84,
        blockThreshold: 0.91,
        minTraversal: 0.54
      },
      flocking: {
        influenceScale: 1.05,
        alignmentWeight: 0.96,
        cohesionWeight: 1.24,
        separationWeight: 0.9,
        countInfluence: 0.1
      },
      economy: {
        corpseLootFraction: 0.16,
        globalRespawnFraction: 0.25,
        resourceLifetime: 14
      },
      springs: {
        packetMass: 1.9,
        interval: 0.31,
        scatter: 176,
        pauseNearbyMass: 50
      },
      mutation: {
        slotCountChance: 0.046,
        slotTypeChance: 0.082,
        allocationJitter: 0.29,
        traitJitter: 0.25,
        speciationChance: 0.017,
        speciationDriftFactor: 0.38,
        speciesShiftSpeciationBonus: 0.22
      },
      combat: {
        attackScale: 0.27,
        contactDamageRate: 0.66,
        rangedDamageScale: 0.79,
        shieldBlockFraction: 0.82,
        lootEfficiency: 0.8
      },
      gadgets: {
        melee: {
          attack: 1.12,
          upkeep: 1.32
        },
        ranged: {
          attack: 1.2,
          range: 238,
          cooldown: 0.99
        },
        shield: {
          defense: 0.98
        }
      }
    }
  },
  {
    name: "wide-drift",
    seedBias: 6,
    override: {
      terrain: {
        peakCount: 4,
        radiusMin: 180,
        radiusMax: 360,
        slowdownStart: 0.48,
        dragBoost: 0.74,
        blockThreshold: 0.94,
        minTraversal: 0.62
      },
      organisms: {
        baseThrust: 16.2,
        dragPerSecond: 1.16,
        minBirthThresholdMass: 47
      },
      economy: {
        corpseLootFraction: 0.17,
        globalRespawnFraction: 0.26,
        resourceLifetime: 14
      },
      springs: {
        packetMass: 1.9,
        interval: 0.3,
        scatter: 194,
        pauseNearbyMass: 50
      },
      mutation: {
        slotCountChance: 0.046,
        slotTypeChance: 0.084,
        allocationJitter: 0.3,
        traitJitter: 0.26,
        speciationChance: 0.018,
        speciationDriftFactor: 0.4,
        speciesShiftSpeciationBonus: 0.24
      },
      combat: {
        attackScale: 0.27,
        contactDamageRate: 0.67,
        rangedDamageScale: 0.82,
        shieldBlockFraction: 0.82,
        lootEfficiency: 0.81
      },
      gadgets: {
        melee: {
          attack: 1.1,
          upkeep: 1.32
        },
        ranged: {
          attack: 1.22,
          range: 240,
          cooldown: 0.98
        },
        shield: {
          defense: 0.96
        }
      }
    }
  },
  {
    name: "relay-delta",
    seedBias: 7,
    override: {
      terrain: {
        peakCount: 5,
        radiusMin: 170,
        radiusMax: 330,
        slowdownStart: 0.47,
        dragBoost: 0.8,
        blockThreshold: 0.92,
        minTraversal: 0.58
      },
      organisms: {
        baseLifespan: 122,
        lifespanSpread: 0.26,
        minBirthThresholdMass: 48
      },
      flocking: {
        influenceScale: 1,
        alignmentWeight: 0.9,
        cohesionWeight: 1.16,
        separationWeight: 0.92,
        countInfluence: 0.08
      },
      economy: {
        corpseLootFraction: 0.16,
        globalRespawnFraction: 0.25,
        resourceLifetime: 13
      },
      springs: {
        packetMass: 1.85,
        interval: 0.29,
        scatter: 186,
        pauseNearbyMass: 48
      },
      mutation: {
        slotCountChance: 0.048,
        slotTypeChance: 0.086,
        allocationJitter: 0.3,
        traitJitter: 0.27,
        speciationChance: 0.019,
        speciationDriftFactor: 0.4,
        speciesShiftSpeciationBonus: 0.25
      },
      combat: {
        attackScale: 0.26,
        contactDamageRate: 0.65,
        rangedDamageScale: 0.82,
        shieldBlockFraction: 0.81,
        lootEfficiency: 0.79
      },
      gadgets: {
        melee: {
          attack: 1.1,
          upkeep: 1.34
        },
        ranged: {
          attack: 1.21,
          range: 242,
          cooldown: 0.97
        },
        shield: {
          defense: 0.95
        }
      }
    }
  }
];

const stage1 = candidates
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 3,
      frames: 720,
      sampleEvery: 60,
      seedOffset: 14000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 1 - diversity tuning", stage1);

const finalists = stage1.slice(0, 3).map((result, index) => ({
  name: result.name,
  seedBias: 40 + index,
  override: candidates.find((candidate) => candidate.name === result.name)?.override ?? {}
}));

const stage2 = finalists
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 4,
      frames: 1200,
      sampleEvery: 75,
      seedOffset: 58000
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
