import { clampConfig, deepClone, defaultConfig } from "../src/sim/config.js";
import { Simulation, sensorRange } from "../src/sim/core.js";

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

function buildComponents(group, config) {
  const count = group.length;
  const adjacency = Array.from({ length: count }, () => []);

  for (let left = 0; left < count; left += 1) {
    const a = group[left];
    const aRange =
      sensorRange(a, config) *
      Math.max(0.12, Math.min(1, config.flocking.neighborhoodFactor));
    for (let right = left + 1; right < count; right += 1) {
      const b = group[right];
      const bRange =
        sensorRange(b, config) *
        Math.max(0.12, Math.min(1, config.flocking.neighborhoodFactor));
      const linkDistance = Math.min(aRange, bRange);
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy <= linkDistance * linkDistance) {
        adjacency[left].push(right);
        adjacency[right].push(left);
      }
    }
  }

  const visited = new Uint8Array(count);
  const components = [];
  for (let start = 0; start < count; start += 1) {
    if (visited[start]) {
      continue;
    }
    const stack = [start];
    visited[start] = 1;
    const members = [];
    while (stack.length) {
      const index = stack.pop();
      members.push(group[index]);
      for (const neighbor of adjacency[index]) {
        if (visited[neighbor]) {
          continue;
        }
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }
    components.push(members);
  }

  return components;
}

function coherenceForGroup(group) {
  if (!group.length) {
    return 0;
  }
  let headingX = 0;
  let headingY = 0;
  for (const organism of group) {
    headingX += Math.cos(organism.heading);
    headingY += Math.sin(organism.heading);
  }
  return Math.hypot(headingX, headingY) / group.length;
}

function collectFlockMetrics(simulation) {
  const living = simulation.organisms.filter((organism) => organism.alive);
  const bySpecies = new Map();
  for (const organism of living) {
    const bucket = bySpecies.get(organism.speciesIndex);
    if (bucket) {
      bucket.push(organism);
    } else {
      bySpecies.set(organism.speciesIndex, [organism]);
    }
  }

  const qualifyingSizes = [];
  const qualifyingCoherences = [];
  let flockedMembers = 0;
  let largestFlock = 0;

  for (const group of bySpecies.values()) {
    if (group.length < 4) {
      continue;
    }
    const components = buildComponents(group, simulation.config);
    for (const component of components) {
      if (component.length < 4) {
        continue;
      }
      const coherence = coherenceForGroup(component);
      if (coherence < 0.46) {
        continue;
      }
      flockedMembers += component.length;
      largestFlock = Math.max(largestFlock, component.length);
      qualifyingSizes.push(component.length);
      qualifyingCoherences.push(coherence);
    }
  }

  const livingCount = living.length;
  return {
    living: livingCount,
    largestFlock,
    avgFlockSize: mean(qualifyingSizes),
    flockedShare: livingCount > 0 ? flockedMembers / livingCount : 0,
    flockCoherence:
      qualifyingSizes.length > 0 ? mean(qualifyingCoherences) : 0,
    flockCount: qualifyingSizes.length
  };
}

function createAggregate() {
  return {
    runs: 0,
    collapseRuns: 0,
    largestFlock: [],
    tailLargestFlock: [],
    avgFlockSize: [],
    flockedShare: [],
    tailFlockedShare: [],
    flockCoherence: [],
    tailFlockCoherence: [],
    living: [],
    finalLiving: []
  };
}

function addRunSummary(aggregate, summary) {
  aggregate.runs += 1;
  aggregate.collapseRuns += summary.collapsed ? 1 : 0;
  aggregate.largestFlock.push(summary.avgLargestFlock);
  aggregate.tailLargestFlock.push(summary.tailLargestFlock);
  aggregate.avgFlockSize.push(summary.avgFlockSize);
  aggregate.flockedShare.push(summary.avgFlockedShare);
  aggregate.tailFlockedShare.push(summary.tailFlockedShare);
  aggregate.flockCoherence.push(summary.avgFlockCoherence);
  aggregate.tailFlockCoherence.push(summary.tailFlockCoherence);
  aggregate.living.push(summary.avgLiving);
  aggregate.finalLiving.push(summary.finalLiving);
}

