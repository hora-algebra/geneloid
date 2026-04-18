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

function collectMetrics(simulation) {
  const lineageCounts = new Map();
  let living = 0;
  let dominantLineageId = null;
  let dominantLineageCount = 0;

  for (const organism of simulation.organisms) {
    if (!organism.alive) {
      continue;
    }
    living += 1;
    const nextCount = (lineageCounts.get(organism.lineageId) ?? 0) + 1;
    lineageCounts.set(organism.lineageId, nextCount);
    if (nextCount > dominantLineageCount) {
      dominantLineageCount = nextCount;
      dominantLineageId = organism.lineageId;
    }
  }

  return {
    living,
    lineages: lineageCounts.size,
    lineageEntropy: entropyFromCounts([...lineageCounts.values()]),
    dominantLineageId,
    dominantLineageShare: living > 0 ? dominantLineageCount / living : 0,
    totalMaterial: simulation.totalMaterial()
  };
}

function runCandidate(candidate, options) {
  const config = clampConfig(mergeConfig(defaultConfig, candidate.override));
  const initialOrganisms = config.world.initialOrganisms;
  const targetMaterial = config.world.totalMaterial;
  const tailStartFrame = Math.floor(options.frames * 0.55);

  const aggregate = [];

  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    const seed = options.seedOffset + candidate.seedBias * 1000 + runIndex;
    const summary = withSeed(seed, () => {
      const simulation = new Simulation(config);
      const samples = [];
      const tailSamples = [];
      let previousDominantLineageId = null;
      let dominantSwitches = 0;

      for (let frame = 0; frame < options.frames; frame += 1) {
        simulation.step(1 / 60);
        if ((frame + 1) % options.sampleEvery !== 0) {
          continue;
        }
        const metrics = collectMetrics(simulation);
        samples.push(metrics);
        if (
          previousDominantLineageId !== null &&
          metrics.dominantLineageId !== null &&
          previousDominantLineageId !== metrics.dominantLineageId
        ) {
          dominantSwitches += 1;
        }
        previousDominantLineageId = metrics.dominantLineageId;
        if (frame + 1 >= tailStartFrame) {
          tailSamples.push(metrics);
        }
      }

      const safeTailSamples = tailSamples.length ? tailSamples : samples;
      const finalMetrics = samples.at(-1) ?? collectMetrics(simulation);
      const collapsed =
        finalMetrics.living < Math.max(18, initialOrganisms * 0.12) ||
        finalMetrics.lineages < Math.max(10, initialOrganisms * 0.06) ||
        mean(safeTailSamples.map((sample) => sample.lineageEntropy)) < 0.72;

      return {
        avgMaterial: mean(samples.map((sample) => sample.totalMaterial)),
        tailMaterial: mean(safeTailSamples.map((sample) => sample.totalMaterial)),
        materialStd: stddev(samples.map((sample) => sample.totalMaterial)),
        avgLineages: mean(samples.map((sample) => sample.lineages)),
        tailLineages: mean(safeTailSamples.map((sample) => sample.lineages)),
        avgLineageEntropy: mean(samples.map((sample) => sample.lineageEntropy)),
        tailLineageEntropy: mean(safeTailSamples.map((sample) => sample.lineageEntropy)),
        avgDominantShare: mean(samples.map((sample) => sample.dominantLineageShare)),
        tailDominantShare: mean(
          safeTailSamples.map((sample) => sample.dominantLineageShare)
        ),
        dominantSwitchRate:
          samples.length > 1 ? dominantSwitches / (samples.length - 1) : 0,
        finalLiving: finalMetrics.living,
        collapsed
      };
    });

    aggregate.push(summary);
  }

  const avgMaterial = mean(aggregate.map((sample) => sample.avgMaterial));
  const tailMaterial = mean(aggregate.map((sample) => sample.tailMaterial));
  const materialStd = mean(aggregate.map((sample) => sample.materialStd));
  const avgLineages = mean(aggregate.map((sample) => sample.avgLineages));
  const tailLineages = mean(aggregate.map((sample) => sample.tailLineages));
  const avgLineageEntropy = mean(aggregate.map((sample) => sample.avgLineageEntropy));
  const tailLineageEntropy = mean(aggregate.map((sample) => sample.tailLineageEntropy));
  const avgDominantShare = mean(aggregate.map((sample) => sample.avgDominantShare));
  const tailDominantShare = mean(aggregate.map((sample) => sample.tailDominantShare));
  const dominantSwitchRate = mean(aggregate.map((sample) => sample.dominantSwitchRate));
  const collapseRate =
    aggregate.filter((sample) => sample.collapsed).length / Math.max(1, aggregate.length);

  const avgMaterialCloseness =
    1 - saturate(Math.abs(avgMaterial - targetMaterial), 2200);
  const tailMaterialCloseness =
    1 - saturate(Math.abs(tailMaterial - targetMaterial), 1400);
  const materialStability = 1 - saturate(materialStd, 1200);

  const score =
    avgMaterialCloseness * 0.16 +
    tailMaterialCloseness * 0.24 +
    materialStability * 0.12 +
    tailLineageEntropy * 0.14 +
    avgLineageEntropy * 0.08 +
    (1 - saturate(tailDominantShare, 0.34)) * 0.12 +
    (1 - saturate(avgDominantShare, 0.36)) * 0.05 +
    saturate(dominantSwitchRate, 0.14) * 0.15 +
    (avgLineages / initialOrganisms) * 0.06 +
    (tailLineages / initialOrganisms) * 0.06 -
    collapseRate * 0.18;

  return {
    name: candidate.name,
    config,
    runs: options.runs,
    score,
    avgMaterial,
    tailMaterial,
    materialStd,
    avgLineages,
    tailLineages,
    avgLineageEntropy,
    tailLineageEntropy,
    avgDominantShare,
    tailDominantShare,
    dominantSwitchRate,
    collapseRate,
    finalLiving: mean(aggregate.map((sample) => sample.finalLiving))
  };
}

