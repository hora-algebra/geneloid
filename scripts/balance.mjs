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

function collectMetrics(simulation) {
  const lineageCounts = new Map();
  const slotCounts = {
    melee: 0,
    ranged: 0,
    shield: 0
  };
  let totalSlots = 0;

  for (const organism of simulation.organisms) {
    if (!organism.alive) {
      continue;
    }

    lineageCounts.set(
      organism.lineageId,
      (lineageCounts.get(organism.lineageId) ?? 0) + 1
    );

    for (const slotType of organism.genome.slotTypes) {
      slotCounts[slotType] += 1;
      totalSlots += 1;
    }
  }

  const lineageValues = [...lineageCounts.values()];
  const slotValues = Object.values(slotCounts);
  const dominantWeaponShare =
    totalSlots > 0 ? Math.max(...slotValues) / totalSlots : 0;

  return {
    living: simulation.organisms.length,
    lineages: lineageCounts.size,
    lineageEntropy: entropyFromCounts(lineageValues),
    weaponEntropy: entropyFromCounts(slotValues),
    dominantWeaponShare,
    meleeShare: totalSlots > 0 ? slotCounts.melee / totalSlots : 0,
    rangedShare: totalSlots > 0 ? slotCounts.ranged / totalSlots : 0,
    shieldShare: totalSlots > 0 ? slotCounts.shield / totalSlots : 0
  };
}

function createAggregate() {
  return {
    runs: 0,
    collapseRuns: 0,
    living: [],
    finalLiving: [],
    lineages: [],
    finalLineages: [],
    lineageEntropy: [],
    tailLineageEntropy: [],
    weaponEntropy: [],
    dominantWeaponShare: [],
    meleeShare: [],
    rangedShare: [],
    shieldShare: []
  };
}

function addRunSummary(aggregate, summary) {
  aggregate.runs += 1;
  aggregate.collapseRuns += summary.collapsed ? 1 : 0;
  aggregate.living.push(summary.avgLiving);
  aggregate.finalLiving.push(summary.finalLiving);
  aggregate.lineages.push(summary.avgLineages);
  aggregate.finalLineages.push(summary.finalLineages);
  aggregate.lineageEntropy.push(summary.avgLineageEntropy);
  aggregate.tailLineageEntropy.push(summary.tailLineageEntropy);
  aggregate.weaponEntropy.push(summary.avgWeaponEntropy);
  aggregate.dominantWeaponShare.push(summary.avgDominantWeaponShare);
  aggregate.meleeShare.push(summary.avgMeleeShare);
  aggregate.rangedShare.push(summary.avgRangedShare);
  aggregate.shieldShare.push(summary.avgShieldShare);
}

function finalizeAggregate(aggregate, initialLineages) {
  const avgLineages = mean(aggregate.lineages);
  const finalLineages = mean(aggregate.finalLineages);
  const avgEntropy = mean(aggregate.lineageEntropy);
  const tailEntropy = mean(aggregate.tailLineageEntropy);
  const avgWeaponEntropy = mean(aggregate.weaponEntropy);
  const avgDominantWeaponShare = mean(aggregate.dominantWeaponShare);
  const collapseRate = aggregate.collapseRuns / Math.max(1, aggregate.runs);

  const score =
    avgEntropy * 0.34 +
    tailEntropy * 0.26 +
    (avgLineages / initialLineages) * 0.18 +
    (finalLineages / initialLineages) * 0.12 +
    avgWeaponEntropy * 0.06 +
    (1 - avgDominantWeaponShare) * 0.04 -
    collapseRate * 0.18;

  return {
    runs: aggregate.runs,
    score,
    collapseRate,
    avgLiving: mean(aggregate.living),
    avgLivingStd: stddev(aggregate.living),
    finalLiving: mean(aggregate.finalLiving),
    avgLineages,
    lineagesStd: stddev(aggregate.lineages),
    finalLineages,
    avgLineageEntropy: avgEntropy,
    tailLineageEntropy: tailEntropy,
    avgWeaponEntropy,
    avgDominantWeaponShare,
    meleeShare: mean(aggregate.meleeShare),
    rangedShare: mean(aggregate.rangedShare),
    shieldShare: mean(aggregate.shieldShare)
  };
}