function finalizeAggregate(aggregate, initialOrganisms) {
  const avgLargestFlock = mean(aggregate.largestFlock);
  const tailLargestFlock = mean(aggregate.tailLargestFlock);
  const avgFlockedShare = mean(aggregate.flockedShare);
  const tailFlockedShare = mean(aggregate.tailFlockedShare);
  const avgFlockCoherence = mean(aggregate.flockCoherence);
  const tailFlockCoherence = mean(aggregate.tailFlockCoherence);
  const collapseRate = aggregate.collapseRuns / Math.max(1, aggregate.runs);

  const score =
    (avgLargestFlock / initialOrganisms) * 0.16 +
    (tailLargestFlock / initialOrganisms) * 0.34 +
    avgFlockedShare * 0.16 +
    tailFlockedShare * 0.2 +
    avgFlockCoherence * 0.04 +
    tailFlockCoherence * 0.1 -
    collapseRate * 0.22;

  return {
    runs: aggregate.runs,
    score,
    collapseRate,
    avgLargestFlock,
    largestFlockStd: stddev(aggregate.largestFlock),
    tailLargestFlock,
    avgFlockSize: mean(aggregate.avgFlockSize),
    avgFlockedShare,
    tailFlockedShare,
    avgFlockCoherence,
    tailFlockCoherence,
    avgLiving: mean(aggregate.living),
    finalLiving: mean(aggregate.finalLiving)
  };
}

function runCandidate(candidate, options) {
  const config = clampConfig(mergeConfig(defaultConfig, candidate.override));
  const initialOrganisms = config.world.initialOrganisms;
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
          const metrics = collectFlockMetrics(simulation);
          samples.push(metrics);
          if (frame + 1 >= tailStartFrame) {
            tailSamples.push(metrics);
          }
        }
      }

      const finalMetrics = collectFlockMetrics(simulation);
      const collapsed = finalMetrics.living < Math.max(18, initialOrganisms * 0.12);

      const tailMetrics = tailSamples.length ? tailSamples : samples;
      return {
        avgLargestFlock: mean(samples.map((sample) => sample.largestFlock)),
        tailLargestFlock: mean(tailMetrics.map((sample) => sample.largestFlock)),
        avgFlockSize: mean(samples.map((sample) => sample.avgFlockSize)),
        avgFlockedShare: mean(samples.map((sample) => sample.flockedShare)),
        tailFlockedShare: mean(tailMetrics.map((sample) => sample.flockedShare)),
        avgFlockCoherence: mean(samples.map((sample) => sample.flockCoherence)),
        tailFlockCoherence: mean(
          tailMetrics.map((sample) => sample.flockCoherence)
        ),
        avgLiving: mean(samples.map((sample) => sample.living)),
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
    "name".padEnd(15),
    "score".padStart(7),
    "tailF".padStart(7),
    "share".padStart(8),
    "coher".padStart(7),
    "coll".padStart(8)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(15),
      result.score.toFixed(3).padStart(7),
      result.tailLargestFlock.toFixed(1).padStart(7),
      formatRatio(result.tailFlockedShare).padStart(8),
      result.tailFlockCoherence.toFixed(3).padStart(7),
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
    name: "local-swarm",
    seedBias: 2,
    override: {
      organisms: {
        sensoryBase: 92,
        sensoryMassFactor: 8.3,
        dragPerSecond: 1.34,
        wanderRate: 0.26,
        sameSpeciesSpacing: 12,
        birthScatter: 18
      },
      flocking: {
        neighborhoodFactor: 0.58,
        influenceScale: 1.22,
        alignmentWeight: 1.16,
        cohesionWeight: 1.24,
        separationWeight: 0.82,
        countInfluence: 0.06
      },
      mutation: {
        slotCountChance: 0.04,
        slotTypeChance: 0.065,
        traitJitter: 0.16
      },
      combat: {
        attackScale: 0.34,
        contactDamageRate: 0.86,
        rangedDamageScale: 0.74
      },
      economy: {
        corpseLootFraction: 0.26
      }
    }
  },
  {
    name: "ribbon-school",
    seedBias: 3,
    override: {
      organisms: {
        sensoryBase: 88,
        sensoryMassFactor: 8.1,
        baseTurnRate: 1.94,
        dragPerSecond: 1.31,
        wanderRate: 0.24,
        sameSpeciesSpacing: 11,
        birthScatter: 16
      },
      flocking: {
        neighborhoodFactor: 0.46,
        influenceScale: 1.36,
        alignmentWeight: 1.28,
        cohesionWeight: 1.1,
        separationWeight: 0.9,
        countInfluence: 0.08
      },
      mutation: {
        slotCountChance: 0.038,
        slotTypeChance: 0.06,
        traitJitter: 0.16
      },
      combat: {
        attackScale: 0.35,
        contactDamageRate: 0.88,
        rangedDamageScale: 0.76
      },
      economy: {
        corpseLootFraction: 0.27
      }
    }
  },
  {
    name: "dense-school",
    seedBias: 4,
    override: {
      organisms: {
        sensoryBase: 96,
        sensoryMassFactor: 8.8,
        dragPerSecond: 1.28,
        wanderRate: 0.22,
        sameSpeciesSpacing: 8,
        birthScatter: 14
      },
      flocking: {
        neighborhoodFactor: 0.52,
        influenceScale: 1.34,
        alignmentWeight: 1.12,
        cohesionWeight: 1.42,
        separationWeight: 0.7,
        countInfluence: 0.1
      },
      mutation: {
        slotCountChance: 0.03,
        slotTypeChance: 0.055,
        traitJitter: 0.15
      },
      combat: {
        attackScale: 0.32,
        contactDamageRate: 0.8,
        rangedDamageScale: 0.7
      },
      economy: {
        corpseLootFraction: 0.24
      }
    }
  },
  {
    name: "steady-school",
    seedBias: 5,
    override: {
      organisms: {
        sensoryBase: 94,
        sensoryMassFactor: 8.5,
        baseTurnRate: 1.9,
        dragPerSecond: 1.25,
        wanderRate: 0.2,
        sameSpeciesSpacing: 10,
        birthScatter: 14
      },
      flocking: {
        neighborhoodFactor: 0.6,
        influenceScale: 1.18,
        alignmentWeight: 1.04,
        cohesionWeight: 1.34,
        separationWeight: 0.78,
        countInfluence: 0.07
      },
      mutation: {
        slotCountChance: 0.032,
        slotTypeChance: 0.058,
        traitJitter: 0.15
      },
      combat: {
        attackScale: 0.35,
        contactDamageRate: 0.84,
        rangedDamageScale: 0.72
      },
      economy: {
        corpseLootFraction: 0.25
      }
    }
  },
  {
    name: "wide-school",
    seedBias: 6,
    override: {
      organisms: {
        sensoryBase: 104,
        sensoryMassFactor: 8.6,
        baseTurnRate: 1.88,
        dragPerSecond: 1.26,
        wanderRate: 0.18,
        sameSpeciesSpacing: 9,
        birthScatter: 12
      },
      flocking: {
        neighborhoodFactor: 0.72,
        influenceScale: 1.1,
        alignmentWeight: 0.98,
        cohesionWeight: 1.48,
        separationWeight: 0.74,
        countInfluence: 0.12
      },
      mutation: {
        slotCountChance: 0.03,
        slotTypeChance: 0.05,
        traitJitter: 0.15
      },
      combat: {
        attackScale: 0.33,
        contactDamageRate: 0.8,
        rangedDamageScale: 0.7
      },
      economy: {
        corpseLootFraction: 0.24
      }
    }
  },
  {
    name: "cluster-school",
    seedBias: 7,
    override: {
      organisms: {
        sensoryBase: 118,
        sensoryMassFactor: 9.2,
        baseTurnRate: 1.92,
        dragPerSecond: 1.22,
        wanderRate: 0.12,
        sameSpeciesSpacing: 6,
        birthScatter: 10
      },
      flocking: {
        neighborhoodFactor: 0.82,
        influenceScale: 1.42,
        alignmentWeight: 1.24,
        cohesionWeight: 1.78,
        separationWeight: 0.56,
        countInfluence: 0.14
      },
      mutation: {
        slotCountChance: 0.006,
        slotTypeChance: 0.01,
        traitJitter: 0.08,
        allocationJitter: 0.1
      },
      combat: {
        attackScale: 0.24,
        contactDamageRate: 0.6,
        rangedDamageScale: 0.52,
        shieldBlockFraction: 0.92
      },
      economy: {
        corpseLootFraction: 0.16
      }
    }
  }
];

