import {
  clamp,
  clampConfig,
  deepClone,
  defaultConfig,
  directionCount,
  gadgetOrder,
  minSlotCount,
  speciesCount
} from "./config.js";

export const SIDE_NAMES = ["Front", "Left", "Right"];
export const SIDE_ANGLES = Array.from(
  { length: directionCount },
  (_, index) => (Math.PI * 2 * index) / directionCount
);
const SPECIES_LENGTH_OFFSETS = Array.from({ length: directionCount + 1 }, () => 0);
let speciesOffset = 0;
for (let slotCount = minSlotCount; slotCount <= directionCount; slotCount += 1) {
  SPECIES_LENGTH_OFFSETS[slotCount] = speciesOffset;
  speciesOffset += gadgetOrder.length ** slotCount;
}
const LINEAGE_NAMES = [
  "Acid",
  "Acre",
  "Arch",
  "Army",
  "Atom",
  "Aunt",
  "Axle",
  "Bait",
  "Bale",
  "Band",
  "Bank",
  "Bark",
  "Barn",
  "Bass",
  "Bear",
  "Beam",
  "Bean",
  "Beet",
  "Bell",
  "Belt",
  "Bird",
  "Boat",
  "Bolt",
  "Book",
  "Boot",
  "Bowl",
  "Buck",
  "Bulb",
  "Bull",
  "Cage",
  "Cake",
  "Calf",
  "Cane",
  "Cape",
  "Card",
  "Carp",
  "Cart",
  "Cave",
  "Cell",
  "Chef",
  "City",
  "Claw",
  "Clay",
  "Club",
  "Coal",
  "Coat",
  "Colt",
  "Cone",
  "Cook",
  "Coop",
  "Cord",
  "Cork",
  "Corn",
  "Crab",
  "Crew",
  "Crop",
  "Crow",
  "Cube",
  "Dale",
  "Dawn",
  "Deer",
  "Desk",
  "Dial",
  "Disk",
  "Dock",
  "Door",
  "Dove",
  "Drop",
  "Drum",
  "Duck",
  "Dune",
  "Dust",
  "Fang",
  "Farm",
  "Fern",
  "Fire",
  "Fish",
  "Flag",
  "Flax",
  "Flea",
  "Foal",
  "Foam",
  "Folk",
  "Food",
  "Foot",
  "Fork",
  "Frog",
  "Fuel",
  "Gale",
  "Game",
  "Gate",
  "Gear",
  "Gift",
  "Gnat",
  "Goat",
  "Gold",
  "Gong",
  "Grub",
  "Gulf",
  "Gull",
  "Hail",
  "Hall",
  "Hand",
  "Hare",
  "Harp",
  "Hawk",
  "Head",
  "Heap",
  "Heel",
  "Herb",
  "Hill",
  "Hive",
  "Hoof",
  "Hook",
  "Horn",
  "Husk",
  "Ibis",
  "Idol",
  "Iris",
  "Isle",
  "Jade",
  "Junk",
  "Kelp",
  "Kite",
  "Knot",
  "Lake",
  "Lamb",
  "Lamp",
  "Land",
  "Lark",
  "Lava",
  "Leaf",
  "Lens",
  "Lily",
  "Limb",
  "Lion",
  "Loaf",
  "Loom",
  "Lure",
  "Mace",
  "Mall",
  "Mare",
  "Mask",
  "Meal",
  "Mint",
  "Mist",
  "Mole",
  "Moon",
  "Moss",
  "Mule",
  "Nail",
  "Nest",
  "Note",
  "Nook",
  "Oath",
  "Oats",
  "Oxen",
  "Pail",
  "Palm",
  "Park",
  "Path",
  "Peak",
  "Pear",
  "Pelt",
  "Pill",
  "Pine",
  "Pipe",
  "Plum",
  "Pond",
  "Port",
  "Post",
  "Puma",
  "Pupa",
  "Pyre",
  "Rail",
  "Rain",
  "Reed",
  "Reef",
  "Rein",
  "Rice",
  "Ring",
  "Road",
  "Rock",
  "Roof",
  "Root",
  "Rope",
  "Rose",
  "Rust",
  "Sage",
  "Sail",
  "Salt",
  "Sand",
  "Seal",
  "Seat",
  "Seed",
  "Shed",
  "Silk",
  "Silt",
  "Skin",
  "Slab",
  "Slat",
  "Sled",
  "Slug",
  "Smog",
  "Snow",
  "Soap",
  "Sock",
  "Soil",
  "Song",
  "Soot",
  "Span",
  "Spur",
  "Star",
  "Stem",
  "Step",
  "Stew",
  "Surf",
  "Swan",
  "Tent",
  "Tide",
  "Tile",
  "Toad",
  "Tool",
  "Tray",
  "Tree",
  "Turf",
  "Tusk",
  "Vase",
  "Veil",
  "Vine",
  "Vole",
  "Wave",
  "Well",
  "Wind",
  "Wolf",
  "Wood",
  "Wool",
  "Worm",
  "Yard",
  "Yarn",
  "Yolk",
  "Zinc",
  "Zone"
];
const PROFILE_KEYS = [
  "indexesStart",
  "behavior",
  "indexesMid",
  "intake",
  "ranged",
  "contact",
  "upkeep",
  "budding",
  "cleanup",
  "indexesEnd",
  "rebalance",
  "stats"
];
const DOMINANT_LINEAGE_LIMIT = 4;
const PHYLOGENY_LINEAGE_LIMIT = 12;
const BEHAVIOR_PRIORITY_KEYS = ["food", "danger", "prey", "flock", "cruise"];
const EPSILON = 1e-6;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function nowMillis() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function createEmptyProfileSample() {
  return {
    frames: 0,
    organisms: 0,
    resources: 0,
    stepMs: 0,
    statsMs: 0,
    totals: Object.fromEntries(PROFILE_KEYS.map((key) => [key, 0]))
  };
}

function wrapAngle(angle) {
  let cursor = angle;
  while (cursor <= -Math.PI) {
    cursor += Math.PI * 2;
  }
  while (cursor > Math.PI) {
    cursor -= Math.PI * 2;
  }
  return cursor;
}

function wrapCoordinate(value, size) {
  if (size <= EPSILON) {
    return 0;
  }
  return ((value % size) + size) % size;
}

function torusDelta(fromValue, toValue, size) {
  if (size <= EPSILON) {
    return 0;
  }

  let delta = toValue - fromValue;
  if (delta > size * 0.5) {
    delta -= size;
  } else if (delta < -size * 0.5) {
    delta += size;
  }
  return delta;
}

function euclideanOffset(from, to, world) {
  const dx = world ? torusDelta(from.x, to.x, world.width) : to.x - from.x;
  const dy = world ? torusDelta(from.y, to.y, world.height) : to.y - from.y;
  const distanceSq = dx * dx + dy * dy;
  return {
    dx,
    dy,
    distanceSq,
    distance: Math.sqrt(distanceSq)
  };
}

function hsv(hue, saturation, lightness, alpha = 1) {
  return `hsla(${hue} ${saturation}% ${lightness}% / ${alpha})`;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return sum(values) / values.length;
}

function leinsterEntropyFromCounts(counts) {
  const total = sum(counts);
  if (total <= EPSILON) {
    return 0;
  }
  let entropy = 0;
  for (const count of counts) {
    if (count <= EPSILON) {
      continue;
    }
    const p = count / total;
    entropy -= p * Math.log(p);
  }
  return entropy;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function variance(values, mean = average(values)) {
  if (!values.length) {
    return 0;
  }
  return (
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
  );
}

function wrapHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function organismMass(organism) {
  return organism.coreMass + organism.motorMass + sum(organism.slotMasses);
}

function resourceRadius(node, config) {
  return Math.max(
    1.8,
    Math.sqrt(Math.max(0, node.mass)) * config.render.resourceScale
  );
}

function terrainEnabled(config) {
  return Number(config.terrain?.enabled ?? 0) >= 0.5;
}

function generateTerrainField(config, version = 0) {
  if (!terrainEnabled(config) || (config.terrain?.peakCount ?? 0) <= 0) {
    return {
      enabled: false,
      version,
      columns: 0,
      rows: 0,
      samples: new Float32Array(0)
    };
  }

  const columns = clamp(Math.round(config.world.width / 110), 28, 64);
  const rows = clamp(Math.round(config.world.height / 110), 18, 44);
  const peakCount = Math.max(0, Math.round(config.terrain.peakCount));
  const minRadius = Math.max(24, Math.min(config.terrain.radiusMin, config.terrain.radiusMax));
  const maxRadius = Math.max(minRadius, config.terrain.radiusMax);
  const peaks = Array.from({ length: peakCount }, () => {
    const radiusX = randomBetween(minRadius, maxRadius);
    const aspect = randomBetween(0.55, 1.85);
    return {
      x: randomBetween(0, config.world.width),
      y: randomBetween(0, config.world.height),
      radiusX,
      radiusY: radiusX * aspect,
      angle: randomBetween(-Math.PI, Math.PI),
      strength: randomBetween(0.58, 1.2)
    };
  });
  const waveA = {
    phaseX: randomBetween(-Math.PI, Math.PI),
    phaseY: randomBetween(-Math.PI, Math.PI),
    freqX: randomBetween(1.2, 2.4),
    freqY: randomBetween(1.4, 2.8)
  };
  const waveB = {
    phaseX: randomBetween(-Math.PI, Math.PI),
    phaseY: randomBetween(-Math.PI, Math.PI),
    freqX: randomBetween(2.4, 4.2),
    freqY: randomBetween(2.2, 4.4)
  };
  const samples = new Float32Array(columns * rows);
  let maxValue = EPSILON;

  for (let row = 0; row < rows; row += 1) {
    const y = (row / rows) * config.world.height;
    for (let column = 0; column < columns; column += 1) {
      const x = (column / columns) * config.world.width;
      let height = 0;

      for (const peak of peaks) {
        const dx = torusDelta(x, peak.x, config.world.width);
        const dy = torusDelta(y, peak.y, config.world.height);
        const cosAngle = Math.cos(peak.angle);
        const sinAngle = Math.sin(peak.angle);
        const localX = (dx * cosAngle + dy * sinAngle) / peak.radiusX;
        const localY = (-dx * sinAngle + dy * cosAngle) / peak.radiusY;
        height += peak.strength * Math.exp(-(localX * localX + localY * localY) * 1.7);
      }

      const nx = x / config.world.width;
      const ny = y / config.world.height;
      const wavePrimary =
        Math.sin(nx * Math.PI * 2 * waveA.freqX + waveA.phaseX) *
        Math.sin(ny * Math.PI * 2 * waveA.freqY + waveA.phaseY);
      const waveSecondary =
        Math.sin(nx * Math.PI * 2 * waveB.freqX + waveB.phaseX) *
        Math.cos(ny * Math.PI * 2 * waveB.freqY + waveB.phaseY);
      height += Math.max(0, wavePrimary) * 0.22 + Math.max(0, waveSecondary) * 0.14;

      const index = row * columns + column;
      samples[index] = height;
      maxValue = Math.max(maxValue, height);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const normalized = clamp(samples[index] / maxValue, 0, 1);
    samples[index] = Math.pow(normalized, 0.9);
  }

  return {
    enabled: true,
    version,
    columns,
    rows,
    samples
  };
}

function terrainHeightAt(simulation, x, y) {
  const terrain = simulation.terrain;
  if (!terrain?.enabled || terrain.samples.length === 0) {
    return 0;
  }

  const nx = wrapCoordinate(x, simulation.config.world.width) / simulation.config.world.width;
  const ny = wrapCoordinate(y, simulation.config.world.height) / simulation.config.world.height;
  const fx = nx * terrain.columns;
  const fy = ny * terrain.rows;
  const x0 = Math.floor(fx) % terrain.columns;
  const y0 = Math.floor(fy) % terrain.rows;
  const x1 = (x0 + 1) % terrain.columns;
  const y1 = (y0 + 1) % terrain.rows;
  const tx = fx - Math.floor(fx);
  const ty = fy - Math.floor(fy);
  const rowStride = terrain.columns;

  const sample00 = terrain.samples[y0 * rowStride + x0];
  const sample10 = terrain.samples[y0 * rowStride + x1];
  const sample01 = terrain.samples[y1 * rowStride + x0];
  const sample11 = terrain.samples[y1 * rowStride + x1];

  const top = lerp(sample00, sample10, tx);
  const bottom = lerp(sample01, sample11, tx);
  return lerp(top, bottom, ty);
}

function reshapeTerrainField(simulation, x, y, options = {}) {
  const terrain = simulation.terrain;
  if (!terrain?.enabled || terrain.samples.length === 0) {
    return false;
  }

  const world = simulation.config.world;
  const center = clampPointToWorld(x, y, world);
  const radius = clamp(
    Number(options.radius) || (simulation.config.terrain.radiusMin + simulation.config.terrain.radiusMax) * 0.16,
    28,
    Math.min(world.width, world.height) * 0.24
  );
  const signedStrength = Number(options.strength) || 0.22;
  const strength = clamp(Math.abs(signedStrength), 0.02, 0.75);
  const direction = signedStrength >= 0 ? 1 : -1;
  let changed = false;

  for (let row = 0; row < terrain.rows; row += 1) {
    const sampleY = ((row + 0.5) / terrain.rows) * world.height;
    const dy = torusDelta(center.y, sampleY, world.height);
    if (Math.abs(dy) > radius * 1.8) {
      continue;
    }
    for (let column = 0; column < terrain.columns; column += 1) {
      const sampleX = ((column + 0.5) / terrain.columns) * world.width;
      const dx = torusDelta(center.x, sampleX, world.width);
      if (Math.abs(dx) > radius * 1.8) {
        continue;
      }
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > radius * radius * 3.24) {
        continue;
      }
      const influence = Math.exp(-distanceSq / Math.max(EPSILON, radius * radius * 0.62));
      if (influence <= 0.002) {
        continue;
      }
      const index = row * terrain.columns + column;
      const nextValue = clamp(terrain.samples[index] + direction * strength * influence, 0, 1);
      if (Math.abs(nextValue - terrain.samples[index]) > EPSILON) {
        terrain.samples[index] = nextValue;
        changed = true;
      }
    }
  }

  if (changed) {
    terrain.version += 1;
    simulation.terrainVersion = terrain.version;
  }
  return changed;
}

function raiseTerrainField(simulation, x, y, options = {}) {
  return reshapeTerrainField(simulation, x, y, {
    ...options,
    strength: Math.abs(Number(options.strength) || 0.22)
  });
}

function erodeTerrainField(simulation, x, y, options = {}) {
  return reshapeTerrainField(simulation, x, y, {
    ...options,
    strength: -Math.abs(Number(options.strength) || 0.18)
  });
}

function terrainTraversalData(simulation, x, y) {
  const height = terrainHeightAt(simulation, x, y);
  const terrainConfig = simulation.config.terrain ?? {};
  const slowdownStart = clamp(terrainConfig.slowdownStart ?? 0.24, 0, 0.95);
  const blockThreshold = clamp(
    Math.max(slowdownStart + 0.04, terrainConfig.blockThreshold ?? 0.72),
    slowdownStart + 0.04,
    0.99
  );
  const slowdown = clamp(
    (height - slowdownStart) / Math.max(EPSILON, 1 - slowdownStart),
    0,
    1
  );
  const ridge = clamp(
    (height - blockThreshold) / Math.max(EPSILON, 1 - blockThreshold),
    0,
    1
  );
  const minTraversal = clamp(terrainConfig.minTraversal ?? 0.08, 0.01, 1);
  return {
    height,
    slowdown,
    ridge,
    dragFactor: 1 + slowdown * (terrainConfig.dragBoost ?? 0),
    traversal: Math.max(minTraversal, 1 - slowdown * 0.62 - ridge * 0.78)
  };
}

export function terrainMovementProfile(simulation, x, y) {
  const terrain = terrainTraversalData(simulation, x, y);
  const thrustScale = Math.max(0.08, 1 - terrain.slowdown * 0.72);
  const dragPenalty = 1 / Math.max(EPSILON, terrain.dragFactor);
  const mobility = clamp(terrain.traversal * thrustScale * dragPenalty, 0, 1);
  return {
    ...terrain,
    thrustScale,
    dragPenalty,
    mobility
  };
}

export function organismRadius(organism, config) {
  return Math.max(
    5.4,
    Math.sqrt(Math.max(0, organismMass(organism))) * config.render.organismScale
  );
}

function normalizeRatios(values) {
  const total = sum(values);
  if (total <= EPSILON) {
    return values.map(() => 1 / values.length);
  }
  return values.map((value) => value / total);
}

function choice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function choiceIndex(length) {
  return Math.floor(Math.random() * length);
}

function mutateScalar(value, jitter, min, max) {
  const next = value + randomBetween(-jitter, jitter);
  return clamp(next, min, max);
}

function clampVisualShape(shape) {
  return {
    lobes: clamp(Math.round(shape?.lobes ?? 3), 2, 6),
    amplitude: clamp(shape?.amplitude ?? 0.12, 0.02, 0.22),
    wobble: clamp(shape?.wobble ?? 0.06, 0, 0.16),
    squish: clamp(shape?.squish ?? 1, 0.82, 1.22),
    tilt: clamp(shape?.tilt ?? 0, -0.55, 0.55),
    phase: wrapAngle(shape?.phase ?? 0)
  };
}

function cachedGenomeFeatures(genome, config) {
  if (!genome) {
    return normalizedGenomeFeatures({}, config);
  }
  if (!genome.__cachedFeatures) {
    genome.__cachedFeatures = normalizedGenomeFeatures(genome, config);
  }
  return genome.__cachedFeatures;
}

function minimumBirthThresholdMass(config) {
  const minimumRemainder =
    config.organisms.minViableMass + config.organisms.minViableCore + 2;
  return Math.max(
    config.organisms.minBirthThresholdMass ?? 0,
    minimumRemainder + 6
  );
}

function effectiveBirthThresholdMass(genome, config) {
  return Math.max(genome?.thresholdMass ?? 0, minimumBirthThresholdMass(config));
}

export function genomeVisualShape(genome) {
  if (!genome) {
    return clampVisualShape({});
  }
  if (!genome.__cachedVisualShape) {
    genome.__cachedVisualShape = clampVisualShape({
      lobes: genome?.shapeLobes,
      amplitude: genome?.shapeAmplitude,
      wobble: genome?.shapeWobble,
      squish: genome?.shapeSquish,
      tilt: genome?.shapeTilt,
      phase: genome?.shapePhase
    });
  }
  return genome.__cachedVisualShape;
}

export function visualShapeFromFeatures(features) {
  const phase = Math.atan2(
    features?.shapePhaseSin ?? 0,
    features?.shapePhaseCos ?? 1
  );
  return clampVisualShape({
    lobes: 2 + Math.round(clamp(features?.shapeLobes ?? 0.25, 0, 1) * 4),
    amplitude: 0.02 + clamp(features?.shapeAmplitude ?? 0.5, 0, 1) * 0.2,
    wobble: clamp(features?.shapeWobble ?? 0.35, 0, 1) * 0.16,
    squish: 0.82 + clamp(features?.shapeSquish ?? 0.5, 0, 1) * 0.4,
    tilt: -0.55 + clamp(features?.shapeTilt ?? 0.5, 0, 1) * 1.1,
    phase
  });
}

function clampPointToWorld(x, y, world) {
  return {
    x: wrapCoordinate(x, world.width),
    y: wrapCoordinate(y, world.height)
  };
}

function spatialKey(cellX, cellY) {
  return `${cellX}:${cellY}`;
}

function buildSpatialIndex(items, cellSize, world = null) {
  const buckets = new Map();
  for (const item of items) {
    const cellX = Math.floor(item.x / cellSize);
    const cellY = Math.floor(item.y / cellSize);
    const key = spatialKey(cellX, cellY);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }
  return { cellSize, buckets, world };
}

function visitSpatialIndex(index, x, y, radius, visitor) {
  if (!index) {
    return;
  }

  const world = index.world;
  const xCenters = [x];
  const yCenters = [y];
  if (world) {
    if (x - radius < 0) {
      xCenters.push(x + world.width);
    }
    if (x + radius > world.width) {
      xCenters.push(x - world.width);
    }
    if (y - radius < 0) {
      yCenters.push(y + world.height);
    }
    if (y + radius > world.height) {
      yCenters.push(y - world.height);
    }
  }

  const seen = new Set();
  for (const centerY of yCenters) {
    const minCellY = Math.floor((centerY - radius) / index.cellSize);
    const maxCellY = Math.floor((centerY + radius) / index.cellSize);
    for (const centerX of xCenters) {
      const minCellX = Math.floor((centerX - radius) / index.cellSize);
      const maxCellX = Math.floor((centerX + radius) / index.cellSize);
      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
          const bucket = index.buckets.get(spatialKey(cellX, cellY));
          if (!bucket) {
            continue;
          }
          for (const item of bucket) {
            if (seen.has(item.id)) {
              continue;
            }
            seen.add(item.id);
            visitor(item);
          }
        }
      }
    }
  }
}