function runCandidate(candidate, options) {
  const config = clampConfig(mergeConfig(experimentBaseConfig, candidate.override));
  const initialLineages = config.world.initialOrganisms;
  const aggregate = createAggregate();
  const tailStartFrame = Math.floor(options.frames * 0.55);

  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    const seed = options.seedOffset + candidate.seedBias * 1000 + runIndex;
    const summary = withSeed(seed, () => {
      const simulation = new Simulation(config);
      const samples = [];
      const tailSamples = [];

      for (let frame = 0; frame < options.frames; frame += 1) {
        simulation.step(1 / 60);
        if ((frame + 1) % options.sampleEvery === 0) {
          const metrics = collectMetrics(simulation);
          samples.push(metrics);
          if (frame + 1 >= tailStartFrame) {
            tailSamples.push(metrics);
          }
        }
      }

      const finalMetrics = collectMetrics(simulation);
      const collapsed =
        finalMetrics.living < Math.max(8, initialLineages * 0.16) ||
        finalMetrics.lineages < Math.max(4, initialLineages * 0.08);

      return {
        avgLiving: mean(samples.map((sample) => sample.living)),
        finalLiving: finalMetrics.living,
        avgLineages: mean(samples.map((sample) => sample.lineages)),
        finalLineages: finalMetrics.lineages,
        avgLineageEntropy: mean(samples.map((sample) => sample.lineageEntropy)),
        tailLineageEntropy: mean(
          (tailSamples.length ? tailSamples : samples).map(
            (sample) => sample.lineageEntropy
          )
        ),
        avgWeaponEntropy: mean(samples.map((sample) => sample.weaponEntropy)),
        avgDominantWeaponShare: mean(
          samples.map((sample) => sample.dominantWeaponShare)
        ),
        avgMeleeShare: mean(samples.map((sample) => sample.meleeShare)),
        avgRangedShare: mean(samples.map((sample) => sample.rangedShare)),
        avgShieldShare: mean(samples.map((sample) => sample.shieldShare)),
        collapsed
      };
    });

    addRunSummary(aggregate, summary);
  }

  return {
    name: candidate.name,
    config,
    ...finalizeAggregate(aggregate, initialLineages)
  };
}

function formatRatio(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printStage(title, results) {
  console.log(`\n${title}`);
  console.log(
    "name".padEnd(15),
    "score".padStart(7),
    "lin".padStart(7),
    "tailH".padStart(7),
    "wEnt".padStart(7),
    "domW".padStart(7),
    "collapse".padStart(9)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(15),
      result.score.toFixed(3).padStart(7),
      result.avgLineages.toFixed(1).padStart(7),
      result.tailLineageEntropy.toFixed(3).padStart(7),
      result.avgWeaponEntropy.toFixed(3).padStart(7),
      formatRatio(result.avgDominantWeaponShare).padStart(7),
      formatRatio(result.collapseRate).padStart(9)
    );
  }
}

const experimentBaseConfig = clampConfig(
  mergeConfig(defaultConfig, {
    economy: {
      corpseLootFraction: 0.34
    },
    combat: {
      attackScale: 0.4,
      contactDamageRate: 1.15,
      shieldBlockFraction: 1,
      lootEfficiency: 1
    },
    gadgets: {
      melee: {
        attack: 1.72,
        steal: 0.12,
        upkeep: 1.18
      },
      ranged: {
        attack: 1.12,
        steal: 0.18,
        upkeep: 1.34,
        range: 220,
        cooldown: 1.15
      },
      shield: {
        defense: 1,
        upkeep: 0.88
      }
    }
  })
);