const stageOne = candidates
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 6,
      frames: 2400,
      sampleEvery: 120,
      seedOffset: 1200
    })
  )
  .sort((left, right) => right.score - left.score);

printStage(`Stage 1: ${candidates.length * 6} runs / ${candidates.length} candidates`, stageOne);

const finalists = stageOne.slice(0, 3).map((result) =>
  candidates.find((candidate) => candidate.name === result.name)
);

const stageTwo = finalists
  .map((candidate) =>
    runCandidate(candidate, {
      runs: 10,
      frames: 4200,
      sampleEvery: 140,
      seedOffset: 9200
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 2: 30 confirmation runs / 3 finalists", stageTwo);

const winner = stageTwo[0];
console.log("\nBest candidate");
console.log(
  JSON.stringify(
    {
      name: winner.name,
      score: Number(winner.score.toFixed(4)),
      avgLargestFlock: Number(winner.avgLargestFlock.toFixed(2)),
      tailLargestFlock: Number(winner.tailLargestFlock.toFixed(2)),
      avgFlockedShare: Number(winner.avgFlockedShare.toFixed(4)),
      tailFlockedShare: Number(winner.tailFlockedShare.toFixed(4)),
      avgFlockCoherence: Number(winner.avgFlockCoherence.toFixed(4)),
      tailFlockCoherence: Number(winner.tailFlockCoherence.toFixed(4)),
      collapseRate: Number(winner.collapseRate.toFixed(4)),
      override: candidates.find((candidate) => candidate.name === winner.name)?.override
    },
    null,
    2
  )
);