function buildOrganismSpatialIndex(simulation) {
  const cellSize = Math.max(44, simulation.config.organisms.sensoryBase * 0.9);
  const alive = simulation.organisms.filter((organism) => organism.alive);
  const index = buildSpatialIndex(alive, cellSize, simulation.config.world);
  index.maxRadius = alive.reduce(
    (largest, organism) =>
      Math.max(largest, organismRadius(organism, simulation.config)),
    0
  );
  return index;
}

function buildResourceSpatialIndex(simulation) {
  const cellSize = Math.max(32, simulation.config.organisms.sensoryBase * 0.75);
  const active = simulation.resources.filter((resource) => resource.mass > EPSILON);
  const index = buildSpatialIndex(active, cellSize, simulation.config.world);
  index.maxRadius = active.reduce(
    (largest, resource) =>
      Math.max(largest, resourceRadius(resource, simulation.config)),
    0
  );
  return index;
}

function speciesIndexFromSlotTypes(slotTypes) {
  const base = gadgetOrder.length;
  const slotCount = clamp(slotTypes.length, minSlotCount, directionCount);
  let localIndex = Infinity;

  for (let rotation = 0; rotation < slotCount; rotation += 1) {
    const rotatedIndex = slotTypes.reduce((index, _, slotIndex) => {
      const rotatedSlotType = slotTypes[(slotIndex + rotation) % slotCount];
      const typeIndex = Math.max(0, gadgetOrder.indexOf(rotatedSlotType));
      return index + typeIndex * base ** slotIndex;
    }, 0);
    if (rotatedIndex < localIndex) {
      localIndex = rotatedIndex;
    }
  }

  return SPECIES_LENGTH_OFFSETS[slotCount] + localIndex;
}

export function slotAngleOffset(sideIndex, slotCount) {
  const count = clamp(Math.round(slotCount || 1), 1, directionCount);
  return (Math.PI * 2 * sideIndex) / count;
}

function normalizeSpeciesThresholds(genome) {
  for (let index = 0; index < speciesCount; index += 1) {
    const approach = clamp(genome.approachMassRatios[index], 0.18, 1.45);
    const avoid = clamp(
      Math.max(genome.avoidMassRatios[index], approach + 0.12),
      0.9,
      3.2
    );
    genome.approachMassRatios[index] = approach;
    genome.avoidMassRatios[index] = avoid;
  }
}

function normalizeBehaviorPriorityMap(priorities = {}) {
  const ratios = normalizeRatios(
    BEHAVIOR_PRIORITY_KEYS.map((key) =>
      Math.max(EPSILON, Number(priorities?.[key]) || EPSILON)
    )
  );
  return Object.fromEntries(
    BEHAVIOR_PRIORITY_KEYS.map((key, index) => [key, ratios[index]])
  );
}

function randomBehaviorPriorities() {
  return normalizeBehaviorPriorityMap({
    food: randomBetween(1.02, 1.52),
    danger: randomBetween(1.14, 1.72),
    prey: randomBetween(0.7, 1.24),
    flock: randomBetween(0.3, 0.96),
    cruise: randomBetween(0.08, 0.42)
  });
}

function derivedBehaviorPriorities(genome) {
  return normalizeBehaviorPriorityMap({
    food:
      0.92 +
      (genome?.sensorBias ?? 0.8) * 0.62 +
      (genome?.allocation?.[0] ?? 0.33) * 0.12,
    danger:
      1.08 +
      average(genome?.avoidMassRatios ?? [1.4]) * 0.16 +
      (1 - clamp(genome?.cooperation ?? 0.2, 0, 1)) * 0.12,
    prey:
      0.62 +
      average(genome?.approachMassRatios ?? [0.8]) * 0.26 +
      (genome?.allocation?.[2] ?? 0.33) * 0.16,
    flock: 0.22 + clamp(genome?.cooperation ?? 0.2, 0, 1) * 0.74,
    cruise: 0.08 + (genome?.allocation?.[1] ?? 0.33) * 0.24
  });
}

function behaviorPrioritiesForGenome(genome) {
  if (!genome) {
    return normalizeBehaviorPriorityMap();
  }
  genome.behaviorPriorities = normalizeBehaviorPriorityMap(
    genome.behaviorPriorities ?? derivedBehaviorPriorities(genome)
  );
  return genome.behaviorPriorities;
}

function createApproachRatios() {
  return Array.from({ length: speciesCount }, () => randomBetween(0.45, 1.18));
}

function createAvoidRatios(approachRatios) {
  return approachRatios.map((approach) =>
    randomBetween(Math.max(1.02, approach + 0.18), 2.6)
  );
}

export function createRandomGenome(config) {
  const allocation = normalizeRatios([
    randomBetween(0.88, 1.38),
    randomBetween(0.45, 1.06),
    randomBetween(0.42, 1.24)
  ]);
  const slotCount = Math.max(
    minSlotCount,
    Math.floor(randomBetween(minSlotCount, directionCount + 1))
  );
  const birthThresholdFloor = minimumBirthThresholdMass(config);
  const birthThresholdCeiling = Math.max(
    birthThresholdFloor + 2,
    config.world.initialOrganismMass * 4.1
  );
  const approachMassRatios = createApproachRatios();
  const avoidMassRatios = createAvoidRatios(approachMassRatios);

  const genome = {
    slotTypes: Array.from({ length: slotCount }, () => choice(gadgetOrder)),
    allocation,
    sensorBias: randomBetween(0.25, 1.08),
    cooperation: randomBetween(0.08, 0.96),
    behaviorPriorities: randomBehaviorPriorities(),
    shapeLobes: Math.floor(randomBetween(2, 7)),
    shapeAmplitude: randomBetween(0.04, 0.18),
    shapeWobble: randomBetween(0.01, 0.12),
    shapeSquish: randomBetween(0.86, 1.18),
    shapeTilt: randomBetween(-0.4, 0.4),
    shapePhase: randomBetween(-Math.PI, Math.PI),
    lifespanLimit: randomBetween(
      config.organisms.baseLifespan * (1 - config.organisms.lifespanSpread),
      config.organisms.baseLifespan * (1 + config.organisms.lifespanSpread)
    ),
    thresholdMass: randomBetween(
      birthThresholdFloor,
      birthThresholdCeiling
    ),
    budFraction: randomBetween(0.32, 0.49),
    approachMassRatios,
    avoidMassRatios
  };

  normalizeSpeciesThresholds(genome);
  return genome;
}

