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

function torusDelta(fromValue, toValue, size) {
  let delta = toValue - fromValue;
  if (delta > size * 0.5) {
    delta -= size;
  } else if (delta < -size * 0.5) {
    delta += size;
  }
  return delta;
}

function torusDistance(a, b, world) {
  const dx = torusDelta(a.x, b.x, world.width);
  const dy = torusDelta(a.y, b.y, world.height);
  return Math.hypot(dx, dy);
}

function countDistributionDistance(leftCounts, rightCounts, leftTotal, rightTotal) {
  if (leftTotal <= 0 || rightTotal <= 0) {
    return 0;
  }

  const allKeys = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  let distance = 0;
  for (const key of allKeys) {
    const leftShare = (leftCounts.get(key) ?? 0) / leftTotal;
    const rightShare = (rightCounts.get(key) ?? 0) / rightTotal;
    distance += Math.abs(leftShare - rightShare);
  }
  return distance * 0.5;
}

function collectRegionalGridMetrics(simulation, living) {
  const cols = 4;
  const rows = 3;
  const cellCount = cols * rows;
  const world = simulation.config.world;
  const cellMaps = Array.from({ length: cellCount }, () => new Map());
  const speciesCellCounts = new Map();

  for (const organism of simulation.organisms) {
    if (!organism.alive) {
      continue;
    }
    const column = Math.min(cols - 1, Math.floor((organism.x / world.width) * cols));
    const row = Math.min(rows - 1, Math.floor((organism.y / world.height) * rows));
    const index = row * cols + column;
    const cellCounts = cellMaps[index];
    cellCounts.set(organism.speciesIndex, (cellCounts.get(organism.speciesIndex) ?? 0) + 1);

    let bins = speciesCellCounts.get(organism.speciesIndex);
    if (!bins) {
      bins = new Array(cellCount).fill(0);
      speciesCellCounts.set(organism.speciesIndex, bins);
    }
    bins[index] += 1;
  }

  const occupiedThreshold = Math.max(16, living * 0.018);
  const occupiedCells = [];
  const cellByIndex = new Map();
  const dominanceShares = [];
  const dominantIds = new Set();

  for (let index = 0; index < cellCount; index += 1) {
    const counts = cellMaps[index];
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (total < occupiedThreshold) {
      continue;
    }

    let dominantSpeciesId = null;
    let dominantCount = 0;
    for (const [speciesIndex, count] of counts) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantSpeciesId = speciesIndex;
      }
    }

    const cell = {
      index,
      row: Math.floor(index / cols),
      column: index % cols,
      counts,
      total,
      dominantSpeciesId,
      dominantShare: dominantCount / total
    };
    occupiedCells.push(cell);
    cellByIndex.set(index, cell);
    dominanceShares.push(cell.dominantShare);
    dominantIds.add(dominantSpeciesId);
  }

  const neighborPairs = [];
  const seenPairs = new Set();
  for (const cell of occupiedCells) {
    const neighbors = [
      cell.row * cols + ((cell.column + 1) % cols),
      ((cell.row + 1) % rows) * cols + cell.column
    ];
    for (const neighborIndex of neighbors) {
      const neighbor = cellByIndex.get(neighborIndex);
      if (!neighbor) {
        continue;
      }
      const pairKey =
        cell.index < neighbor.index
          ? `${cell.index}:${neighbor.index}`
          : `${neighbor.index}:${cell.index}`;
      if (seenPairs.has(pairKey)) {
        continue;
      }
      seenPairs.add(pairKey);
      const distributionDistance = countDistributionDistance(
        cell.counts,
        neighbor.counts,
        cell.total,
        neighbor.total
      );
      const dominanceDifference =
        cell.dominantSpeciesId === neighbor.dominantSpeciesId ? 0 : 1;
      neighborPairs.push(distributionDistance * 0.65 + dominanceDifference * 0.35);
    }
  }

  const globalSpecies = [...speciesCellCounts.entries()]
    .map(([speciesIndex, bins]) => ({
      speciesIndex,
      bins,
      total: bins.reduce((sum, value) => sum + value, 0)
    }))
    .filter((entry) => entry.total >= Math.max(12, living * 0.015))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);

  const localization = mean(
    globalSpecies.map((entry) => Math.max(...entry.bins) / Math.max(1, entry.total))
  );

  return {
    occupiedRegions: occupiedCells.length,
    regionalPurity: mean(dominanceShares),
    regionalDistinctness:
      occupiedCells.length > 0
        ? dominantIds.size / occupiedCells.length
        : 0,
    regionalContrast: mean(neighborPairs),
    regionalLocalization: localization
  };
}