const candidates = [
  {
    name: "baseline",
    seedBias: 1,
    override: {}
  },
  {
    name: "soft-shield",
    seedBias: 2,
    override: {
      combat: {
        shieldBlockFraction: 0.9
      }
    }
  },
  {
    name: "snowball-cut",
    seedBias: 3,
    override: {
      combat: {
        shieldBlockFraction: 0.88,
        lootEfficiency: 0.92
      },
      economy: {
        corpseLootFraction: 0.29
      }
    }
  },
  {
    name: "ranged-trim",
    seedBias: 4,
    override: {
      combat: {
        shieldBlockFraction: 0.88,
        attackScale: 0.38,
        rangedDamageScale: 0.74,
        lootEfficiency: 0.94
      },
      economy: {
        corpseLootFraction: 0.3
      },
      gadgets: {
        melee: {
          attack: 1.56,
          steal: 0.1,
          upkeep: 1.18
        },
        ranged: {
          attack: 0.98,
          steal: 0.14,
          upkeep: 1.46,
          range: 196,
          cooldown: 1.42
        },
        shield: {
          defense: 0.92,
          upkeep: 0.96
        }
      }
    }
  },
  {
    name: "melee-trim",
    seedBias: 5,
    override: {
      combat: {
        shieldBlockFraction: 0.88,
        attackScale: 0.38,
        contactDamageRate: 0.96,
        lootEfficiency: 0.94
      },
      economy: {
        corpseLootFraction: 0.3
      },
      gadgets: {
        melee: {
          attack: 1.44,
          steal: 0.1,
          upkeep: 1.24
        },
        ranged: {
          attack: 1.06,
          steal: 0.15,
          upkeep: 1.4,
          range: 210,
          cooldown: 1.24
        },
        shield: {
          defense: 0.92,
          upkeep: 0.96
        }
      }
    }
  },
  {
    name: "balanced-a",
    seedBias: 6,
    override: {
      combat: {
        shieldBlockFraction: 0.86,
        attackScale: 0.37,
        contactDamageRate: 0.98,
        rangedDamageScale: 0.74,
        lootEfficiency: 0.9
      },
      economy: {
        corpseLootFraction: 0.28
      },
      gadgets: {
        melee: {
          attack: 1.46,
          defense: 0.18,
          steal: 0.08,
          upkeep: 1.22
        },
        ranged: {
          attack: 1,
          defense: 0.1,
          steal: 0.12,
          upkeep: 1.48,
          range: 192,
          cooldown: 1.38
        },
        shield: {
          defense: 0.88,
          upkeep: 0.98
        }
      }
    }
  },
  {
    name: "balanced-b",
    seedBias: 7,
    override: {
      combat: {
        shieldBlockFraction: 0.84,
        attackScale: 0.38,
        contactDamageRate: 1,
        rangedDamageScale: 0.78,
        lootEfficiency: 0.88
      },
      economy: {
        corpseLootFraction: 0.27
      },
      gadgets: {
        melee: {
          attack: 1.52,
          defense: 0.18,
          steal: 0.09,
          upkeep: 1.2
        },
        ranged: {
          attack: 1.02,
          defense: 0.1,
          steal: 0.12,
          upkeep: 1.44,
          range: 204,
          cooldown: 1.32
        },
        shield: {
          defense: 0.86,
          upkeep: 1
        }
      }
    }
  }
];

const stageOne = candidates
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 6,
      frames: 4200,
      sampleEvery: 90,
      seedOffset: 1000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 1: 42 runs / 7 candidates", stageOne);

const finalists = stageOne.slice(0, 3).map((result) =>
  candidates.find((candidate) => candidate.name === result.name)
);

const stageTwo = finalists
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 12,
      frames: 7200,
      sampleEvery: 120,
      seedOffset: 9000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 2: 36 confirmation runs / 3 finalists", stageTwo);

const winner = stageTwo[0];
console.log("\nBest candidate");
console.log(
  JSON.stringify(
    {
      name: winner.name,
      score: Number(winner.score.toFixed(4)),
      avgLineages: Number(winner.avgLineages.toFixed(2)),
      finalLineages: Number(winner.finalLineages.toFixed(2)),
      tailLineageEntropy: Number(winner.tailLineageEntropy.toFixed(4)),
      avgWeaponEntropy: Number(winner.avgWeaponEntropy.toFixed(4)),
      avgDominantWeaponShare: Number(winner.avgDominantWeaponShare.toFixed(4)),
      meleeShare: Number(winner.meleeShare.toFixed(4)),
      rangedShare: Number(winner.rangedShare.toFixed(4)),
      shieldShare: Number(winner.shieldShare.toFixed(4)),
      collapseRate: Number(winner.collapseRate.toFixed(4)),
      override: candidates.find((candidate) => candidate.name === winner.name)?.override
    },
    null,
    2
  )
);