export function createDesignedGenome(design = {}, config = defaultConfig) {
  const genome = createRandomGenome(config);
  const slotCount = clamp(
    Math.round(Number(design.slotCount) || genome.slotTypes.length),
    minSlotCount,
    directionCount
  );
  const desiredSlotTypes = Array.isArray(design.slotTypes) ? design.slotTypes : [];
  genome.slotTypes = Array.from({ length: slotCount }, (_, index) => {
    const desired = desiredSlotTypes[index];
    if (gadgetOrder.includes(desired)) {
      return desired;
    }
    return genome.slotTypes[index % genome.slotTypes.length] ?? choice(gadgetOrder);
  });

  const coreShare = Number(design.coreShare);
  const motorShare = Number(design.motorShare);
  const gadgetShare = Number(design.gadgetShare);
  if (
    Number.isFinite(coreShare) ||
    Number.isFinite(motorShare) ||
    Number.isFinite(gadgetShare)
  ) {
    genome.allocation = normalizeRatios([
      Math.max(EPSILON, Number.isFinite(coreShare) ? coreShare : genome.allocation[0]),
      Math.max(EPSILON, Number.isFinite(motorShare) ? motorShare : genome.allocation[1]),
      Math.max(EPSILON, Number.isFinite(gadgetShare) ? gadgetShare : genome.allocation[2])
    ]);
  }

  const sensorBias = Number(design.sensorBias);
  if (Number.isFinite(sensorBias)) {
    genome.sensorBias = clamp(sensorBias, 0.1, 1.35);
  }

  const cooperation = Number(design.cooperation);
  if (Number.isFinite(cooperation)) {
    genome.cooperation = clamp(cooperation, 0, 1);
  }

  const lifespanLimit = Number(design.lifespanLimit);
  if (Number.isFinite(lifespanLimit)) {
    genome.lifespanLimit = clamp(
      lifespanLimit,
      12,
      config.organisms.baseLifespan * (2 + config.organisms.lifespanSpread * 2)
    );
  }

  const thresholdMass = Number(design.thresholdMass);
  if (Number.isFinite(thresholdMass)) {
    genome.thresholdMass = clamp(
      thresholdMass,
      minimumBirthThresholdMass(config),
      Math.max(minimumBirthThresholdMass(config) + 2, config.world.totalMaterial * 0.3)
    );
  } else {
    genome.thresholdMass = effectiveBirthThresholdMass(genome, config);
  }

  const budFraction = Number(design.budFraction);
  if (Number.isFinite(budFraction)) {
    genome.budFraction = clamp(budFraction, 0.24, 0.6);
  }

  const approachRatio = Number(design.approachRatio);
  if (Number.isFinite(approachRatio)) {
    const clamped = clamp(approachRatio, 0.18, 1.45);
    genome.approachMassRatios = Array.from({ length: speciesCount }, () => clamped);
  }

  const avoidRatio = Number(design.avoidRatio);
  if (Number.isFinite(avoidRatio)) {
    const clamped = clamp(avoidRatio, 0.9, 3.2);
    genome.avoidMassRatios = Array.from({ length: speciesCount }, () => clamped);
  }

  const shapeLobes = Number(design.shapeLobes);
  if (Number.isFinite(shapeLobes)) {
    genome.shapeLobes = clamp(Math.round(shapeLobes), 2, 6);
  }

  const shapeAmplitude = Number(design.shapeAmplitude);
  if (Number.isFinite(shapeAmplitude)) {
    genome.shapeAmplitude = clamp(shapeAmplitude, 0.02, 0.22);
  }

  const shapeWobble = Number(design.shapeWobble);
  if (Number.isFinite(shapeWobble)) {
    genome.shapeWobble = clamp(shapeWobble, 0, 0.16);
  }

  const shapeSquish = Number(design.shapeSquish);
  if (Number.isFinite(shapeSquish)) {
    genome.shapeSquish = clamp(shapeSquish, 0.82, 1.22);
  }

  const shapeTilt = Number(design.shapeTilt);
  genome.shapeTilt = clamp(Number.isFinite(shapeTilt) ? shapeTilt : 0, -0.55, 0.55);

  const shapePhase = Number(design.shapePhase);
  genome.shapePhase = wrapAngle(Number.isFinite(shapePhase) ? shapePhase : 0);

  const explicitBehaviorPriorities = {
    food: Number(design.foodPriority),
    danger: Number(design.dangerPriority),
    prey: Number(design.preyPriority),
    flock: Number(design.flockPriority),
    cruise: Number(design.cruisePriority)
  };
  if (Object.values(explicitBehaviorPriorities).some((value) => Number.isFinite(value))) {
    genome.behaviorPriorities = normalizeBehaviorPriorityMap({
      ...derivedBehaviorPriorities(genome),
      ...Object.fromEntries(
        Object.entries(explicitBehaviorPriorities).filter(([, value]) =>
          Number.isFinite(value)
        )
      )
    });
  } else {
    genome.behaviorPriorities = derivedBehaviorPriorities(genome);
  }

  behaviorPrioritiesForGenome(genome);
  normalizeSpeciesThresholds(genome);
  return genome;
}

export function mutateGenome(parentGenome, config) {
  const mutation = config.mutation;
  const genome = deepClone(parentGenome);
  delete genome.__cachedFeatures;
  delete genome.__cachedVisualShape;

  if (Math.random() < mutation.slotCountChance) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const nextCount = clamp(
      genome.slotTypes.length + direction,
      minSlotCount,
      directionCount
    );
    if (nextCount > genome.slotTypes.length) {
      while (genome.slotTypes.length < nextCount) {
        genome.slotTypes.push(choice(gadgetOrder));
      }
    } else if (nextCount < genome.slotTypes.length) {
      while (genome.slotTypes.length > nextCount) {
        genome.slotTypes.splice(choiceIndex(genome.slotTypes.length), 1);
      }
    }
  }

  for (let index = 0; index < genome.slotTypes.length; index += 1) {
    if (Math.random() < mutation.slotTypeChance) {
      genome.slotTypes[index] = choice(gadgetOrder);
    }
  }

  genome.allocation = normalizeRatios(
    genome.allocation.map((ratio) =>
      Math.max(
        0.03,
        ratio *
          (1 +
            randomBetween(
              -mutation.allocationJitter,
              mutation.allocationJitter
            ))
      )
    )
  );

  genome.sensorBias = mutateScalar(
    genome.sensorBias,
    mutation.traitJitter,
    0.1,
    1.35
  );
  genome.cooperation = mutateScalar(
    genome.cooperation,
    mutation.traitJitter,
    0,
    1
  );
  const behaviorPriorities = behaviorPrioritiesForGenome(genome);
  genome.behaviorPriorities = normalizeBehaviorPriorityMap(
    Object.fromEntries(
      BEHAVIOR_PRIORITY_KEYS.map((key) => [
        key,
        mutateScalar(
          behaviorPriorities[key],
          mutation.traitJitter * 0.26,
          0.04,
          2.4
        )
      ])
    )
  );
  if (Math.random() < mutation.traitJitter * 0.55) {
    genome.shapeLobes = clamp(
      genome.shapeLobes + (Math.random() < 0.5 ? -1 : 1),
      2,
      6
    );
  }
  genome.shapeAmplitude = mutateScalar(
    genome.shapeAmplitude,
    mutation.traitJitter * 0.1,
    0.02,
    0.22
  );
  genome.shapeWobble = mutateScalar(
    genome.shapeWobble,
    mutation.traitJitter * 0.08,
    0,
    0.16
  );
  genome.shapeSquish = mutateScalar(
    genome.shapeSquish,
    mutation.traitJitter * 0.16,
    0.82,
    1.22
  );
  genome.shapeTilt = mutateScalar(
    genome.shapeTilt,
    mutation.traitJitter * 0.55,
    -0.55,
    0.55
  );
  genome.shapePhase = wrapAngle(
    genome.shapePhase + randomBetween(-mutation.traitJitter * 2.8, mutation.traitJitter * 2.8)
  );
  genome.lifespanLimit = mutateScalar(
    genome.lifespanLimit,
    config.organisms.baseLifespan *
      Math.max(0.02, config.organisms.lifespanSpread) *
      mutation.traitJitter,
    12,
    config.organisms.baseLifespan * (2 + config.organisms.lifespanSpread * 2)
  );
  const birthThresholdFloor = minimumBirthThresholdMass(config);
  const birthThresholdCeiling = Math.max(
    birthThresholdFloor + 2,
    config.world.totalMaterial * 0.3
  );
  genome.thresholdMass = mutateScalar(
    genome.thresholdMass,
    mutation.traitJitter * config.world.initialOrganismMass,
    birthThresholdFloor,
    birthThresholdCeiling
  );
  genome.budFraction = mutateScalar(
    genome.budFraction,
    mutation.traitJitter * 0.2,
    0.24,
    0.6
  );
  genome.approachMassRatios = genome.approachMassRatios.map((value) =>
    mutateScalar(value, mutation.traitJitter * 0.8, 0.18, 1.45)
  );
  genome.avoidMassRatios = genome.avoidMassRatios.map((value) =>
    mutateScalar(value, mutation.traitJitter * 1.2, 0.9, 3.2)
  );

  behaviorPrioritiesForGenome(genome);
  normalizeSpeciesThresholds(genome);
  return genome;
}

function addMaterialToOrganism(organism, amount) {
  if (amount <= EPSILON) {
    return;
  }

  organism.coreMass += amount * organism.genome.allocation[0];
  organism.motorMass += amount * organism.genome.allocation[1];
  const slotCount = Math.max(1, organism.slotMasses.length);
  const slotShare =
    (amount * organism.genome.allocation[2]) / slotCount;
  for (let side = 0; side < organism.slotMasses.length; side += 1) {
    organism.slotMasses[side] += slotShare;
  }
}

function removeProportionalMaterial(organism, amount) {
  const total = organismMass(organism);
  if (total <= EPSILON || amount <= EPSILON) {
    return 0;
  }

  const actual = Math.min(amount, total);
  const ratio = actual / total;

  organism.coreMass -= organism.coreMass * ratio;
  organism.motorMass -= organism.motorMass * ratio;
  for (let side = 0; side < organism.slotMasses.length; side += 1) {
    organism.slotMasses[side] -= organism.slotMasses[side] * ratio;
  }

  return actual;
}

function createOrganism({
  id,
  x,
  y,
  mass,
  genome,
  config,
  lineageId = id,
  hue = randomBetween(20, 200)
}) {
  const organism = {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    heading: randomBetween(-Math.PI, Math.PI),
    genome,
    speciesIndex: speciesIndexFromSlotTypes(genome.slotTypes),
    lineageId,
    hue,
    coreMass: 0,
    motorMass: 0,
    slotMasses: Array.from({ length: genome.slotTypes.length }, () => 0),
    age: 0,
    cooldown: 0,
    weaponCooldowns: Array.from({ length: genome.slotTypes.length }, () => 0),
    damageFlashTimer: 0,
    damageFlashDuration: 0,
    damageFlashStrength: 0,
    lastDamagerId: null,
    lastHarvestFactor: 0,
    deathCause: null,
    alive: true
  };

  addMaterialToOrganism(organism, mass);
  const anchored = keepOrganismInsideWalls(organism, config, 0);
  organism.x = anchored.x;
  organism.y = anchored.y;
  return organism;
}

export function sensorRange(organism, config) {
  return (
    config.organisms.sensoryBase +
    Math.sqrt(Math.max(0, organismMass(organism))) *
      config.organisms.sensoryMassFactor +
    organism.genome.sensorBias * 26
  );
}

function maxSpeed(organism) {
  return 18 + Math.sqrt(Math.max(0, organism.motorMass)) * 5.2;
}