function collectSpringRegionMetrics(simulation, living) {
  if (!simulation.springs.length) {
    return {
      springNeighborhoods: 0,
      springPurity: 0,
      springDistinctness: 0,
      springContrast: 0
    };
  }

  const threshold = Math.max(12, living * 0.014);
  const neighborhoods = [];
  for (const spring of simulation.springs) {
    const radius = Math.max(140, spring.scatter * 1.35, spring.radius * 7);
    const counts = new Map();
    let total = 0;
    for (const organism of simulation.organisms) {
      if (!organism.alive) {
        continue;
      }
      if (torusDistance(spring, organism, simulation.config.world) > radius) {
        continue;
      }
      total += 1;
      counts.set(organism.speciesIndex, (counts.get(organism.speciesIndex) ?? 0) + 1);
    }
    if (total < threshold) {
      continue;
    }

    let dominantSpeciesId = null;
    let dominantCount = 0;
    for (const [speciesIndex, count] of counts) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantSpeciesId = speciesIndex;
      }
    }
    neighborhoods.push({
      total,
      counts,
      dominantSpeciesId,
      dominantShare: dominantCount / total
    });
  }

  const dominantIds = new Set(neighborhoods.map((entry) => entry.dominantSpeciesId));
  const pairScores = [];
  for (let index = 0; index < neighborhoods.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < neighborhoods.length; otherIndex += 1) {
      const left = neighborhoods[index];
      const right = neighborhoods[otherIndex];
      const distributionDistance = countDistributionDistance(
        left.counts,
        right.counts,
        left.total,
        right.total
      );
      const dominanceDifference =
        left.dominantSpeciesId === right.dominantSpeciesId ? 0 : 1;
      pairScores.push(distributionDistance * 0.6 + dominanceDifference * 0.4);
    }
  }

  return {
    springNeighborhoods: neighborhoods.length,
    springPurity: mean(neighborhoods.map((entry) => entry.dominantShare)),
    springDistinctness:
      neighborhoods.length > 0
        ? dominantIds.size / neighborhoods.length
        : 0,
    springContrast: mean(pairScores)
  };
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
  const gridMetrics = collectRegionalGridMetrics(simulation, living);
  const springMetrics = collectSpringRegionMetrics(simulation, living);

  return {
    living,
    lineages: lineageCounts.size,
    species: speciesCounts.size,
    totalMaterial: simulation.totalMaterial(),
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
    speciations: simulation.speciations,
    ...gridMetrics,
    ...springMetrics
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
    avgMaterial: [],
    tailMaterial: [],
    materialStd: [],
    avgRegionalPurity: [],
    tailRegionalPurity: [],
    avgRegionalDistinctness: [],
    tailRegionalDistinctness: [],
    avgRegionalContrast: [],
    tailRegionalContrast: [],
    avgRegionalLocalization: [],
    tailRegionalLocalization: [],
    avgOccupiedRegions: [],
    avgSpringPurity: [],
    tailSpringPurity: [],
    avgSpringDistinctness: [],
    tailSpringDistinctness: [],
    avgSpringContrast: [],
    tailSpringContrast: [],
    avgSpringNeighborhoods: [],
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
  aggregate.avgMaterial.push(summary.avgMaterial);
  aggregate.tailMaterial.push(summary.tailMaterial);
  aggregate.materialStd.push(summary.materialStd);
  aggregate.avgRegionalPurity.push(summary.avgRegionalPurity);
  aggregate.tailRegionalPurity.push(summary.tailRegionalPurity);
  aggregate.avgRegionalDistinctness.push(summary.avgRegionalDistinctness);
  aggregate.tailRegionalDistinctness.push(summary.tailRegionalDistinctness);
  aggregate.avgRegionalContrast.push(summary.avgRegionalContrast);
  aggregate.tailRegionalContrast.push(summary.tailRegionalContrast);
  aggregate.avgRegionalLocalization.push(summary.avgRegionalLocalization);
  aggregate.tailRegionalLocalization.push(summary.tailRegionalLocalization);
  aggregate.avgOccupiedRegions.push(summary.avgOccupiedRegions);
  aggregate.avgSpringPurity.push(summary.avgSpringPurity);
  aggregate.tailSpringPurity.push(summary.tailSpringPurity);
  aggregate.avgSpringDistinctness.push(summary.avgSpringDistinctness);
  aggregate.tailSpringDistinctness.push(summary.tailSpringDistinctness);
  aggregate.avgSpringContrast.push(summary.avgSpringContrast);
  aggregate.tailSpringContrast.push(summary.tailSpringContrast);
  aggregate.avgSpringNeighborhoods.push(summary.avgSpringNeighborhoods);
  aggregate.finalLiving.push(summary.finalLiving);
}