function formatRatio(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printResults(title, results) {
  console.log(`\n${title}`);
  console.log(
    "name".padEnd(16),
    "score".padStart(7),
    "tailMat".padStart(9),
    "std".padStart(7),
    "tailH".padStart(7),
    "share".padStart(7),
    "switch".padStart(8),
    "coll".padStart(8)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(16),
      result.score.toFixed(3).padStart(7),
      result.tailMaterial.toFixed(0).padStart(9),
      result.materialStd.toFixed(0).padStart(7),
      result.tailLineageEntropy.toFixed(3).padStart(7),
      formatRatio(result.tailDominantShare).padStart(7),
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
    name: "switch-weave",
    seedBias: 2,
    override: {
      economy: {
        corpseLootFraction: 0.17,
        globalRespawnFraction: 0.22,
        resourceLifetime: 17
      },
      combat: {
        attackScale: 0.29,
        contactDamageRate: 0.72,
        rangedDamageScale: 0.8,
        shieldBlockFraction: 0.85,
        lootEfficiency: 0.83
      },
      mutation: {
        slotTypeChance: 0.078,
        allocationJitter: 0.27,
        traitJitter: 0.23,
        speciationChance: 0.013,
        speciationDriftFactor: 0.34,
        speciesShiftSpeciationBonus: 0.2
      },
      springs: {
        packetMass: 2.2,
        interval: 0.4,
        scatter: 168,
        pauseNearbyMass: 58
      },
      gadgets: {
        melee: {
          attack: 1.2,
          upkeep: 1.3
        },
        ranged: {
          attack: 1.18,
          range: 230,
          cooldown: 1.03
        },
        shield: {
          defense: 1.01
        }
      }
    }
  },
  {
    name: "branch-check",
    seedBias: 3,
    override: {
      organisms: {
        minBirthThresholdMass: 46
      },
      economy: {
        corpseLootFraction: 0.18,
        globalRespawnFraction: 0.23,
        resourceLifetime: 17
      },
      combat: {
        attackScale: 0.29,
        contactDamageRate: 0.71,
        rangedDamageScale: 0.79,
        shieldBlockFraction: 0.86,
        lootEfficiency: 0.84
      },
      mutation: {
        slotTypeChance: 0.076,
        allocationJitter: 0.27,
        traitJitter: 0.22,
        speciationChance: 0.012,
        speciationDriftFactor: 0.32,
        speciesShiftSpeciationBonus: 0.22
      },
      springs: {
        packetMass: 2.1,
        interval: 0.38,
        scatter: 166,
        pauseNearbyMass: 60
      },
      gadgets: {
        melee: {
          attack: 1.18,
          upkeep: 1.28
        },
        ranged: {
          attack: 1.18,
          range: 232,
          cooldown: 1.02
        },
        shield: {
          defense: 1.02
        }
      }
    }
  },
  {
    name: "range-weave",
    seedBias: 4,
    override: {
      economy: {
        corpseLootFraction: 0.17,
        globalRespawnFraction: 0.22,
        resourceLifetime: 18
      },
      combat: {
        attackScale: 0.3,
        contactDamageRate: 0.7,
        rangedDamageScale: 0.82,
        shieldBlockFraction: 0.86,
        lootEfficiency: 0.84
      },
      mutation: {
        slotTypeChance: 0.075,
        allocationJitter: 0.26,
        traitJitter: 0.21,
        speciationChance: 0.011,
        speciationDriftFactor: 0.31,
        speciesShiftSpeciationBonus: 0.2
      },
      springs: {
        packetMass: 2.15,
        interval: 0.39,
        scatter: 162,
        pauseNearbyMass: 58
      },
      gadgets: {
        melee: {
          attack: 1.16,
          upkeep: 1.3
        },
        ranged: {
          attack: 1.2,
          range: 234,
          cooldown: 1.01
        },
        shield: {
          defense: 1.02
        }
      }
    }
  },
  {
    name: "plain-pulse",
    seedBias: 5,
    override: {
      organisms: {
        baseLifespan: 124,
        lifespanSpread: 0.24
      },
      economy: {
        corpseLootFraction: 0.17,
        globalRespawnFraction: 0.24,
        resourceLifetime: 16
      },
      combat: {
        attackScale: 0.29,
        contactDamageRate: 0.73,
        rangedDamageScale: 0.79,
        shieldBlockFraction: 0.85,
        lootEfficiency: 0.82
      },
      mutation: {
        slotTypeChance: 0.08,
        allocationJitter: 0.27,
        traitJitter: 0.24,
        speciationChance: 0.014,
        speciationDriftFactor: 0.35,
        speciesShiftSpeciationBonus: 0.18
      },
      springs: {
        packetMass: 2.25,
        interval: 0.43,
        scatter: 170,
        pauseNearbyMass: 58
      },
      gadgets: {
        melee: {
          attack: 1.18,
          upkeep: 1.32
        },
        ranged: {
          attack: 1.17,
          range: 230,
          cooldown: 1.02
        },
        shield: {
          defense: 1
        }
      }
    }
  },
  {
    name: "calm-switch",
    seedBias: 6,
    override: {
      organisms: {
        minBirthThresholdMass: 46
      },
      economy: {
        corpseLootFraction: 0.18,
        globalRespawnFraction: 0.22,
        resourceLifetime: 19
      },
      combat: {
        attackScale: 0.28,
        contactDamageRate: 0.7,
        rangedDamageScale: 0.78,
        shieldBlockFraction: 0.86,
        lootEfficiency: 0.83
      },
      mutation: {
        slotTypeChance: 0.074,
        allocationJitter: 0.25,
        traitJitter: 0.21,
        speciationChance: 0.011,
        speciationDriftFactor: 0.3,
        speciesShiftSpeciationBonus: 0.2
      },
      springs: {
        packetMass: 2.0,
        interval: 0.36,
        scatter: 168,
        pauseNearbyMass: 62
      },
      gadgets: {
        melee: {
          attack: 1.18,
          upkeep: 1.28
        },
        ranged: {
          attack: 1.17,
          range: 228,
          cooldown: 1.04
        },
        shield: {
          defense: 1.03
        }
      }
    }
  }
];

const stage1 = candidates
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 4,
      frames: 2100,
      sampleEvery: 105,
      seedOffset: 12000
    })
  )
  .sort((left, right) => right.score - left.score);

printResults("Stage 1 - material + dominance", stage1);

const finalists = stage1.slice(0, 3).map((result, index) => ({
  name: result.name,
  seedBias: 40 + index,
  override: candidates.find((candidate) => candidate.name === result.name)?.override ?? {}
}));

const stage2 = finalists
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 6,
      frames: 3000,
      sampleEvery: 120,
      seedOffset: 52000
    })
  )
  .sort((left, right) => right.score - left.score);

printResults("Stage 2 - confirmation", stage2);

console.log("\nChosen override:");
console.log(
  JSON.stringify(
    candidates.find((candidate) => candidate.name === stage2[0]?.name)?.override ?? {},
    null,
    2
  )
);