function sideIndexFromAngle(heading, absoluteAngle, slotCount = directionCount) {
  const count = clamp(Math.round(slotCount || 1), 1, directionCount);
  const localAngle = wrapAngle(absoluteAngle - heading);
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let index = 0; index < count; index += 1) {
    const delta = Math.abs(wrapAngle(localAngle - slotAngleOffset(index, count)));
    if (delta < bestDistance) {
      bestDistance = delta;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function slotAngle(organism, sideIndex) {
  return organism.heading + slotAngleOffset(sideIndex, organism.slotMasses.length);
}

export function lineageNameForId(lineageId) {
  const safeIndex = Math.max(0, Number(lineageId || 1) - 1);
  return LINEAGE_NAMES[safeIndex % LINEAGE_NAMES.length];
}

function shieldMitigationFraction(defender, defenderSide, config) {
  const gadgetKey = defender.genome.slotTypes[defenderSide];
  const gadget = config.gadgets[gadgetKey];
  if (!(gadget?.role === "defense") || defender.slotMasses[defenderSide] <= EPSILON) {
    return 0;
  }
  return clamp(config.combat.shieldBlockFraction, 0, 1);
}

function normalizedGenomeFeatures(genome, config) {
  const slotCount = Math.max(1, genome.slotTypes.length);
  const meleeShare =
    genome.slotTypes.filter((slotType) => slotType === "melee").length /
    directionCount;
  const rangedShare =
    genome.slotTypes.filter((slotType) => slotType === "ranged").length /
    directionCount;
  const shieldShare =
    genome.slotTypes.filter((slotType) => slotType === "shield").length /
    directionCount;
  const slotDensity = clamp(slotCount / directionCount, 0, 1);
  const slotCode =
    speciesIndexFromSlotTypes(genome.slotTypes) / Math.max(1, speciesCount - 1);
  const coreBias = clamp(genome.allocation[0], 0, 1);
  const motorBias = clamp(genome.allocation[1], 0, 1);
  const slotBias = clamp(genome.allocation[2], 0, 1);
  const allocationVariance = clamp(
    variance(genome.allocation) / 0.06,
    0,
    1
  );
  const sensor = clamp((genome.sensorBias - 0.1) / 1.25, 0, 1);
  const cooperation = clamp(genome.cooperation, 0, 1);
  const behaviorPriorities = behaviorPrioritiesForGenome(genome);
  const lifespan = clamp(
    (genome.lifespanLimit - 12) /
      Math.max(
        1,
        config.organisms.baseLifespan *
          (2 + config.organisms.lifespanSpread * 2) -
          12
      ),
    0,
    1
  );
  const threshold = clamp(
    effectiveBirthThresholdMass(genome, config) /
      Math.max(1, config.world.totalMaterial * 0.3),
    0,
    1
  );
  const budFraction = clamp((genome.budFraction - 0.24) / (0.6 - 0.24), 0, 1);
  const approachMean = clamp(
    (average(genome.approachMassRatios) - 0.18) / (1.45 - 0.18),
    0,
    1
  );
  const avoidMean = clamp(
    (average(genome.avoidMassRatios) - 0.9) / (3.2 - 0.9),
    0,
    1
  );
  const behaviorSpread = clamp(
    average(
      genome.avoidMassRatios.map(
        (avoid, index) => avoid - genome.approachMassRatios[index]
      )
    ) / 2.6,
    0,
    1
  );
  const visualShape = genomeVisualShape(genome);

  return {
    slotCode,
    slotDensity,
    meleeShare,
    rangedShare,
    shieldShare,
    coreBias,
    motorBias,
    slotBias,
    allocationVariance,
    sensor,
    cooperation,
    priorityFood: behaviorPriorities.food,
    priorityDanger: behaviorPriorities.danger,
    priorityPrey: behaviorPriorities.prey,
    priorityFlock: behaviorPriorities.flock,
    priorityCruise: behaviorPriorities.cruise,
    lifespan,
    threshold,
    budFraction,
    approachMean,
    avoidMean,
    behaviorSpread,
    shapeLobes: (visualShape.lobes - 2) / 4,
    shapeAmplitude: (visualShape.amplitude - 0.02) / 0.2,
    shapeWobble: visualShape.wobble / 0.16,
    shapeSquish: (visualShape.squish - 0.82) / 0.4,
    shapeTilt: (visualShape.tilt + 0.55) / 1.1,
    shapePhaseSin: Math.sin(visualShape.phase),
    shapePhaseCos: Math.cos(visualShape.phase)
  };
}

const SPECIATION_FEATURE_KEYS = [
  "slotCode",
  "slotDensity",
  "meleeShare",
  "rangedShare",
  "shieldShare",
  "coreBias",
  "motorBias",
  "slotBias",
  "allocationVariance",
  "sensor",
  "cooperation",
  "priorityFood",
  "priorityDanger",
  "priorityPrey",
  "priorityFlock",
  "priorityCruise",
  "lifespan",
  "threshold",
  "budFraction",
  "approachMean",
  "avoidMean",
  "behaviorSpread",
  "shapeLobes",
  "shapeAmplitude",
  "shapeWobble",
  "shapeSquish",
  "shapeTilt"
];

function slotTypeDifferenceFraction(parentSlotTypes, childSlotTypes) {
  const width = Math.max(parentSlotTypes.length, childSlotTypes.length, 1);
  let mismatches = 0;
  for (let index = 0; index < width; index += 1) {
    if (parentSlotTypes[index] !== childSlotTypes[index]) {
      mismatches += 1;
    }
  }
  return mismatches / width;
}

function speciationDistanceFromGenomes(parentGenome, childGenome, config) {
  const parentFeatures = cachedGenomeFeatures(parentGenome, config);
  const childFeatures = cachedGenomeFeatures(childGenome, config);
  const featureDistance =
    SPECIATION_FEATURE_KEYS.reduce(
      (total, key) => total + Math.abs(parentFeatures[key] - childFeatures[key]),
      0
    ) / SPECIATION_FEATURE_KEYS.length;
  const allocationDistance = average(
    parentGenome.allocation.map((value, index) =>
      Math.abs(value - (childGenome.allocation[index] ?? value))
    )
  );
  const slotTypeDistance = slotTypeDifferenceFraction(
    parentGenome.slotTypes,
    childGenome.slotTypes
  );
  const slotCountDistance =
    Math.abs(parentGenome.slotTypes.length - childGenome.slotTypes.length) /
    Math.max(1, directionCount - minSlotCount);
  const phaseDistance =
    Math.abs(
      wrapAngle((childGenome.shapePhase ?? 0) - (parentGenome.shapePhase ?? 0))
    ) / Math.PI;

  return clamp(
    featureDistance * 0.66 +
      slotTypeDistance * 0.16 +
      slotCountDistance * 0.08 +
      allocationDistance * 0.05 +
      phaseDistance * 0.05,
    0,
    1
  );
}

function lineageBranchChance(parentGenome, childGenome, config) {
  const mutation = config.mutation ?? {};
  const drift = speciationDistanceFromGenomes(parentGenome, childGenome, config);
  const speciesShift =
    speciesIndexFromSlotTypes(parentGenome.slotTypes) !==
    speciesIndexFromSlotTypes(childGenome.slotTypes);
  const chance = clamp(
    (mutation.speciationChance ?? 0) +
      drift * (mutation.speciationDriftFactor ?? 0) +
      (speciesShift ? mutation.speciesShiftSpeciationBonus ?? 0 : 0),
    0,
    1
  );
  return { chance, drift, speciesShift };
}

function paletteFromFeatures(features, alpha = 1, diversity = 0) {
  const divergence = clamp(diversity, 0, 1);
  const baseHue = wrapHue(
    18 +
      features.slotCode * 252 +
      features.rangedShare * 36 -
      features.shieldShare * 26 +
      features.approachMean * 28 +
      features.priorityFood * 22 -
      features.priorityDanger * 16 +
      features.priorityPrey * 12 +
      features.slotDensity * 18
  );
  const secondaryHue = wrapHue(
    baseHue +
      26 +
      features.motorBias * 76 -
      features.coreBias * 42 +
      features.cooperation * 28 +
      features.priorityFlock * 24 -
      features.priorityCruise * 16 +
      features.behaviorSpread * 82 +
      divergence * 36 +
      features.slotDensity * 24
  );
  const accentHue = wrapHue(
      baseHue -
      34 +
      features.avoidMean * 108 +
      features.priorityDanger * 48 +
      features.priorityPrey * 24 -
      features.allocationVariance * 84 -
      divergence * 18
  );

  const primarySaturation = clamp(
    66 +
      features.rangedShare * 16 +
      features.behaviorSpread * 14 +
      divergence * 10 +
      features.slotDensity * 8,
    44,
    98
  );
  const primaryLightness = clamp(
    52 + features.coreBias * 16 + features.lifespan * 8 - features.shieldShare * 4,
    38,
    80
  );
  const secondarySaturation = clamp(
    60 +
      features.sensor * 24 +
      features.cooperation * 10 +
      features.slotBias * 12 +
      features.slotDensity * 10,
    42,
    98
  );
  const secondaryLightness = clamp(
    66 + features.threshold * 8 + divergence * 6,
    46,
    88
  );
  const accentSaturation = clamp(
    74 +
      features.meleeShare * 16 +
      features.allocationVariance * 20 +
      features.slotDensity * 10,
    46,
    98
  );
  const accentLightness = clamp(
    74 + features.sensor * 6 - features.coreBias * 6 + divergence * 4,
    50,
    90
  );

  return {
    primaryHue: baseHue,
    secondaryHue,
    accentHue,
    primary: hsv(baseHue, primarySaturation, primaryLightness, alpha),
    secondary: hsv(secondaryHue, secondarySaturation, secondaryLightness, alpha),
    accent: hsv(accentHue, accentSaturation, accentLightness, alpha),
    glow: hsv(baseHue, primarySaturation, primaryLightness + 12, alpha),
    shadow: hsv(accentHue, accentSaturation * 0.86, primaryLightness - 6, alpha)
  };
}

export const capabilityAxes = [
  { key: "core", label: "Core", shortLabel: "COR" },
  { key: "motor", label: "Motor", shortLabel: "MOT" },
  { key: "melee", label: "Melee", shortLabel: "MEL" },
  { key: "ranged", label: "Ranged", shortLabel: "RNG" },
  { key: "shield", label: "Shield", shortLabel: "SHD" },
  { key: "sense", label: "Sense", shortLabel: "SNS" },
  { key: "bud", label: "Budding", shortLabel: "BUD" },
  { key: "risk", label: "Risk", shortLabel: "RSK" }
];

function capabilityProfileFromFeatures(features, config) {
  const meleeAttack = clamp(config.gadgets.melee.attack / 3, 0, 1);
  const rangedAttack = clamp(config.gadgets.ranged.attack / 3, 0, 1);
  const rangedReach = clamp((config.gadgets.ranged.range - 40) / (420 - 40), 0, 1);
  const shieldPower = clamp(config.gadgets.shield.defense / 3, 0, 1);
  const core = clamp(features.coreBias * 0.68 + features.lifespan * 0.32, 0, 1);
  const motor = clamp(features.motorBias * 0.82 + features.sensor * 0.12, 0, 1);
  const melee = clamp(
    features.meleeShare *
      (0.76 * meleeAttack + 0.24 * (1 - features.shieldShare)) *
      (0.62 + features.slotDensity * 0.38),
    0,
    1
  );
  const ranged = clamp(
    features.rangedShare *
      (0.58 * rangedAttack + 0.42 * rangedReach) *
      (0.62 + features.slotDensity * 0.38),
    0,
    1
  );
  const shield = clamp(
    features.shieldShare *
      (0.78 * shieldPower + 0.22) *
      (0.62 + features.slotDensity * 0.38),
    0,
    1
  );
  const sense = clamp(
    features.sensor * 0.68 +
      features.cooperation * 0.1 +
      features.priorityFood * 0.08 +
      features.priorityFlock * 0.06 +
      features.slotBias * 0.08 +
      features.approachMean * 0.16 +
      features.slotDensity * 0.08,
    0,
    1
  );
  const bud = clamp(
    features.budFraction * 0.58 +
      (1 - features.threshold) * 0.26 +
      features.lifespan * 0.16,
    0,
    1
  );
  const risk = clamp(
    features.approachMean * 0.54 +
      features.priorityPrey * 0.22 +
      (1 - features.priorityDanger) * 0.18 +
      (1 - features.avoidMean) * 0.3 +
      features.meleeShare * 0.16 +
      features.slotDensity * 0.08 -
      features.cooperation * 0.16,
    0,
    1
  );

  return [
    { ...capabilityAxes[0], value: core },
    { ...capabilityAxes[1], value: motor },
    { ...capabilityAxes[2], value: melee },
    { ...capabilityAxes[3], value: ranged },
    { ...capabilityAxes[4], value: shield },
    { ...capabilityAxes[5], value: sense },
    { ...capabilityAxes[6], value: bud },
    { ...capabilityAxes[7], value: risk }
  ];
}

function attackUpkeep(organism, config) {
  let upkeep = 0;
  for (let side = 0; side < organism.slotMasses.length; side += 1) {
    const gadgetKey = organism.genome.slotTypes[side];
    const gadget = config.gadgets[gadgetKey];
    upkeep += organism.slotMasses[side] * gadget.upkeep;
  }
  return upkeep;
}

function findResourceTarget(simulation, organism, sensingSq) {
  let bestResource = null;
  const capturePadding = 1.5;
  const organismCaptureRadius = organismRadius(organism, simulation.config);
  const sensing = Math.sqrt(sensingSq);

  visitSpatialIndex(
    simulation.resourceSpatialIndex,
    organism.x,
    organism.y,
    sensing,
    (resource) => {
      if (resource.mass <= EPSILON) {
        return;
      }

      const offset = euclideanOffset(organism, resource, simulation.config.world);
      if (offset.distanceSq > sensingSq) {
        return;
      }

      const captureRadius =
        organismCaptureRadius +
        resourceRadius(resource, simulation.config) +
        capturePadding;
      if (offset.distanceSq <= captureRadius * captureRadius) {
        return;
      }

      const score = resource.mass / Math.max(offset.distanceSq, 48);
      if (!bestResource || score > bestResource.score) {
        bestResource = {
          angle: Math.atan2(offset.dy, offset.dx),
          score,
          distanceSq: offset.distanceSq,
          resource
        };
      }
    }
  );

  return bestResource;
}

function findNeighborhoodContext(simulation, organism, sensingSq) {
  const myMass = Math.max(organismMass(organism), EPSILON);
  const config = simulation.config;
  const myRadius = organismRadius(organism, config);
  const sensing = Math.sqrt(sensingSq);
  const neighborhoodFactor = clamp(
    config.flocking?.neighborhoodFactor ?? 1,
    0.15,
    1
  );
  const flockRange = sensing * neighborhoodFactor;
  const flockRangeSq = flockRange * flockRange;
  let bestApproach = null;
  let bestAvoid = null;
  let alignmentX = 0;
  let alignmentY = 0;
  let alignmentWeight = 0;
  let cohesionX = 0;
  let cohesionY = 0;
  let cohesionWeight = 0;
  let separationX = 0;
  let separationY = 0;
  let separationWeight = 0;
  let count = 0;

  visitSpatialIndex(
    simulation.organismSpatialIndex,
    organism.x,
    organism.y,
    sensing,
    (other) => {
      if (other.id === organism.id || !other.alive) {
        return;
      }

      const offset = euclideanOffset(organism, other, simulation.config.world);
      if (offset.distanceSq > sensingSq) {
        return;
      }

      const distance = Math.max(offset.distance, EPSILON);
      const otherRadius = organismRadius(other, config);

      if (other.speciesIndex !== organism.speciesIndex) {
        const closeContact = myRadius + otherRadius + EPSILON;
        if (offset.distanceSq <= closeContact * closeContact * 0.01) {
          return;
        }

        const otherMass = organismMass(other);
        const massRatio = otherMass / myMass;
        const approachThreshold =
          organism.genome.approachMassRatios[other.speciesIndex];
        const avoidThreshold = organism.genome.avoidMassRatios[other.speciesIndex];
        const angle = Math.atan2(offset.dy, offset.dx);

        if (massRatio <= approachThreshold) {
          const score =
            (approachThreshold - massRatio + 0.12) *
            (0.8 + otherMass * 0.03) /
            Math.sqrt(Math.max(offset.distanceSq, 36));
          if (!bestApproach || score > bestApproach.score) {
            bestApproach = {
              angle,
              score,
              distanceSq: offset.distanceSq,
              target: other
            };
          }
        }

        if (massRatio >= avoidThreshold) {
          const score =
            (massRatio - avoidThreshold + 0.12) *
            (0.8 + otherMass * 0.018) /
            Math.sqrt(Math.max(offset.distanceSq, 36));
          if (!bestAvoid || score > bestAvoid.score) {
            bestAvoid = {
              angle,
              score,
              distanceSq: offset.distanceSq,
              target: other
            };
          }
        }
        return;
      }

      if (offset.distanceSq > flockRangeSq) {
        return;
      }

      const neighborWeight = 1 / (1 + distance * 0.032);
      alignmentX += Math.cos(other.heading) * neighborWeight;
      alignmentY += Math.sin(other.heading) * neighborWeight;
      alignmentWeight += neighborWeight;
      cohesionX += (organism.x + offset.dx) * neighborWeight;
      cohesionY += (organism.y + offset.dy) * neighborWeight;
      cohesionWeight += neighborWeight;
      count += 1;

      const desiredDistance =
        myRadius +
        otherRadius +
        config.organisms.sameSpeciesSpacing;
      if (distance < desiredDistance) {
        const pressure = (desiredDistance - distance) / desiredDistance;
        separationX -= (offset.dx / distance) * pressure;
        separationY -= (offset.dy / distance) * pressure;
        separationWeight += pressure;
      }
    }
  );

  return {
    bestApproach,
    bestAvoid,
    count,
    alignmentX,
    alignmentY,
    alignmentWeight,
    cohesionX,
    cohesionY,
    cohesionWeight,
    separationX,
    separationY,
    separationWeight
  };
}

function keepOrganismInsideWalls(organism, config, bounceFactor = 0.84) {
  void bounceFactor;
  const point = clampPointToWorld(organism.x, organism.y, config.world);
  organism.x = point.x;
  organism.y = point.y;
  return organism;
}

function pushCombatEffect(simulation, effect) {
  if (simulation.fastMode) {
    return;
  }
  simulation.combatEffects.push({
    id: `${effect.kind}-${simulation.time.toFixed(3)}-${simulation.nextEffectId++}`,
    age: 0,
    ...effect
  });
  const overflow = simulation.combatEffects.length - 160;
  if (overflow > 0) {
    simulation.combatEffects.splice(0, overflow);
  }
}

function emitMeleeEffect(
  simulation,
  attacker,
  sideIndex,
  attackGadget,
  slotAttackMass,
  impactX,
  impactY,
  relativeSpeed
) {
  const attackAngle = slotAngle(attacker, sideIndex);
  const radius = organismRadius(attacker, simulation.config);
  const originX = attacker.x + Math.cos(attackAngle) * radius * 0.9;
  const originY = attacker.y + Math.sin(attackAngle) * radius * 0.9;
  pushCombatEffect(simulation, {
    kind: "melee",
    color: attackGadget.color,
    x1: originX,
    y1: originY,
    x2: impactX,
    y2: impactY,
    angle: attackAngle,
    width: 1.6 + Math.sqrt(Math.max(slotAttackMass, 0)) * 0.55,
    magnitude: clamp(0.45 + relativeSpeed * 0.06 + slotAttackMass * 0.03, 0.45, 1.6),
    duration: 0.14
  });
}

function emitProjectileEffect(
  simulation,
  attacker,
  sideIndex,
  attackGadget,
  slotAttackMass,
  impactX,
  impactY,
  travelDistance,
  blocked
) {
  const attackAngle = slotAngle(attacker, sideIndex);
  const radius = organismRadius(attacker, simulation.config);
  const originX = attacker.x + Math.cos(attackAngle) * radius * 0.9;
  const originY = attacker.y + Math.sin(attackAngle) * radius * 0.9;
  pushCombatEffect(simulation, {
    kind: "projectile",
    color: attackGadget.color,
    x1: originX,
    y1: originY,
    x2: impactX,
    y2: impactY,
    angle: attackAngle,
    width: 1.4 + Math.sqrt(Math.max(slotAttackMass, 0)) * 0.46,
    magnitude: clamp(0.55 + slotAttackMass * 0.035, 0.55, 1.7),
    blocked,
    duration: clamp(0.16 + travelDistance / 520, 0.16, 0.42)
  });
}

function emitDefenseEffect(
  simulation,
  defender,
  sideIndex,
  defenseGadget,
  slotDefenseMass,
  impactX,
  impactY,
  defense,
  damage,
  blocked = true
) {
  const defenseAngle = slotAngle(defender, sideIndex);
  pushCombatEffect(simulation, {
    kind: "defense",
    color: defenseGadget.color,
    x: defender.x,
    y: defender.y,
    impactX,
    impactY,
    angle: defenseAngle,
    span: Math.PI / 3,
    radius:
      organismRadius(defender, simulation.config) *
      (0.92 + Math.sqrt(Math.max(slotDefenseMass, 0)) * 0.04),
    width: 1.4 + Math.sqrt(Math.max(slotDefenseMass, 0)) * 0.42,
    magnitude: clamp(0.55 + defense * 0.05 + damage * 0.14, 0.55, 2.2),
    blocked,
    duration: blocked ? 0.26 : 0.2
  });
}

function emitDamageEffect(simulation, defender, impactX, impactY, lifeDamage) {
  if (lifeDamage <= EPSILON) {
    return;
  }

  pushCombatEffect(simulation, {
    kind: "damage",
    color: "#ff9a72",
    x: defender.x,
    y: defender.y,
    impactX,
    impactY,
    radius:
      organismRadius(defender, simulation.config) *
      (0.84 + clamp(lifeDamage * 0.04, 0.12, 0.52)),
    width: 1.3 + Math.sqrt(Math.max(lifeDamage, 0)) * 0.2,
    magnitude: clamp(0.5 + lifeDamage * 0.08, 0.5, 1.9),
    duration: clamp(0.18 + lifeDamage * 0.02, 0.18, 0.34)
  });
}

function emitSiphonEffect(simulation, attacker, impactX, impactY, stolen) {
  if (stolen <= EPSILON) {
    return;
  }

  pushCombatEffect(simulation, {
    kind: "siphon",
    color: "#ffe4a5",
    x1: impactX,
    y1: impactY,
    x2: attacker.x,
    y2: attacker.y,
    width: 1.1 + Math.sqrt(stolen) * 0.34,
    magnitude: clamp(0.45 + stolen * 0.24, 0.45, 1.5),
    duration: 0.22
  });
}

function applyLifeDamage(attacker, defender, harvestFactor, lifeDamage) {
  if (lifeDamage <= EPSILON || !attacker.alive || !defender.alive) {
    return;
  }

  defender.lastDamagerId = attacker.id;
  defender.lastHarvestFactor = harvestFactor;
  const flashDuration = clamp(0.42 + lifeDamage * 0.02, 0.42, 0.82);
  defender.damageFlashTimer = Math.max(defender.damageFlashTimer, flashDuration);
  defender.damageFlashDuration = Math.max(
    defender.damageFlashDuration,
    flashDuration
  );
  defender.damageFlashStrength = Math.max(
    defender.damageFlashStrength,
    clamp(0.32 + lifeDamage * 0.06, 0.32, 1)
  );
  defender.age += lifeDamage;
  if (defender.age >= defender.genome.lifespanLimit) {
    defender.deathCause = "combat";
    defender.alive = false;
  }
}

function findRangedTarget(simulation, attacker, sideIndex, slotAttackMass, attackGadget) {
  const config = simulation.config;
  const myMass = Math.max(organismMass(attacker), EPSILON);
  const firingAngle = slotAngle(attacker, sideIndex);
  const rangeLimit = Math.min(
    sensorRange(attacker, config),
    attackGadget.range + Math.sqrt(Math.max(slotAttackMass, 0)) * 16
  );
  const coneHalfAngle = Math.PI * 0.2;
  let bestTarget = null;

  visitSpatialIndex(
    simulation.organismSpatialIndex,
    attacker.x,
    attacker.y,
    rangeLimit,
    (defender) => {
      if (defender.id === attacker.id || !defender.alive) {
        return;
      }
      if (defender.speciesIndex === attacker.speciesIndex) {
        return;
      }

      const offset = euclideanOffset(attacker, defender, config.world);
      const distance = offset.distance;
      if (distance > rangeLimit) {
        return;
      }

      const attackerRadius = organismRadius(attacker, config);
      const defenderRadius = organismRadius(defender, config);
      if (distance <= attackerRadius + defenderRadius + 8) {
        return;
      }

      const angleToDefender = Math.atan2(offset.dy, offset.dx);
      const angleError = Math.abs(wrapAngle(angleToDefender - firingAngle));
      if (angleError > coneHalfAngle) {
        return;
      }

      const otherMass = organismMass(defender);
      const massRatio = otherMass / myMass;
      const approachThreshold =
        attacker.genome.approachMassRatios[defender.speciesIndex];
      if (massRatio > approachThreshold) {
        return;
      }

      const score =
        (approachThreshold - massRatio + 0.16) *
        (1 + otherMass * 0.018) /
        (Math.max(distance, 24) * (0.5 + angleError * 1.6));
      if (!bestTarget || score > bestTarget.score) {
        bestTarget = {
          defender,
          angleToDefender,
          distance,
          score
        };
      }
    }
  );

  return bestTarget;
}

function resolveBehavior(simulation, organism, dt) {
  const config = simulation.config;
  for (let side = 0; side < organism.weaponCooldowns.length; side += 1) {
    organism.weaponCooldowns[side] = Math.max(
      0,
      organism.weaponCooldowns[side] - dt
    );
  }
  const myMass = organismMass(organism);
  const sensing = sensorRange(organism, config);
  const sensingSq = sensing * sensing;
  const bestResource = findResourceTarget(simulation, organism, sensingSq);
  const flock = findNeighborhoodContext(simulation, organism, sensingSq);
  const { bestApproach, bestAvoid } = flock;
  const behaviorPriorities = behaviorPrioritiesForGenome(organism.genome);
  const velocityLength = Math.hypot(organism.vx, organism.vy);
  const inertialAngle =
    velocityLength > EPSILON ? Math.atan2(organism.vy, organism.vx) : organism.heading;
  let desiredAngle = inertialAngle;
  let throttle = flock.count > 0 ? 0.72 : 0.62;
  let hasExplicitTarget = false;
  let selectedMode = "cruise";

  const birthThreshold = effectiveBirthThresholdMass(organism.genome, config);
  const preyEligible = bestApproach && myMass < birthThreshold * 1.18;
  const foodSignal = bestResource
    ? clamp(0.42 + bestResource.score * 42, 0.42, 1.7)
    : 0;
  const dangerSignal = bestAvoid
    ? clamp(0.54 + bestAvoid.score * 1.55, 0.54, 1.9)
    : 0;
  const preyNeed = clamp((birthThreshold * 1.22 - myMass) / Math.max(1, birthThreshold), 0.16, 1);
  const preySignal = preyEligible
    ? clamp(0.3 + bestApproach.score * 1.7, 0.3, 1.6) * preyNeed
    : 0;
  const flockSignal =
    flock.count > 0
      ? clamp(
          0.12 +
            flock.count * 0.12 +
            flock.alignmentWeight * 0.14 +
            flock.cohesionWeight * 0.08 +
            clamp(organism.genome.cooperation, 0, 1) * 0.3,
          0.18,
          1.5
        )
      : 0;
  const cruiseSignal = clamp(
    0.12 +
      (velocityLength > EPSILON
        ? Math.min(1, velocityLength / Math.max(1, maxSpeed(organism))) * 0.16
        : 0),
    0.12,
    0.38
  );
  const behaviorScores = [
    { mode: "food", score: behaviorPriorities.food * foodSignal },
    { mode: "danger", score: behaviorPriorities.danger * dangerSignal },
    { mode: "prey", score: behaviorPriorities.prey * preySignal },
    { mode: "flock", score: behaviorPriorities.flock * flockSignal },
    { mode: "cruise", score: behaviorPriorities.cruise * cruiseSignal }
  ];
  behaviorScores.sort((left, right) => right.score - left.score);
  selectedMode = behaviorScores[0]?.mode ?? "cruise";

  if (selectedMode === "danger" && bestAvoid) {
    desiredAngle = bestAvoid.angle + Math.PI;
    throttle = 1;
    hasExplicitTarget = true;
  } else if (selectedMode === "food" && bestResource) {
    desiredAngle = bestResource.angle;
    throttle = 0.88;
    hasExplicitTarget = true;
  } else if (selectedMode === "prey" && preyEligible) {
    desiredAngle = bestApproach.angle;
    throttle = 0.92;
    hasExplicitTarget = true;
  } else if (selectedMode === "flock") {
    throttle = 0.78;
  } else {
    selectedMode = "cruise";
    throttle = flock.count > 0 ? 0.68 : 0.62;
  }

  const steering = hasExplicitTarget
    ? {
        x: Math.cos(desiredAngle),
        y: Math.sin(desiredAngle)
      }
    : velocityLength > EPSILON
      ? {
          x: organism.vx / velocityLength,
          y: organism.vy / velocityLength
        }
      : {
          x: Math.cos(organism.heading),
          y: Math.sin(organism.heading)
        };
  const cooperation = clamp(organism.genome.cooperation, 0, 1);
  if (flock.count > 0) {
    const flocking = config.flocking ?? {};
    const countGain =
      1 +
      Math.min(10, flock.count) * clamp(flocking.countInfluence ?? 0, 0, 0.5);
    const boidModeFactor =
      selectedMode === "flock"
        ? 1
        : selectedMode === "cruise"
          ? 0.72
          : selectedMode === "food"
            ? 0.46
            : selectedMode === "prey"
              ? 0.4
              : 0.26;
    const boidInfluence =
      (0.24 + cooperation * 0.34 + behaviorPriorities.flock * 0.42) *
      boidModeFactor *
      clamp(flocking.influenceScale ?? 1, 0.2, 3) *
      countGain;

    if (flock.alignmentWeight > EPSILON && cooperation > EPSILON) {
      const alignmentX = flock.alignmentX / flock.alignmentWeight;
      const alignmentY = flock.alignmentY / flock.alignmentWeight;
      const alignmentGain =
        boidInfluence *
        clamp(flocking.alignmentWeight ?? 1, 0.2, 3) *
        (0.7 + cooperation * 0.55);
      steering.x += alignmentX * alignmentGain;
      steering.y += alignmentY * alignmentGain;
    }

    if (flock.cohesionWeight > EPSILON && cooperation > EPSILON) {
      const centerX = flock.cohesionX / flock.cohesionWeight;
      const centerY = flock.cohesionY / flock.cohesionWeight;
      const cohesionVectorX = centerX - organism.x;
      const cohesionVectorY = centerY - organism.y;
      const cohesionLength = Math.hypot(cohesionVectorX, cohesionVectorY);
      if (cohesionLength > EPSILON) {
        const cohesionGain =
          boidInfluence *
          clamp(flocking.cohesionWeight ?? 1, 0.2, 3) *
          (0.26 + cooperation * 0.42);
        steering.x += (cohesionVectorX / cohesionLength) * cohesionGain;
        steering.y += (cohesionVectorY / cohesionLength) * cohesionGain;
      }
    }

    if (flock.separationWeight > EPSILON) {
      const separationLength = Math.hypot(flock.separationX, flock.separationY);
      if (separationLength > EPSILON) {
        const separationGain =
          clamp(flocking.separationWeight ?? 1, 0.2, 3) *
          (0.62 + cooperation * 1.18);
        steering.x +=
          (flock.separationX / separationLength) *
          separationGain *
          Math.max(1, flock.separationWeight * 0.85);
        steering.y +=
          (flock.separationY / separationLength) *
          separationGain *
          Math.max(1, flock.separationWeight * 0.85);
      }
      throttle = Math.max(throttle, 0.8);
    }
  }
  if (Math.hypot(steering.x, steering.y) > EPSILON) {
    desiredAngle = Math.atan2(steering.y, steering.x);
  }

  const turnLimit =
    (config.organisms.baseTurnRate +
      Math.sqrt(Math.max(0, organism.motorMass)) *
        config.organisms.motorTurnFactor) *
    dt;
  const delta = wrapAngle(desiredAngle - organism.heading);
  organism.heading += clamp(delta, -turnLimit, turnLimit);

  const thrust =
    (config.organisms.baseThrust +
      organism.motorMass * config.organisms.motorThrustFactor) *
    throttle;
  const terrainHere = terrainTraversalData(simulation, organism.x, organism.y);
  const terrainThrustScale = Math.max(0.08, 1 - terrainHere.slowdown * 0.72);
  organism.vx += Math.cos(organism.heading) * thrust * terrainThrustScale * dt;
  organism.vy += Math.sin(organism.heading) * thrust * terrainThrustScale * dt;

  const damping = Math.exp(
    -config.organisms.dragPerSecond * terrainHere.dragFactor * dt
  );
  organism.vx *= damping;
  organism.vy *= damping;

  const speed = Math.hypot(organism.vx, organism.vy);
  const speedCap = maxSpeed(organism);
  if (speed > speedCap) {
    organism.vx = (organism.vx / speed) * speedCap;
    organism.vy = (organism.vy / speed) * speedCap;
  }

  const nextX = organism.x + organism.vx * dt;
  const nextY = organism.y + organism.vy * dt;
  const terrainAhead = terrainTraversalData(simulation, nextX, nextY);
  organism.x += organism.vx * dt * terrainAhead.traversal;
  organism.y += organism.vy * dt * terrainAhead.traversal;
  if (terrainAhead.traversal < 0.999) {
    const ridgeSlow = Math.max(0.16, terrainAhead.traversal);
    organism.vx *= ridgeSlow;
    organism.vy *= ridgeSlow;
  }
  keepOrganismInsideWalls(organism, config);
  organism.age += dt;
}

function applyResourceIntake(simulation, organism, dt) {
  const config = simulation.config;
  const radius = organismRadius(organism, config);
  const intakeRadius =
    radius + Math.max(4, config.render.resourceScale * Math.sqrt(config.economy.debrisUnitMass)) + 3;

  visitSpatialIndex(
    simulation.resourceSpatialIndex,
    organism.x,
    organism.y,
    intakeRadius,
    (resource) => {
      if (resource.mass <= EPSILON) {
        return;
      }

      const offset = euclideanOffset(organism, resource, simulation.config.world);
      const captureRadius = radius + resourceRadius(resource, config) + 1.5;
      if (offset.distanceSq > captureRadius * captureRadius) {
        return;
      }

      const intake = Math.min(
        resource.mass,
        config.organisms.resourceIntakeRate *
          dt *
          (0.78 + organism.genome.sensorBias * 0.34)
      );
      if (intake <= EPSILON) {
        return;
      }

      resource.mass -= intake;
      resource.age = 0;
      addMaterialToOrganism(organism, intake);
    }
  );
}

function spawnResource(simulation, x, y, mass) {
  if (mass <= EPSILON) {
    return;
  }

  simulation.resources.push({
    id: simulation.nextResourceId++,
    ...clampPointToWorld(x, y, simulation.config.world),
    mass,
    age: 0
  });
}

function emitSpringResources(simulation, dt) {
  if (!simulation.springs.length) {
    return false;
  }

  let emittedAny = false;
  for (const spring of simulation.springs) {
    spring.cooldown -= dt;
    const nearbyMass = localFreeMassAroundSpring(simulation, spring);
    spring.nearbyMass = nearbyMass;
    spring.paused = nearbyMass >= simulation.config.springs.pauseNearbyMass - EPSILON;
    if (spring.paused) {
      spring.cooldown = Math.min(
        Math.max(0, spring.cooldown),
        spring.interval * 0.45
      );
      continue;
    }

    let pulses = 0;
    while (spring.cooldown <= 0 && pulses < 6) {
      pulses += 1;
      spring.cooldown += spring.interval;
      const emittedMass = Math.max(EPSILON, spring.packetMass);
      if (emittedMass <= EPSILON) {
        break;
      }

      const angle = randomBetween(-Math.PI, Math.PI);
      const distance = Math.random() * spring.scatter;
      const point = clampPointToWorld(
        spring.x + Math.cos(angle) * distance,
        spring.y + Math.sin(angle) * distance,
        simulation.config.world
      );
      spawnResource(simulation, point.x, point.y, emittedMass);
      simulation.config.world.totalMaterial += emittedMass;
      emittedAny = true;
    }
  }

  return emittedAny;
}

function localFreeMassAroundSpring(simulation, spring) {
  const senseRadius = Math.max(spring.radius * 3.2, spring.scatter * 0.9);
  let nearbyMass = 0;
  visitSpatialIndex(
    simulation.resourceSpatialIndex,
    spring.x,
    spring.y,
    senseRadius,
    (resource) => {
      const offset = euclideanOffset(spring, resource, simulation.config.world);
      if (offset.distance <= senseRadius) {
        nearbyMass += resource.mass;
      }
    }
  );
  return nearbyMass;
}

function springFoothillScore(simulation, x, y) {
  if (!terrainEnabled(simulation.config)) {
    return 0;
  }

  const world = simulation.config.world;
  const terrain = simulation.config.terrain ?? {};
  const centerHeight = terrainHeightAt(simulation, x, y);
  const sampleRadius = clamp(
    ((terrain.radiusMin ?? 120) + (terrain.radiusMax ?? 260)) * 0.22,
    44,
    Math.min(world.width, world.height) * 0.12
  );
  let maxNeighbor = centerHeight;
  let minNeighbor = centerHeight;
  let maxRise = 0;
  let accumulatedRise = 0;
  const samples = 8;

  for (let index = 0; index < samples; index += 1) {
    const angle = (Math.PI * 2 * index) / samples;
    const sampleHeight = terrainHeightAt(
      simulation,
      x + Math.cos(angle) * sampleRadius,
      y + Math.sin(angle) * sampleRadius
    );
    maxNeighbor = Math.max(maxNeighbor, sampleHeight);
    minNeighbor = Math.min(minNeighbor, sampleHeight);
    const rise = Math.max(0, sampleHeight - centerHeight);
    maxRise = Math.max(maxRise, rise);
    accumulatedRise += rise;
  }

  const foothillHeightScore = clamp(1 - Math.abs(centerHeight - 0.34) / 0.24, 0, 1);
  const riseScore = clamp(maxRise / 0.2, 0, 1);
  const ridgeScore = clamp((maxNeighbor - centerHeight) / 0.28, 0, 1);
  const variationScore = clamp((maxNeighbor - minNeighbor) / 0.32, 0, 1);
  const basinPenalty = clamp((0.1 - centerHeight) / 0.1, 0, 1);
  const summitPenalty = clamp((centerHeight - 0.62) / 0.18, 0, 1);
  const flatPenalty = clamp((0.05 - accumulatedRise / samples) / 0.05, 0, 1);

  return (
    foothillHeightScore * 0.44 +
    riseScore * 0.24 +
    ridgeScore * 0.18 +
    variationScore * 0.14 -
    basinPenalty * 0.26 -
    summitPenalty * 0.44 -
    flatPenalty * 0.18
  );
}

function seedInitialSprings(simulation) {
  const targetCount = Math.min(
    Math.max(0, Math.round(simulation.config.springs.initialCount ?? 3)),
    Math.max(0, simulation.config.springs.maxCount)
  );
  if (targetCount <= 0) {
    return;
  }

  const world = simulation.config.world;
  const minWorldSpan = Math.min(world.width, world.height);
  const targetSpacing = Math.max(
    simulation.config.springs.radius * 8,
    minWorldSpan / 4.8
  );
  const terrainAware = terrainEnabled(simulation.config);
  const candidatePool = [];
  const maxAttempts = targetCount * (terrainAware ? 90 : 14);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = {
      x: randomBetween(0, world.width),
      y: randomBetween(0, world.height),
      foothillScore: 0
    };
    candidate.foothillScore = terrainAware
      ? springFoothillScore(simulation, candidate.x, candidate.y)
      : 0;
    candidatePool.push(candidate);
  }

  candidatePool.sort((left, right) => right.foothillScore - left.foothillScore);

  for (const candidate of candidatePool) {
    if (simulation.springs.length >= targetCount) {
      break;
    }

    const tooClose = simulation.springs.some((spring) => {
      const offset = euclideanOffset(candidate, spring, world);
      return offset.distance < targetSpacing;
    });
    if (tooClose) {
      continue;
    }

    simulation.addSpring(candidate.x, candidate.y, {
      budgetCap: simulation.config.world.totalMaterial
    });
  }

  while (simulation.springs.length < targetCount) {
    simulation.addSpring(randomBetween(0, world.width), randomBetween(0, world.height), {
      budgetCap: simulation.config.world.totalMaterial
    });
  }
}

function clusteredRandomPoint(simulation, anchor = null, radius = null) {
  const world = simulation.config.world;
  const spread =
    radius ?? Math.max(24, simulation.config.economy.corpseScatterRadius * 2.4);
  const center = anchor ?? {
    x: randomBetween(0, world.width),
    y: randomBetween(0, world.height)
  };
  const angle = randomBetween(-Math.PI, Math.PI);
  const distance = Math.pow(Math.random(), 1.9) * spread;
  return clampPointToWorld(
    center.x + Math.cos(angle) * distance,
    center.y + Math.sin(angle) * distance,
    world
  );
}

function splitMassIntoChunks(totalMass, unitMass, maxChunks = 32) {
  if (totalMass <= EPSILON) {
    return [];
  }

  const safeUnit = Math.max(unitMass, EPSILON * 10);
  let chunkCount = Math.ceil(totalMass / safeUnit);
  chunkCount = Math.max(1, Math.min(maxChunks, chunkCount));

  const chunks = [];
  let remaining = totalMass;
  let remainingCount = chunkCount;

  while (remainingCount > 1) {
    const average = remaining / remainingCount;
    const chunk = clamp(
      average * randomBetween(0.72, 1.28),
      Math.max(EPSILON, average * 0.45),
      remaining - Math.max(EPSILON, average * 0.45) * (remainingCount - 1)
    );
    chunks.push(chunk);
    remaining -= chunk;
    remainingCount -= 1;
  }

  chunks.push(remaining);
  return chunks;
}

function spillRemoteDebris(simulation, mass, unitMass, scatterRadius) {
  if (mass <= EPSILON) {
    return;
  }

  const hotspotCount = Math.max(1, Math.min(3, Math.ceil(mass / (unitMass * 3.2))));
  const hotspots = Array.from({ length: hotspotCount }, () =>
    clusteredRandomPoint(simulation, null, scatterRadius * 2.4)
  );

  for (const chunk of splitMassIntoChunks(mass, unitMass, 18)) {
    const hotspot = hotspots[Math.floor(Math.random() * hotspots.length)];
    const placement =
      Math.random() < 0.22
        ? hotspot
        : clusteredRandomPoint(simulation, hotspot, scatterRadius);
    spawnResource(simulation, placement.x, placement.y, chunk);
  }
}

function spillCorpseDebris(simulation, x, y, mass, baseRadius = 0) {
  if (mass <= EPSILON) {
    return;
  }

  const { debrisUnitMass, corpseScatterRadius, globalRespawnFraction } =
    simulation.config.economy;
  const remoteMass = mass * globalRespawnFraction;
  const localMass = mass - remoteMass;
  const scatterRadius = Math.max(6, corpseScatterRadius + baseRadius * 0.4);

  for (const chunk of splitMassIntoChunks(localMass, debrisUnitMass, 36)) {
    const angle = randomBetween(-Math.PI, Math.PI);
    const distance = Math.sqrt(Math.random()) * scatterRadius;
    spawnResource(
      simulation,
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      chunk
    );
  }

  spillRemoteDebris(simulation, remoteMass, debrisUnitMass, scatterRadius);
}

function resolveMeleeExchange(
  simulation,
  attacker,
  defender,
  attackerSide,
  defenderSide,
  relativeSpeed,
  impactX,
  impactY,
  dt
) {
  if (!attacker.alive || !defender.alive) {
    return;
  }
  if (attacker.speciesIndex === defender.speciesIndex) {
    return;
  }

  const config = simulation.config;
  const attackGadget = config.gadgets[attacker.genome.slotTypes[attackerSide]];
  const defenseGadget = config.gadgets[defender.genome.slotTypes[defenderSide]];
  const slotAttackMass = attacker.slotMasses[attackerSide];
  const slotDefenseMass = defender.slotMasses[defenderSide];
  if (
    attackGadget?.mode !== "melee" ||
    slotAttackMass <= EPSILON
  ) {
    return;
  }

  const shieldMitigation = shieldMitigationFraction(defender, defenderSide, config);
  const shielded = shieldMitigation > EPSILON;

  const offense =
    slotAttackMass *
    attackGadget.attack *
    config.combat.attackScale *
    (1 + relativeSpeed * config.combat.impactBonus);
  const defense =
    slotDefenseMass * defenseGadget.defense * config.combat.defenseScale +
    defender.coreMass * config.combat.coreArmor;
  const rawDamage =
    Math.max(0, offense - defense) * config.combat.contactDamageRate * dt;
  const lifeDamage = rawDamage * (1 - shieldMitigation);

  emitMeleeEffect(
    simulation,
    attacker,
    attackerSide,
    attackGadget,
    slotAttackMass,
    impactX,
    impactY,
    relativeSpeed
  );
  if (shielded) {
    emitDefenseEffect(
      simulation,
      defender,
      defenderSide,
      defenseGadget,
      slotDefenseMass,
      impactX,
      impactY,
      offense,
      rawDamage,
      shieldMitigation >= 0.995
    );
  }

  if (lifeDamage <= EPSILON) {
    return;
  }

  emitDamageEffect(simulation, defender, impactX, impactY, lifeDamage);
  applyLifeDamage(attacker, defender, attackGadget.steal, lifeDamage);
}

function resolveRangedCombat(simulation) {
  const config = simulation.config;
  const world = config.world;

  for (const attacker of simulation.organisms) {
    if (!attacker.alive) {
      continue;
    }

    for (let side = 0; side < attacker.slotMasses.length; side += 1) {
      const attackGadget = config.gadgets[attacker.genome.slotTypes[side]];
      const slotAttackMass = attacker.slotMasses[side];
      if (
        attackGadget?.mode !== "ranged" ||
        slotAttackMass <= EPSILON ||
        attacker.weaponCooldowns[side] > EPSILON
      ) {
        continue;
      }

      const shot = findRangedTarget(
        simulation,
        attacker,
        side,
        slotAttackMass,
        attackGadget
      );
      if (!shot) {
        continue;
      }

      const { defender, angleToDefender, distance } = shot;
      const defenderSide = sideIndexFromAngle(
        defender.heading,
        angleToDefender + Math.PI,
        defender.slotMasses.length
      );
      const defenseGadget = config.gadgets[defender.genome.slotTypes[defenderSide]];
      const slotDefenseMass = defender.slotMasses[defenderSide];
      const shieldMitigation = shieldMitigationFraction(defender, defenderSide, config);
      const shielded = shieldMitigation > EPSILON;
      const defenderRadius = organismRadius(defender, config);
      const impactPoint = clampPointToWorld(
        defender.x - Math.cos(angleToDefender) * defenderRadius * 0.78,
        defender.y - Math.sin(angleToDefender) * defenderRadius * 0.78,
        world
      );
      const impactX = impactPoint.x;
      const impactY = impactPoint.y;
      const offense =
        slotAttackMass * attackGadget.attack * config.combat.attackScale;
      const defense =
        defender.coreMass * config.combat.coreArmor +
        slotDefenseMass * defenseGadget.defense * config.combat.defenseScale;
      const rawDamage =
        Math.max(0, offense - defense) * config.combat.rangedDamageScale;
      const lifeDamage = rawDamage * (1 - shieldMitigation);

      emitProjectileEffect(
        simulation,
        attacker,
        side,
        attackGadget,
        slotAttackMass,
        impactX,
        impactY,
        distance,
        shielded
      );
      if (shielded) {
        emitDefenseEffect(
          simulation,
          defender,
          defenderSide,
          defenseGadget,
          slotDefenseMass,
          impactX,
          impactY,
          offense,
          rawDamage,
          shieldMitigation >= 0.995
        );
      }

      if (lifeDamage > EPSILON) {
        emitDamageEffect(simulation, defender, impactX, impactY, lifeDamage);
        applyLifeDamage(attacker, defender, attackGadget.steal, lifeDamage);
      }
      attacker.weaponCooldowns[side] = attackGadget.cooldown;
    }
  }
}

function resolveCombat(simulation, dt) {
  const config = simulation.config;
  const world = config.world;
  const index = simulation.organismSpatialIndex;
  const maxRadius = index?.maxRadius ?? 0;

  for (const attacker of simulation.organisms) {
    if (!attacker.alive) {
      continue;
    }

    const attackerRadius = organismRadius(attacker, config);
    visitSpatialIndex(
      index,
      attacker.x,
      attacker.y,
      attackerRadius + maxRadius,
      (defender) => {
        if (!defender.alive || defender.id <= attacker.id) {
          return;
        }

        const offset = euclideanOffset(attacker, defender, world);
        const distance = Math.max(offset.distance, EPSILON);
        const defenderRadius = organismRadius(defender, config);
        const overlap = attackerRadius + defenderRadius - distance;

        if (overlap <= 0) {
          return;
        }

        const nx = offset.dx / distance;
        const ny = offset.dy / distance;
        const separation = overlap * 0.5;

        attacker.x -= nx * separation;
        attacker.y -= ny * separation;
        defender.x += nx * separation;
        defender.y += ny * separation;
        keepOrganismInsideWalls(attacker, config, 0.72);
        keepOrganismInsideWalls(defender, config, 0.72);

        const relativeSpeed = Math.abs(
          (defender.vx - attacker.vx) * nx + (defender.vy - attacker.vy) * ny
        );
        const angleToDefender = Math.atan2(offset.dy, offset.dx);
        const attackerSide = sideIndexFromAngle(
          attacker.heading,
          angleToDefender,
          attacker.slotMasses.length
        );
        const defenderSide = sideIndexFromAngle(
          defender.heading,
          angleToDefender + Math.PI,
          defender.slotMasses.length
        );
        const impactPoint = clampPointToWorld(
          attacker.x + nx * attackerRadius,
          attacker.y + ny * attackerRadius,
          world
        );
        const impactX = impactPoint.x;
        const impactY = impactPoint.y;

        resolveMeleeExchange(
          simulation,
          attacker,
          defender,
          attackerSide,
          defenderSide,
          relativeSpeed,
          impactX,
          impactY,
          dt
        );
        resolveMeleeExchange(
          simulation,
          defender,
          attacker,
          defenderSide,
          attackerSide,
          relativeSpeed,
          impactX,
          impactY,
          dt
        );
      }
    );
  }
}

function applyUpkeep(simulation, organism, dt) {
  if (!organism.alive) {
    return;
  }

  const config = simulation.config;
  const upkeep =
    config.economy.upkeepBase +
    organismMass(organism) * config.economy.upkeepMassFactor +
    attackUpkeep(organism, config) * config.economy.gadgetMaintenanceFactor;
  const spent = removeProportionalMaterial(organism, upkeep * dt);
  if (spent > EPSILON) {
    spawnResource(simulation, organism.x, organism.y, spent);
  }
}

function attemptReproduction(simulation, organism) {
  const config = simulation.config;
  const total = organismMass(organism);
  const birthThreshold = effectiveBirthThresholdMass(organism.genome, config);
  const minimumRemainder =
    config.organisms.minViableMass + config.organisms.minViableCore + 2;

  if (
    total < birthThreshold ||
    total - total * organism.genome.budFraction <= minimumRemainder
  ) {
    return null;
  }

  const exportedTarget = total * organism.genome.budFraction;
  const taxTarget = exportedTarget * config.organisms.reproductionTax;
  const removed = removeProportionalMaterial(organism, exportedTarget + taxTarget);

  if (removed <= EPSILON) {
    return null;
  }

  const childMass = Math.max(0, removed / (1 + config.organisms.reproductionTax));
  if (childMass < config.organisms.minViableMass + 1) {
    addMaterialToOrganism(organism, removed);
    return null;
  }

  spawnResource(simulation, organism.x, organism.y, removed - childMass);

  const childGenome = mutateGenome(organism.genome, config);
  const childId = simulation.nextOrganismId++;
  const branchRoll = lineageBranchChance(organism.genome, childGenome, config);
  const branchedLineage = Math.random() < branchRoll.chance;
  if (branchedLineage) {
    simulation.speciations += 1;
    simulation.lineageParents.set(childId, organism.lineageId);
  }
  const scatterAngle = randomBetween(-Math.PI, Math.PI);
  const child = createOrganism({
    id: childId,
    x: organism.x + Math.cos(scatterAngle) * config.organisms.birthScatter,
    y: organism.y + Math.sin(scatterAngle) * config.organisms.birthScatter,
    mass: childMass,
    genome: childGenome,
    config,
    lineageId: branchedLineage ? childId : organism.lineageId,
    hue:
      ((organism.hue +
        randomBetween(-config.mutation.hueJitter, config.mutation.hueJitter)) %
        360 +
        360) %
      360
  });

  child.heading = scatterAngle;
  child.vx = organism.vx * 0.25;
  child.vy = organism.vy * 0.25;

  simulation.pendingBirths.push(child);
  simulation.births += 1;
  return child;
}

function enforceBudding(simulation) {
  const queue = [...simulation.organisms];

  while (queue.length > 0) {
    const organism = queue.shift();
    if (!organism?.alive) {
      continue;
    }

    let sequentialBirths = 0;
    while (organism.alive) {
      const child = attemptReproduction(simulation, organism);
      if (!child) {
        break;
      }

      queue.push(child);
      sequentialBirths += 1;
      if (sequentialBirths >= 64) {
        break;
      }
    }
  }
}

function distributeResources(simulation, massBudget) {
  let remaining = massBudget;
  while (remaining > EPSILON) {
    const chunk = Math.min(remaining, randomBetween(6, 24));
    spawnResource(
      simulation,
      randomBetween(0, simulation.config.world.width),
      randomBetween(0, simulation.config.world.height),
      chunk
    );
    remaining -= chunk;
  }
}

function cullDead(simulation) {
  const survivors = [];
  const config = simulation.config;

  for (const organism of simulation.organisms) {
    const total = organismMass(organism);
    const ageExpired = organism.age >= organism.genome.lifespanLimit;
    const collapsed =
      total < config.organisms.minViableMass ||
      organism.coreMass < config.organisms.minViableCore;
    const shouldDie =
      !organism.alive ||
      collapsed ||
      ageExpired;

    if (!shouldDie) {
      survivors.push(organism);
      continue;
    }

    const deathCause =
      organism.deathCause ??
      (ageExpired ? "age" : collapsed ? "collapse" : "unknown");
    organism.alive = false;
    if (ageExpired) {
      if (!simulation.fastMode) {
        simulation.bursts.push({
          id: `${organism.id}-${simulation.time.toFixed(3)}`,
          x: organism.x,
          y: organism.y,
          visualFeatures: cachedGenomeFeatures(organism.genome, config),
          visualShape: genomeVisualShape(organism.genome),
          radius: organismRadius(organism, config),
          age: 0,
          duration: 0.55
        });
      }
    }
    const corpseMass = total;
    if (corpseMass > EPSILON) {
      const eligibleForLoot = deathCause === "combat";
      const killer =
        eligibleForLoot && simulation.organismById
          ? simulation.organismById.get(organism.lastDamagerId)?.alive
            ? simulation.organismById.get(organism.lastDamagerId)
            : null
          : null;
      const corpseLootFraction = clamp(
        eligibleForLoot
          ? config.economy.corpseLootFraction +
              organism.lastHarvestFactor * config.combat.lootEfficiency
          : 0,
        0,
        1
      );
      const corpseLoot = corpseMass * corpseLootFraction;
      const corpseRadius = organismRadius(organism, config);
      if (killer) {
        addMaterialToOrganism(killer, corpseLoot);
        emitSiphonEffect(simulation, killer, organism.x, organism.y, corpseLoot);
      } else {
        spillCorpseDebris(
          simulation,
          organism.x,
          organism.y,
          corpseLoot,
          corpseRadius
        );
      }
      spillCorpseDebris(
        simulation,
        organism.x,
        organism.y,
        corpseMass - corpseLoot,
        corpseRadius
      );
    }

    simulation.deaths += 1;
    if (organism.lastDamagerId !== null) {
      simulation.kills += 1;
    }
  }

  simulation.organisms = survivors.concat(simulation.pendingBirths);
  simulation.pendingBirths = [];
}

function cullSpentResources(simulation, dt = 0) {
  const resourceLifetime = Math.max(
    0,
    Number(simulation.config.economy.resourceLifetime ?? 0)
  );
  let evaporatedMass = 0;

  simulation.resources = simulation.resources.filter((resource) => {
    if (resource.mass <= EPSILON) {
      return false;
    }

    resource.age = Math.max(0, (resource.age ?? 0) + dt);
    if (resourceLifetime > EPSILON && resource.age >= resourceLifetime) {
      evaporatedMass += resource.mass;
      return false;
    }
    return true;
  });

  if (evaporatedMass > EPSILON) {
    simulation.config.world.totalMaterial = Math.max(
      0,
      simulation.config.world.totalMaterial - evaporatedMass
    );
  }
}

function mergeClosestResources(simulation) {
  const limit = simulation.config.world.resourceNodeCap;
  if (simulation.resources.length <= limit) {
    return;
  }

  const world = simulation.config.world;
  let resources = simulation.resources.filter((resource) => resource.mass > EPSILON);
  let cellSize = Math.max(
    14,
    Math.sqrt((world.width * world.height) / Math.max(1, limit))
  );

  while (resources.length > limit) {
    const buckets = new Map();
    for (const resource of resources) {
      const cellX = Math.floor(resource.x / cellSize);
      const cellY = Math.floor(resource.y / cellSize);
      const key = spatialKey(cellX, cellY);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.mass += resource.mass;
        bucket.x += resource.x * resource.mass;
        bucket.y += resource.y * resource.mass;
        bucket.age += (resource.age ?? 0) * resource.mass;
      } else {
        buckets.set(key, {
          mass: resource.mass,
          x: resource.x * resource.mass,
          y: resource.y * resource.mass,
          age: (resource.age ?? 0) * resource.mass
        });
      }
    }

    resources = [...buckets.values()].map((bucket) => {
      const mass = Math.max(bucket.mass, EPSILON);
      const point = clampPointToWorld(bucket.x / mass, bucket.y / mass, world);
      return {
        id: simulation.nextResourceId++,
        x: point.x,
        y: point.y,
        mass,
        age: bucket.age / mass
      };
    });

    if (resources.length <= limit) {
      break;
    }

    cellSize *= Math.max(1.18, Math.sqrt(resources.length / limit));
  }

  simulation.resources = resources;
}