function finalizeAggregate(aggregate, initialOrganisms, targetMaterial) {
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
  const avgMaterial = mean(aggregate.avgMaterial);
  const tailMaterial = mean(aggregate.tailMaterial);
  const materialStd = mean(aggregate.materialStd);
  const avgRegionalPurity = mean(aggregate.avgRegionalPurity);
  const tailRegionalPurity = mean(aggregate.tailRegionalPurity);
  const avgRegionalDistinctness = mean(aggregate.avgRegionalDistinctness);
  const tailRegionalDistinctness = mean(aggregate.tailRegionalDistinctness);
  const avgRegionalContrast = mean(aggregate.avgRegionalContrast);
  const tailRegionalContrast = mean(aggregate.tailRegionalContrast);
  const avgRegionalLocalization = mean(aggregate.avgRegionalLocalization);
  const tailRegionalLocalization = mean(aggregate.tailRegionalLocalization);
  const avgOccupiedRegions = mean(aggregate.avgOccupiedRegions);
  const avgSpringPurity = mean(aggregate.avgSpringPurity);
  const tailSpringPurity = mean(aggregate.tailSpringPurity);
  const avgSpringDistinctness = mean(aggregate.avgSpringDistinctness);
  const tailSpringDistinctness = mean(aggregate.tailSpringDistinctness);
  const avgSpringContrast = mean(aggregate.avgSpringContrast);
  const tailSpringContrast = mean(aggregate.tailSpringContrast);
  const avgSpringNeighborhoods = mean(aggregate.avgSpringNeighborhoods);

  const avgMaterialCloseness =
    1 - saturate(Math.abs(avgMaterial - targetMaterial), 2600);
  const tailMaterialCloseness =
    1 - saturate(Math.abs(tailMaterial - targetMaterial), 1800);
  const materialStability = 1 - saturate(materialStd, 1800);

  const score =
    avgLineageEntropy * 0.08 +
    tailLineageEntropy * 0.11 +
    avgSpeciesEntropy * 0.03 +
    tailSpeciesEntropy * 0.05 +
    lineagePersistence * 0.07 +
    speciesPersistence * 0.04 +
    saturate(avgPersistentLineages, 24) * 0.03 +
    saturate(avgEventRate, 14) * 0.03 +
    saturate(avgSpeciationRate, 0.55) * 0.03 +
    saturate(tailSpeciationRate, 0.45) * 0.02 +
    saturate(avgCompositionDelta, 0.24) * 0.05 +
    saturate(dominantSwitchRate, 0.18) * 0.08 +
    (1 - saturate(avgDominantShare, 0.36)) * 0.03 +
    (1 - saturate(tailDominantShare, 0.32)) * 0.05 +
    avgRegionalPurity * 0.04 +
    tailRegionalPurity * 0.05 +
    avgRegionalDistinctness * 0.04 +
    tailRegionalDistinctness * 0.06 +
    avgRegionalContrast * 0.04 +
    tailRegionalContrast * 0.06 +
    avgRegionalLocalization * 0.05 +
    tailRegionalLocalization * 0.06 +
    avgSpringPurity * 0.03 +
    tailSpringPurity * 0.03 +
    avgSpringDistinctness * 0.03 +
    tailSpringDistinctness * 0.04 +
    avgSpringContrast * 0.02 +
    tailSpringContrast * 0.03 +
    saturate(avgOccupiedRegions, 8) * 0.03 +
    saturate(avgSpringNeighborhoods, 5) * 0.02 +
    avgMaterialCloseness * 0.08 +
    tailMaterialCloseness * 0.1 +
    materialStability * 0.05 +
    saturate(avgSpeed, 10) * 0.02 +
    saturate(tailSpeed, 10) * 0.02 +
    (avgLineages / initialOrganisms) * 0.02 +
    (tailLineages / initialOrganisms) * 0.03 -
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
    avgMaterial,
    tailMaterial,
    materialStd,
    avgRegionalPurity,
    tailRegionalPurity,
    avgRegionalDistinctness,
    tailRegionalDistinctness,
    avgRegionalContrast,
    tailRegionalContrast,
    avgRegionalLocalization,
    tailRegionalLocalization,
    avgOccupiedRegions,
    avgSpringPurity,
    tailSpringPurity,
    avgSpringDistinctness,
    tailSpringDistinctness,
    avgSpringContrast,
    tailSpringContrast,
    avgSpringNeighborhoods,
    finalLiving: mean(aggregate.finalLiving),
    lineagesStd: stddev(aggregate.avgLineages),
    regionalStd: stddev(aggregate.tailRegionalDistinctness),
    materialStdSpread: stddev(aggregate.materialStd)
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
        mean(safeTailSamples.map((sample) => sample.lineageEntropy)) < 0.72 ||
        mean(safeTailSamples.map((sample) => sample.regionalDistinctness)) < 0.32;

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
        avgMaterial: mean(samples.map((sample) => sample.totalMaterial)),
        tailMaterial: mean(safeTailSamples.map((sample) => sample.totalMaterial)),
        materialStd: stddev(samples.map((sample) => sample.totalMaterial)),
        avgRegionalPurity: mean(samples.map((sample) => sample.regionalPurity)),
        tailRegionalPurity: mean(safeTailSamples.map((sample) => sample.regionalPurity)),
        avgRegionalDistinctness: mean(
          samples.map((sample) => sample.regionalDistinctness)
        ),
        tailRegionalDistinctness: mean(
          safeTailSamples.map((sample) => sample.regionalDistinctness)
        ),
        avgRegionalContrast: mean(samples.map((sample) => sample.regionalContrast)),
        tailRegionalContrast: mean(safeTailSamples.map((sample) => sample.regionalContrast)),
        avgRegionalLocalization: mean(
          samples.map((sample) => sample.regionalLocalization)
        ),
        tailRegionalLocalization: mean(
          safeTailSamples.map((sample) => sample.regionalLocalization)
        ),
        avgOccupiedRegions: mean(samples.map((sample) => sample.occupiedRegions)),
        avgSpringPurity: mean(samples.map((sample) => sample.springPurity)),
        tailSpringPurity: mean(safeTailSamples.map((sample) => sample.springPurity)),
        avgSpringDistinctness: mean(
          samples.map((sample) => sample.springDistinctness)
        ),
        tailSpringDistinctness: mean(
          safeTailSamples.map((sample) => sample.springDistinctness)
        ),
        avgSpringContrast: mean(samples.map((sample) => sample.springContrast)),
        tailSpringContrast: mean(safeTailSamples.map((sample) => sample.springContrast)),
        avgSpringNeighborhoods: mean(
          samples.map((sample) => sample.springNeighborhoods)
        ),
        finalLiving: finalMetrics.living,
        collapsed
      };
    });

    addRunSummary(aggregate, summary);
  }

  return {
    name: candidate.name,
    config,
    ...finalizeAggregate(aggregate, initialOrganisms, config.world.totalMaterial)
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
    "rDist".padStart(8),
    "contrast".padStart(9),
    "local".padStart(8),
    "springs".padStart(8),
    "switch".padStart(8),
    "tailMat".padStart(9),
    "coll".padStart(8)
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(18),
      result.score.toFixed(3).padStart(7),
      result.tailLineageEntropy.toFixed(3).padStart(7),
      result.tailRegionalDistinctness.toFixed(3).padStart(8),
      result.tailRegionalContrast.toFixed(3).padStart(9),
      result.tailRegionalLocalization.toFixed(3).padStart(8),
      result.tailSpringDistinctness.toFixed(3).padStart(8),
      formatRatio(result.dominantSwitchRate).padStart(8),
      result.tailMaterial.toFixed(0).padStart(9),
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
    name: "spring-canopy",
    seedBias: 2,
    override: {
      terrain: {
        peakCount: 9,
        radiusMin: 115,
        radiusMax: 230,
        slowdownStart: 0.42,
        dragBoost: 1.12,
        blockThreshold: 0.88,
        minTraversal: 0.44
      },
      springs: {
        initialCount: 5,
        packetMass: 1.55,
        interval: 0.37,
        scatter: 104,
        pauseNearbyMass: 64,
        maxCount: 23
      },
      economy: {
        globalRespawnFraction: 0.06,
        corpseScatterRadius: 46,
        resourceLifetime: 13
      },
      organisms: {
        baseThrust: 14,
        sensoryBase: 93,
        sensoryMassFactor: 7.6,
        sameSpeciesSpacing: 10.2
      },
      flocking: {
        influenceScale: 1.18,
        alignmentWeight: 1.05,
        cohesionWeight: 1.4,
        separationWeight: 1,
        countInfluence: 0.15
      },
      mutation: {
        slotTypeChance: 0.09,
        allocationJitter: 0.31,
        traitJitter: 0.29,
        speciationChance: 0.02,
        speciationDriftFactor: 0.46,
        speciesShiftSpeciationBonus: 0.27
      }
    }
  },
  {
    name: "pocket-ridge",
    seedBias: 3,
    override: {
      terrain: {
        peakCount: 9,
        radiusMin: 100,
        radiusMax: 200,
        slowdownStart: 0.42,
        dragBoost: 1.18,
        blockThreshold: 0.87,
        minTraversal: 0.43
      },
      springs: {
        initialCount: 5,
        packetMass: 1.55,
        interval: 0.37,
        scatter: 90,
        pauseNearbyMass: 62,
        maxCount: 24
      },
      economy: {
        globalRespawnFraction: 0.05,
        corpseScatterRadius: 46,
        resourceLifetime: 13
      },
      organisms: {
        baseThrust: 13.7,
        sensoryBase: 90,
        sensoryMassFactor: 7.5,
        sameSpeciesSpacing: 10.4
      },
      flocking: {
        influenceScale: 1.2,
        alignmentWeight: 1.08,
        cohesionWeight: 1.46,
        separationWeight: 1,
        countInfluence: 0.16
      },
      mutation: {
        slotTypeChance: 0.092,
        allocationJitter: 0.31,
        traitJitter: 0.29,
        speciationChance: 0.021,
        speciationDriftFactor: 0.48,
        speciesShiftSpeciationBonus: 0.28
      }
    }
  },
  {
    name: "braid-oasis",
    seedBias: 4,
    override: {
      terrain: {
        peakCount: 10,
        radiusMin: 95,
        radiusMax: 185,
        slowdownStart: 0.39,
        dragBoost: 1.24,
        blockThreshold: 0.84,
        minTraversal: 0.39
      },
      springs: {
        initialCount: 6,
        packetMass: 1.45,
        interval: 0.39,
        scatter: 84,
        pauseNearbyMass: 60,
        maxCount: 24
      },
      economy: {
        globalRespawnFraction: 0.05,
        corpseScatterRadius: 44,
        resourceLifetime: 13
      },
      organisms: {
        baseThrust: 13.5,
        sensoryBase: 88,
        sensoryMassFactor: 7.2,
        sameSpeciesSpacing: 10.8
      },
      flocking: {
        influenceScale: 1.24,
        alignmentWeight: 1.1,
        cohesionWeight: 1.5,
        separationWeight: 1.02,
        countInfluence: 0.17
      },
      mutation: {
        slotTypeChance: 0.094,
        allocationJitter: 0.31,
        traitJitter: 0.29,
        speciationChance: 0.022,
        speciationDriftFactor: 0.5,
        speciesShiftSpeciationBonus: 0.29
      }
    }
  },
  {
    name: "terrace-oasis",
    seedBias: 5,
    override: {
      terrain: {
        peakCount: 7,
        radiusMin: 140,
        radiusMax: 260,
        slowdownStart: 0.44,
        dragBoost: 1,
        blockThreshold: 0.88,
        minTraversal: 0.49
      },
      springs: {
        initialCount: 5,
        packetMass: 1.7,
        interval: 0.35,
        scatter: 98,
        pauseNearbyMass: 66,
        maxCount: 22
      },
      economy: {
        globalRespawnFraction: 0.06,
        corpseScatterRadius: 48,
        resourceLifetime: 14
      },
      organisms: {
        baseThrust: 13.9,
        sensoryBase: 91,
        sensoryMassFactor: 7.4,
        sameSpeciesSpacing: 10.2
      },
      flocking: {
        influenceScale: 1.18,
        alignmentWeight: 1.06,
        cohesionWeight: 1.42,
        separationWeight: 0.98,
        countInfluence: 0.15
      },
      mutation: {
        slotTypeChance: 0.09,
        allocationJitter: 0.3,
        traitJitter: 0.28,
        speciationChance: 0.02,
        speciationDriftFactor: 0.46,
        speciesShiftSpeciationBonus: 0.27
      }
    }
  },
  {
    name: "ridge-pocket",
    seedBias: 6,
    override: {
      terrain: {
        peakCount: 8,
        radiusMin: 115,
        radiusMax: 235,
        slowdownStart: 0.42,
        dragBoost: 1.1,
        blockThreshold: 0.88,
        minTraversal: 0.45
      },
      springs: {
        initialCount: 4,
        packetMass: 1.55,
        interval: 0.36,
        scatter: 108,
        pauseNearbyMass: 64,
        maxCount: 22
      },
      economy: {
        globalRespawnFraction: 0.06,
        corpseScatterRadius: 48,
        resourceLifetime: 13
      },
      organisms: {
        baseThrust: 14.05,
        sensoryBase: 93,
        sensoryMassFactor: 7.6,
        sameSpeciesSpacing: 10.2
      },
      flocking: {
        influenceScale: 1.18,
        alignmentWeight: 1.05,
        cohesionWeight: 1.4,
        separationWeight: 1,
        countInfluence: 0.14
      },
      mutation: {
        slotTypeChance: 0.089,
        allocationJitter: 0.31,
        traitJitter: 0.29,
        speciationChance: 0.02,
        speciationDriftFactor: 0.45,
        speciesShiftSpeciationBonus: 0.26
      }
    }
  },
  {
    name: "delta-weave",
    seedBias: 7,
    override: {
      terrain: {
        peakCount: 6,
        radiusMin: 155,
        radiusMax: 285,
        slowdownStart: 0.45,
        dragBoost: 0.92,
        blockThreshold: 0.89,
        minTraversal: 0.5
      },
      springs: {
        initialCount: 5,
        packetMass: 1.72,
        interval: 0.34,
        scatter: 104,
        pauseNearbyMass: 70,
        maxCount: 22
      },
      economy: {
        globalRespawnFraction: 0.06,
        corpseScatterRadius: 50,
        resourceLifetime: 14
      },
      organisms: {
        baseThrust: 13.8,
        sensoryBase: 92,
        sensoryMassFactor: 7.6,
        sameSpeciesSpacing: 10.1
      },
      flocking: {
        influenceScale: 1.17,
        alignmentWeight: 1.04,
        cohesionWeight: 1.38,
        separationWeight: 0.98,
        countInfluence: 0.14
      },
      mutation: {
        slotTypeChance: 0.089,
        allocationJitter: 0.3,
        traitJitter: 0.28,
        speciationChance: 0.02,
        speciationDriftFactor: 0.45,
        speciesShiftSpeciationBonus: 0.26
      }
    }
  }
];

