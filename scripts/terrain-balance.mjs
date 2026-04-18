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

function collectMetrics(simulation) {
  const lineageCounts = new Map();
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
  }

  const terrainSamples = simulation.terrain?.samples?.length
    ? [...simulation.terrain.samples]
    : [];
  const ridgeThreshold = simulation.config.terrain.blockThreshold;
  const slowdownStart = simulation.config.terrain.slowdownStart;

  return {
    living,
    lineages: lineageCounts.size,
    lineageEntropy: entropyFromCounts([...lineageCounts.values()]),
    avgSpeed: living > 0 ? totalSpeed / living : 0,
    terrainMean: mean(terrainSamples),
    terrainSlowShare:
      terrainSamples.length > 0
        ? terrainSamples.filter((value) => value >= slowdownStart).length /
          terrainSamples.length
        : 0,
    terrainRidgeShare:
      terrainSamples.length > 0
        ? terrainSamples.filter((value) => value >= ridgeThreshold).length /
          terrainSamples.length
        : 0
  };
}

function summarizeCandidate(candidate, options) {
  const config = clampConfig(mergeConfig(defaultConfig, candidate.override));
  const initialLineages = config.world.initialOrganisms;
  const tailStartFrame = Math.floor(options.frames * 0.55);
  const samples = [];
  const tailSamples = [];
  let collapseRuns = 0;

  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    const seed = options.seedOffset + candidate.seedBias * 1000 + runIndex;
    const runMetrics = withSeed(seed, () => {
      const simulation = new Simulation(config);
      const runSamples = [];
      const runTailSamples = [];
      for (let frame = 0; frame < options.frames; frame += 1) {
        simulation.step(1 / 60);
        if ((frame + 1) % options.sampleEvery === 0) {
          const metrics = collectMetrics(simulation);
          runSamples.push(metrics);
          if (frame + 1 >= tailStartFrame) {
            runTailSamples.push(metrics);
          }
        }
      }
      const finalMetrics = collectMetrics(simulation);
      const collapsed =
        finalMetrics.living < Math.max(18, initialLineages * 0.12) ||
        finalMetrics.lineages < Math.max(8, initialLineages * 0.08);
      return {
        runSamples,
        runTailSamples: runTailSamples.length ? runTailSamples : runSamples,
        finalMetrics,
        collapsed
      };
    });

    if (runMetrics.collapsed) {
      collapseRuns += 1;
    }
    samples.push(...runMetrics.runSamples);
    tailSamples.push(...runMetrics.runTailSamples);
  }

  const avgLineages = mean(samples.map((sample) => sample.lineages));
  const finalLineages = mean(tailSamples.map((sample) => sample.lineages));
  const avgEntropy = mean(samples.map((sample) => sample.lineageEntropy));
  const tailEntropy = mean(tailSamples.map((sample) => sample.lineageEntropy));
  const avgSpeed = mean(samples.map((sample) => sample.avgSpeed));
  const tailSpeed = mean(tailSamples.map((sample) => sample.avgSpeed));
  const terrainMean = mean(samples.map((sample) => sample.terrainMean));
  const terrainSlowShare = mean(samples.map((sample) => sample.terrainSlowShare));
  const terrainRidgeShare = mean(samples.map((sample) => sample.terrainRidgeShare));
  const collapseRate = collapseRuns / Math.max(1, options.runs);

  const score =
    avgEntropy * 0.28 +
    tailEntropy * 0.28 +
    (avgLineages / initialLineages) * 0.16 +
    (finalLineages / initialLineages) * 0.1 +
    Math.min(1, avgSpeed / 9.5) * 0.12 +
    Math.min(1, tailSpeed / 9.5) * 0.1 -
    collapseRate * 0.18;

  return {
    name: candidate.name,
    config,
    runs: options.runs,
    score,
    collapseRate,
    avgLineages,
    finalLineages,
    avgEntropy,
    tailEntropy,
    avgSpeed,
    tailSpeed,
    terrainMean,
    terrainSlowShare,
    terrainRidgeShare
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
    "lin".padStart(7),
    "tailH".padStart(7),
    "spd".padStart(7),
    "slow".padStart(8),
    "ridge".padStart(8),
    "coll".padStart(8)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(16),
      result.score.toFixed(3).padStart(7),
      result.avgLineages.toFixed(1).padStart(7),
      result.tailEntropy.toFixed(3).padStart(7),
      result.avgSpeed.toFixed(2).padStart(7),
      formatRatio(result.terrainSlowShare).padStart(8),
      formatRatio(result.terrainRidgeShare).padStart(8),
      formatRatio(result.collapseRate).padStart(8)
    );
  }
}

const stage1Candidates = [
  {
    name: "baseline",
    seedBias: 1,
    override: {}
  },
  {
    name: "terrain-off",
    seedBias: 2,
    override: {
      terrain: {
        enabled: 0
      }
    }
  },
  {
    name: "soft-basins",
    seedBias: 3,
    override: {
      terrain: {
        peakCount: 8,
        radiusMin: 150,
        radiusMax: 360,
        slowdownStart: 0.34,
        dragBoost: 1.35,
        blockThreshold: 0.82,
        minTraversal: 0.28
      }
    }
  },
  {
    name: "gentle-ridge",
    seedBias: 4,
    override: {
      terrain: {
        peakCount: 7,
        radiusMin: 170,
        radiusMax: 340,
        slowdownStart: 0.36,
        dragBoost: 1.12,
        blockThreshold: 0.84,
        minTraversal: 0.34
      }
    }
  },
  {
    name: "wide-gentle",
    seedBias: 5,
    override: {
      terrain: {
        peakCount: 6,
        radiusMin: 220,
        radiusMax: 460,
        slowdownStart: 0.38,
        dragBoost: 0.95,
        blockThreshold: 0.86,
        minTraversal: 0.42
      }
    }
  },
  {
    name: "corridor-lite",
    seedBias: 6,
    override: {
      terrain: {
        peakCount: 9,
        radiusMin: 140,
        radiusMax: 260,
        slowdownStart: 0.33,
        dragBoost: 1.25,
        blockThreshold: 0.8,
        minTraversal: 0.24
      }
    }
  },
  {
    name: "visible-bal",
    seedBias: 7,
    override: {
      terrain: {
        peakCount: 7,
        radiusMin: 180,
        radiusMax: 380,
        slowdownStart: 0.35,
        dragBoost: 1.18,
        blockThreshold: 0.83,
        minTraversal: 0.32
      }
    }
  }
];

const stage1 = stage1Candidates
  .map((candidate) =>
    summarizeCandidate(candidate, {
      runs: 6,
      frames: 1800,
      sampleEvery: 120,
      seedOffset: 20000
    })
  )
  .sort((left, right) => right.score - left.score);

printResults("Stage 1 - terrain candidates", stage1);

const finalists = stage1
  .filter((candidate) => candidate.name !== "terrain-off")
  .slice(0, 3)
  .map((candidate, index) => ({
    name: candidate.name,
    seedBias: 30 + index,
    override: stage1Candidates.find((entry) => entry.name === candidate.name)?.override ?? {}
  }));

const stage2 = finalists
  .map((candidate) =>
    summarizeCandidate(candidate, {
      runs: 8,
      frames: 3000,
      sampleEvery: 150,
      seedOffset: 50000
    })
  )
  .sort((left, right) => right.score - left.score);

printResults("Stage 2 - confirmation", stage2);

console.log("\nChosen config:");
console.log(
  JSON.stringify(
    stage2[0]?.config?.terrain ?? stage1[0]?.config?.terrain ?? defaultConfig.terrain,
    null,
    2
  )
);