function summarizeLineages(
  organisms,
  config,
  limit = DOMINANT_LINEAGE_LIMIT,
  lineageNameResolver = lineageNameForId
) {
  const lineages = new Map();
  const featureKeys = [
    "slotCode",
    "slotDensity",
    "meleeShare",
    "rangedShare",
    "shieldShare",
    "coreBias",
    "motorBias",
    "slotBias",
    "allocationVariance",
    "sensor",
    "cooperation",
    "lifespan",
    "threshold",
    "budFraction",
    "approachMean",
    "avoidMean",
    "behaviorSpread",
    "shapeLobes",
    "shapeAmplitude",
    "shapeWobble",
    "shapeSquish",
    "shapeTilt",
    "shapePhaseSin",
    "shapePhaseCos"
  ];
  for (const organism of organisms) {
    const mass = organismMass(organism);
    const key = organism.lineageId;
    const features = cachedGenomeFeatures(organism.genome, config);
    if (!lineages.has(key)) {
      const featureSums = Object.fromEntries(
        featureKeys.map((featureKey) => [featureKey, 0])
      );
      const featureSquares = Object.fromEntries(
        featureKeys.map((featureKey) => [featureKey, 0])
      );
      lineages.set(key, {
        lineageId: key,
        count: 0,
        mass: 0,
        sampleMass: -Infinity,
        sampleOrganism: null,
        featureSums,
        featureSquares
      });
    }
    const entry = lineages.get(key);
    entry.count += 1;
    entry.mass += mass;
    if (mass > entry.sampleMass) {
      entry.sampleMass = mass;
      entry.sampleOrganism = {
        lineageId: organism.lineageId,
        visualFeatures: { ...features },
        visualShape: genomeVisualShape(organism.genome),
        slotTypes: [...organism.genome.slotTypes],
        slotMasses: [...organism.slotMasses],
        heading: organism.heading,
        radius: organismRadius(organism, config)
      };
    }
    for (const featureKey of featureKeys) {
      const value = features[featureKey];
      entry.featureSums[featureKey] += value;
      entry.featureSquares[featureKey] += value * value;
    }
  }

  return [...lineages.values()]
    .map((entry) => {
      const visualFeatures = {};
      let varianceSum = 0;
      for (const featureKey of featureKeys) {
        const mean = entry.featureSums[featureKey] / entry.count;
        const meanSquare = entry.featureSquares[featureKey] / entry.count;
        visualFeatures[featureKey] = mean;
        varianceSum += Math.max(0, meanSquare - mean * mean);
      }
      return {
        lineageId: entry.lineageId,
        lineageName: lineageNameResolver(entry.lineageId),
        count: entry.count,
        mass: entry.mass,
        sample: entry.sampleOrganism,
        visualFeatures,
        genomeDiversity: clamp(
          Math.sqrt(varianceSum / featureKeys.length) * 3.4,
          0,
          1
        )
      };
    })
    .sort((left, right) => right.count - left.count || right.mass - left.mass)
    .slice(0, limit);
}