const candidateFilter = (process.env.CANDIDATES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const activeCandidates = candidateFilter.length
  ? candidates.filter((candidate) => candidateFilter.includes(candidate.name))
  : candidates;

const stage1Runs = Number(process.env.STAGE1_RUNS ?? 4);
const stage1Frames = Number(process.env.STAGE1_FRAMES ?? 2100);
const stage1SampleEvery = Number(process.env.STAGE1_SAMPLE_EVERY ?? 105);
const stage2Runs = Number(process.env.STAGE2_RUNS ?? 5);
const stage2Frames = Number(process.env.STAGE2_FRAMES ?? 2700);
const stage2SampleEvery = Number(process.env.STAGE2_SAMPLE_EVERY ?? 135);

const stage1 = activeCandidates
  .map((candidate) =>
    runCandidate(candidate, {
      runs: stage1Runs,
      frames: stage1Frames,
      sampleEvery: stage1SampleEvery,
      seedOffset: 16000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 1 - regional differentiation", stage1);

const finalists = stage1.slice(0, 3).map((result, index) => ({
  name: result.name,
  seedBias: 60 + index,
  override: candidates.find((candidate) => candidate.name === result.name)?.override ?? {}
}));

const stage2 = finalists
  .map((candidate) =>
    runCandidate(candidate, {
      runs: stage2Runs,
      frames: stage2Frames,
      sampleEvery: stage2SampleEvery,
      seedOffset: 24000
    })
  )
  .sort((left, right) => right.score - left.score);

printStage("Stage 2 - regional confirmation", stage2);

const winner = stage2[0];
console.log("\nRecommended override:");
console.log(
  JSON.stringify(
    {
      name: winner.name,
      score: winner.score,
      tailLineageEntropy: winner.tailLineageEntropy,
      tailRegionalDistinctness: winner.tailRegionalDistinctness,
      tailRegionalContrast: winner.tailRegionalContrast,
      tailRegionalLocalization: winner.tailRegionalLocalization,
      tailSpringDistinctness: winner.tailSpringDistinctness,
      dominantSwitchRate: winner.dominantSwitchRate,
      tailMaterial: winner.tailMaterial,
      collapseRate: winner.collapseRate,
      override: finalists.find((candidate) => candidate.name === winner.name)?.override ?? {}
    },
    null,
    2
  )
);