export class Simulation {
  constructor(config = defaultConfig) {
    this.fastMode = false;
    this.reset(config);
  }

  reset(nextConfig = this.config || defaultConfig) {
    this.fastMode = Boolean(this.fastMode);
    this.config = clampConfig(deepClone(nextConfig));
    this.time = 0;
    this.births = 0;
    this.deaths = 0;
    this.kills = 0;
    this.speciations = 0;
    this.nextOrganismId = 1;
    this.nextResourceId = 1;
    this.nextSpringId = 1;
    this.nextEffectId = 1;
    this.organisms = [];
    this.resources = [];
    this.springs = [];
    this.pendingBirths = [];
    this.bursts = [];
    this.combatEffects = [];
    this.terrainVersion = (this.terrainVersion ?? 0) + 1;
    this.terrain = generateTerrainField(this.config, this.terrainVersion);
    this.organismSpatialIndex = null;
    this.organismById = new Map();
    this.resourceSpatialIndex = null;
    this.profileEnabled = false;
    this.profile = createEmptyProfileSample();
    this.lineageNameOverrides = new Map();
    this.lineageParents = new Map();

    const intendedBiomass = Math.min(
      this.config.world.totalMaterial * 0.58,
      this.config.world.initialOrganisms * this.config.world.initialOrganismMass
    );

    const masses = Array.from({ length: this.config.world.initialOrganisms }, () =>
      randomBetween(
        this.config.world.initialOrganismMass * 0.78,
        this.config.world.initialOrganismMass * 1.2
      )
    );
    const scale = intendedBiomass / Math.max(sum(masses), EPSILON);

    for (const baseMass of masses) {
      const genome = createRandomGenome(this.config);
      const organism = createOrganism({
        id: this.nextOrganismId++,
        x: randomBetween(0, this.config.world.width),
        y: randomBetween(0, this.config.world.height),
        mass: baseMass * scale,
        genome,
        config: this.config
      });
      this.organisms.push(organism);
    }

    const remainingMaterial =
      this.config.world.totalMaterial -
      this.organisms.reduce((total, organism) => total + organismMass(organism), 0);
    distributeResources(this, Math.max(0, remainingMaterial));
    mergeClosestResources(this);
    seedInitialSprings(this);
    this.organismSpatialIndex = buildOrganismSpatialIndex(this);
    this.organismById = new Map(this.organisms.map((organism) => [organism.id, organism]));
    this.resourceSpatialIndex = buildResourceSpatialIndex(this);
  }

  step(deltaTime) {
    const dt = Math.min(0.05, Math.max(0.001, deltaTime));
    const profiling = this.profileEnabled;
    const profileTotals = profiling ? createEmptyProfileSample() : null;
    const stepStart = profiling ? nowMillis() : 0;
    let sectionStart = stepStart;
    if (this.fastMode) {
      this.bursts = [];
      this.combatEffects = [];
    } else {
      this.bursts = this.bursts
        .map((burst) => ({ ...burst, age: burst.age + dt }))
        .filter((burst) => burst.age < burst.duration);
      this.combatEffects = this.combatEffects
        .map((effect) => ({ ...effect, age: effect.age + dt }))
        .filter((effect) => effect.age < effect.duration);
    }
    const emittedFromSprings = emitSpringResources(this, dt);
    if (emittedFromSprings) {
      this.resourceSpatialIndex = buildResourceSpatialIndex(this);
    }
    if (profiling) {
      profileTotals.totals.indexesStart += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    for (const organism of this.organisms) {
      if (this.fastMode) {
        organism.damageFlashTimer = 0;
        organism.damageFlashDuration = 0;
        organism.damageFlashStrength = 0;
      } else {
        organism.damageFlashTimer = Math.max(0, organism.damageFlashTimer - dt);
        if (organism.damageFlashTimer <= EPSILON) {
          organism.damageFlashDuration = 0;
        }
        organism.damageFlashStrength = Math.max(
          0,
          organism.damageFlashStrength - dt * 2.6
        );
      }
      resolveBehavior(this, organism, dt);
    }
    if (profiling) {
      profileTotals.totals.behavior += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    this.organismSpatialIndex = buildOrganismSpatialIndex(this);
    if (profiling) {
      profileTotals.totals.indexesMid += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    for (const organism of this.organisms) {
      applyResourceIntake(this, organism, dt);
    }
    if (profiling) {
      profileTotals.totals.intake += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    resolveRangedCombat(this);
    if (profiling) {
      profileTotals.totals.ranged += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }
    resolveCombat(this, dt);
    if (profiling) {
      profileTotals.totals.contact += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    for (const organism of this.organisms) {
      applyUpkeep(this, organism, dt);
    }
    if (profiling) {
      profileTotals.totals.upkeep += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    enforceBudding(this);
    if (profiling) {
      profileTotals.totals.budding += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }

    cullDead(this);
    cullSpentResources(this, dt);
    mergeClosestResources(this);
    if (profiling) {
      profileTotals.totals.cleanup += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }
    this.organismSpatialIndex = buildOrganismSpatialIndex(this);
    this.organismById = new Map(this.organisms.map((organism) => [organism.id, organism]));
    this.resourceSpatialIndex = buildResourceSpatialIndex(this);
    if (profiling) {
      profileTotals.totals.indexesEnd += nowMillis() - sectionStart;
      sectionStart = nowMillis();
    }
    this.rebalanceMaterial();
    if (profiling) {
      profileTotals.totals.rebalance += nowMillis() - sectionStart;
    }
    this.time += dt;

    if (profiling) {
      const stepDuration = nowMillis() - stepStart;
      this.profile.frames += 1;
      this.profile.organisms = this.organisms.length;
      this.profile.resources = this.resources.length;
      this.profile.stepMs += stepDuration;
      for (const key of PROFILE_KEYS) {
        this.profile.totals[key] += profileTotals.totals[key];
      }
    }
  }

  rebalanceMaterial() {
    const drift = this.config.world.totalMaterial - this.totalMaterial();
    if (Math.abs(drift) <= EPSILON) {
      return;
    }

    const largestResource = this.resources.reduce(
      (largest, resource) =>
        !largest || resource.mass > largest.mass ? resource : largest,
      null
    );

    if (largestResource) {
      largestResource.mass = Math.max(EPSILON, largestResource.mass + drift);
      return;
    }

    if (this.organisms.length > 0) {
      this.organisms[0].coreMass = Math.max(
        this.organisms[0].coreMass + drift,
        this.config.organisms.minViableCore
      );
    }
  }

  totalMaterial() {
    const organismMaterial = this.organisms.reduce(
      (total, organism) => total + organismMass(organism),
      0
    );
    const freeMaterial = this.resources.reduce(
      (total, resource) => total + resource.mass,
      0
    );
    return organismMaterial + freeMaterial;
  }

  injectResource(x, y, mass, options = {}) {
    const { adjustBudget = true, mergeResources = true, rebuildIndex = true } = options;
    const safeMass = Math.max(0, Number(mass) || 0);
    if (safeMass <= EPSILON) {
      return 0;
    }
    if (adjustBudget) {
      this.config.world.totalMaterial += safeMass;
    }
    spawnResource(this, x, y, safeMass);
    if (mergeResources) {
      mergeClosestResources(this);
    }
    if (rebuildIndex) {
      this.resourceSpatialIndex = buildResourceSpatialIndex(this);
    }
    return safeMass;
  }

  finalizeResourceInjection() {
    mergeClosestResources(this);
    this.resourceSpatialIndex = buildResourceSpatialIndex(this);
  }

  raiseTerrain(x, y, options = {}) {
    return raiseTerrainField(this, x, y, options);
  }

  erodeTerrain(x, y, options = {}) {
    return erodeTerrainField(this, x, y, options);
  }

  vaporizeOrganisms(targetIds, options = {}) {
    const emitBurst = options.emitBurst !== false && !this.fastMode;
    const normalizedIds = Array.isArray(targetIds)
      ? targetIds
      : targetIds instanceof Set
        ? [...targetIds]
        : targetIds === null || targetIds === undefined
          ? []
          : [targetIds];
    const targetIdSet = new Set(
      normalizedIds.filter((id) => Number.isFinite(Number(id))).map((id) => Number(id))
    );

    if (targetIdSet.size === 0 || this.organisms.length === 0) {
      return { count: 0, removedMass: 0 };
    }

    let count = 0;
    let removedMass = 0;
    const survivors = [];

    for (const organism of this.organisms) {
      if (!targetIdSet.has(organism.id)) {
        survivors.push(organism);
        continue;
      }

      const total = organismMass(organism);
      if (total > EPSILON) {
        removedMass += total;
        if (emitBurst) {
          this.bursts.push({
            id: `${organism.id}-lightning-${this.time.toFixed(3)}-${count}`,
            x: organism.x,
            y: organism.y,
            visualFeatures: normalizedGenomeFeatures(organism.genome, this.config),
            visualShape: genomeVisualShape(organism.genome),
            radius: organismRadius(organism, this.config) * 0.96,
            age: 0,
            duration: 0.28
          });
        }
      }
      count += 1;
      this.deaths += 1;
    }

    if (count === 0) {
      return { count: 0, removedMass: 0 };
    }

    this.organisms = survivors;
    this.config.world.totalMaterial = Math.max(
      0,
      this.config.world.totalMaterial - removedMass
    );
    this.organismSpatialIndex = buildOrganismSpatialIndex(this);
    return { count, removedMass };
  }

  addSpring(x, y, options = {}) {
    if (this.springs.length >= this.config.springs.maxCount) {
      return null;
    }

    const point = clampPointToWorld(x, y, this.config.world);
    const interval = Math.max(
      EPSILON,
      Number(options.interval ?? this.config.springs.interval) || this.config.springs.interval
    );
    const spring = {
      id: this.nextSpringId++,
      x: point.x,
      y: point.y,
      radius: options.radius ?? this.config.springs.radius,
      scatter: options.scatter ?? this.config.springs.scatter,
      packetMass: options.packetMass ?? this.config.springs.packetMass,
      interval,
      budgetCap: options.budgetCap ?? Infinity,
      cooldown: randomBetween(0, interval),
      phase: randomBetween(0, Math.PI * 2),
      paused: false,
      nearbyMass: 0
    };
    this.springs.push(spring);
    return spring;
  }

  removeSpring(springId) {
    const nextSprings = this.springs.filter((spring) => spring.id !== springId);
    const removed = nextSprings.length !== this.springs.length;
    this.springs = nextSprings;
    return removed;
  }

  getLineageName(lineageId) {
    return this.lineageNameOverrides.get(lineageId) ?? lineageNameForId(lineageId);
  }

  spawnDesignedOrganism(x, y, design = {}, options = {}) {
    const point = clampPointToWorld(x, y, this.config.world);
    const genome =
      options.genome && typeof options.genome === "object"
        ? deepClone(options.genome)
        : createDesignedGenome(design, this.config);
    const mass = clamp(
      Number(options.mass ?? design.initialMass ?? this.config.world.initialOrganismMass),
      this.config.organisms.minViableMass + 1,
      Math.max(this.config.organisms.minViableMass + 2, this.config.world.totalMaterial * 0.2)
    );
    const lineageId = Number.isFinite(Number(options.lineageId))
      ? Number(options.lineageId)
      : this.nextOrganismId;
    const organism = createOrganism({
      id: this.nextOrganismId++,
      x: point.x,
      y: point.y,
      mass,
      genome,
      config: this.config,
      lineageId,
      hue: Number.isFinite(Number(options.hue)) ? Number(options.hue) : randomBetween(20, 200)
    });

    const lineageName =
      typeof options.lineageName === "string" && options.lineageName.trim()
        ? options.lineageName.trim()
        : typeof design.lineageName === "string" && design.lineageName.trim()
          ? design.lineageName.trim()
          : null;
    if (lineageName) {
      this.lineageNameOverrides.set(lineageId, Array.from(lineageName).slice(0, 4).join(""));
    }

    this.organisms.push(organism);
    this.config.world.totalMaterial += mass;
    this.organismSpatialIndex = buildOrganismSpatialIndex(this);
    return {
      organism,
      lineageId,
      lineageName: this.getLineageName(lineageId),
      mass
    };
  }

  stats(options = {}) {
    const { includeDominantLineages = true, includePhylogeny = false } = options;
    const statsStart = this.profileEnabled ? nowMillis() : 0;
    const organismMaterial = this.organisms.reduce(
      (total, organism) => total + organismMass(organism),
      0
    );
    const freeMaterial = this.resources.reduce(
      (total, resource) => total + resource.mass,
      0
    );
    const totalMaterial = organismMaterial + freeMaterial;
    const lineageCounts = new Map();
    for (const organism of this.organisms) {
      lineageCounts.set(
        organism.lineageId,
        (lineageCounts.get(organism.lineageId) ?? 0) + 1
      );
    }
    const biodiversityEntropy = leinsterEntropyFromCounts([...lineageCounts.values()]);
    const lineageSummary =
      includeDominantLineages || includePhylogeny
        ? summarizeLineages(
            this.organisms,
            this.config,
            Math.max(
              includeDominantLineages ? DOMINANT_LINEAGE_LIMIT : 0,
              includePhylogeny ? PHYLOGENY_LINEAGE_LIMIT : 0
            ),
            (lineageId) => this.getLineageName(lineageId)
          )
        : [];
    const dominantLineages = includeDominantLineages
      ? lineageSummary.slice(0, DOMINANT_LINEAGE_LIMIT)
      : [];
    const phylogenyLineages = includePhylogeny
      ? lineageSummary.slice(0, PHYLOGENY_LINEAGE_LIMIT)
      : [];
    const avgRemainingLife =
      this.organisms.length > 0
        ? this.organisms.reduce(
            (total, organism) =>
              total + Math.max(0, organism.genome.lifespanLimit - organism.age),
            0
          ) / this.organisms.length
        : 0;

    const result = {
      time: this.time,
      living: this.organisms.length,
      lineages: lineageCounts.size,
      biodiversityEntropy,
      avgMass:
        this.organisms.length > 0 ? organismMaterial / this.organisms.length : 0,
      organismMaterial,
      freeMaterial,
      totalMaterial,
      drift: totalMaterial - this.config.world.totalMaterial,
      avgRemainingLife,
      resources: this.resources.length,
      births: this.births,
      deaths: this.deaths,
      kills: this.kills,
      speciations: this.speciations,
      dominantLineages,
      phylogenyLineages
    };

    if (this.profileEnabled) {
      this.profile.statsMs += nowMillis() - statsStart;
    }
    return result;
  }

  snapshot() {
    return {
      stats: this.stats(),
      config: this.config,
      time: this.time,
      springs: this.springs.length
    };
  }

  resetProfile() {
    this.profile = createEmptyProfileSample();
  }
}

export function gadgetLabel(config, key) {
  return config.gadgets[key]?.label ?? key;
}

export function gadgetColor(config, key) {
  return config.gadgets[key]?.color ?? "#ffffff";
}

export function genomeVisualFeatures(genome, config) {
  return cachedGenomeFeatures(genome, config);
}

export function genomeCapabilityProfile(genome, config) {
  return capabilityProfileFromFeatures(
    cachedGenomeFeatures(genome, config),
    config
  );
}

export function lineageCapabilityProfile(lineageEntry, config) {
  return capabilityProfileFromFeatures(lineageEntry.visualFeatures, config);
}

export function organismPalette(organism, config, alpha = 1) {
  return paletteFromFeatures(
    cachedGenomeFeatures(organism.genome, config),
    alpha
  );
}

export function lineagePalette(lineageEntry, alpha = 1) {
  return paletteFromFeatures(
    lineageEntry.visualFeatures,
    alpha,
    lineageEntry.genomeDiversity
  );
}

export function visualFeaturePalette(visualFeatures, alpha = 1) {
  return paletteFromFeatures(visualFeatures, alpha);
}

export function lineageGradientCss(lineageEntry) {
  const palette = lineagePalette(lineageEntry, 1);
  return `linear-gradient(135deg, ${palette.shadow} 0%, ${palette.primary} 42%, ${palette.secondary} 76%, ${palette.accent} 100%)`;
}

export function organismColor(organism, alpha = 1) {
  if (organism.visualFeatures) {
    return lineagePalette(organism, alpha).primary;
  }
  if (organism.genome) {
    return organismPalette(organism, defaultConfig, alpha).primary;
  }
  return hsv(180, 72, 62, alpha);
}

export function remainingLife(organism) {
  return Math.max(0, organism.genome.lifespanLimit - organism.age);
}

export function lifeBrightness(organism) {
  if (!organism.genome?.lifespanLimit) {
    return 1;
  }
  return clamp(remainingLife(organism) / organism.genome.lifespanLimit, 0.16, 1);
}

export function lifeProgress(organism) {
  if (!organism.genome?.lifespanLimit) {
    return 0;
  }
  return clamp(organism.age / organism.genome.lifespanLimit, 0, 1);
}
