import {
  deepClone,
  loadConfig,
  saveConfig,
  gadgetEntries,
  SNAPSHOT_CHANNEL,
  CONFIG_STORAGE_KEY
} from "./sim/config.js";
import {
  createDesignedGenome,
  createRandomGenome,
  genomeCapabilityProfile,
  genomeVisualFeatures,
  genomeVisualShape,
  lineageCapabilityProfile,
  Simulation,
  gadgetColor,
  lifeBrightness,
  lineageNameForId,
  lineageGradientCss,
  lineagePalette,
  organismPalette,
  organismRadius,
  remainingLife,
  slotAngleOffset,
  terrainMovementProfile,
  visualFeaturePalette,
  visualShapeFromFeatures
} from "./sim/core.js";
import {
  LOCALE_STORAGE_KEY,
  loadLocale,
  localeToggleLabel,
  localeToggleTitle,
  saveLocale,
  t,
  translateConfigText
} from "./i18n.js";
import { createAudioDirector } from "./audio.js";

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits);
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixColor(start, end, t) {
  return Math.round(lerp(start, end, t));
}

function blendTerrainTriplets(stops, t) {
  const clamped = clampNumber(t, 0, 1);
  if (clamped <= stops[0].at) {
    return [...stops[0].color];
  }
  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1];
    const right = stops[index];
    if (clamped <= right.at) {
      const localT = (clamped - left.at) / Math.max(0.0001, right.at - left.at);
      return [
        mixColor(left.color[0], right.color[0], localT),
        mixColor(left.color[1], right.color[1], localT),
        mixColor(left.color[2], right.color[2], localT)
      ];
    }
  }
  return [...stops[stops.length - 1].color];
}

function terrainTone(profile, column = 0, row = 0) {
  const mobility = clampNumber(profile.mobility, 0, 1);
  const height = clampNumber(profile.height, 0, 1);
  const ridge = clampNumber(profile.ridge, 0, 1);
  const slowdown = clampNumber(profile.slowdown, 0, 1);
  const terrainLevel = clampNumber(
    height * 0.62 + (1 - mobility) * 0.28 + ridge * 0.1,
    0,
    1
  );
  const steppedLevel = Math.round(terrainLevel * 6) / 6;
  const shadedLevel = lerp(terrainLevel, steppedLevel, 0.58);
  const [baseR, baseG, baseB] = blendTerrainTriplets(
    [
      { at: 0, color: [10, 24, 31] },
      { at: 0.22, color: [23, 40, 37] },
      { at: 0.42, color: [58, 70, 46] },
      { at: 0.64, color: [112, 98, 60] },
      { at: 0.82, color: [146, 112, 72] },
      { at: 1, color: [168, 126, 82] }
    ],
    shadedLevel
  );

  const majorWave = ((height * 8.8 + ridge * 0.95) % 1 + 1) % 1;
  const minorWave =
    ((height * 19.5 + slowdown * 1.2 + mobility * 0.35) % 1 + 1) % 1;
  const majorContour = Math.max(0, 1 - Math.abs(majorWave * 2 - 1) * 18);
  const minorContour = Math.max(0, 1 - Math.abs(minorWave * 2 - 1) * 26);
  const hatch =
    ridge > 0.1 && (column * 3 + row * 5) % 11 === 0 ? ridge * 10 : 0;
  const reliefShadow = ridge * 20 + slowdown * 14 + hatch;
  const lowlandLift = mobility * (1 - height) * 6;

  return {
    r: clampNumber(
      Math.round(baseR + lowlandLift - reliefShadow - majorContour * 18 - minorContour * 5),
      0,
      255
    ),
    g: clampNumber(
      Math.round(baseG + lowlandLift * 0.7 - reliefShadow * 0.72 - majorContour * 12 - minorContour * 4),
      0,
      255
    ),
    b: clampNumber(
      Math.round(baseB + lowlandLift * 0.3 - reliefShadow * 0.44 - majorContour * 6 - minorContour * 2),
      0,
      255
    ),
    a: Math.round(132 + terrainLevel * 30 + ridge * 10 + majorContour * 8)
  };
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

function wrapWorldCoordinate(value, size) {
  if (!Number.isFinite(size) || size <= 0) {
    return value;
  }
  return ((value % size) + size) % size;
}

function wrapWorldPoint(point, worldOrWidth, maybeHeight) {
  if (!point) {
    return null;
  }
  const width =
    typeof worldOrWidth === "number"
      ? worldOrWidth
      : Number(worldOrWidth?.width) || 0;
  const height =
    typeof worldOrWidth === "number"
      ? Number(maybeHeight) || 0
      : Number(worldOrWidth?.height) || 0;
  return {
    x: wrapWorldCoordinate(point.x, width),
    y: wrapWorldCoordinate(point.y, height)
  };
}

function polarVectorPoint(radius, angle) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function formatSvgPoint(x, y) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function blobShapePoint(radius, shape, angle, heading = 0) {
  const localAngle = angle + shape.tilt;
  const primaryWave = Math.sin(localAngle * shape.lobes + shape.phase);
  const secondaryWave = Math.sin(localAngle * (shape.lobes + 1) - shape.phase * 0.6);
  const radialScale =
    1 +
    primaryWave * shape.amplitude +
    secondaryWave * shape.wobble * 0.8;
  const localRadius = radius * Math.max(0.62, radialScale);
  const squishX = shape.squish;
  const squishY = 1 / shape.squish;
  const baseX = Math.cos(angle) * localRadius * squishX;
  const baseY = Math.sin(angle) * localRadius * squishY;
  const cosHeading = Math.cos(heading);
  const sinHeading = Math.sin(heading);
  return {
    x: baseX * cosHeading - baseY * sinHeading,
    y: baseX * sinHeading + baseY * cosHeading
  };
}

function buildBlobShapePath(radius, shape, heading, steps = 28) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const point = blobShapePoint(radius, shape, angle, heading);
    points.push(`${index === 0 ? "M" : "L"} ${formatSvgPoint(point.x, point.y)}`);
  }
  points.push("Z");
  return points.join(" ");
}

function terrainConfigSignature(config) {
  const terrain = config?.terrain ?? {};
  return JSON.stringify({
    enabled: Number(terrain.enabled) || 0,
    peakCount: Number(terrain.peakCount) || 0,
    radiusMin: Number(terrain.radiusMin) || 0,
    radiusMax: Number(terrain.radiusMax) || 0,
    slowdownStart: Number(terrain.slowdownStart) || 0,
    dragBoost: Number(terrain.dragBoost) || 0,
    blockThreshold: Number(terrain.blockThreshold) || 0,
    minTraversal: Number(terrain.minTraversal) || 0
  });
}

function sampleTerrainHeightAtNormalized(terrain, nx, ny) {
  const samples = terrain?.samples;
  if (
    !terrain?.enabled ||
    (!Array.isArray(samples) && !ArrayBuffer.isView(samples)) ||
    samples.length === 0 ||
    terrain.columns <= 0 ||
    terrain.rows <= 0
  ) {
    return 0;
  }

  const wrappedX = ((nx % 1) + 1) % 1;
  const wrappedY = ((ny % 1) + 1) % 1;
  const fx = wrappedX * terrain.columns;
  const fy = wrappedY * terrain.rows;
  const x0 = Math.floor(fx) % terrain.columns;
  const y0 = Math.floor(fy) % terrain.rows;
  const x1 = (x0 + 1) % terrain.columns;
  const y1 = (y0 + 1) % terrain.rows;
  const tx = fx - Math.floor(fx);
  const ty = fy - Math.floor(fy);
  const rowStride = terrain.columns;
  const sample00 = samples[y0 * rowStride + x0];
  const sample10 = samples[y0 * rowStride + x1];
  const sample01 = samples[y1 * rowStride + x0];
  const sample11 = samples[y1 * rowStride + x1];
  const top = lerp(sample00, sample10, tx);
  const bottom = lerp(sample01, sample11, tx);
  return lerp(top, bottom, ty);
}

function cloneTerrainFieldState(terrain) {
  const sourceSamples = terrain?.samples;
  const clonedSamples = ArrayBuffer.isView(sourceSamples)
    ? new Float32Array(sourceSamples)
    : Array.isArray(sourceSamples)
      ? Float32Array.from(sourceSamples)
      : null;
  if (!terrain?.enabled || !clonedSamples) {
    return null;
  }
  return {
    ...terrain,
    peaks: Array.isArray(terrain.peaks)
      ? terrain.peaks.map((peak) => ({ ...peak }))
      : [],
    samples: clonedSamples
  };
}

function restoreTerrainFieldState(targetSimulation, terrainState) {
  if (!targetSimulation || !terrainState) {
    return false;
  }
  const nextTerrain = targetSimulation.terrain;
  if (
    nextTerrain?.enabled &&
    nextTerrain.columns > 0 &&
    nextTerrain.rows > 0 &&
    terrainState.enabled
  ) {
    const resampled = new Float32Array(nextTerrain.columns * nextTerrain.rows);
    for (let row = 0; row < nextTerrain.rows; row += 1) {
      for (let column = 0; column < nextTerrain.columns; column += 1) {
        const nx = (column + 0.5) / nextTerrain.columns;
        const ny = (row + 0.5) / nextTerrain.rows;
        resampled[row * nextTerrain.columns + column] = sampleTerrainHeightAtNormalized(
          terrainState,
          nx,
          ny
        );
      }
    }
    targetSimulation.terrain = {
      ...nextTerrain,
      peaks: Array.isArray(terrainState.peaks)
        ? terrainState.peaks.map((peak) => ({ ...peak }))
        : [],
      samples: resampled
    };
  } else {
    targetSimulation.terrain = cloneTerrainFieldState(terrainState);
  }
  targetSimulation.terrainVersion = targetSimulation.terrain?.version ?? 0;
  return Boolean(targetSimulation.terrain);
}

function terrainSampleChecksum(terrain) {
  const samples = terrain?.samples;
  if (
    !terrain?.enabled ||
    (!Array.isArray(samples) && !ArrayBuffer.isView(samples)) ||
    samples.length === 0
  ) {
    return 0;
  }
  let checksum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    checksum += samples[index];
  }
  return Number((checksum / samples.length).toFixed(6));
}

const LOW_FIDELITY_RENDER = true;
const UI_UPDATE_INTERVAL_MS = 220;
const LINEAGE_UPDATE_INTERVAL_MS = 1400;
const FRAME_BUDGET_MS = 1000 / 60;
const PERF_EMA_ALPHA = 0.16;
const LAG_UPDATE_INTERVAL_MS = 180;
const LIGHTNING_CHARGE_MIN_RADIUS = 56;
const LIGHTNING_CHARGE_MAX_RADIUS = 280;
const LIGHTNING_CHARGE_RAMP = 1.7;
const MOUNTAIN_BRUSH_RADIUS_FACTOR = 0.16;
const MOUNTAIN_BRUSH_SPACING_FACTOR = 0.56;
const MOUNTAIN_BRUSH_INTERVAL_MS = 72;
const MOUNTAIN_BRUSH_INITIAL_STRENGTH = 0.085;
const MOUNTAIN_BRUSH_TRAIL_STRENGTH = 0.048;
const MOUNTAIN_BRUSH_HOLD_STRENGTH_PER_SECOND = 0.36;
const MOUNTAIN_BRUSH_HOLD_STRENGTH_MIN = 0.032;
const MOUNTAIN_BRUSH_HOLD_STRENGTH_MAX = 0.11;
const INTERACTION_COMMAND_KEYS = Object.freeze({
  feed: "KeyP",
  lightning: "KeyL",
  spring: "KeyS",
  mountain: "KeyH",
  designer: "KeyC"
});
const INTERACTION_COMMAND_PRIORITY = Object.freeze([
  "lightning",
  "spring",
  "mountain",
  "designer",
  "feed"
]);
const INTERACTION_COMMAND_CODES = new Set(Object.values(INTERACTION_COMMAND_KEYS));
const PHYLOGENY_STORAGE_KEY = "genericalgoid.phylogeny.enabled";
const LEGACY_AUDIO_STORAGE_KEY = "genericalgoid.audio.enabled";
const AUDIO_BGM_STORAGE_KEY = "genericalgoid.audio.bgm.enabled";
const AUDIO_SFX_STORAGE_KEY = "genericalgoid.audio.sfx.enabled";
const AUDIO_VOLUME_STORAGE_KEY = "genericalgoid.audio.volume";
const AUDIO_BGM_VOLUME_STORAGE_KEY = "genericalgoid.audio.bgm.volume";
const AUDIO_SFX_VOLUME_STORAGE_KEY = "genericalgoid.audio.sfx.volume";
const FAST_MODE_STORAGE_KEY = "genericalgoid.fast-mode";
const FAST_UI_UPDATE_INTERVAL_MS = 900;
const FAST_LINEAGE_UPDATE_INTERVAL_MS = 3600;
const FAST_DRAW_INTERVAL_MS = 90;
const CURATED_BGM_SOURCE = "./assets/bgm/noru-they.mp3";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function withColorAlpha(color, alpha) {
  if (typeof color !== "string") {
    return color;
  }
  if (color.includes("/")) {
    return color.replace(/\/\s*[^)]+\)/, `/ ${alpha})`);
  }
  return color;
}

const lineageTraitDefinitions = [
  {
    key: "forager",
    group: "drive",
    paletteKey: "secondary",
    score: ({ values, features }) =>
      features.priorityFood * 0.54 +
      values.sense * 0.2 +
      values.motor * 0.14 +
      (1 - features.priorityDanger) * 0.06 +
      values.bud * 0.06
  },
  {
    key: "wary",
    group: "drive",
    paletteKey: "primary",
    score: ({ values, features }) =>
      features.priorityDanger * 0.46 +
      features.avoidMean * 0.22 +
      values.shield * 0.18 +
      values.core * 0.14
  },
  {
    key: "hunter",
    group: "drive",
    paletteKey: "accent",
    score: ({ values, features }) =>
      features.priorityPrey * 0.4 +
      values.risk * 0.2 +
      Math.max(values.melee, values.ranged) * 0.24 +
      features.approachMean * 0.16
  },
  {
    key: "flocker",
    group: "drive",
    paletteKey: "secondary",
    score: ({ values, features }) =>
      features.priorityFlock * 0.4 +
      features.cooperation * 0.34 +
      values.sense * 0.14 +
      (1 - features.behaviorSpread) * 0.12
  },
  {
    key: "cruiser",
    group: "drive",
    paletteKey: "secondary",
    score: ({ values, features }) =>
      features.priorityCruise * 0.52 +
      values.motor * 0.24 +
      (1 - features.priorityFood) * 0.08 +
      (1 - features.priorityPrey) * 0.08 +
      (1 - features.priorityDanger) * 0.08
  },
  {
    key: "sprinter",
    group: "frame",
    paletteKey: "secondary",
    score: ({ values, features }) =>
      values.motor * 0.62 +
      (1 - values.core) * 0.16 +
      features.slotDensity * 0.08 +
      features.approachMean * 0.14
  },
  {
    key: "bulwark",
    group: "frame",
    paletteKey: "primary",
    score: ({ values, features }) =>
      values.core * 0.38 +
      values.shield * 0.3 +
      features.lifespan * 0.18 +
      features.priorityDanger * 0.14
  },
  {
    key: "duelist",
    group: "combat",
    paletteKey: "accent",
    score: ({ values, features }) =>
      values.melee * 0.68 +
      features.priorityPrey * 0.12 +
      values.risk * 0.12 +
      features.approachMean * 0.08
  },
  {
    key: "skirmisher",
    group: "combat",
    paletteKey: "primary",
    score: ({ values, features }) =>
      values.ranged * 0.48 +
      values.motor * 0.16 +
      values.sense * 0.16 +
      features.priorityPrey * 0.12 +
      features.priorityCruise * 0.08
  },
  {
    key: "brooder",
    group: "life",
    paletteKey: "accent",
    score: ({ values, features }) =>
      values.bud * 0.46 +
      (1 - features.threshold) * 0.34 +
      features.budFraction * 0.14 +
      features.priorityFood * 0.06
  }
];

const TRAIT_TAG_BASE_FEATURES = Object.freeze({
  slotCode: 0.48,
  slotDensity: 0.58,
  meleeShare: 0.34,
  rangedShare: 0.34,
  shieldShare: 0.32,
  coreBias: 0.5,
  motorBias: 0.5,
  slotBias: 0.5,
  allocationVariance: 0.28,
  sensor: 0.5,
  cooperation: 0.5,
  priorityFood: 0.2,
  priorityDanger: 0.2,
  priorityPrey: 0.2,
  priorityFlock: 0.2,
  priorityCruise: 0.2,
  lifespan: 0.5,
  threshold: 0.5,
  budFraction: 0.5,
  approachMean: 0.5,
  avoidMean: 0.5,
  behaviorSpread: 0.38
});

const TRAIT_TAG_FEATURE_SEEDS = Object.freeze({
  forager: {
    slotCode: 0.42,
    slotDensity: 0.62,
    meleeShare: 0.18,
    rangedShare: 0.36,
    shieldShare: 0.16,
    coreBias: 0.34,
    motorBias: 0.74,
    slotBias: 0.58,
    allocationVariance: 0.24,
    sensor: 0.82,
    cooperation: 0.38,
    priorityFood: 0.94,
    priorityDanger: 0.18,
    priorityPrey: 0.22,
    priorityFlock: 0.22,
    priorityCruise: 0.1,
    lifespan: 0.48,
    threshold: 0.36,
    budFraction: 0.58,
    approachMean: 0.44,
    avoidMean: 0.52,
    behaviorSpread: 0.26
  },
  wary: {
    slotCode: 0.18,
    slotDensity: 0.54,
    meleeShare: 0.12,
    rangedShare: 0.24,
    shieldShare: 0.84,
    coreBias: 0.82,
    motorBias: 0.32,
    slotBias: 0.46,
    allocationVariance: 0.16,
    sensor: 0.56,
    cooperation: 0.36,
    priorityFood: 0.18,
    priorityDanger: 0.96,
    priorityPrey: 0.08,
    priorityFlock: 0.28,
    priorityCruise: 0.1,
    lifespan: 0.82,
    threshold: 0.54,
    budFraction: 0.36,
    approachMean: 0.22,
    avoidMean: 0.9,
    behaviorSpread: 0.2
  },
  hunter: {
    slotCode: 0.82,
    slotDensity: 0.7,
    meleeShare: 0.46,
    rangedShare: 0.44,
    shieldShare: 0.08,
    coreBias: 0.38,
    motorBias: 0.72,
    slotBias: 0.64,
    allocationVariance: 0.46,
    sensor: 0.68,
    cooperation: 0.18,
    priorityFood: 0.18,
    priorityDanger: 0.08,
    priorityPrey: 0.96,
    priorityFlock: 0.12,
    priorityCruise: 0.2,
    lifespan: 0.5,
    threshold: 0.44,
    budFraction: 0.46,
    approachMean: 0.9,
    avoidMean: 0.22,
    behaviorSpread: 0.72
  },
  flocker: {
    slotCode: 0.54,
    slotDensity: 0.56,
    meleeShare: 0.22,
    rangedShare: 0.28,
    shieldShare: 0.32,
    coreBias: 0.48,
    motorBias: 0.52,
    slotBias: 0.56,
    allocationVariance: 0.18,
    sensor: 0.74,
    cooperation: 0.98,
    priorityFood: 0.22,
    priorityDanger: 0.2,
    priorityPrey: 0.16,
    priorityFlock: 0.96,
    priorityCruise: 0.08,
    lifespan: 0.56,
    threshold: 0.48,
    budFraction: 0.5,
    approachMean: 0.46,
    avoidMean: 0.58,
    behaviorSpread: 0.12
  },
  cruiser: {
    slotCode: 0.68,
    slotDensity: 0.5,
    meleeShare: 0.2,
    rangedShare: 0.26,
    shieldShare: 0.14,
    coreBias: 0.36,
    motorBias: 0.88,
    slotBias: 0.48,
    allocationVariance: 0.22,
    sensor: 0.34,
    cooperation: 0.18,
    priorityFood: 0.06,
    priorityDanger: 0.08,
    priorityPrey: 0.08,
    priorityFlock: 0.12,
    priorityCruise: 0.96,
    lifespan: 0.44,
    threshold: 0.42,
    budFraction: 0.42,
    approachMean: 0.38,
    avoidMean: 0.34,
    behaviorSpread: 0.22
  },
  sprinter: {
    slotCode: 0.74,
    slotDensity: 0.68,
    meleeShare: 0.28,
    rangedShare: 0.34,
    shieldShare: 0.08,
    coreBias: 0.18,
    motorBias: 0.98,
    slotBias: 0.62,
    allocationVariance: 0.34,
    sensor: 0.62,
    cooperation: 0.22,
    priorityFood: 0.24,
    priorityDanger: 0.16,
    priorityPrey: 0.34,
    priorityFlock: 0.1,
    priorityCruise: 0.58,
    lifespan: 0.36,
    threshold: 0.42,
    budFraction: 0.44,
    approachMean: 0.58,
    avoidMean: 0.32,
    behaviorSpread: 0.56
  },
  bulwark: {
    slotCode: 0.14,
    slotDensity: 0.46,
    meleeShare: 0.16,
    rangedShare: 0.14,
    shieldShare: 0.88,
    coreBias: 0.96,
    motorBias: 0.2,
    slotBias: 0.38,
    allocationVariance: 0.12,
    sensor: 0.44,
    cooperation: 0.42,
    priorityFood: 0.12,
    priorityDanger: 0.72,
    priorityPrey: 0.1,
    priorityFlock: 0.24,
    priorityCruise: 0.1,
    lifespan: 0.9,
    threshold: 0.56,
    budFraction: 0.34,
    approachMean: 0.22,
    avoidMean: 0.82,
    behaviorSpread: 0.18
  },
  duelist: {
    slotCode: 0.04,
    slotDensity: 0.64,
    meleeShare: 0.96,
    rangedShare: 0.06,
    shieldShare: 0.1,
    coreBias: 0.42,
    motorBias: 0.68,
    slotBias: 0.58,
    allocationVariance: 0.42,
    sensor: 0.5,
    cooperation: 0.2,
    priorityFood: 0.12,
    priorityDanger: 0.12,
    priorityPrey: 0.82,
    priorityFlock: 0.12,
    priorityCruise: 0.18,
    lifespan: 0.48,
    threshold: 0.44,
    budFraction: 0.46,
    approachMean: 0.84,
    avoidMean: 0.16,
    behaviorSpread: 0.5
  },
  skirmisher: {
    slotCode: 0.56,
    slotDensity: 0.66,
    meleeShare: 0.08,
    rangedShare: 0.96,
    shieldShare: 0.16,
    coreBias: 0.34,
    motorBias: 0.62,
    slotBias: 0.68,
    allocationVariance: 0.34,
    sensor: 0.9,
    cooperation: 0.34,
    priorityFood: 0.16,
    priorityDanger: 0.16,
    priorityPrey: 0.74,
    priorityFlock: 0.18,
    priorityCruise: 0.34,
    lifespan: 0.46,
    threshold: 0.46,
    budFraction: 0.44,
    approachMean: 0.5,
    avoidMean: 0.62,
    behaviorSpread: 0.56
  },
  brooder: {
    slotCode: 0.16,
    slotDensity: 0.68,
    meleeShare: 0.3,
    rangedShare: 0.28,
    shieldShare: 0.14,
    coreBias: 0.42,
    motorBias: 0.52,
    slotBias: 0.48,
    allocationVariance: 0.3,
    sensor: 0.56,
    cooperation: 0.46,
    priorityFood: 0.58,
    priorityDanger: 0.14,
    priorityPrey: 0.08,
    priorityFlock: 0.3,
    priorityCruise: 0.16,
    lifespan: 0.38,
    threshold: 0.08,
    budFraction: 0.94,
    approachMean: 0.54,
    avoidMean: 0.36,
    behaviorSpread: 0.58
  }
});

function traitTagFeatures(tagKey) {
  return {
    ...TRAIT_TAG_BASE_FEATURES,
    ...(TRAIT_TAG_FEATURE_SEEDS[tagKey] ?? {})
  };
}

const TRAIT_TAG_PALETTES = Object.freeze(
  Object.fromEntries(
    lineageTraitDefinitions.map((definition) => [
      definition.key,
      visualFeaturePalette(traitTagFeatures(definition.key), 1)
    ])
  )
);

function capabilityValueMap(profile) {
  return Object.fromEntries(profile.map((axis) => [axis.key, axis.value]));
}

function deriveLineageTraitTags(entry, palette, config, locale, limit = 2) {
  const features = entry?.visualFeatures ?? {};
  const profile = lineageCapabilityProfile(entry, config);
  const values = capabilityValueMap(profile);
  const candidates = lineageTraitDefinitions
    .map((definition) => {
      const score = clampNumber(definition.score({ values, features }), 0, 1);
      return {
        key: definition.key,
        group: definition.group,
        score,
        color:
          TRAIT_TAG_PALETTES[definition.key]?.[definition.paletteKey] ??
          TRAIT_TAG_PALETTES[definition.key]?.primary ??
          palette[definition.paletteKey] ??
          palette.primary,
        shadow:
          TRAIT_TAG_PALETTES[definition.key]?.shadow ?? palette.shadow
      };
    })
    .sort((left, right) => right.score - left.score);

  const selected = [];
  const usedGroups = new Set();
  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    if (usedGroups.has(candidate.group)) {
      continue;
    }
    selected.push(candidate);
    usedGroups.add(candidate.group);
  }

  if (selected.length < limit) {
    for (const candidate of candidates) {
      if (selected.length >= limit) {
        break;
      }
      if (selected.some((tag) => tag.key === candidate.key)) {
        continue;
      }
      selected.push(candidate);
    }
  }

  return selected.slice(0, limit).map((tag) => ({
    ...tag,
    label: t(locale, `trait.${tag.key}`),
    backgroundStart: withColorAlpha(tag.shadow, 0.52),
    backgroundEnd: withColorAlpha(tag.color, 0.18),
    border: withColorAlpha(tag.color, 0.4),
    dot: withColorAlpha(tag.color, 0.94),
    glow: withColorAlpha(tag.color, 0.22)
  }));
}

function buildTraitTagMarkup(tags) {
  if (!tags.length) {
    return "";
  }
  return `
    <div class="lineage-tags">
      ${tags
        .map(
          (tag) => `
            <span
              class="lineage-tag"
              style="--lineage-tag-color:${tag.color}; --lineage-tag-bg-start:${tag.backgroundStart}; --lineage-tag-bg-end:${tag.backgroundEnd}; --lineage-tag-border:${tag.border}; --lineage-tag-dot:${tag.dot}; --lineage-tag-glow:${tag.glow};"
            >
              ${escapeHtml(tag.label)}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadPhylogenyEnabled() {
  if (!hasStorage()) {
    return false;
  }
  try {
    return window.localStorage.getItem(PHYLOGENY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePhylogenyEnabled(enabled) {
  if (!hasStorage()) {
    return enabled;
  }
  try {
    window.localStorage.setItem(PHYLOGENY_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    return enabled;
  }
  return enabled;
}

function loadLegacyAudioEnabled() {
  if (!hasStorage()) {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(LEGACY_AUDIO_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === "1";
  } catch {
    return true;
  }
}

function loadAudioBgmEnabled() {
  if (!hasStorage()) {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(AUDIO_BGM_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === "1";
  } catch {
    return true;
  }
}

function saveAudioBgmEnabled(enabled) {
  if (!hasStorage()) {
    return enabled;
  }
  try {
    window.localStorage.setItem(AUDIO_BGM_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    return enabled;
  }
  return enabled;
}

function loadAudioSfxEnabled() {
  if (!hasStorage()) {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(AUDIO_SFX_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === "1";
  } catch {
    return true;
  }
}

function saveAudioSfxEnabled(enabled) {
  if (!hasStorage()) {
    return enabled;
  }
  try {
    window.localStorage.setItem(AUDIO_SFX_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    return enabled;
  }
  return enabled;
}

function loadAudioVolume() {
  if (!hasStorage()) {
    return 0.6;
  }
  try {
    const raw = Number(window.localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY));
    return Number.isFinite(raw) ? clampNumber(raw, 0, 1) : 0.6;
  } catch {
    return 0.6;
  }
}

function saveAudioVolume(volume) {
  const normalized = clampNumber(Number(volume) || 0, 0, 1);
  if (!hasStorage()) {
    return normalized;
  }
  try {
    window.localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, String(normalized));
  } catch {
    return normalized;
  }
  return normalized;
}

function loadAudioBgmVolume() {
  if (!hasStorage()) {
    return 1;
  }
  try {
    const raw = Number(window.localStorage.getItem(AUDIO_BGM_VOLUME_STORAGE_KEY));
    return Number.isFinite(raw) ? clampNumber(raw, 0, 1) : 1;
  } catch {
    return 1;
  }
}

function saveAudioBgmVolume(volume) {
  const normalized = clampNumber(Number(volume) || 0, 0, 1);
  if (!hasStorage()) {
    return normalized;
  }
  try {
    window.localStorage.setItem(AUDIO_BGM_VOLUME_STORAGE_KEY, String(normalized));
  } catch {
    return normalized;
  }
  return normalized;
}

function loadAudioSfxVolume() {
  if (!hasStorage()) {
    return 1;
  }
  try {
    const raw = Number(window.localStorage.getItem(AUDIO_SFX_VOLUME_STORAGE_KEY));
    return Number.isFinite(raw) ? clampNumber(raw, 0, 1) : 1;
  } catch {
    return 1;
  }
}

function saveAudioSfxVolume(volume) {
  const normalized = clampNumber(Number(volume) || 0, 0, 1);
  if (!hasStorage()) {
    return normalized;
  }
  try {
    window.localStorage.setItem(AUDIO_SFX_VOLUME_STORAGE_KEY, String(normalized));
  } catch {
    return normalized;
  }
  return normalized;
}

function loadFastMode() {
  if (!hasStorage()) {
    return false;
  }
  try {
    return window.localStorage.getItem(FAST_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveFastMode(enabled) {
  if (!hasStorage()) {
    return enabled;
  }
  try {
    window.localStorage.setItem(FAST_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    return enabled;
  }
  return enabled;
}

function startApp() {
  const canvas = document.getElementById("sim-canvas");
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  const canvasFrame = canvas.parentElement;
  const stageShell = canvasFrame?.parentElement ?? null;
  const stagePanel = canvasFrame?.closest(".stage-panel") ?? null;
  const appLayout = document.querySelector(".app-layout");
  const lineageSidebar = document.querySelector(".lineage-sidebar");
  const stageToolbar = document.querySelector(".stage-toolbar");
  const stageStatsStrip = document.querySelector(".stage-stats-strip");
  const menuToggleButton = document.getElementById("toggle-menu");
  const commandsPeekButton = document.getElementById("commands-peek-button");
  const commandsPanel = document.getElementById("commands-panel");
  const modeToggleButton = document.getElementById("mode-toggle");
  const statsPeekButton = document.getElementById("stats-peek-button");
  const localeToggleButton = document.getElementById("locale-toggle");
  const guideLink = document.getElementById("guide-link");
  const developerLink = document.getElementById("developer-link");
  const menuLayer = document.getElementById("menu-layer");
  const menuBackdrop = document.getElementById("menu-backdrop");
  const menuPanel = document.getElementById("menu-panel");
  const closeMenuButton = document.getElementById("close-menu");
  const toggleButton = document.getElementById("toggle-run");
  const resetButton = document.getElementById("reset-world");
  const fullscreenButton = document.getElementById("toggle-fullscreen");
  const exportSnapshotButton = document.getElementById("export-snapshot");
  const exportVideoButton = document.getElementById("export-video");
  const quickSpeedInput = document.getElementById("quick-speed-scale");
  const quickSpeedLabel = document.getElementById("quick-speed-label");
  const quickPopulationInput = document.getElementById("quick-population-input");
  const quickTotalMaterialInput = document.getElementById("quick-total-material-input");
  const quickAudioVolumeInput = document.getElementById("quick-audio-volume");
  const quickAudioLabel = document.getElementById("quick-audio-label");
  const speedInput = document.getElementById("speed-scale");
  const speedLabel = document.getElementById("speed-label");
  const statusPill = document.getElementById("status-pill");
  const lineageList = document.getElementById("lineage-list");
  const lineageSharePanel = document.getElementById("lineage-share-panel");
  const legendList = document.getElementById("gadget-legend");
  const phylogenyToggle = document.getElementById("phylogeny-toggle");
  const phylogenyTree = document.getElementById("phylogeny-tree");
  const bgmToggle = document.getElementById("bgm-toggle");
  const sfxToggle = document.getElementById("sfx-toggle");
  const bgmVolumeInput = document.getElementById("bgm-volume");
  const bgmVolumeReadout = document.getElementById("bgm-volume-readout");
  const sfxVolumeInput = document.getElementById("sfx-volume");
  const sfxVolumeReadout = document.getElementById("sfx-volume-readout");
  const designerRandomizeButton = document.getElementById("designer-randomize");
  const designerDeployToggleButton = document.getElementById("designer-deploy-toggle");
  const designerPreview = document.getElementById("designer-preview");
  const designerNameInput = document.getElementById("designer-name");
  const designerMassInput = document.getElementById("designer-mass");
  const designerSlotCountInput = document.getElementById("designer-slot-count");
  const designerCoreShareInput = document.getElementById("designer-core-share");
  const designerMotorShareInput = document.getElementById("designer-motor-share");
  const designerGadgetShareInput = document.getElementById("designer-gadget-share");
  const designerSensorInput = document.getElementById("designer-sensor");
  const designerCooperationInput = document.getElementById("designer-cooperation");
  const designerLifeInput = document.getElementById("designer-life");
  const designerBirthThresholdInput = document.getElementById("designer-birth-threshold");
  const designerBudFractionInput = document.getElementById("designer-bud-fraction");
  const designerApproachRatioInput = document.getElementById("designer-approach-ratio");
  const designerAvoidRatioInput = document.getElementById("designer-avoid-ratio");
  const designerShapeLobesInput = document.getElementById("designer-shape-lobes");
  const designerShapeAmplitudeInput = document.getElementById("designer-shape-amplitude");
  const designerShapeWobbleInput = document.getElementById("designer-shape-wobble");
  const designerShapeSquishInput = document.getElementById("designer-shape-squish");
  const designerSlotInputs = Array.from({ length: 7 }, (_, index) =>
    document.getElementById(`designer-slot-${index}`)
  );

  const statPopulation = document.getElementById("stat-population");
  const statLineages = document.getElementById("stat-lineages");
  const statAvgMass = document.getElementById("stat-avg-mass");
  const statFreeMass = document.getElementById("stat-free-mass");
  const statBoundMass = document.getElementById("stat-bound-mass");
  const statTotalMass = document.getElementById("stat-total-mass");
  const statBirths = document.getElementById("stat-births");
  const statDeaths = document.getElementById("stat-deaths");
  const statDrift = document.getElementById("stat-drift");
  const statLifeLeft = document.getElementById("stat-life-left");
  const statBiodiversityEntropy = document.getElementById("stat-biodiversity-entropy");
  const mainStatPopulation = document.getElementById("main-stat-population");
  const mainStatBiodiversityEntropy = document.getElementById(
    "main-stat-biodiversity-entropy"
  );
  const mainStatTotalMass = document.getElementById("main-stat-total-mass");
  const stageLagIndicator = document.getElementById("stage-lag-indicator");
  const mainStatLag = document.getElementById("main-stat-lag");
  const detailStatLineages = document.getElementById("detail-stat-lineages");
  const detailStatAvgMass = document.getElementById("detail-stat-avg-mass");
  const detailStatFreeMass = document.getElementById("detail-stat-free-mass");
  const detailStatBoundMass = document.getElementById("detail-stat-bound-mass");
  const detailStatLifeLeft = document.getElementById("detail-stat-life-left");
  const detailStatBirths = document.getElementById("detail-stat-births");
  const detailStatDeaths = document.getElementById("detail-stat-deaths");
  const detailStatDrift = document.getElementById("detail-stat-drift");
  const focusCell = document.getElementById("focus-cell");

  function shouldUseUltrawideMode() {
    return window.innerWidth >= 3000 && window.innerHeight >= 1200;
  }

  function buildSimulationConfig(sourceConfig, ultrawideMode) {
    const nextConfig = deepClone(sourceConfig);
    if (!ultrawideMode) {
      return nextConfig;
    }

    const ultrawideAspect = 2.42;
    nextConfig.world.width = Math.max(
      nextConfig.world.width,
      Math.round(nextConfig.world.height * ultrawideAspect)
    );
    return nextConfig;
  }

  let useUltrawideWorld =
    shouldUseUltrawideMode() || Boolean(document.fullscreenElement);
  let locale = loadLocale();
  let baseConfig = loadConfig();
  let config = buildSimulationConfig(baseConfig, useUltrawideWorld);
  let simulation = new Simulation(config);
  let paused = false;
  let speedScale = Number(speedInput.value);
  let lastTime = performance.now();
  let lastBroadcastAt = 0;
  let lastUiUpdateAt = 0;
  let lastLineageUpdateAt = -Infinity;
  let lastFeedSoundAt = -Infinity;
  let viewport = { scale: 1, offsetX: 0, offsetY: 0 };
  let hoverWorldPoint = null;
  let hoveredOrganismId = null;
  let selectedOrganismId = null;
  let selectedLineageId = null;
  let pointerDragState = null;
  let menuOpen = false;
  let cachedDominantLineages = [];
  let cachedPhylogenyLineages = [];
  let phylogenyEnabled = loadPhylogenyEnabled();
  let audioBgmEnabled = loadAudioBgmEnabled();
  let audioSfxEnabled = loadAudioSfxEnabled();
  let audioVolume = loadAudioVolume();
  let audioBgmVolume = loadAudioBgmVolume();
  let audioSfxVolume = loadAudioSfxVolume();
  let fastMode = loadFastMode();
  const pressedInteractionCodes = new Set();
  let heldInteractionCommand = null;
  let mountainArmed = false;
  let designerDeployArmed = false;
  const cachedLineageSamples = new Map();
  let terrainTextureCache = { version: -1, canvas: null };
  let exportRecordingState = null;
  let lastDrawAt = 0;
  let smoothedFrameCostMs = 0;
  let smoothedComputeLagMs = 0;
  let hasPerformanceSample = false;
  let lastLagUpdateAt = 0;
  const debugState = {
    resetCount: 0,
    displayModeSwitchCount: 0,
    resizeCount: 0,
    lastResetReason: null,
    lastDisplayModeReason: "init",
    lastDisplayModeChanged: false,
    commandTrace: []
  };
  const audioDirector = createAudioDirector();
  simulation.fastMode = fastMode;
  audioDirector.setBgmSource(CURATED_BGM_SOURCE);
  audioDirector.setBgmEnabled(audioBgmEnabled && !fastMode);
  audioDirector.setSfxEnabled(audioSfxEnabled && !fastMode);
  audioDirector.setVolume(audioVolume);
  audioDirector.setBgmVolume(audioBgmVolume);
  audioDirector.setSfxVolume(audioSfxVolume);

  const broadcastChannel =
    typeof window.BroadcastChannel !== "undefined"
      ? new window.BroadcastChannel(SNAPSHOT_CHANNEL)
      : null;

  function updateDebugHandle() {
    if (
      typeof window === "undefined" ||
      !["127.0.0.1", "localhost"].includes(window.location.hostname)
    ) {
      return;
    }

    window.__genericalgoidDebug = {
      getState() {
        return {
          ...debugState,
          useUltrawideWorld,
          worldWidth: config.world.width,
          worldHeight: config.world.height,
          terrainVersion: simulation.terrain?.version ?? -1,
          terrainChecksum: terrainSampleChecksum(simulation.terrain),
          currentCommand: worldInteractionCommand(),
          springCount: simulation.springs?.length ?? 0,
          resourceCount: simulation.resources?.length ?? 0,
          totalMaterial: simulation.config?.world?.totalMaterial ?? 0,
          pointerMode: pointerDragState?.mode ?? null,
          statusText: statusPill?.textContent ?? "",
          audio: audioDirector.getDebugState(),
          activeElementTag: document.activeElement?.tagName ?? null,
          activeElementId: document.activeElement?.id ?? null,
          commandTrace: [...debugState.commandTrace],
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        };
      },
      simulateMountainClick(normalizedX = 0.5, normalizedY = 0.5) {
        const point = {
          x: config.world.width * clampNumber(normalizedX, 0, 1),
          y: config.world.height * clampNumber(normalizedY, 0, 1)
        };
        const raised = raiseMountainAt(point, {
          silent: true,
          playAudio: false,
          redraw: false
        });
        updateStats(true);
        draw(true);
        return {
          raised,
          state: this.getState()
        };
      },
      simulateMountainDrag(
        startX = 0.2,
        startY = 0.3,
        endX = 0.65,
        endY = 0.7,
        holdMs = 220
      ) {
        const startPoint = {
          x: config.world.width * clampNumber(startX, 0, 1),
          y: config.world.height * clampNumber(startY, 0, 1)
        };
        const endPoint = {
          x: config.world.width * clampNumber(endX, 0, 1),
          y: config.world.height * clampNumber(endY, 0, 1)
        };
        const started = beginMountainSculpt(startPoint, 9991);
        if (!started) {
          return {
            raised: false,
            state: this.getState()
          };
        }
        sculptMountainToward(endPoint, performance.now() + Math.max(0, holdMs), {
          forceTail: true
        });
        finishPointerDrag();
        return {
          raised: true,
          state: this.getState()
        };
      },
      simulateLightningBurst(normalizedX = 0.5, normalizedY = 0.5, normalizedRadius = 0.08) {
        const point = {
          x: config.world.width * clampNumber(normalizedX, 0, 1),
          y: config.world.height * clampNumber(normalizedY, 0, 1)
        };
        const radius =
          clampNumber(normalizedRadius, 0.01, 0.4) *
          Math.min(config.world.width, config.world.height);
        const result = strikeLightningBurst(point, radius);
        updateStats(true);
        draw(true);
        return {
          ...result,
          state: this.getState()
        };
      }
    };
  }

  function recordCommandTrace(type, detail = {}) {
    if (
      typeof window === "undefined" ||
      !["127.0.0.1", "localhost"].includes(window.location.hostname)
    ) {
      return;
    }
    debugState.commandTrace.push({
      type,
      detail,
      at: Number(performance.now().toFixed(1))
    });
    if (debugState.commandTrace.length > 18) {
      debugState.commandTrace.splice(0, debugState.commandTrace.length - 18);
    }
  }

  function preserveTerrainAcrossSimulationReset(previousSimulation, nextSimulation, nextConfig) {
    if (!previousSimulation?.terrain?.enabled) {
      return false;
    }
    if (
      terrainConfigSignature(previousSimulation.config) !==
      terrainConfigSignature(nextConfig)
    ) {
      return false;
    }
    const restored = restoreTerrainFieldState(
      nextSimulation,
      cloneTerrainFieldState(previousSimulation.terrain)
    );
    if (restored) {
      terrainTextureCache = { version: -1, canvas: null };
    }
    return restored;
  }

  function syncDisplayMode(notify = false) {
    const isFullscreen = Boolean(document.fullscreenElement);
    const nextUltrawideWorld = shouldUseUltrawideMode() || isFullscreen;
    const modeChanged = nextUltrawideWorld !== useUltrawideWorld;
    debugState.lastDisplayModeReason = isFullscreen ? "fullscreen" : "resize";
    debugState.lastDisplayModeChanged = modeChanged;
    useUltrawideWorld = nextUltrawideWorld;
    document.body.classList.toggle("ultrawide-mode", useUltrawideWorld);
    syncFullscreenLabel();

    if (!modeChanged) {
      updateDebugHandle();
      return;
    }

    debugState.displayModeSwitchCount += 1;
    const previousSimulation = simulation;
    config = buildSimulationConfig(baseConfig, useUltrawideWorld);
    simulation = new Simulation(config);
    preserveTerrainAcrossSimulationReset(previousSimulation, simulation, config);
    simulation.fastMode = fastMode;
    hoverWorldPoint = null;
    hoveredOrganismId = null;
    renderLegend();
    resizeCanvas();
    updateStats(true);
    draw(true);
    updateDebugHandle();

    if (notify) {
      showStatus(
        useUltrawideWorld
          ? t(locale, "app.status.ultrawide")
          : t(locale, "app.status.standard")
      );
      window.setTimeout(() => {
        showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
      }, 1600);
    }
  }

  function refreshHeldInteractionCommand() {
    heldInteractionCommand =
      INTERACTION_COMMAND_PRIORITY.find((command) =>
        pressedInteractionCodes.has(INTERACTION_COMMAND_KEYS[command])
      ) ?? null;
  }

  function clearHeldInteractionCommands() {
    pressedInteractionCodes.clear();
    heldInteractionCommand = null;
  }

  function worldInteractionCommand() {
    if (heldInteractionCommand) {
      return heldInteractionCommand;
    }
    if (designerDeployArmed) {
      return "designer";
    }
    if (mountainArmed) {
      return "mountain";
    }
    return null;
  }

  function showStatus(text, tone = "normal") {
    statusPill.textContent = text;
    statusPill.title = text;
    statusPill.style.color = tone === "alert" ? "#ffb19c" : "";
    statusPill.style.background =
      tone === "alert" ? "rgba(255, 139, 107, 0.14)" : "rgba(114, 225, 209, 0.11)";
    statusPill.style.borderColor =
      tone === "alert" ? "rgba(255, 139, 107, 0.22)" : "rgba(114, 225, 209, 0.2)";
  }

  function exportTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  function downloadBlob(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
  }

  function canvasToBlob(targetCanvas, type) {
    return new Promise((resolve) => {
      targetCanvas.toBlob((blob) => resolve(blob), type);
    });
  }

  function pickRecordingMimeType() {
    if (typeof MediaRecorder === "undefined") {
      return "";
    }
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];
    return (
      candidates.find((type) => {
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      }) ?? ""
    );
  }

  function setLocalizedText(id, key) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = t(locale, key);
    }
  }

  function setLocalizedHtml(id, key) {
    const node = document.getElementById(id);
    if (node) {
      node.innerHTML = t(locale, key);
    }
  }

  function timeUnitLabel() {
    return locale === "ja" ? "秒" : "s";
  }

  function syncPhylogenyToggle() {
    if (phylogenyToggle) {
      phylogenyToggle.checked = phylogenyEnabled;
    }
    const label = document.getElementById("phylogeny-toggle-label");
    if (label) {
      label.textContent = t(
        locale,
        phylogenyEnabled ? "app.phylogenyToggle.on" : "app.phylogenyToggle.off"
      );
    }
  }

  function syncAudioToggles() {
    if (bgmToggle) {
      bgmToggle.checked = audioBgmEnabled;
    }
    if (sfxToggle) {
      sfxToggle.checked = audioSfxEnabled;
    }
    const bgmLabel = document.getElementById("bgm-toggle-label");
    if (bgmLabel) {
      bgmLabel.textContent = t(
        locale,
        audioBgmEnabled ? "app.audioBgmToggle.on" : "app.audioBgmToggle.off"
      );
    }
    const sfxLabel = document.getElementById("sfx-toggle-label");
    if (sfxLabel) {
      sfxLabel.textContent = t(
        locale,
        audioSfxEnabled ? "app.audioSfxToggle.on" : "app.audioSfxToggle.off"
      );
    }
  }

  function anyAudioEnabled() {
    return audioBgmEnabled || audioSfxEnabled;
  }

  function syncFastModeToggle() {
    if (!modeToggleButton) {
      return;
    }
    modeToggleButton.textContent = t(
      locale,
      fastMode ? "app.modeToggle.fast" : "app.modeToggle.normal"
    );
    modeToggleButton.setAttribute(
      "title",
      t(locale, fastMode ? "app.modeToggle.normalTitle" : "app.modeToggle.fastTitle")
    );
    modeToggleButton.setAttribute(
      "aria-label",
      t(locale, fastMode ? "app.modeToggle.normalTitle" : "app.modeToggle.fastTitle")
    );
    modeToggleButton.classList.toggle("is-active", fastMode);
  }

  function syncExportControls() {
    if (exportSnapshotButton) {
      exportSnapshotButton.textContent = t(locale, "app.exportSnapshot");
      exportSnapshotButton.disabled = false;
    }
    if (exportVideoButton) {
      exportVideoButton.textContent = t(locale, "app.exportVideo");
      exportVideoButton.disabled = Boolean(exportRecordingState);
    }
  }

  function syncAudioVolume() {
    if (quickAudioVolumeInput) {
      quickAudioVolumeInput.value = audioVolume.toFixed(2);
    }
    if (quickAudioLabel) {
      quickAudioLabel.textContent = `${Math.round(audioVolume * 100)}%`;
    }
  }

  function syncAudioMixControls() {
    if (bgmVolumeInput) {
      bgmVolumeInput.value = audioBgmVolume.toFixed(2);
      bgmVolumeInput.disabled = fastMode;
    }
    if (bgmVolumeReadout) {
      bgmVolumeReadout.textContent = `${Math.round(audioBgmVolume * 100)}%`;
    }
    if (sfxVolumeInput) {
      sfxVolumeInput.value = audioSfxVolume.toFixed(2);
      sfxVolumeInput.disabled = fastMode;
    }
    if (sfxVolumeReadout) {
      sfxVolumeReadout.textContent = `${Math.round(audioSfxVolume * 100)}%`;
    }
  }

  function syncAudioMixControls() {
    if (bgmVolumeInput) {
      bgmVolumeInput.value = audioBgmVolume.toFixed(2);
      bgmVolumeInput.disabled = fastMode;
    }
    if (bgmVolumeReadout) {
      bgmVolumeReadout.textContent = `${Math.round(audioBgmVolume * 100)}%`;
    }
    if (sfxVolumeInput) {
      sfxVolumeInput.value = audioSfxVolume.toFixed(2);
      sfxVolumeInput.disabled = fastMode;
    }
    if (sfxVolumeReadout) {
      sfxVolumeReadout.textContent = `${Math.round(audioSfxVolume * 100)}%`;
    }
  }

  function truncateLineageName(name) {
    return Array.from(String(name ?? "").trim()).slice(0, 4).join("");
  }

  function designerNameFallback() {
    return "Wolf";
  }

  function average(values) {
    if (!values?.length) {
      return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  function buildDesignerDraftFromGenome(genome) {
    return {
      lineageName: designerNameFallback(),
      initialMass: Math.round(config.world.initialOrganismMass * 1.9),
      slotCount: genome.slotTypes.length,
      slotTypes: [...genome.slotTypes],
      coreShare: genome.allocation[0],
      motorShare: genome.allocation[1],
      gadgetShare: genome.allocation[2],
      sensorBias: genome.sensorBias,
      cooperation: genome.cooperation,
      lifespanLimit: genome.lifespanLimit,
      thresholdMass: genome.thresholdMass,
      budFraction: genome.budFraction,
      approachRatio: average(genome.approachMassRatios),
      avoidRatio: average(genome.avoidMassRatios),
      shapeLobes: genome.shapeLobes,
      shapeAmplitude: genome.shapeAmplitude,
      shapeWobble: genome.shapeWobble,
      shapeSquish: genome.shapeSquish
    };
  }

  function readDesignerDraft() {
    return {
      lineageName: truncateLineageName(designerNameInput?.value) || designerNameFallback(),
      initialMass: Number(designerMassInput?.value),
      slotCount: Number(designerSlotCountInput?.value),
      slotTypes: designerSlotInputs.map((input) => input?.value ?? "melee"),
      coreShare: Number(designerCoreShareInput?.value),
      motorShare: Number(designerMotorShareInput?.value),
      gadgetShare: Number(designerGadgetShareInput?.value),
      sensorBias: Number(designerSensorInput?.value),
      cooperation: Number(designerCooperationInput?.value),
      lifespanLimit: Number(designerLifeInput?.value),
      thresholdMass: Number(designerBirthThresholdInput?.value),
      budFraction: Number(designerBudFractionInput?.value),
      approachRatio: Number(designerApproachRatioInput?.value),
      avoidRatio: Number(designerAvoidRatioInput?.value),
      shapeLobes: Number(designerShapeLobesInput?.value),
      shapeAmplitude: Number(designerShapeAmplitudeInput?.value),
      shapeWobble: Number(designerShapeWobbleInput?.value),
      shapeSquish: Number(designerShapeSquishInput?.value)
    };
  }

  function writeDesignerDraft(draft) {
    if (designerNameInput) {
      designerNameInput.value = truncateLineageName(draft.lineageName) || designerNameFallback();
    }
    if (designerMassInput) {
      designerMassInput.value = String(Math.round(draft.initialMass ?? config.world.initialOrganismMass));
    }
    if (designerSlotCountInput) {
      designerSlotCountInput.value = String(Math.max(3, Math.min(7, Math.round(draft.slotCount ?? 5))));
    }
    designerSlotInputs.forEach((input, index) => {
      if (!input) {
        return;
      }
      input.value = draft.slotTypes?.[index] ?? draft.slotTypes?.[draft.slotTypes.length - 1] ?? "melee";
    });
    if (designerCoreShareInput) {
      designerCoreShareInput.value = Number(draft.coreShare ?? 1).toFixed(2);
    }
    if (designerMotorShareInput) {
      designerMotorShareInput.value = Number(draft.motorShare ?? 1).toFixed(2);
    }
    if (designerGadgetShareInput) {
      designerGadgetShareInput.value = Number(draft.gadgetShare ?? 1).toFixed(2);
    }
    if (designerSensorInput) {
      designerSensorInput.value = Number(draft.sensorBias ?? 0.8).toFixed(2);
    }
    if (designerCooperationInput) {
      designerCooperationInput.value = Number(draft.cooperation ?? 0.2).toFixed(2);
    }
    if (designerLifeInput) {
      designerLifeInput.value = String(Math.round(draft.lifespanLimit ?? config.organisms.baseLifespan));
    }
    if (designerBirthThresholdInput) {
      designerBirthThresholdInput.value = String(Math.round(draft.thresholdMass ?? 60));
    }
    if (designerBudFractionInput) {
      designerBudFractionInput.value = Number(draft.budFraction ?? 0.36).toFixed(2);
    }
    if (designerApproachRatioInput) {
      designerApproachRatioInput.value = Number(draft.approachRatio ?? 0.94).toFixed(2);
    }
    if (designerAvoidRatioInput) {
      designerAvoidRatioInput.value = Number(draft.avoidRatio ?? 1.58).toFixed(2);
    }
    if (designerShapeLobesInput) {
      designerShapeLobesInput.value = String(Math.round(draft.shapeLobes ?? 4));
    }
    if (designerShapeAmplitudeInput) {
      designerShapeAmplitudeInput.value = Number(draft.shapeAmplitude ?? 0.1).toFixed(2);
    }
    if (designerShapeWobbleInput) {
      designerShapeWobbleInput.value = Number(draft.shapeWobble ?? 0.05).toFixed(2);
    }
    if (designerShapeSquishInput) {
      designerShapeSquishInput.value = Number(draft.shapeSquish ?? 1).toFixed(2);
    }
  }

  function syncDesignerSlotInputs() {
    const slotCount = Math.max(
      3,
      Math.min(7, Math.round(Number(designerSlotCountInput?.value) || 5))
    );
    designerSlotInputs.forEach((input, index) => {
      if (!input) {
        return;
      }
      input.disabled = index >= slotCount;
    });
  }

  function syncDesignerSlotOptionLabels() {
    const labelByValue = {
      melee: translateConfigText(locale, config.gadgets.melee.label),
      ranged: translateConfigText(locale, config.gadgets.ranged.label),
      shield: translateConfigText(locale, config.gadgets.shield.label)
    };
    designerSlotInputs.forEach((input) => {
      if (!input) {
        return;
      }
      [...input.options].forEach((option) => {
        option.textContent = labelByValue[option.value] ?? option.value;
      });
    });
  }

  function currentDesignerGenome() {
    return createDesignedGenome(readDesignerDraft(), config);
  }

  function syncDesignerDeployToggle() {
    if (!designerDeployToggleButton) {
      return;
    }
    designerDeployToggleButton.textContent = t(
      locale,
      designerDeployArmed ? "app.designerDeploy.on" : "app.designerDeploy.off"
    );
    designerDeployToggleButton.classList.toggle("designer-deploy-active", designerDeployArmed);
  }

  function syncFullscreenLabel() {
    if (fullscreenButton) {
      fullscreenButton.textContent = document.fullscreenElement
        ? t(locale, "app.window")
        : t(locale, "app.fullscreen");
    }
  }

  function applyLocale() {
    document.documentElement.lang = locale;
    document.title = t(locale, "app.pageTitle");

    menuToggleButton?.setAttribute("aria-label", t(locale, "app.toggleMenuAria"));
    menuToggleButton?.setAttribute("title", t(locale, "app.toggleMenuTitle"));
    syncFastModeToggle();
    document
      .querySelector(".stage-quick-controls")
      ?.setAttribute("aria-label", t(locale, "app.quickControlsAria"));
    quickSpeedInput?.parentElement?.setAttribute("title", t(locale, "app.quickSpeedTitle"));
    quickSpeedInput?.setAttribute("aria-label", t(locale, "app.quickSpeedAria"));
    quickPopulationInput?.parentElement?.setAttribute(
      "title",
      t(locale, "app.quickPopulationTitle")
    );
    quickPopulationInput?.setAttribute("aria-label", t(locale, "app.quickPopulationAria"));
    quickTotalMaterialInput?.parentElement?.setAttribute(
      "title",
      t(locale, "app.quickMaterialTitle")
    );
    quickTotalMaterialInput?.setAttribute("aria-label", t(locale, "app.quickMaterialAria"));
    quickAudioVolumeInput?.parentElement?.setAttribute("title", t(locale, "app.quickAudioTitle"));
    quickAudioVolumeInput?.setAttribute("aria-label", t(locale, "app.quickAudioAria"));
    bgmVolumeInput?.parentElement?.setAttribute("title", t(locale, "app.audioBgmVolume"));
    bgmVolumeInput?.setAttribute("aria-label", t(locale, "app.audioBgmVolume"));
    sfxVolumeInput?.parentElement?.setAttribute("title", t(locale, "app.audioSfxVolume"));
    sfxVolumeInput?.setAttribute("aria-label", t(locale, "app.audioSfxVolume"));
    guideLink?.setAttribute("aria-label", t(locale, "app.guideLinkAria"));
    guideLink?.setAttribute("title", t(locale, "app.guideLinkTitle"));
    if (guideLink) {
      guideLink.textContent = locale === "ja" ? "解説" : "guide";
    }
    developerLink?.setAttribute("aria-label", t(locale, "app.devLinkAria"));
    developerLink?.setAttribute("title", t(locale, "app.devLinkTitle"));
    if (developerLink) {
      developerLink.textContent = locale === "ja" ? "開発" : "dev";
    }
    commandsPeekButton?.setAttribute("aria-label", t(locale, "app.commandsPeekTitle"));
    commandsPeekButton?.setAttribute("title", t(locale, "app.commandsPeekTitle"));
    if (commandsPeekButton) {
      commandsPeekButton.textContent = t(locale, "app.commandsPeek");
    }
    statsPeekButton?.setAttribute("aria-label", t(locale, "app.statsPeekTitle"));
    statsPeekButton?.setAttribute("title", t(locale, "app.statsPeekTitle"));
    if (statsPeekButton) {
      statsPeekButton.textContent = t(locale, "app.statsPeek");
    }
    localeToggleButton?.setAttribute("title", localeToggleTitle(locale));
    localeToggleButton?.setAttribute("aria-label", localeToggleTitle(locale));
    if (localeToggleButton) {
      localeToggleButton.textContent = localeToggleLabel(locale);
    }
    document.querySelector(".stage-shortcuts-hint")?.setAttribute("aria-label", t(locale, "app.shortcutsAria"));
    canvas.setAttribute("aria-label", t(locale, "app.canvasAria"));
    menuPanel?.setAttribute("aria-label", t(locale, "app.menuPanelAria"));
    closeMenuButton?.setAttribute("aria-label", t(locale, "app.closeMenuAria"));
    closeMenuButton?.setAttribute("title", t(locale, "app.closeMenuTitle"));

    setLocalizedText("hint-menu-label", "app.hintLabel.menu");
    setLocalizedText("hint-run-label", "app.hintLabel.run");
    setLocalizedText("hint-reset-label", "app.hintLabel.reset");
    setLocalizedText("hint-full-label", "app.hintLabel.full");
    setLocalizedText("hint-speed-label", "app.hintLabel.speed");
    setLocalizedText("hint-drop-label", "app.hintLabel.feed");
    setLocalizedText("hint-lightning-label", "app.hintLabel.lightning");
    setLocalizedText("hint-spring-label", "app.hintLabel.spring");
    setLocalizedText("hint-mountain-label", "app.hintLabel.mountain");
    setLocalizedText("hint-design-label", "app.hintLabel.design");
    setLocalizedText("hint-dev-label", "app.hintLabel.dev");

    setLocalizedText("lineage-title", "app.lineagesTitle");
    setLocalizedText("menu-title", "app.menuTitle");
    setLocalizedText("menu-speed-label-text", "app.speed");
    setLocalizedText("world-title", "app.worldTitle");
    setLocalizedText("label-population", "app.population");
    setLocalizedText("main-label-population", "app.population");
    setLocalizedText("label-lineages", "app.lineages");
    setLocalizedText("detail-label-lineages", "app.lineages");
    setLocalizedText("label-avg-mass", "app.avgMass");
    setLocalizedText("detail-label-avg-mass", "app.avgMass");
    setLocalizedText("label-free-mass", "app.freeMass");
    setLocalizedText("detail-label-free-mass", "app.freeMass");
    setLocalizedText("label-life-left", "app.avgLifeLeft");
    setLocalizedText("detail-label-life-left", "app.avgLifeLeft");
    setLocalizedText("label-biodiversity-entropy", "app.biodiversityEntropy");
    setLocalizedText("main-label-biodiversity-entropy", "app.biodiversityEntropy");
    setLocalizedText("material-title", "app.materialTitle");
    setLocalizedText("label-bound-mass", "app.boundMass");
    setLocalizedText("detail-label-bound-mass", "app.boundMass");
    setLocalizedText("label-total-mass", "app.totalMass");
    setLocalizedText("main-label-total-mass", "app.totalMass");
    setLocalizedText("main-label-lag", "app.computeLag");
    setLocalizedText("label-births", "app.births");
    setLocalizedText("detail-label-births", "app.births");
    setLocalizedText("label-deaths", "app.deaths");
    setLocalizedText("detail-label-deaths", "app.deaths");
    setLocalizedText("label-drift", "app.materialDrift");
    setLocalizedText("detail-label-drift", "app.materialDrift");
    stageLagIndicator?.setAttribute("title", t(locale, "app.computeLagTitle"));
    setLocalizedText("export-title", "app.exportTitle");
    setLocalizedText("export-note", "app.exportNote");
    setLocalizedText("audio-title", "app.audioTitle");
    setLocalizedText("audio-bgm-volume-label", "app.audioBgmVolume");
    setLocalizedText("audio-sfx-volume-label", "app.audioSfxVolume");
    setLocalizedText("audio-note", "app.audioNote");
    setLocalizedText("phylogeny-title", "app.phylogenyTitle");
    setLocalizedText("phylogeny-note", "app.phylogenyNote");
    setLocalizedText("designer-title", "app.designerTitle");
    setLocalizedText("designer-lead", "app.designerLead");
    setLocalizedText("designer-label-name", "app.designerName");
    setLocalizedText("designer-label-mass", "app.designerMass");
    setLocalizedText("designer-label-slots", "app.designerSlots");
    setLocalizedText("designer-label-core", "app.designerCore");
    setLocalizedText("designer-label-motor", "app.designerMotor");
    setLocalizedText("designer-label-gadget", "app.designerGadget");
    setLocalizedText("designer-label-sensor", "app.designerSensor");
    setLocalizedText("designer-label-cooperation", "app.designerCooperation");
    setLocalizedText("designer-label-life", "app.designerLife");
    setLocalizedText("designer-label-birth", "app.designerBirth");
    setLocalizedText("designer-label-bud", "app.designerBud");
    setLocalizedText("designer-label-chase", "app.designerChase");
    setLocalizedText("designer-label-avoid", "app.designerAvoid");
    setLocalizedText("designer-label-lobes", "app.designerLobes");
    setLocalizedText("designer-label-blob", "app.designerBlob");
    setLocalizedText("designer-label-wobble", "app.designerWobble");
    setLocalizedText("designer-label-stretch", "app.designerStretch");
    setLocalizedText("legend-title", "app.legendTitle");
    setLocalizedText("focus-title", "app.focusTitle");
    setLocalizedText("focus-status-label", "app.focusStatus");
    setLocalizedText("focus-status-empty", "app.hoverCell");
    setLocalizedText("keys-title", "app.keysTitle");
    setLocalizedText("shortcut-menu", "app.shortcut.menu");
    setLocalizedText("shortcut-run", "app.shortcut.run");
    setLocalizedText("shortcut-reset", "app.shortcut.reset");
    setLocalizedText("shortcut-fullscreen", "app.shortcut.fullscreen");
    setLocalizedText("shortcut-speed", "app.shortcut.speed");
    setLocalizedText("shortcut-feed", "app.shortcut.feed");
    setLocalizedText("shortcut-lightning", "app.shortcut.lightning");
    setLocalizedText("shortcut-spring", "app.shortcut.spring");
    setLocalizedText("shortcut-mountain", "app.shortcut.mountain");
    setLocalizedText("shortcut-design", "app.shortcut.design");
    setLocalizedText("shortcut-developer", "app.shortcut.developer");

    syncPhylogenyToggle();
    if (designerRandomizeButton) {
      designerRandomizeButton.textContent = t(locale, "app.designerRandomize");
    }
    syncDesignerSlotOptionLabels();
    syncDesignerDeployToggle();
    syncPauseLabel();
    syncFullscreenLabel();
    syncExportControls();
    syncAudioToggles();
    syncFastModeToggle();
    syncAudioVolume();
    syncAudioMixControls();
    renderLegend();
    updateStats(true);
    showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
    renderDesignerPreview();
    draw(true);
  }

  function resizeCanvas() {
    const targetAspect = Math.max(0.25, config.world.width / config.world.height);
    canvasFrame.style.width = "";
    canvasFrame.style.height = "";
    canvasFrame.style.aspectRatio = `${config.world.width} / ${config.world.height}`;
    stagePanel?.style.removeProperty("width");
    stagePanel?.style.removeProperty("max-width");
    appLayout?.style.removeProperty("grid-template-columns");

    const layoutRect = appLayout?.getBoundingClientRect();
    const panelRect = stagePanel?.getBoundingClientRect();
    const shellStyles = stageShell ? window.getComputedStyle(stageShell) : null;
    const panelStyles = stagePanel ? window.getComputedStyle(stagePanel) : null;
    const layoutStyles = appLayout ? window.getComputedStyle(appLayout) : null;
    const panelPaddingX =
      (Number.parseFloat(panelStyles?.paddingLeft ?? "0") || 0) +
      (Number.parseFloat(panelStyles?.paddingRight ?? "0") || 0);
    const panelPaddingY =
      (Number.parseFloat(panelStyles?.paddingTop ?? "0") || 0) +
      (Number.parseFloat(panelStyles?.paddingBottom ?? "0") || 0);
    const toolbarHeight = stageToolbar?.getBoundingClientRect().height ?? 0;
    const baseChromeHeight = toolbarHeight;
    const layoutGap =
      Number.parseFloat(layoutStyles?.columnGap || layoutStyles?.gap || "0") || 0;
    const isStackedLayout = window.innerWidth <= 1220;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const panelBottomSafety = document.fullscreenElement ? 30 : 12;
    const availablePanelHeight = Math.max(
      300,
      viewportHeight - (layoutRect?.top ?? panelRect?.top ?? 0) - panelBottomSafety
    );
    const sidebarWidth = isStackedLayout
      ? 0
      : Math.max(280, lineageSidebar?.getBoundingClientRect().width ?? 320);
    const availableStageWidth = Math.max(
      280,
      (layoutRect?.width ?? panelRect?.width ?? window.innerWidth) -
        sidebarWidth -
        (isStackedLayout ? 0 : layoutGap)
    );
    const frameWidthSafety = document.fullscreenElement ? 18 : 0;
    const maxFrameWidth = Math.max(240, availableStageWidth - panelPaddingX - frameWidthSafety);

    function fitFrame(maxHeight, widthLimit = maxFrameWidth) {
      let nextWidth = Math.floor(Math.min(widthLimit, maxHeight * targetAspect));
      let nextHeight = Math.floor(nextWidth / targetAspect);
      if (nextHeight > maxHeight) {
        nextHeight = Math.floor(maxHeight);
        nextWidth = Math.floor(nextHeight * targetAspect);
      }
      return {
        width: Math.max(240, nextWidth),
        height: Math.max(220, nextHeight)
      };
    }

    let frameWidth = 240;
    let frameHeight = 220;
    let fittedStageWidth = Math.min(availableStageWidth, frameWidth + panelPaddingX);
    let currentToolbarHeight = baseChromeHeight;

    for (let pass = 0; pass < 3; pass += 1) {
      const maxFrameHeight = Math.max(
        220,
        availablePanelHeight - panelPaddingY - currentToolbarHeight
      );
      ({ width: frameWidth, height: frameHeight } = fitFrame(maxFrameHeight, maxFrameWidth));
      fittedStageWidth = Math.min(availableStageWidth, frameWidth + panelPaddingX);

      if (stagePanel && appLayout && !isStackedLayout) {
        stagePanel.style.width = `${Math.round(fittedStageWidth)}px`;
        stagePanel.style.maxWidth = `${Math.round(fittedStageWidth)}px`;
        appLayout.style.gridTemplateColumns = `${Math.round(
          fittedStageWidth
        )}px minmax(280px, 360px)`;
      }

      canvasFrame.style.width = `${frameWidth}px`;
      canvasFrame.style.height = `${frameHeight}px`;

      const nextToolbarHeight = stageToolbar?.getBoundingClientRect().height ?? currentToolbarHeight;
      if (Math.abs(nextToolbarHeight - currentToolbarHeight) < 1) {
        currentToolbarHeight = nextToolbarHeight;
        break;
      }
      currentToolbarHeight = nextToolbarHeight;
    }

    if (!isStackedLayout && stagePanel && appLayout) {
      stagePanel.style.width = `${Math.round(fittedStageWidth)}px`;
      stagePanel.style.maxWidth = `${Math.round(fittedStageWidth)}px`;
      appLayout.style.gridTemplateColumns = `${Math.round(
        fittedStageWidth
      )}px minmax(280px, 360px)`;
    }

    const rect = canvasFrame.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, LOW_FIDELITY_RENDER ? 1 : 2);
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
  }

  function drawWrapped(drawFn, x, y, padding = 0) {
    const { width, height } = config.world;
    const xPositions = [x];
    const yPositions = [y];

    if (padding > 0) {
      if (x < padding) {
        xPositions.push(x + width);
      }
      if (x > width - padding) {
        xPositions.push(x - width);
      }
      if (y < padding) {
        yPositions.push(y + height);
      }
      if (y > height - padding) {
        yPositions.push(y - height);
      }
    }

    for (const wrappedY of yPositions) {
      for (const wrappedX of xPositions) {
        drawFn(wrappedX, wrappedY);
      }
    }
  }

  function torusOffset(fromPoint, toPoint) {
    return {
      dx: torusDelta(fromPoint.x, toPoint.x, config.world.width),
      dy: torusDelta(fromPoint.y, toPoint.y, config.world.height)
    };
  }

  function drawBackground(worldWidth, worldHeight) {
    context.fillStyle = "#091c25";
    context.fillRect(0, 0, worldWidth, worldHeight);

    drawTerrainOverlay(worldWidth, worldHeight);

    if (LOW_FIDELITY_RENDER) {
      context.save();
      context.strokeStyle = "rgba(255, 226, 160, 0.22)";
      context.lineWidth = 4;
      context.strokeRect(2, 2, worldWidth - 4, worldHeight - 4);
      context.restore();
      return;
    }

    context.save();
    context.strokeStyle = "rgba(124, 186, 177, 0.06)";
    context.lineWidth = 1;
    for (let x = 0; x <= worldWidth; x += 140) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, worldHeight);
      context.stroke();
    }
    for (let y = 0; y <= worldHeight; y += 140) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(worldWidth, y);
      context.stroke();
    }
    context.strokeStyle = "rgba(255, 226, 160, 0.25)";
    context.lineWidth = 5;
    context.strokeRect(2.5, 2.5, worldWidth - 5, worldHeight - 5);
    context.restore();
  }

  function ensureTerrainTexture() {
    const terrain = simulation.terrain;
    if (!terrain?.enabled || !terrain.samples?.length) {
      terrainTextureCache = { version: terrain?.version ?? -1, canvas: null };
      return null;
    }
    if (
      terrainTextureCache.canvas &&
      terrainTextureCache.version === terrain.version
    ) {
      return terrainTextureCache.canvas;
    }

    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = terrain.columns;
    textureCanvas.height = terrain.rows;
    const textureContext = textureCanvas.getContext("2d");
    const imageData = textureContext.createImageData(terrain.columns, terrain.rows);
    for (let index = 0; index < terrain.samples.length; index += 1) {
      const column = index % terrain.columns;
      const row = Math.floor(index / terrain.columns);
      const sampleX = ((column + 0.5) / terrain.columns) * config.world.width;
      const sampleY = ((row + 0.5) / terrain.rows) * config.world.height;
      const profile = terrainMovementProfile(simulation, sampleX, sampleY);
      const tone = terrainTone(profile, column, row);
      const pixel = index * 4;
      imageData.data[pixel] = tone.r;
      imageData.data[pixel + 1] = tone.g;
      imageData.data[pixel + 2] = tone.b;
      imageData.data[pixel + 3] = LOW_FIDELITY_RENDER ? Math.max(128, tone.a) : tone.a;
    }

    textureContext.putImageData(imageData, 0, 0);
    terrainTextureCache = { version: terrain.version, canvas: textureCanvas };
    return textureCanvas;
  }

  function drawTerrainOverlay(worldWidth, worldHeight) {
    const texture = ensureTerrainTexture();
    if (!texture) {
      return;
    }

    context.save();
    context.globalAlpha = LOW_FIDELITY_RENDER ? 0.96 : 0.99;
    context.imageSmoothingEnabled = true;
    context.drawImage(texture, 0, 0, texture.width, texture.height, 0, 0, worldWidth, worldHeight);
    context.restore();
  }

  function drawResources() {
    const resourceAlpha = selectedLineageId === null ? 1 : 0.2;
    for (const resource of simulation.resources) {
      const radius = Math.max(2, Math.sqrt(resource.mass) * config.render.resourceScale);
      drawWrapped(
        (wrappedX, wrappedY) => {
          context.save();
          context.globalAlpha = resourceAlpha;
          if (LOW_FIDELITY_RENDER) {
            context.fillStyle = "rgba(255, 225, 155, 0.9)";
            context.beginPath();
            context.arc(wrappedX, wrappedY, radius, 0, Math.PI * 2);
            context.fill();
            context.restore();
            return;
          }

          const gradient = context.createRadialGradient(
            wrappedX,
            wrappedY,
            0,
            wrappedX,
            wrappedY,
            radius * 2.4
          );
          gradient.addColorStop(0, "rgba(255, 209, 102, 0.9)");
          gradient.addColorStop(1, "rgba(255, 209, 102, 0)");
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(wrappedX, wrappedY, radius * 2.4, 0, Math.PI * 2);
          context.fill();

          context.fillStyle = "rgba(255, 231, 182, 0.92)";
          context.beginPath();
          context.arc(wrappedX, wrappedY, radius, 0, Math.PI * 2);
          context.fill();
          context.restore();
        },
        resource.x,
        resource.y,
        LOW_FIDELITY_RENDER ? radius : radius * 2.4
      );
    }
  }

  function drawSprings() {
    if (!simulation.springs?.length) {
      return;
    }

    const springAlpha = selectedLineageId === null ? 1 : 0.24;
    if (fastMode) {
      for (const spring of simulation.springs) {
        const locallyPaused = Boolean(spring.paused);
        const fieldRadius = Math.max(spring.scatter, spring.radius * 2.8);
        drawWrapped((wrappedX, wrappedY) => {
          context.save();
          context.translate(wrappedX, wrappedY);
          context.globalAlpha = springAlpha;
          context.fillStyle = locallyPaused
            ? "rgba(111, 235, 212, 0.11)"
            : "rgba(111, 235, 212, 0.12)";
          context.beginPath();
          context.arc(0, 0, fieldRadius, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = locallyPaused
            ? "rgba(111, 235, 212, 0.72)"
            : "rgba(111, 235, 212, 0.86)";
          context.lineWidth = 2.2;
          context.beginPath();
          context.arc(0, 0, spring.radius * 1.08, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = locallyPaused
            ? "rgba(213, 255, 246, 0.82)"
            : "rgba(225, 255, 247, 0.92)";
          context.beginPath();
          context.arc(0, 0, spring.radius * 0.34, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }, spring.x, spring.y, fieldRadius + 4);
      }
      return;
    }

    for (const spring of simulation.springs) {
      const locallyPaused = Boolean(spring.paused);
      const active = !locallyPaused;
      const pulse = 0.5 + 0.5 * Math.sin(simulation.time * 4.6 + spring.phase);
      const glowPulse = active ? pulse : 0.48;
      const outerRadius = spring.radius * (1.05 + pulse * 0.08);
      const innerRadius = spring.radius * 0.42;
      const fieldRadius = Math.max(spring.scatter, spring.radius * 2.8);

      drawWrapped((wrappedX, wrappedY) => {
        context.save();
        context.translate(wrappedX, wrappedY);
        context.globalAlpha = springAlpha;

        const backdropRadius = fieldRadius * (LOW_FIDELITY_RENDER ? 1.45 : 1.7);
        const backdrop = context.createRadialGradient(
          0,
          0,
          spring.radius * 0.35,
          0,
          0,
          backdropRadius
        );
        if (locallyPaused) {
          backdrop.addColorStop(0, `rgba(188, 255, 240, ${0.11 + glowPulse * 0.03})`);
          backdrop.addColorStop(0.5, "rgba(111, 235, 212, 0.07)");
          backdrop.addColorStop(1, "rgba(111, 235, 212, 0)");
        } else {
          backdrop.addColorStop(0, `rgba(188, 255, 240, ${0.12 + pulse * 0.08})`);
          backdrop.addColorStop(0.5, "rgba(111, 235, 212, 0.08)");
          backdrop.addColorStop(1, "rgba(111, 235, 212, 0)");
        }
        context.fillStyle = backdrop;
        context.beginPath();
        context.arc(0, 0, backdropRadius, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = locallyPaused
          ? "rgba(111, 235, 212, 0.18)"
          : "rgba(111, 235, 212, 0.22)";
        context.lineWidth = 1;
        context.setLineDash([6, 8]);
        context.beginPath();
        context.arc(0, 0, fieldRadius, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);

        if (!LOW_FIDELITY_RENDER) {
          context.fillStyle = active
            ? `rgba(111, 235, 212, ${0.08 + pulse * 0.12})`
            : locallyPaused
              ? `rgba(111, 235, 212, ${0.08 + glowPulse * 0.04})`
              : "rgba(111, 235, 212, 0.05)";
          context.beginPath();
          context.arc(0, 0, outerRadius * 1.8, 0, Math.PI * 2);
          context.fill();
        }

        const swirlTime = simulation.time * 0.62 + spring.phase;
        const swirlRadius = Math.max(spring.radius * 1.8, fieldRadius * 0.54);
        const armCount = LOW_FIDELITY_RENDER ? 2 : 3;
        const swirlTurns = LOW_FIDELITY_RENDER ? 1.35 : 1.8;
        const swirlSteps = LOW_FIDELITY_RENDER ? 8 : 14;
        for (let arm = 0; arm < armCount; arm += 1) {
          const armBaseAngle = swirlTime * 0.58 + (Math.PI * 2 * arm) / armCount;
          context.save();
          context.globalCompositeOperation = "screen";
          for (let step = 0; step <= swirlSteps; step += 1) {
            const t = step / swirlSteps;
            const eased = t * t * (3 - 2 * t);
            const armAngle =
              armBaseAngle + eased * Math.PI * swirlTurns + Math.sin(swirlTime + t * 4) * 0.08;
            const armRadius =
              lerp(innerRadius * 0.58, swirlRadius, eased) +
              Math.sin(swirlTime * 0.8 + arm * 1.6 + t * 6) * spring.radius * 0.06;
            const px = Math.cos(armAngle) * armRadius;
            const py = Math.sin(armAngle) * armRadius;
            const hazeRadius =
              lerp(spring.radius * 0.34, spring.radius * 0.16, eased) *
              (1 + Math.sin(swirlTime + arm + t * 5) * 0.12);
            const tealGlow = context.createRadialGradient(
              px,
              py,
              0,
              px,
              py,
              hazeRadius * 2.8
            );
            if (active) {
              tealGlow.addColorStop(0, `rgba(204, 255, 247, ${0.13 + (1 - eased) * 0.1})`);
              tealGlow.addColorStop(0.45, `rgba(126, 241, 225, ${0.1 + (1 - eased) * 0.08})`);
              tealGlow.addColorStop(1, "rgba(111, 235, 212, 0)");
            } else if (locallyPaused) {
              tealGlow.addColorStop(0, `rgba(204, 255, 247, ${0.09 + (1 - eased) * 0.05})`);
              tealGlow.addColorStop(0.52, `rgba(126, 241, 225, ${0.07 + (1 - eased) * 0.03})`);
              tealGlow.addColorStop(1, "rgba(111, 235, 212, 0)");
            } else {
              tealGlow.addColorStop(0, "rgba(204, 255, 247, 0.08)");
              tealGlow.addColorStop(0.52, "rgba(126, 241, 225, 0.05)");
              tealGlow.addColorStop(1, "rgba(111, 235, 212, 0)");
            }
            context.fillStyle = tealGlow;
            context.beginPath();
            context.arc(px, py, hazeRadius * 2.8, 0, Math.PI * 2);
            context.fill();

            if (!LOW_FIDELITY_RENDER || step % 2 === 0) {
              const emberGlow = context.createRadialGradient(
                px,
                py,
                0,
                px,
                py,
                hazeRadius * 1.35
              );
              if (active) {
                emberGlow.addColorStop(0, `rgba(255, 235, 182, ${0.08 + (1 - eased) * 0.06})`);
                emberGlow.addColorStop(1, "rgba(255, 227, 160, 0)");
              } else if (locallyPaused) {
                emberGlow.addColorStop(0, `rgba(255, 235, 182, ${0.05 + (1 - eased) * 0.03})`);
                emberGlow.addColorStop(1, "rgba(255, 227, 160, 0)");
              } else {
                emberGlow.addColorStop(0, "rgba(255, 235, 182, 0.04)");
                emberGlow.addColorStop(1, "rgba(255, 227, 160, 0)");
              }
              context.fillStyle = emberGlow;
              context.beginPath();
              context.arc(px, py, hazeRadius * 1.35, 0, Math.PI * 2);
              context.fill();
            }
          }
          context.restore();
        }

        context.strokeStyle = active
          ? "rgba(111, 235, 212, 0.92)"
          : locallyPaused
            ? "rgba(111, 235, 212, 0.82)"
            : "rgba(111, 235, 212, 0.42)";
        context.lineWidth = LOW_FIDELITY_RENDER ? 2.2 : 2.8;
        context.beginPath();
        context.arc(0, 0, outerRadius, 0, Math.PI * 2);
        context.stroke();

        context.beginPath();
        context.arc(0, 0, spring.radius * 0.72, Math.PI * 0.12, Math.PI * 0.88);
        context.stroke();

        context.fillStyle = active
          ? "rgba(192, 255, 245, 0.92)"
          : locallyPaused
            ? "rgba(192, 255, 245, 0.82)"
            : "rgba(192, 255, 245, 0.48)";
        context.beginPath();
        context.arc(0, 0, innerRadius, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = active
          ? "rgba(255, 241, 184, 0.8)"
          : locallyPaused
            ? "rgba(255, 241, 184, 0.54)"
            : "rgba(255, 241, 184, 0.34)";
        context.lineWidth = 1.5;
        for (const angle of [-1.1, -0.5, 0.2]) {
          const jetLength = spring.radius * (0.45 + pulse * 0.15);
          context.beginPath();
          context.moveTo(
            Math.cos(angle) * spring.radius * 0.18,
            -spring.radius * 0.15 + Math.sin(angle) * spring.radius * 0.08
          );
          context.lineTo(
            Math.cos(angle) * jetLength,
            -spring.radius * 0.72 + Math.sin(angle) * spring.radius * 0.16
          );
          context.stroke();
        }

        context.fillStyle = active
          ? "rgba(255, 230, 158, 0.9)"
          : locallyPaused
            ? "rgba(255, 230, 158, 0.56)"
            : "rgba(255, 230, 158, 0.36)";
        for (const droplet of [-0.6, 0.1]) {
          context.beginPath();
          context.arc(
            Math.cos(droplet) * spring.radius * 0.32,
            -spring.radius * (0.82 + pulse * 0.1),
            Math.max(1.6, spring.radius * 0.12),
            0,
            Math.PI * 2
          );
          context.fill();
        }

        context.restore();
      }, spring.x, spring.y, Math.max(outerRadius * 1.8, fieldRadius + 4));
    }
  }

  function traceBlobShape(radius, shape, heading) {
    const steps = LOW_FIDELITY_RENDER ? 24 : 56;
    context.beginPath();

    for (let index = 0; index <= steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      const point = blobShapePoint(radius, shape, angle, heading);
      const x = point.x;
      const y = point.y;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.closePath();
  }

  function traceSector(innerRadius, outerRadius, angle, span) {
    context.beginPath();
    context.arc(0, 0, outerRadius, angle - span, angle + span);
    context.arc(0, 0, innerRadius, angle + span, angle - span, true);
    context.closePath();
  }

  function radarAxisPoint(center, radius, index, count) {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      angle
    };
  }

  function radarPolygonPoints(profile, radius, center) {
    return profile
      .map((axis, index) => {
        const point = radarAxisPoint(center, radius * axis.value, index, profile.length);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      })
      .join(" ");
  }

  function radarRingPoints(axisCount, radius, center, scaleFactor) {
    return Array.from({ length: axisCount }, (_, index) => {
      const point = radarAxisPoint(center, radius * scaleFactor, index, axisCount);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" ");
  }

  function buildCapabilityChartMarkup(profile, palette, options = {}) {
    const variant = options.variant ?? (options.showLabels ? "detail" : "compact");
    const size = options.size ?? (variant === "detail" ? 240 : 104);
    const padding = options.padding ?? (variant === "detail" ? 26 : 12);
    const viewportSize = size + padding * 2;
    const center = viewportSize / 2;
    const radius = size * (variant === "detail" ? 0.305 : 0.325);
    const rings = variant === "detail" ? [0.25, 0.5, 0.75, 1] : [0.34, 0.67, 1];
    const showLabels = variant === "detail";
    const labelRadius = radius + 24;
    const axisColor = showLabels ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.1)";
    const fillId =
      `${options.idPrefix ?? `cap-${Math.random().toString(36).slice(2, 8)}`}-fill`;
    const polygonPoints = radarPolygonPoints(profile, radius, center);

    const ringMarkup = rings
      .map(
        (ring) =>
          `<polygon points="${radarRingPoints(profile.length, radius, center, ring)}" fill="none" stroke="rgba(255,255,255,${ring === 1 ? 0.12 : 0.08})" stroke-width="${showLabels ? (ring === 1 ? 1.15 : 0.9) : 0.9}" />`
      )
      .join("");

    const axisMarkup = profile
      .map((axis, index) => {
        const edge = radarAxisPoint(center, radius, index, profile.length);
        const endCapRadius = showLabels ? 2 : 1.8;
        const labelPoint = radarAxisPoint(center, labelRadius, index, profile.length);
        const anchor =
          Math.cos(labelPoint.angle) > 0.28
            ? "start"
            : Math.cos(labelPoint.angle) < -0.28
              ? "end"
              : "middle";
        const baseline =
          Math.sin(labelPoint.angle) > 0.48
            ? "hanging"
            : Math.sin(labelPoint.angle) < -0.48
              ? "baseline"
              : "middle";
        const labelMarkup = showLabels
          ? `<text x="${labelPoint.x.toFixed(1)}" y="${labelPoint.y.toFixed(1)}" fill="rgba(231,243,239,0.88)" font-size="11" font-weight="700" text-anchor="${anchor}" dominant-baseline="${baseline}">${axis.label}</text>`
          : "";
        return `
          <line x1="${center}" y1="${center}" x2="${edge.x.toFixed(1)}" y2="${edge.y.toFixed(1)}" stroke="${axisColor}" stroke-width="${showLabels ? 1 : 0.9}" />
          <circle cx="${edge.x.toFixed(1)}" cy="${edge.y.toFixed(1)}" r="${endCapRadius}" fill="rgba(255,255,255,0.16)" />
          ${labelMarkup}
        `;
      })
      .join("");

    const stopShadow = palette.shadow.replace("1)", "0.9)");
    const stopPrimary = palette.primary.replace("1)", "0.92)");
    const stopSecondary = palette.secondary.replace("1)", "0.86)");
    const stopAccent = palette.accent.replace("1)", "0.98)");
    const vertexMarkup = profile
      .map((axis, index) => {
        const point = radarAxisPoint(center, radius * axis.value, index, profile.length);
        return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${showLabels ? 3 : 2.1}" fill="${palette.secondary}" stroke="${palette.shadow}" stroke-width="1" />`;
      })
      .join("");

    const centerDiscRadius = showLabels ? 5.4 : 4.2;
    return `
      <svg class="capability-chart capability-chart-${variant}" viewBox="0 0 ${viewportSize} ${viewportSize}" role="img" aria-label="${t(locale, "common.capabilityChart")}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="${fillId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${stopShadow}" />
            <stop offset="42%" stop-color="${stopPrimary}" />
            <stop offset="76%" stop-color="${stopSecondary}" />
            <stop offset="100%" stop-color="${stopAccent}" />
          </linearGradient>
        </defs>
        ${ringMarkup}
        ${axisMarkup}
        <polygon points="${polygonPoints}" fill="url(#${fillId})" fill-opacity="${showLabels ? 0.78 : 0.68}" stroke="${palette.accent}" stroke-width="${showLabels ? 2 : 1.55}" />
        ${vertexMarkup}
        <circle cx="${center}" cy="${center}" r="${centerDiscRadius}" fill="${palette.shadow}" fill-opacity="${showLabels ? 0.75 : 0.66}" stroke="${palette.accent}" stroke-opacity="0.45" stroke-width="${showLabels ? 1.2 : 1}" />
      </svg>
    `;
  }

  function drawBursts() {
    if (fastMode) {
      return;
    }
    const burstAlpha = selectedLineageId === null ? 0.56 : 0.18;
    for (const burst of simulation.bursts) {
      const phase = burst.age / burst.duration;
      const radius = burst.radius * (0.94 + phase * 1.18);
      const alpha = (1 - phase) * 0.72;
      const burstShape =
        burst.visualShape ?? visualShapeFromFeatures(burst.visualFeatures);
      const palette = lineagePalette(
        {
          visualFeatures: burst.visualFeatures,
          genomeDiversity: 0
        },
        1
      );

      drawWrapped(
        (wrappedX, wrappedY) => {
          context.save();
          context.translate(wrappedX, wrappedY);

          if (LOW_FIDELITY_RENDER) {
            context.strokeStyle = palette.secondary;
            context.globalAlpha = burstAlpha * alpha * 0.46;
            context.lineWidth = 1.1;
            context.beginPath();
            context.arc(0, 0, radius, 0, Math.PI * 2);
            context.stroke();
            context.restore();
            return;
          }

          context.strokeStyle = palette.secondary;
          context.globalAlpha = burstAlpha * alpha * 0.62;
          context.lineWidth = 1 + (1 - phase) * 1.9;
          traceBlobShape(radius, burstShape, phase * Math.PI * 0.6);
          context.stroke();

          context.fillStyle = palette.secondary;
          context.globalAlpha = burstAlpha * alpha * 0.08;
          traceBlobShape(radius * 0.76, burstShape, -phase * Math.PI * 0.9);
          context.fill();

          context.restore();
        },
        burst.x,
        burst.y,
        radius * 1.15
      );
    }
  }

  function drawWrappedLinearEffect(x1, y1, x2, y2, renderer) {
    const dx = torusDelta(x1, x2, config.world.width);
    const dy = torusDelta(y1, y2, config.world.height);

    for (const offsetX of [-config.world.width, 0, config.world.width]) {
      for (const offsetY of [-config.world.height, 0, config.world.height]) {
        const startX = x1 + offsetX;
        const startY = y1 + offsetY;
        renderer(startX, startY, startX + dx, startY + dy);
      }
    }
  }

  function worldUnitsForPixels(pixels) {
    return pixels / Math.max(viewport.scale, 0.0001);
  }

  function ensureVisibleProjectileSegment(startX, startY, endX, endY, angle, minPixels) {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);
    const minimumLength = worldUnitsForPixels(minPixels);
    if (distance >= minimumLength) {
      return { startX, startY, endX, endY };
    }
    const ux = distance > 0.0001 ? dx / distance : Math.cos(angle);
    const uy = distance > 0.0001 ? dy / distance : Math.sin(angle);
    return {
      startX: endX - ux * minimumLength,
      startY: endY - uy * minimumLength,
      endX,
      endY
    };
  }

  function drawCombatEffects() {
    if (fastMode) {
      return;
    }
    const effectAlpha = selectedLineageId === null ? 1 : 0.24;
    context.save();
    context.globalCompositeOperation = LOW_FIDELITY_RENDER ? "source-over" : "lighter";

    for (const effect of simulation.combatEffects) {
      const phase = effect.age / effect.duration;
      const fade = 1 - phase;

      if (effect.kind === "melee") {
        if (LOW_FIDELITY_RENDER) {
          drawWrappedLinearEffect(effect.x1, effect.y1, effect.x2, effect.y2, (x1, y1, x2, y2) => {
            const head = Math.min(1, phase * 1.25);
            const tail = Math.max(0, head - 0.2);
            const startX = lerp(x1, x2, tail);
            const startY = lerp(y1, y2, tail);
            const endX = lerp(x1, x2, head);
            const endY = lerp(y1, y2, head);
            context.strokeStyle = effect.color;
            context.globalAlpha = effectAlpha * (0.24 + fade * 0.54);
            context.lineWidth = effect.width * 1.2;
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.stroke();
          });
          continue;
        }

        drawWrappedLinearEffect(effect.x1, effect.y1, effect.x2, effect.y2, (x1, y1, x2, y2) => {
          const head = Math.min(1, phase * 1.28);
          const tail = Math.max(0, head - 0.24 - effect.magnitude * 0.1);
          const startX = lerp(x1, x2, tail);
          const startY = lerp(y1, y2, tail);
          const endX = lerp(x1, x2, head);
          const endY = lerp(y1, y2, head);
          const headSize = effect.width * (2.4 + effect.magnitude * 1.2);

          context.save();
          context.shadowColor = effect.color;
          context.shadowBlur = 12 + effect.magnitude * 18 * fade;
          context.strokeStyle = effect.color;
          context.lineWidth = effect.width * (1.15 + fade * 1.2);
          context.lineCap = "round";
          context.globalAlpha = effectAlpha * (0.2 + fade * 0.55);
          context.beginPath();
          context.moveTo(startX, startY);
          context.lineTo(endX, endY);
          context.stroke();

          context.globalAlpha = effectAlpha * (0.24 + fade * 0.62);
          context.fillStyle = effect.color;
          context.beginPath();
          context.moveTo(endX, endY);
          context.lineTo(
            endX - Math.cos(effect.angle - 0.42) * headSize,
            endY - Math.sin(effect.angle - 0.42) * headSize
          );
          context.lineTo(
            endX - Math.cos(effect.angle + 0.42) * headSize,
            endY - Math.sin(effect.angle + 0.42) * headSize
          );
          context.closePath();
          context.fill();
          context.globalAlpha = effectAlpha * (0.14 + fade * 0.4);
          for (let spark = -1; spark <= 1; spark += 1) {
            const sparkAngle = effect.angle + spark * 0.45 + phase * 0.2;
            context.beginPath();
            context.moveTo(endX, endY);
            context.lineTo(
              endX + Math.cos(sparkAngle) * headSize * 0.9,
              endY + Math.sin(sparkAngle) * headSize * 0.9
            );
            context.stroke();
          }
          context.restore();
        });
        continue;
      }

      if (effect.kind === "projectile") {
        if (LOW_FIDELITY_RENDER) {
          drawWrappedLinearEffect(effect.x1, effect.y1, effect.x2, effect.y2, (x1, y1, x2, y2) => {
            const head = Math.min(1, phase * 1.18);
            const tail = Math.max(0, head - 0.18);
            let startX = lerp(x1, x2, tail);
            let startY = lerp(y1, y2, tail);
            const endX = lerp(x1, x2, head);
            const endY = lerp(y1, y2, head);
            ({ startX, startY } = ensureVisibleProjectileSegment(
              startX,
              startY,
              endX,
              endY,
              effect.angle,
              12
            ));
            const visibleWidth = Math.max(effect.width, worldUnitsForPixels(2.2));
            const visibleOrbRadius = Math.max(effect.width * 1.5, worldUnitsForPixels(4));
            context.strokeStyle = effect.color;
            context.globalAlpha = effectAlpha * (0.2 + fade * 0.46);
            context.lineWidth = visibleWidth;
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.stroke();
            context.fillStyle = effect.color;
            context.globalAlpha = effectAlpha * (0.28 + fade * 0.52);
            context.beginPath();
            context.arc(endX, endY, visibleOrbRadius, 0, Math.PI * 2);
            context.fill();
          });
          continue;
        }

        drawWrappedLinearEffect(effect.x1, effect.y1, effect.x2, effect.y2, (x1, y1, x2, y2) => {
          const head = Math.min(1, phase * 1.18);
          const tail = Math.max(0, head - (0.2 + effect.magnitude * 0.08));
          let startX = lerp(x1, x2, tail);
          let startY = lerp(y1, y2, tail);
          const endX = lerp(x1, x2, head);
          const endY = lerp(y1, y2, head);
          ({ startX, startY } = ensureVisibleProjectileSegment(
            startX,
            startY,
            endX,
            endY,
            effect.angle,
            15
          ));
          const visibleWidth = Math.max(
            effect.width * (0.9 + fade * 1.4),
            worldUnitsForPixels(2.6)
          );
          const orbRadius = Math.max(
            effect.width * (1.8 + effect.magnitude * 0.85),
            worldUnitsForPixels(5.4)
          );
          const muzzleRadius = Math.max(
            orbRadius * (1.1 + phase * 1.6),
            worldUnitsForPixels(4.8)
          );

          context.save();
          context.shadowColor = effect.color;
          context.shadowBlur = 14 + effect.magnitude * 16 * fade;
          context.strokeStyle = effect.color;
          context.lineWidth = visibleWidth;
          context.lineCap = "round";
          context.globalAlpha = effectAlpha * (0.18 + fade * 0.58);
          context.beginPath();
          context.moveTo(startX, startY);
          context.lineTo(endX, endY);
          context.stroke();

          context.globalAlpha = effectAlpha * (0.26 + fade * 0.72);
          context.fillStyle = effect.color;
          context.beginPath();
          context.arc(endX, endY, orbRadius, 0, Math.PI * 2);
          context.fill();

          if (phase < 0.35) {
            context.globalAlpha = effectAlpha * (0.16 + fade * 0.34);
            context.beginPath();
            context.arc(x1, y1, muzzleRadius, 0, Math.PI * 2);
            context.fill();
          }

          if (head > 0.9) {
            context.globalAlpha = effectAlpha * (effect.blocked ? 0.2 + fade * 0.38 : 0.14 + fade * 0.26);
            context.beginPath();
            context.arc(
              x2,
              y2,
              orbRadius * (0.9 + (head - 0.9) * 8),
              0,
              Math.PI * 2
            );
            context.stroke();
          }
          context.restore();
        });
        continue;
      }

      if (effect.kind === "defense") {
        const localImpactX = torusDelta(effect.x, effect.impactX, config.world.width);
        const localImpactY = torusDelta(effect.y, effect.impactY, config.world.height);
        if (LOW_FIDELITY_RENDER) {
          drawWrapped((wrappedX, wrappedY) => {
            context.save();
            context.translate(wrappedX, wrappedY);
            context.strokeStyle = effect.color;
            context.globalAlpha = effectAlpha * (0.24 + fade * 0.48);
            context.lineWidth = effect.width;
            context.beginPath();
            context.arc(0, 0, effect.radius, effect.angle - effect.span, effect.angle + effect.span);
            context.stroke();
            context.restore();
          }, effect.x, effect.y, effect.radius + effect.width * 4);
          continue;
        }

        const arcRadius = effect.radius * (0.94 + Math.sin(phase * Math.PI) * 0.22);
        const innerRadius = arcRadius * 0.68;
        drawWrapped((wrappedX, wrappedY) => {
          context.save();
          context.translate(wrappedX, wrappedY);
          context.shadowColor = effect.color;
          context.shadowBlur = 14 + effect.magnitude * 16 * fade;

          context.fillStyle = effect.color;
          context.globalAlpha = effectAlpha * (0.08 + fade * 0.2);
          traceSector(innerRadius, arcRadius, effect.angle, effect.span);
          context.fill();

          context.strokeStyle = effect.color;
          context.lineWidth = effect.width * (1.1 + fade * 1.4);
          context.globalAlpha = effectAlpha * (0.24 + fade * 0.58);
          context.beginPath();
          context.arc(0, 0, arcRadius, effect.angle - effect.span, effect.angle + effect.span);
          context.stroke();

          context.globalAlpha = effectAlpha * (0.14 + fade * 0.24);
          for (let rib = 0; rib < 3; rib += 1) {
            const ribAngle =
              effect.angle - effect.span + (rib / 2) * effect.span;
            context.beginPath();
            context.moveTo(
              Math.cos(ribAngle) * innerRadius,
              Math.sin(ribAngle) * innerRadius
            );
            context.lineTo(
              Math.cos(ribAngle) * arcRadius,
              Math.sin(ribAngle) * arcRadius
            );
            context.stroke();
          }

          context.globalAlpha = effectAlpha * (0.18 + fade * 0.44);
          context.beginPath();
          context.arc(
            localImpactX,
            localImpactY,
            effect.width * (1.8 + effect.magnitude * 0.55),
            0,
            Math.PI * 2
          );
          context.fill();
          context.restore();
        }, effect.x, effect.y, arcRadius + effect.width * 4);
        continue;
      }

      if (effect.kind === "siphon") {
        if (LOW_FIDELITY_RENDER) {
          drawWrappedLinearEffect(effect.x1, effect.y1, effect.x2, effect.y2, (x1, y1, x2, y2) => {
            const travel = Math.min(1, phase * 1.15);
            const beadX = lerp(x1, x2, travel);
            const beadY = lerp(y1, y2, travel);
            context.fillStyle = effect.color;
            context.globalAlpha = effectAlpha * (0.18 + fade * 0.4);
            context.beginPath();
            context.arc(beadX, beadY, effect.width, 0, Math.PI * 2);
            context.fill();
          });
          continue;
        }

        drawWrappedLinearEffect(effect.x1, effect.y1, effect.x2, effect.y2, (x1, y1, x2, y2) => {
          const travel = Math.min(1, phase * 1.25);
          context.fillStyle = effect.color;
          for (let bead = 0; bead < 3; bead += 1) {
            const beadOffset = bead * 0.14;
            const beadPhase = Math.max(0, Math.min(1, travel - beadOffset));
            const beadX = lerp(x1, x2, beadPhase);
            const beadY = lerp(y1, y2, beadPhase);
            const beadRadius = effect.width * (0.9 + bead * 0.25) * (0.45 + fade * 0.7);
            context.globalAlpha = effectAlpha * (0.12 + fade * (0.42 - bead * 0.08));
            context.beginPath();
            context.arc(beadX, beadY, beadRadius, 0, Math.PI * 2);
            context.fill();
          }
        });
        continue;
      }

      if (effect.kind === "damage") {
        const ringRadius =
          effect.radius * (0.88 + Math.sin(phase * Math.PI) * 0.42);
        const localImpactX = torusDelta(effect.x, effect.impactX, config.world.width);
        const localImpactY = torusDelta(effect.y, effect.impactY, config.world.height);
        const impactAngle = Math.atan2(localImpactY, localImpactX);

        if (LOW_FIDELITY_RENDER) {
          drawWrapped((wrappedX, wrappedY) => {
            context.save();
            context.translate(wrappedX, wrappedY);
            context.strokeStyle = effect.color;
            context.globalAlpha = effectAlpha * (0.18 + fade * 0.46);
            context.lineWidth = effect.width * (1 + fade * 0.5);
            context.beginPath();
            context.arc(0, 0, ringRadius, 0, Math.PI * 2);
            context.stroke();
            context.beginPath();
            context.moveTo(
              Math.cos(impactAngle) * effect.radius * 0.28,
              Math.sin(impactAngle) * effect.radius * 0.28
            );
            context.lineTo(
              Math.cos(impactAngle) * (ringRadius + effect.width * 2.8),
              Math.sin(impactAngle) * (ringRadius + effect.width * 2.8)
            );
            context.stroke();
            context.restore();
          }, effect.x, effect.y, ringRadius + effect.width * 4);
          continue;
        }

        drawWrapped((wrappedX, wrappedY) => {
          context.save();
          context.translate(wrappedX, wrappedY);
          context.shadowColor = effect.color;
          context.shadowBlur = 10 + effect.magnitude * 14 * fade;
          context.strokeStyle = effect.color;
          context.globalAlpha = effectAlpha * (0.16 + fade * 0.54);
          context.lineWidth = effect.width * (1.1 + fade * 1.1);
          context.beginPath();
          context.arc(0, 0, ringRadius, 0, Math.PI * 2);
          context.stroke();

          context.globalAlpha = effectAlpha * (0.14 + fade * 0.42);
          for (let spark = -1; spark <= 1; spark += 1) {
            const sparkAngle = impactAngle + spark * 0.5;
            context.beginPath();
            context.moveTo(
              Math.cos(sparkAngle) * effect.radius * 0.32,
              Math.sin(sparkAngle) * effect.radius * 0.32
            );
            context.lineTo(
              Math.cos(sparkAngle) * (ringRadius + effect.width * (3 + Math.abs(spark))),
              Math.sin(sparkAngle) * (ringRadius + effect.width * (3 + Math.abs(spark)))
            );
            context.stroke();
          }

          context.fillStyle = effect.color;
          context.globalAlpha = effectAlpha * (0.12 + fade * 0.3);
          context.beginPath();
          context.arc(localImpactX, localImpactY, effect.width * (1.8 + effect.magnitude * 0.6), 0, Math.PI * 2);
          context.fill();
          context.restore();
        }, effect.x, effect.y, ringRadius + effect.width * 5);
      }
    }

    context.restore();
  }

  function traceLightningPath(x1, y1, x2, y2, seed = 0.5) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    const normalX = distance > 0 ? -dy / distance : 0;
    const normalY = distance > 0 ? dx / distance : 0;
    const segmentCount = Math.max(3, Math.min(10, Math.round(distance / 24)));

    context.beginPath();
    context.moveTo(x1, y1);
    for (let index = 1; index < segmentCount; index += 1) {
      const t = index / segmentCount;
      const envelope = Math.max(0, 1 - Math.abs(0.5 - t) * 1.55);
      const wave = Math.sin((t * (3.6 + seed * 2.2) + seed * 1.8) * Math.PI * 2);
      const jitter = distance * (0.025 + seed * 0.018) * envelope * wave;
      context.lineTo(
        x1 + dx * t + normalX * jitter,
        y1 + dy * t + normalY * jitter
      );
    }
    context.lineTo(x2, y2);
  }

  function currentLightningChargeRadius(startedAt, now = performance.now()) {
    if (!Number.isFinite(startedAt)) {
      return LIGHTNING_CHARGE_MIN_RADIUS;
    }

    const heldSeconds = Math.max(0, now - startedAt) / 1000;
    const worldLimit = Math.min(
      LIGHTNING_CHARGE_MAX_RADIUS,
      Math.min(config.world.width, config.world.height) * 0.18
    );
    const minRadius = Math.max(
      LIGHTNING_CHARGE_MIN_RADIUS,
      manualResourceSpacing() * 1.8
    );
    const maxRadius = Math.max(minRadius + 16, worldLimit);
    const growth = 1 - Math.exp(-heldSeconds * LIGHTNING_CHARGE_RAMP);
    return lerp(minRadius, maxRadius, growth);
  }

  function drawLightningCharge() {
    if (fastMode) {
      return;
    }
    if (pointerDragState?.mode !== "lightning-charge" || !pointerDragState.centerPoint) {
      return;
    }

    const chargeRadius = currentLightningChargeRadius(pointerDragState.chargeStartedAt);
    const phase = Math.max(0, performance.now() - pointerDragState.chargeStartedAt) / 1000;
    const branchSeeds =
      pointerDragState.branchSeeds?.length
        ? pointerDragState.branchSeeds
        : [0.17, 0.31, 0.53, 0.79];

    context.save();
    context.globalCompositeOperation = LOW_FIDELITY_RENDER ? "source-over" : "lighter";
    context.lineCap = "round";
    context.lineJoin = "round";

    drawWrapped((wrappedX, wrappedY) => {
      context.save();
      context.translate(wrappedX, wrappedY);

      const outerGlow = context.createRadialGradient(
        0,
        0,
        chargeRadius * 0.2,
        0,
        0,
        chargeRadius * 1.5
      );
      outerGlow.addColorStop(0, "rgba(255, 255, 255, 0.24)");
      outerGlow.addColorStop(0.38, "rgba(110, 216, 255, 0.18)");
      outerGlow.addColorStop(1, "rgba(6, 18, 28, 0)");
      context.fillStyle = outerGlow;
      context.beginPath();
      context.arc(0, 0, chargeRadius * 1.5, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "rgba(110, 216, 255, 0.08)";
      context.beginPath();
      context.arc(0, 0, chargeRadius * 1.04, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = "rgba(118, 233, 255, 0.58)";
      context.lineWidth = LOW_FIDELITY_RENDER ? 3.8 : 5.2;
      context.beginPath();
      context.arc(0, 0, chargeRadius, 0, Math.PI * 2);
      context.stroke();

      context.strokeStyle = "rgba(255, 248, 214, 0.86)";
      context.lineWidth = LOW_FIDELITY_RENDER ? 1.6 : 2.4;
      context.beginPath();
      context.arc(
        0,
        0,
        chargeRadius * (0.87 + Math.sin(phase * 5.2) * 0.02),
        0,
        Math.PI * 2
      );
      context.stroke();

      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.beginPath();
      context.arc(0, 0, Math.max(5, chargeRadius * 0.09), 0, Math.PI * 2);
      context.fill();

      for (let index = 0; index < branchSeeds.length; index += 1) {
        const seed = branchSeeds[index];
        const angle =
          seed * Math.PI * 2 +
          phase * (0.52 + seed * 0.46) +
          index * (Math.PI / Math.max(3, branchSeeds.length));
        const branchLength = chargeRadius * (0.82 + (seed % 0.26));
        const endX = Math.cos(angle) * branchLength;
        const endY = Math.sin(angle) * branchLength;

        context.strokeStyle = "rgba(110, 216, 255, 0.18)";
        context.lineWidth = LOW_FIDELITY_RENDER ? 8.5 : 12;
        traceLightningPath(0, 0, endX, endY, seed + phase * 0.08);
        context.stroke();

        context.strokeStyle = "rgba(255, 249, 213, 0.44)";
        context.lineWidth = LOW_FIDELITY_RENDER ? 3.2 : 4.4;
        traceLightningPath(0, 0, endX, endY, seed + 0.16 + phase * 0.08);
        context.stroke();

        context.strokeStyle = "rgba(255, 255, 255, 0.78)";
        context.lineWidth = LOW_FIDELITY_RENDER ? 1.2 : 1.8;
        traceLightningPath(0, 0, endX, endY, seed + 0.32 + phase * 0.08);
        context.stroke();
      }

      context.restore();
    }, pointerDragState.centerPoint.x, pointerDragState.centerPoint.y, chargeRadius * 1.6);

    context.restore();
  }

  function drawThrusterWake(organism, radius, alphaBase) {
    const speed = Math.hypot(organism.vx, organism.vy);
    const wakeAngle = speed > 0.8 ? Math.atan2(organism.vy, organism.vx) : organism.heading;
    const wakeGain = Math.max(0.28, Math.min(1.18, speed / 18 + 0.28));

    context.save();
    context.rotate(wakeAngle);

    if (!LOW_FIDELITY_RENDER) {
      context.globalAlpha = alphaBase * (0.14 + wakeGain * 0.12);
      context.fillStyle = "rgba(91, 226, 255, 0.92)";
      for (const offset of [-0.18, 0, 0.18]) {
        context.beginPath();
        context.ellipse(
          -radius * (0.96 + wakeGain * 0.16),
          offset * radius,
          radius * (0.18 + wakeGain * 0.18),
          radius * (0.06 + wakeGain * 0.06),
          0,
          0,
          Math.PI * 2
        );
        context.fill();
      }
    }

    context.globalAlpha = alphaBase * 0.42;
    context.fillStyle = "rgba(255, 177, 110, 0.95)";
    for (const offset of [-0.16, 0.16]) {
      context.beginPath();
      context.ellipse(
        -radius * 0.56,
        offset * radius,
        radius * 0.11,
        radius * 0.07,
        0,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    context.globalAlpha = alphaBase * 0.52;
    context.fillStyle = "rgba(109, 236, 255, 0.95)";
    context.beginPath();
    context.ellipse(
      -radius * 0.62,
      0,
      radius * 0.15,
      radius * 0.09,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
    context.restore();
  }

  function drawHullAccents(radius, palette, alphaBase) {
    context.save();

    context.globalAlpha = alphaBase * 0.58;
    context.fillStyle = "rgba(4, 16, 24, 0.92)";
    for (const sign of [-1, 1]) {
      context.beginPath();
      context.moveTo(-radius * 0.08, sign * radius * 0.44);
      context.lineTo(-radius * 0.58, sign * radius * 0.7);
      context.lineTo(-radius * 0.44, sign * radius * 0.16);
      context.closePath();
      context.fill();
    }

    context.globalAlpha = alphaBase * (LOW_FIDELITY_RENDER ? 0.32 : 0.46);
    context.fillStyle = "rgba(214, 241, 255, 0.96)";
    context.beginPath();
    context.ellipse(
      radius * 0.32,
      0,
      radius * 0.28,
      radius * 0.17,
      0,
      0,
      Math.PI * 2
    );
    context.fill();

    context.globalAlpha = alphaBase * 0.44;
    context.fillStyle = "rgba(69, 142, 173, 0.96)";
    context.beginPath();
    context.ellipse(
      radius * 0.38,
      0,
      radius * 0.16,
      radius * 0.09,
      0,
      0,
      Math.PI * 2
    );
    context.fill();

    context.globalAlpha = alphaBase * 0.84;
    context.strokeStyle = palette.accent;
    context.lineWidth = LOW_FIDELITY_RENDER ? 1.2 : 1.5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-radius * 0.18, 0);
    context.lineTo(radius * 0.56, 0);
    context.stroke();

    context.beginPath();
    context.moveTo(radius * 0.5, -radius * 0.14);
    context.lineTo(radius * 0.82, 0);
    context.lineTo(radius * 0.5, radius * 0.14);
    context.stroke();

    context.globalAlpha = alphaBase * 0.26;
    context.strokeStyle = "rgba(235, 247, 255, 0.9)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(radius * 0.06, 0, radius * 0.34, -0.48, 0.48);
    context.stroke();

    context.restore();
  }

  function drawOrganisms() {
    const hasLineageSelection = selectedLineageId !== null;
    const organismsToDraw = hasLineageSelection
      ? [
          ...simulation.organisms.filter(
            (organism) => organism.lineageId !== selectedLineageId
          ),
          ...simulation.organisms.filter(
            (organism) => organism.lineageId === selectedLineageId
          )
        ]
      : simulation.organisms;

    if (fastMode) {
      for (const organism of organismsToDraw) {
        const radius = organismRadius(organism, config);
        const brightness = lifeBrightness(organism);
        const palette = organismPalette(organism, config, 1);
        const isLineageMatch =
          !hasLineageSelection || organism.lineageId === selectedLineageId;
        const alphaBase = (isLineageMatch ? 1 : 0.12) * brightness;
        drawWrapped(
          (wrappedX, wrappedY) => {
            context.save();
            context.translate(wrappedX, wrappedY);
            context.globalAlpha = alphaBase;
            context.fillStyle = palette.primary;
            context.beginPath();
            context.arc(0, 0, radius, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = palette.accent;
            context.lineWidth = 1.1;
            context.beginPath();
            context.arc(0, 0, radius, 0, Math.PI * 2);
            context.stroke();
            context.strokeStyle = "rgba(235, 248, 255, 0.88)";
            context.lineWidth = 1.4;
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(
              Math.cos(organism.heading) * radius * 1.32,
              Math.sin(organism.heading) * radius * 1.32
            );
            context.stroke();
            context.restore();
          },
          organism.x,
          organism.y,
          radius + 4
        );
      }
      return;
    }

    for (const organism of organismsToDraw) {
      const radius = organismRadius(organism, config);
      const shape = genomeVisualShape(organism.genome);
      const brightness = lifeBrightness(organism);
      const glowStrength = Math.max(0.05, brightness);
      const palette = organismPalette(organism, config, 1);
      const isSelected = organism.id === selectedOrganismId;
      const isHovered = organism.id === hoveredOrganismId;
      const isLineageMatch =
        !hasLineageSelection || organism.lineageId === selectedLineageId;
      const lineageAlpha = isLineageMatch ? 1 : 0.1;
      const damageElapsed =
        organism.damageFlashDuration > 0
          ? Math.max(0, organism.damageFlashDuration - organism.damageFlashTimer)
          : 0;
      const damageBlinkStep = Math.floor(damageElapsed / 0.2);
      const damageBlinkStrength =
        organism.damageFlashTimer > 0
          ? Math.min(1, organism.damageFlashStrength)
          : 0;
      const damageVisibleAlpha =
        organism.damageFlashTimer > 0 && damageBlinkStep % 2 === 1
          ? 0.14 + (1 - damageBlinkStrength) * 0.12
          : 1;
      const damageOutlineAlpha =
        organism.damageFlashTimer > 0 && damageBlinkStep % 2 === 1
          ? 0.18 + damageBlinkStrength * 0.34
          : 0;
      drawWrapped(
        (wrappedX, wrappedY) => {
          context.save();
          context.translate(wrappedX, wrappedY);
          const alphaBase = lineageAlpha * brightness;
          context.globalAlpha = alphaBase * damageVisibleAlpha;

          if (!LOW_FIDELITY_RENDER) {
            const outerGlow = context.createRadialGradient(
              0,
              0,
              radius * (0.28 + glowStrength * 0.16),
              0,
              0,
              radius * (1.35 + glowStrength * 1.15)
            );
            outerGlow.addColorStop(0, palette.glow);
            outerGlow.addColorStop(0.58, palette.secondary);
            outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
            context.fillStyle = outerGlow;
            context.beginPath();
            context.arc(0, 0, radius * (1.35 + glowStrength * 1.15), 0, Math.PI * 2);
            context.fill();
          }

          drawThrusterWake(organism, radius, alphaBase);

          for (let side = 0; side < organism.slotMasses.length; side += 1) {
            const slotMass = organism.slotMasses[side];
            const gadgetKey = organism.genome.slotTypes[side];
            const gadget = config.gadgets[gadgetKey];
            const angle =
              organism.heading + slotAngleOffset(side, organism.slotMasses.length);
            const color = gadgetColor(config, gadgetKey);
            const rootX = Math.cos(angle) * (radius * 0.58);
            const rootY = Math.sin(angle) * (radius * 0.58);

            if (gadget.mode === "shield") {
              const shieldOuter = radius + 7 + Math.sqrt(slotMass) * 1.95;
              const shieldInner = radius * 0.8;
              context.save();
              if (!LOW_FIDELITY_RENDER) {
                context.fillStyle = color;
                context.globalAlpha = alphaBase * 0.14;
                traceSector(shieldInner, shieldOuter, angle, Math.PI / 3);
                context.fill();
              }

              context.strokeStyle = color;
              context.lineWidth = 2.3 + Math.sqrt(slotMass) * 0.36;
              context.globalAlpha = alphaBase * 0.82;
              context.beginPath();
              context.arc(0, 0, shieldOuter, angle - Math.PI / 3, angle + Math.PI / 3);
              context.stroke();

              context.globalAlpha = alphaBase * 0.28;
              if (!LOW_FIDELITY_RENDER) {
                for (let rib = -1; rib <= 1; rib += 1) {
                  const ribAngle = angle + rib * (Math.PI / 6);
                  context.beginPath();
                  context.moveTo(
                    Math.cos(ribAngle) * shieldInner,
                    Math.sin(ribAngle) * shieldInner
                  );
                  context.lineTo(
                    Math.cos(ribAngle) * shieldOuter,
                    Math.sin(ribAngle) * shieldOuter
                  );
                  context.stroke();
                }
              }
              context.restore();
              continue;
            }

            if (gadget.mode === "ranged") {
              const chamberStart = radius * 0.34;
              const chamberLength = 4.8 + Math.sqrt(slotMass) * 0.85;
              const barrelStart = chamberStart + chamberLength * 0.72;
              const barrelEnd = radius + 9 + Math.sqrt(slotMass) * 2.15;
              const bodyWidth = 3.8 + Math.sqrt(slotMass) * 0.32;
              const muzzleWidth = bodyWidth * 1.3;
              const muzzleLength = 3.2 + Math.sqrt(slotMass) * 0.42;

              context.save();
              context.rotate(angle);
              context.fillStyle = color;
              context.strokeStyle = color;

              context.globalAlpha = alphaBase * 0.96;
              context.fillRect(
                chamberStart,
                -bodyWidth * 0.86,
                chamberLength,
                bodyWidth * 1.72
              );
              context.fillRect(
                barrelStart,
                -bodyWidth * 0.36,
                barrelEnd - barrelStart,
                bodyWidth * 0.72
              );

              context.beginPath();
              context.moveTo(chamberStart + chamberLength * 0.28, -bodyWidth * 1.18);
              context.lineTo(chamberStart + chamberLength * 0.95, -bodyWidth * 0.32);
              context.lineTo(chamberStart + chamberLength * 0.45, -bodyWidth * 0.16);
              context.closePath();
              context.fill();

              context.beginPath();
              context.moveTo(chamberStart + chamberLength * 0.28, bodyWidth * 1.18);
              context.lineTo(chamberStart + chamberLength * 0.95, bodyWidth * 0.32);
              context.lineTo(chamberStart + chamberLength * 0.45, bodyWidth * 0.16);
              context.closePath();
              context.fill();

              context.fillRect(
                barrelEnd,
                -muzzleWidth * 0.5,
                muzzleLength,
                muzzleWidth
              );

              context.fillStyle = "rgba(5, 11, 18, 0.72)";
              context.fillRect(
                barrelEnd + muzzleLength * 0.28,
                -bodyWidth * 0.22,
                muzzleLength * 0.46,
                bodyWidth * 0.44
              );

              context.strokeStyle = "rgba(233, 245, 255, 0.55)";
              context.lineWidth = 1.1 + Math.sqrt(slotMass) * 0.08;
              context.beginPath();
              context.moveTo(barrelStart + 1, 0);
              context.lineTo(barrelEnd + muzzleLength * 0.9, 0);
              context.stroke();

              if (!LOW_FIDELITY_RENDER) {
                context.strokeStyle = color;
                context.globalAlpha = alphaBase * 0.34;
                context.lineWidth = 1.4 + Math.sqrt(slotMass) * 0.12;
                context.beginPath();
                context.arc(
                  barrelEnd + muzzleLength * 0.9,
                  0,
                  muzzleWidth * 0.78,
                  0,
                  Math.PI * 2
                );
                context.stroke();
              }

              context.restore();
              continue;
            }

            const shaftStart = radius * 0.38;
            const shaftEnd = radius + 5.5 + Math.sqrt(slotMass) * 1.3;
            const bladeLength = 8.5 + Math.sqrt(slotMass) * 2.5;
            const bladeWidth = 3.4 + Math.sqrt(slotMass) * 0.62;

            context.save();
            context.rotate(angle);
            context.strokeStyle = color;
            context.fillStyle = color;
            context.lineCap = "round";
            context.lineWidth = 2.2 + Math.sqrt(slotMass) * 0.34;
            context.beginPath();
            context.moveTo(shaftStart, 0);
            context.lineTo(shaftEnd, 0);
            context.stroke();

            context.beginPath();
            context.moveTo(shaftEnd + bladeLength, 0);
            context.lineTo(shaftEnd + bladeLength * 0.16, -bladeWidth * 1.08);
            context.lineTo(shaftEnd - bladeLength * 0.16, -bladeWidth * 0.34);
            context.lineTo(shaftEnd + bladeLength * 0.02, 0);
            context.lineTo(shaftEnd - bladeLength * 0.16, bladeWidth * 0.34);
            context.lineTo(shaftEnd + bladeLength * 0.16, bladeWidth * 1.08);
            context.closePath();
            context.fill();

            context.lineWidth = 1.4 + Math.sqrt(slotMass) * 0.14;
            context.beginPath();
            context.moveTo(shaftEnd - bladeLength * 0.04, -bladeWidth * 0.92);
            context.lineTo(shaftEnd - bladeLength * 0.24, -bladeWidth * 0.16);
            context.moveTo(shaftEnd - bladeLength * 0.04, bladeWidth * 0.92);
            context.lineTo(shaftEnd - bladeLength * 0.24, bladeWidth * 0.16);
            context.stroke();

            if (!LOW_FIDELITY_RENDER) {
              context.strokeStyle = "rgba(255, 235, 220, 0.52)";
              context.lineWidth = 1;
              context.beginPath();
              context.moveTo(shaftEnd - bladeLength * 0.02, 0);
              context.lineTo(shaftEnd + bladeLength * 0.86, 0);
              context.stroke();
            }

            context.restore();
          }

          if (LOW_FIDELITY_RENDER) {
            context.fillStyle = palette.primary;
          } else {
            const bodyGradient = context.createLinearGradient(
              -Math.cos(organism.heading) * radius,
              -Math.sin(organism.heading) * radius,
              Math.cos(organism.heading) * radius,
              Math.sin(organism.heading) * radius
            );
            bodyGradient.addColorStop(0, palette.shadow);
            bodyGradient.addColorStop(0.38, palette.primary);
            bodyGradient.addColorStop(0.78, palette.secondary);
            bodyGradient.addColorStop(1, palette.accent);
            context.fillStyle = bodyGradient;
          }
          context.globalAlpha = alphaBase * damageVisibleAlpha;
          traceBlobShape(radius, shape, organism.heading);
          context.fill();

          if (brightness < 0.995) {
            context.fillStyle = `rgba(0, 0, 0, ${(1 - brightness) * 0.5})`;
            traceBlobShape(radius, shape, organism.heading);
            context.fill();
          }

          if (damageOutlineAlpha > 0.01) {
            context.globalAlpha = alphaBase * damageOutlineAlpha;
            context.strokeStyle = "rgba(255, 168, 120, 1)";
            context.lineWidth = 1.2 + damageBlinkStrength * 1.6;
            traceBlobShape(radius + damageBlinkStrength * 0.8, shape, organism.heading);
            context.stroke();

            context.beginPath();
            context.arc(
              0,
              0,
              radius + 3 + damageBlinkStrength * 2.6,
              0,
              Math.PI * 2
            );
            context.stroke();
            context.globalAlpha = alphaBase * damageVisibleAlpha;
          }

          if (!LOW_FIDELITY_RENDER) {
            const coreGradient = context.createRadialGradient(
              -radius * 0.18,
              -radius * 0.22,
              radius * 0.1,
              0,
              0,
              radius * 0.95
            );
            coreGradient.addColorStop(0, palette.accent);
            coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            context.fillStyle = coreGradient;
            context.globalAlpha = alphaBase * 0.34;
            traceBlobShape(radius * 0.92, shape, organism.heading);
            context.fill();
            context.globalAlpha = alphaBase;
          }

          context.strokeStyle = palette.accent;
          context.lineWidth = 1.4;
          traceBlobShape(radius, shape, organism.heading);
          context.stroke();

          context.save();
          context.rotate(organism.heading);
          drawHullAccents(radius, palette, alphaBase);
          context.restore();

          if (isSelected || isHovered) {
            context.strokeStyle = isSelected
              ? "rgba(255, 249, 214, 0.96)"
              : "rgba(255, 255, 255, 0.42)";
            context.lineWidth = isSelected ? 2.8 : 1.6;
            context.setLineDash(isSelected ? [] : [4, 4]);
            context.beginPath();
            context.arc(0, 0, radius + (isSelected ? 6 : 4), 0, Math.PI * 2);
            context.stroke();
            context.setLineDash([]);
          }

          if (hasLineageSelection && isLineageMatch) {
            context.strokeStyle = palette.accent;
            context.globalAlpha = 0.28;
            context.lineWidth = 1.2 + Math.sqrt(radius) * 0.22;
            context.beginPath();
            context.arc(0, 0, radius + 5.5, 0, Math.PI * 2);
            context.stroke();
            context.globalAlpha = lineageAlpha;
          }

          context.restore();
        },
        organism.x,
        organism.y,
        radius + 16
      );
    }
  }

  function draw(force = false) {
    const drawNow = performance.now();
    if (!force && fastMode && drawNow - lastDrawAt < FAST_DRAW_INTERVAL_MS) {
      return;
    }
    lastDrawAt = drawNow;
    const world = config.world;
    const padding = 18;
    const usableWidth = canvas.width - padding * 2;
    const usableHeight = canvas.height - padding * 2;
    const scale = Math.min(usableWidth / world.width, usableHeight / world.height);
    const offsetX = (canvas.width - world.width * scale) / 2;
    const offsetY = (canvas.height - world.height * scale) / 2;
    viewport = { scale, offsetX, offsetY };

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255, 255, 255, 0.02)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    drawBackground(world.width, world.height);
    drawSprings();
    drawResources();
    drawOrganisms();
    drawCombatEffects();
    drawBursts();
    drawLightningCharge();
  }

  function setMenuOpen(nextOpen) {
    menuOpen = nextOpen;
    if (!menuLayer) {
      return;
    }
    menuLayer.hidden = !menuOpen;
    menuLayer.setAttribute("aria-hidden", String(!menuOpen));
    if (menuOpen) {
      updateStats(true);
    }
  }

  function buildLineageSampleMarkup(entry, palette) {
    const sample = entry.sample;
    const slotTypes = sample?.slotTypes?.length
      ? sample.slotTypes
      : ["shield"];
    const slotCount = Math.max(1, slotTypes.length);
    const samplePalette =
      sample?.visualFeatures ? visualFeaturePalette(sample.visualFeatures, 1) : palette;
    const sampleRadius = sample?.radius ?? 16;
    const bodyRadius = Math.min(18, sampleRadius);
    const scale = bodyRadius / Math.max(sampleRadius, 1);
    const shape =
      sample?.visualShape ??
      visualShapeFromFeatures(sample?.visualFeatures ?? entry.visualFeatures);
    const sampleHeading = Number.isFinite(sample?.heading) ? sample.heading : -Math.PI / 2;
    const bodyPath = buildBlobShapePath(bodyRadius, shape, sampleHeading, 40);
    const gradientId = `lineage-sample-${entry.lineageId}`;
    const glowId = `lineage-sample-glow-${entry.lineageId}`;
    const hullRotation = ((sampleHeading * 180) / Math.PI).toFixed(2);
    const gadgets = [];

    for (let side = 0; side < slotCount; side += 1) {
      const gadgetKey = slotTypes[side];
      const slotMass = sample?.slotMasses?.[side] ?? 6;
      const color = gadgetColor(config, gadgetKey);
      const angle = sampleHeading + slotAngleOffset(side, slotCount);
      const rotation = ((angle * 180) / Math.PI).toFixed(2);

      if (gadgetKey === "shield") {
        const shieldInner = bodyRadius * 0.8 * scale;
        const shieldOuter = (bodyRadius + 7 + Math.sqrt(slotMass) * 1.95) * scale;
        const outerStart = polarVectorPoint(shieldOuter, -Math.PI / 3);
        const outerEnd = polarVectorPoint(shieldOuter, Math.PI / 3);
        const innerStart = polarVectorPoint(shieldInner, -Math.PI / 3);
        const innerEnd = polarVectorPoint(shieldInner, Math.PI / 3);
        const ribAngles = [-Math.PI / 6, 0, Math.PI / 6];
        gadgets.push(`
          <g transform="translate(39 39) rotate(${rotation})">
            <path
              d="
                M ${formatSvgPoint(outerStart.x, outerStart.y)}
                A ${shieldOuter.toFixed(2)} ${shieldOuter.toFixed(2)} 0 0 1 ${formatSvgPoint(outerEnd.x, outerEnd.y)}
                L ${formatSvgPoint(innerEnd.x, innerEnd.y)}
                A ${shieldInner.toFixed(2)} ${shieldInner.toFixed(2)} 0 0 0 ${formatSvgPoint(innerStart.x, innerStart.y)}
                Z
              "
              fill="${color}"
              opacity="0.18" />
            <path d="M ${formatSvgPoint(outerStart.x, outerStart.y)} A ${shieldOuter.toFixed(2)} ${shieldOuter.toFixed(2)} 0 0 1 ${formatSvgPoint(outerEnd.x, outerEnd.y)}"
              fill="none"
              stroke="${color}"
              stroke-width="${(2.3 + Math.sqrt(slotMass) * 0.36).toFixed(2)}"
              stroke-linecap="round"
              opacity="0.92" />
            <path d="M ${formatSvgPoint(innerStart.x, innerStart.y)} A ${shieldInner.toFixed(2)} ${shieldInner.toFixed(2)} 0 0 1 ${formatSvgPoint(innerEnd.x, innerEnd.y)}"
              fill="none"
              stroke="${color}"
              stroke-width="${Math.max(0.9, 1.15 * scale).toFixed(2)}"
              stroke-linecap="round"
              opacity="0.34" />
            ${ribAngles
              .map((ribAngle) => {
                const ribInner = polarVectorPoint(shieldInner, ribAngle);
                const ribOuter = polarVectorPoint(shieldOuter, ribAngle);
                return `<line
                  x1="${ribInner.x.toFixed(2)}"
                  y1="${ribInner.y.toFixed(2)}"
                  x2="${ribOuter.x.toFixed(2)}"
                  y2="${ribOuter.y.toFixed(2)}"
                  stroke="${color}"
                  stroke-width="${Math.max(0.75, 0.95 * scale).toFixed(2)}"
                  stroke-linecap="round"
                  opacity="0.42" />`;
              })
              .join("")}
          </g>
        `);
        continue;
      }

      if (gadgetKey === "ranged") {
        const chamberStart = bodyRadius * 0.34;
        const chamberLength = (4.8 + Math.sqrt(slotMass) * 0.85) * scale;
        const barrelStart = chamberStart + chamberLength * 0.72;
        const barrelEnd = (bodyRadius + 9 + Math.sqrt(slotMass) * 2.15) * scale;
        const bodyWidth = (3.8 + Math.sqrt(slotMass) * 0.32) * scale;
        const muzzleLength = (3.2 + Math.sqrt(slotMass) * 0.42) * scale;
        gadgets.push(`
          <g transform="translate(39 39) rotate(${rotation})">
            <rect x="${chamberStart.toFixed(2)}" y="${(-bodyWidth * 0.86).toFixed(2)}" width="${chamberLength.toFixed(2)}" height="${(bodyWidth * 1.72).toFixed(2)}" rx="${(bodyWidth * 0.28).toFixed(2)}" fill="${color}" opacity="0.95" />
            <rect x="${barrelStart.toFixed(2)}" y="${(-bodyWidth * 0.36).toFixed(2)}" width="${(barrelEnd - barrelStart).toFixed(2)}" height="${(bodyWidth * 0.72).toFixed(2)}" rx="${(bodyWidth * 0.18).toFixed(2)}" fill="${color}" opacity="0.95" />
            <rect x="${barrelEnd.toFixed(2)}" y="${(-bodyWidth * 0.5).toFixed(2)}" width="${muzzleLength.toFixed(2)}" height="${(bodyWidth * 1.3).toFixed(2)}" rx="${(bodyWidth * 0.16).toFixed(2)}" fill="${color}" opacity="0.95" />
            <line x1="${(barrelStart + scale).toFixed(2)}" y1="0" x2="${(barrelEnd + muzzleLength * 0.9).toFixed(2)}" y2="0" stroke="rgba(233,245,255,0.6)" stroke-width="${Math.max(0.7, scale).toFixed(2)}" stroke-linecap="round" />
          </g>
        `);
        continue;
      }

      const shaftStart = bodyRadius * 0.38;
      const shaftEnd = (bodyRadius + 5.5 + Math.sqrt(slotMass) * 1.3) * scale;
      const bladeLength = (8.5 + Math.sqrt(slotMass) * 2.5) * scale;
      const bladeWidth = (3.4 + Math.sqrt(slotMass) * 0.62) * scale;
      gadgets.push(`
        <g transform="translate(39 39) rotate(${rotation})">
          <line x1="${shaftStart.toFixed(2)}" y1="0" x2="${shaftEnd.toFixed(2)}" y2="0" stroke="${color}" stroke-width="${(2.2 * scale).toFixed(2)}" stroke-linecap="round" />
          <polygon points="
            ${formatSvgPoint(shaftEnd + bladeLength, 0)}
            ${formatSvgPoint(shaftEnd + bladeLength * 0.16, -bladeWidth)}
            ${formatSvgPoint(shaftEnd - bladeLength * 0.16, -bladeWidth * 0.3)}
            ${formatSvgPoint(shaftEnd + bladeLength * 0.02, 0)}
            ${formatSvgPoint(shaftEnd - bladeLength * 0.16, bladeWidth * 0.3)}
            ${formatSvgPoint(shaftEnd + bladeLength * 0.16, bladeWidth)}
          " fill="${color}" opacity="0.96" />
        </g>
      `);
    }

    return `
      <div class="lineage-sample" aria-hidden="true">
        <svg viewBox="0 0 78 78" role="img">
          <defs>
            <radialGradient id="${glowId}" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stop-color="${samplePalette.glow}" />
              <stop offset="60%" stop-color="${samplePalette.secondary}" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="${gradientId}" x1="18%" y1="16%" x2="84%" y2="86%">
              <stop offset="0%" stop-color="${samplePalette.shadow}" />
              <stop offset="42%" stop-color="${samplePalette.primary}" />
              <stop offset="76%" stop-color="${samplePalette.secondary}" />
              <stop offset="100%" stop-color="${samplePalette.accent}" />
            </linearGradient>
          </defs>
          <circle cx="39" cy="39" r="${(bodyRadius * 2.35).toFixed(2)}" fill="url(#${glowId})" opacity="0.72" />
          <g transform="translate(39 39) rotate(${hullRotation})">
            <ellipse cx="${(-bodyRadius * 0.98).toFixed(2)}" cy="0" rx="${(bodyRadius * 0.28).toFixed(2)}" ry="${(bodyRadius * 0.1).toFixed(2)}" fill="rgba(91,226,255,0.26)" />
            <ellipse cx="${(-bodyRadius * 1.15).toFixed(2)}" cy="${(-bodyRadius * 0.18).toFixed(2)}" rx="${(bodyRadius * 0.18).toFixed(2)}" ry="${(bodyRadius * 0.06).toFixed(2)}" fill="rgba(91,226,255,0.18)" />
            <ellipse cx="${(-bodyRadius * 1.15).toFixed(2)}" cy="${(bodyRadius * 0.18).toFixed(2)}" rx="${(bodyRadius * 0.18).toFixed(2)}" ry="${(bodyRadius * 0.06).toFixed(2)}" fill="rgba(91,226,255,0.18)" />
            <ellipse cx="${(-bodyRadius * 0.96).toFixed(2)}" cy="0" rx="${(bodyRadius * 0.18).toFixed(2)}" ry="${(bodyRadius * 0.08).toFixed(2)}" fill="rgba(91,226,255,0.18)" />
            <ellipse cx="${(-bodyRadius * 0.56).toFixed(2)}" cy="${(-bodyRadius * 0.16).toFixed(2)}" rx="${(bodyRadius * 0.11).toFixed(2)}" ry="${(bodyRadius * 0.07).toFixed(2)}" fill="rgba(255,177,110,0.42)" />
            <ellipse cx="${(-bodyRadius * 0.56).toFixed(2)}" cy="${(bodyRadius * 0.16).toFixed(2)}" rx="${(bodyRadius * 0.11).toFixed(2)}" ry="${(bodyRadius * 0.07).toFixed(2)}" fill="rgba(255,177,110,0.42)" />
            <polygon points="${formatSvgPoint(-bodyRadius * 0.08, -bodyRadius * 0.44)} ${formatSvgPoint(-bodyRadius * 0.58, -bodyRadius * 0.7)} ${formatSvgPoint(-bodyRadius * 0.44, -bodyRadius * 0.16)}" fill="rgba(4,16,24,0.58)" />
            <polygon points="${formatSvgPoint(-bodyRadius * 0.08, bodyRadius * 0.44)} ${formatSvgPoint(-bodyRadius * 0.58, bodyRadius * 0.7)} ${formatSvgPoint(-bodyRadius * 0.44, bodyRadius * 0.16)}" fill="rgba(4,16,24,0.58)" />
          </g>
          <path d="${bodyPath}" transform="translate(39 39)" fill="url(#${gradientId})" stroke="${samplePalette.accent}" stroke-width="1.6" />
          <g transform="translate(39 39) rotate(${hullRotation})">
            <ellipse cx="${(bodyRadius * 0.32).toFixed(2)}" cy="0" rx="${(bodyRadius * 0.28).toFixed(2)}" ry="${(bodyRadius * 0.17).toFixed(2)}" fill="rgba(214,241,255,0.46)" />
            <ellipse cx="${(bodyRadius * 0.38).toFixed(2)}" cy="0" rx="${(bodyRadius * 0.16).toFixed(2)}" ry="${(bodyRadius * 0.09).toFixed(2)}" fill="rgba(69,142,173,0.44)" />
            <line x1="${(-bodyRadius * 0.18).toFixed(2)}" y1="0" x2="${(bodyRadius * 0.56).toFixed(2)}" y2="0" stroke="${samplePalette.accent}" stroke-width="1.3" stroke-linecap="round" />
            <polyline points="${formatSvgPoint(bodyRadius * 0.5, -bodyRadius * 0.14)} ${formatSvgPoint(bodyRadius * 0.82, 0)} ${formatSvgPoint(bodyRadius * 0.5, bodyRadius * 0.14)}" fill="none" stroke="${samplePalette.accent}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M ${formatSvgPoint(bodyRadius * 0.06 + Math.cos(-0.48) * bodyRadius * 0.34, Math.sin(-0.48) * bodyRadius * 0.34)} A ${(bodyRadius * 0.34).toFixed(2)} ${(bodyRadius * 0.34).toFixed(2)} 0 0 1 ${formatSvgPoint(bodyRadius * 0.06 + Math.cos(0.48) * bodyRadius * 0.34, Math.sin(0.48) * bodyRadius * 0.34)}" fill="none" stroke="rgba(235,247,255,0.32)" stroke-width="0.9" />
          </g>
          ${gadgets.join("")}
        </svg>
      </div>
    `;
  }

  function renderDesignerPreview() {
    if (!designerPreview) {
      return;
    }
    const draft = readDesignerDraft();
    const genome = currentDesignerGenome();
    const visualFeatures = genomeVisualFeatures(genome, config);
    const palette = visualFeaturePalette(visualFeatures, 1);
    const previewMass = Math.max(
      config.organisms.minViableMass + 1,
      Number(draft.initialMass) || config.world.initialOrganismMass
    );
    const slotCount = Math.max(1, genome.slotTypes.length);
    const slotShare = (previewMass * genome.allocation[2]) / slotCount;
    const previewEntry = {
      lineageId: "designer-preview",
      lineageName: draft.lineageName,
      visualFeatures,
      genomeDiversity: 0,
      sample: {
        lineageId: "designer-preview",
        visualFeatures,
        visualShape: genomeVisualShape(genome),
        slotTypes: [...genome.slotTypes],
        slotMasses: Array.from({ length: slotCount }, () => slotShare),
        heading: -Math.PI / 2,
        radius: Math.max(12, Math.sqrt(previewMass) * config.render.organismScale)
      }
    };
    const profile = genomeCapabilityProfile(genome, config);
    const pattern = genome.slotTypes
      .map((slot) => (slot === "melee" ? "M" : slot === "ranged" ? "R" : "D"))
      .join("-");

    designerPreview.innerHTML = `
      <div class="designer-preview-grid">
        ${buildLineageSampleMarkup(previewEntry, palette)}
        <div class="designer-preview-meta">
          <strong>${escapeHtml(draft.lineageName || designerNameFallback())}</strong>
          <span>${t(locale, "app.designerPreviewPattern")}: ${pattern}</span>
          <small>${t(locale, "app.designerPreviewMass")}: ${formatNumber(previewMass, 0)} · ${t(
            locale,
            "app.designerPreviewBirth"
          )}: ${formatNumber(genome.thresholdMass, 0)}</small>
        </div>
        <div class="lineage-chart">
          ${buildCapabilityChartMarkup(profile, palette, {
            variant: "compact",
            size: 110,
            idPrefix: "designer-chart"
          })}
        </div>
      </div>
    `;
  }

  function cloneLineageSample(sample) {
    if (!sample) {
      return null;
    }
    return {
      ...sample,
      visualFeatures: sample.visualFeatures ? { ...sample.visualFeatures } : null,
      visualShape: sample.visualShape ? { ...sample.visualShape } : null,
      slotTypes: sample.slotTypes ? [...sample.slotTypes] : [],
      slotMasses: sample.slotMasses ? [...sample.slotMasses] : []
    };
  }

  function freezeLineageSamples(entries) {
    return entries.map((entry) => {
      let frozenSample = cachedLineageSamples.get(entry.lineageId);
      if (entry.sample) {
        frozenSample = cloneLineageSample(entry.sample);
        cachedLineageSamples.set(entry.lineageId, frozenSample);
      }
      return {
        ...entry,
        sample: frozenSample ?? entry.sample
      };
    });
  }

  function lineageFeatureDistance(left, right) {
    const leftFeatures = left?.visualFeatures ?? {};
    const rightFeatures = right?.visualFeatures ?? {};
    const keys = new Set([
      ...Object.keys(leftFeatures),
      ...Object.keys(rightFeatures)
    ]);
    if (!keys.size) {
      return 0;
    }

    let distanceSq = 0;
    for (const key of keys) {
      const delta = (leftFeatures[key] ?? 0) - (rightFeatures[key] ?? 0);
      distanceSq += delta * delta;
    }
    return Math.sqrt(distanceSq / keys.size);
  }

  function mergePhylogenyFeatures(left, right) {
    const keys = new Set([
      ...Object.keys(left.features ?? {}),
      ...Object.keys(right.features ?? {})
    ]);
    const totalWeight = Math.max(1, left.weight + right.weight);
    const merged = {};
    for (const key of keys) {
      merged[key] =
        ((left.features?.[key] ?? 0) * left.weight +
          (right.features?.[key] ?? 0) * right.weight) /
        totalWeight;
    }
    return merged;
  }

  function inferPhylogeny(entries) {
    if (!entries.length) {
      return null;
    }

    let nextNodeId = 1;
    let clusters = entries.map((entry) => ({
      id: `leaf-${entry.lineageId}`,
      entry,
      weight: Math.max(1, entry.count),
      height: 0,
      features: { ...(entry.visualFeatures ?? {}) },
      left: null,
      right: null
    }));

    while (clusters.length > 1) {
      let bestI = 0;
      let bestJ = 1;
      let bestDistance = Infinity;

      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          const distance = lineageFeatureDistance(
            { visualFeatures: clusters[i].features },
            { visualFeatures: clusters[j].features }
          );
          if (distance < bestDistance) {
            bestDistance = distance;
            bestI = i;
            bestJ = j;
          }
        }
      }

      const left = clusters[bestI];
      const right = clusters[bestJ];
      const merged = {
        id: `node-${nextNodeId++}`,
        entry: null,
        weight: left.weight + right.weight,
        height: bestDistance,
        features: mergePhylogenyFeatures(left, right),
        left,
        right
      };

      clusters = clusters.filter((_, index) => index !== bestI && index !== bestJ);
      clusters.push(merged);
    }

    return {
      root: clusters[0],
      maxHeight: clusters[0]?.height ?? 0
    };
  }

  function collectPhylogenyLeaves(node, leaves = []) {
    if (!node) {
      return leaves;
    }
    if (!node.left && !node.right) {
      leaves.push(node);
      return leaves;
    }
    collectPhylogenyLeaves(node.left, leaves);
    collectPhylogenyLeaves(node.right, leaves);
    return leaves;
  }

  function buildPhylogenyMarkup(entries) {
    if (!entries.length) {
      return `<div class="snapshot-empty phylogeny-empty"><span>${t(locale, "app.phylogenyWaiting")}</span></div>`;
    }

    const tree = inferPhylogeny(entries);
    if (!tree?.root) {
      return `<div class="snapshot-empty phylogeny-empty"><span>${t(locale, "app.phylogenyWaiting")}</span></div>`;
    }

    const leaves = collectPhylogenyLeaves(tree.root);
    const rowHeight = leaves.length <= 5 ? 34 : leaves.length <= 8 ? 30 : 26;
    const topPad = 16;
    const bottomPad = 16;
    const width = 332;
    const leftPad = 12;
    const rightPad = 8;
    const labelWidth = 124;
    const branchWidth = Math.max(110, width - leftPad - rightPad - labelWidth);
    const height = topPad + bottomPad + Math.max(1, leaves.length - 1) * rowHeight + 16;
    const safeMaxHeight = Math.max(tree.maxHeight, 0.0001);
    const positions = new Map();

    leaves.forEach((leaf, index) => {
      positions.set(leaf.id, {
        x: leftPad + branchWidth,
        y: topPad + 8 + index * rowHeight
      });
    });

    function branchX(nodeHeight) {
      if (tree.maxHeight <= 0.0001) {
        return leftPad + branchWidth * 0.16;
      }
      return (
        leftPad + ((safeMaxHeight - nodeHeight) / safeMaxHeight) * branchWidth
      );
    }

    function layoutNode(node) {
      if (!node.left && !node.right) {
        return positions.get(node.id);
      }
      const leftPosition = layoutNode(node.left);
      const rightPosition = layoutNode(node.right);
      const position = {
        x: branchX(node.height),
        y: (leftPosition.y + rightPosition.y) * 0.5
      };
      positions.set(node.id, position);
      return position;
    }

    layoutNode(tree.root);

    function renderBranches(node) {
      if (!node?.left || !node.right) {
        return "";
      }
      const here = positions.get(node.id);
      const leftPosition = positions.get(node.left.id);
      const rightPosition = positions.get(node.right.id);
      const branchLines = [
        `<line x1="${here.x.toFixed(2)}" y1="${leftPosition.y.toFixed(2)}" x2="${here.x.toFixed(2)}" y2="${rightPosition.y.toFixed(2)}" stroke="rgba(232, 239, 246, 0.22)" stroke-width="1.2" />`,
        `<line x1="${here.x.toFixed(2)}" y1="${leftPosition.y.toFixed(2)}" x2="${leftPosition.x.toFixed(2)}" y2="${leftPosition.y.toFixed(2)}" stroke="rgba(232, 239, 246, 0.22)" stroke-width="1.2" />`,
        `<line x1="${here.x.toFixed(2)}" y1="${rightPosition.y.toFixed(2)}" x2="${rightPosition.x.toFixed(2)}" y2="${rightPosition.y.toFixed(2)}" stroke="rgba(232, 239, 246, 0.22)" stroke-width="1.2" />`,
        `<circle cx="${here.x.toFixed(2)}" cy="${here.y.toFixed(2)}" r="2.5" fill="rgba(232, 239, 246, 0.42)" />`
      ];
      return `${renderBranches(node.left)}${renderBranches(node.right)}${branchLines.join("")}`;
    }

    const labels = leaves
      .map((leaf) => {
        const position = positions.get(leaf.id);
        const entry = leaf.entry;
        const palette = lineagePalette(entry, 1);
        const leafName = escapeHtml(
          entry.lineageName ?? lineageNameForId(entry.lineageId)
        );
        return `
          <circle cx="${(position.x + 8).toFixed(2)}" cy="${position.y.toFixed(2)}" r="4.8" fill="${palette.primary}" stroke="${palette.accent}" stroke-width="1.1" />
          <text x="${(position.x + 18).toFixed(2)}" y="${(position.y + 3.6).toFixed(2)}" fill="rgba(241,246,251,0.92)" font-size="11.5">${leafName}</text>
          <text class="phylogeny-leaf-count" x="${(width - 10).toFixed(2)}" y="${(position.y + 3.2).toFixed(2)}" text-anchor="end">${entry.count}</text>
        `;
      })
      .join("");

    return `
      <div class="phylogeny-tree-shell">
        <svg class="phylogeny-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
          t(locale, "app.phylogenyTitle")
        )}">
          ${renderBranches(tree.root)}
          ${labels}
        </svg>
      </div>
    `;
  }

  function renderPhylogeny() {
    if (!phylogenyTree) {
      return;
    }

    if (!phylogenyEnabled) {
      phylogenyTree.innerHTML = `<div class="snapshot-empty phylogeny-empty"><span>${t(
        locale,
        "app.phylogenyEmpty"
      )}</span></div>`;
      return;
    }

    phylogenyTree.innerHTML = buildPhylogenyMarkup(cachedPhylogenyLineages);
  }

  function balancedPercentages(slices, total) {
    if (!total || !slices.length) {
      return [];
    }
    const exact = slices.map((slice) => (slice.count / total) * 100);
    const roundedDown = exact.map((value) => Math.floor(value));
    let remaining = Math.max(
      0,
      100 - roundedDown.reduce((sum, value) => sum + value, 0)
    );
    const remainderRank = exact
      .map((value, index) => ({
        index,
        remainder: value - roundedDown[index]
      }))
      .sort((left, right) => {
        if (right.remainder !== left.remainder) {
          return right.remainder - left.remainder;
        }
        return left.index - right.index;
      });
    for (let index = 0; index < remainderRank.length && remaining > 0; index += 1) {
      roundedDown[remainderRank[index].index] += 1;
      remaining -= 1;
    }
    return roundedDown;
  }

  function buildLineageShareMarkup(entries, totalLiving) {
    const total = Math.max(0, Math.round(totalLiving));
    if (!total || !entries.length) {
      return `<div class="snapshot-empty lineage-share-empty"><span>${t(locale, "app.none")}</span></div>`;
    }

    const slices = [];
    let coveredCount = 0;
    for (const entry of entries.slice(0, 4)) {
      const count = Math.max(0, Math.round(entry.count ?? 0));
      if (count <= 0) {
        continue;
      }
      coveredCount += count;
      const palette = lineagePalette(entry, 1);
      slices.push({
        label: entry.lineageName ?? lineageNameForId(entry.lineageId),
        count,
        color: palette.primary,
        glow: palette.secondary
      });
    }

    const otherCount = Math.max(0, total - coveredCount);
    if (otherCount > 0) {
      slices.push({
        label: t(locale, "app.lineageShareOthers"),
        count: otherCount,
        color: "rgba(161, 175, 184, 0.92)",
        glow: "rgba(214, 224, 230, 0.72)"
      });
    }

    const chartTotal = slices.reduce((sum, slice) => sum + slice.count, 0);
    if (!chartTotal) {
      return `<div class="snapshot-empty lineage-share-empty"><span>${t(locale, "app.none")}</span></div>`;
    }

    const size = 176;
    const center = size / 2;
    const radius = 54;
    const strokeWidth = 24;
    const circumference = 2 * Math.PI * radius;
    let cumulativeFraction = 0;

    const circles = slices
      .map((slice) => {
        const fraction = slice.count / chartTotal;
        const dash = Math.max(0.0001, circumference * fraction);
        const gap = Math.max(0, circumference - dash);
        const markup = `<circle
            cx="${center}"
            cy="${center}"
            r="${radius}"
            fill="none"
            stroke="${slice.color}"
            stroke-width="${strokeWidth}"
            stroke-linecap="butt"
            stroke-dasharray="${dash.toFixed(3)} ${gap.toFixed(3)}"
            stroke-dashoffset="${(-cumulativeFraction * circumference).toFixed(3)}"
            transform="rotate(-90 ${center} ${center})"
          />`;
        cumulativeFraction += fraction;
        return markup;
      })
      .join("");

    const displayPercents = balancedPercentages(slices, chartTotal);

    const legend = slices
      .map((slice, index) => {
        const percent = displayPercents[index] ?? 0;
        return `
          <div class="lineage-share-legend-item">
            <span class="lineage-share-legend-dot" style="background:${slice.color}; box-shadow:0 0 14px ${slice.glow};"></span>
            <span class="lineage-share-legend-label">${slice.label}</span>
            <strong class="lineage-share-legend-value">${percent}%</strong>
          </div>
        `;
      })
      .join("");

    return `
      <div class="lineage-share-head">
        <span>${t(locale, "app.lineageShareTitle")}</span>
        <strong>${total}</strong>
      </div>
      <div class="lineage-share-layout">
        <div class="lineage-share-donut">
          <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${t(locale, "app.lineageShareTitle")}">
            <circle
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              stroke-width="${strokeWidth}"
            />
            ${circles}
          </svg>
          <div class="lineage-share-center">
            <div>
              <strong>${total}</strong>
              <span>${t(locale, "app.population")}</span>
            </div>
          </div>
        </div>
        <div class="lineage-share-legend">${legend}</div>
      </div>
    `;
  }

  function renderLineageShare(stats) {
    if (!lineageSharePanel) {
      return;
    }
    const dominantLineages = stats?.dominantLineages ?? [];
    const totalLiving = stats?.living ?? 0;
    lineageSharePanel.innerHTML = buildLineageShareMarkup(dominantLineages, totalLiving);
  }

  function renderLineages(stats) {
    lineageList.classList.remove(
      "lineage-list-compact",
      "lineage-list-tight",
      "lineage-list-stack"
    );
    lineageList.classList.toggle("has-active-lineage", selectedLineageId !== null);
    lineageList.innerHTML = "";
    if (!stats.dominantLineages.length) {
      lineageList.innerHTML = `<div class="snapshot-empty"><span>${t(locale, "app.none")}</span></div>`;
      renderLineageShare(stats);
      return;
    }

    for (const entry of stats.dominantLineages) {
      const palette = lineagePalette(entry, 1);
      const profile = lineageCapabilityProfile(entry, config);
      const tags = deriveLineageTraitTags(entry, palette, config, locale, 2);
      const item = document.createElement("div");
      item.className = "lineage-item";
      item.dataset.lineageId = String(entry.lineageId);
      item.classList.toggle("is-active", entry.lineageId === selectedLineageId);
      item.style.setProperty("--lineage-card-border", withColorAlpha(palette.primary, 0.34));
      item.style.setProperty("--lineage-card-border-strong", withColorAlpha(palette.accent, 0.58));
      item.style.setProperty("--lineage-card-shadow", withColorAlpha(palette.secondary, 0.18));
      item.style.setProperty("--lineage-card-bg-top", withColorAlpha(palette.shadow, 0.34));
      item.style.setProperty("--lineage-card-bg-bottom", withColorAlpha(palette.primary, 0.08));
      item.style.setProperty("--lineage-chart-bg", withColorAlpha(palette.shadow, 0.26));
      item.innerHTML = `
        ${buildLineageSampleMarkup(entry, palette)}
        <div class="lineage-item-main">
          <div class="lineage-item-head">
            <span class="lineage-swatch" style="background:${lineageGradientCss(entry)};"></span>
            <span class="lineage-name">${entry.lineageName ?? lineageNameForId(entry.lineageId)}</span>
          </div>
          ${buildTraitTagMarkup(tags)}
        </div>
        <div class="lineage-chart">
          ${buildCapabilityChartMarkup(profile, palette, {
            variant: "compact",
            size: 116,
            idPrefix: `lineage-chart-${entry.lineageId}`
          })}
        </div>
      `;
      lineageList.appendChild(item);
    }
    fitLineageListLayout();
    renderLineageShare(stats);
  }

  function lineageListHasHorizontalOverflow() {
    if (!lineageList) {
      return false;
    }
    if (lineageList.scrollWidth > lineageList.clientWidth + 1) {
      return true;
    }
    return [...lineageList.children].some(
      (item) => item.scrollWidth > item.clientWidth + 1
    );
  }

  function fitLineageListLayout() {
    if (!lineageList) {
      return;
    }
    lineageList.classList.remove(
      "lineage-list-compact",
      "lineage-list-tight",
      "lineage-list-stack"
    );
    if (lineageListHasHorizontalOverflow()) {
      lineageList.classList.add("lineage-list-compact");
    }
    if (lineageListHasHorizontalOverflow()) {
      lineageList.classList.add("lineage-list-tight");
    }
    if (lineageListHasHorizontalOverflow()) {
      lineageList.classList.add("lineage-list-stack");
    }
  }

  function speciesLabel(organism) {
    return organism.genome.slotTypes
      .map((slot) =>
        slot === "melee" ? "M" : slot === "ranged" ? "R" : "D"
      )
      .join("-");
  }

  function findOrganismAt(worldPoint) {
    if (!worldPoint) {
      return null;
    }
    let bestOrganism = null;
    let bestDistanceSq = Infinity;

    for (const organism of simulation.organisms) {
      const { dx, dy } = torusOffset(worldPoint, organism);
      const distanceSq = dx * dx + dy * dy;
      const hitRadius = organismRadius(organism, config) * 1.35;
      if (distanceSq <= hitRadius * hitRadius && distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestOrganism = organism;
      }
    }

    return bestOrganism;
  }

  function findSpringAt(worldPoint) {
    if (!worldPoint || !simulation.springs?.length) {
      return null;
    }

    let bestSpring = null;
    let bestDistanceSq = Infinity;
    for (const spring of simulation.springs) {
      const { dx, dy } = torusOffset(worldPoint, spring);
      const distanceSq = dx * dx + dy * dy;
      const hitRadius = spring.radius * 1.15 + 5;
      if (distanceSq <= hitRadius * hitRadius && distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestSpring = spring;
      }
    }

    return bestSpring;
  }

  function updateHoveredOrganism() {
    hoveredOrganismId = findOrganismAt(hoverWorldPoint)?.id ?? null;
  }

  function renderFocusCell() {
    const selectedOrganism = simulation.organisms.find(
      (candidate) => candidate.id === selectedOrganismId
    );
    const organism =
      selectedOrganism ??
      simulation.organisms.find((candidate) => candidate.id === hoveredOrganismId);

    if (!organism) {
      focusCell.innerHTML = `
        <div class="focus-placeholder">
          <strong>${t(locale, "app.focus.noneTitle")}</strong>
          <span>${t(locale, "app.focus.noneBody")}</span>
        </div>
      `;
      return;
    }

    const palette = organismPalette(organism, config, 1);
    const profile = genomeCapabilityProfile(organism.genome, config);
    const modeLabel = selectedOrganism
      ? t(locale, "app.focus.pinned")
      : t(locale, "app.focus.hover");
    const modeTitle = selectedOrganism
      ? t(locale, "app.focus.pinnedCell")
      : t(locale, "app.focus.hoverCell");
    const lineageName = simulation.getLineageName
      ? simulation.getLineageName(organism.lineageId)
      : lineageNameForId(organism.lineageId);

    focusCell.innerHTML = `
      <div class="focus-head">
        <div class="focus-title">
          <span class="focus-chip" style="background:linear-gradient(135deg, ${palette.shadow} 0%, ${palette.primary} 42%, ${palette.secondary} 78%, ${palette.accent} 100%);"></span>
          <strong>${modeTitle}</strong>
          <span>${lineageName} · ${speciesLabel(organism)}</span>
        </div>
      </div>
      <div class="focus-radar-wrap">
        ${buildCapabilityChartMarkup(profile, palette, {
          variant: "detail",
          size: 240,
          idPrefix: `focus-chart-${organism.id}`
        })}
      </div>
      <div class="focus-metrics">
        <div>
          <dt>${t(locale, "app.focus.mass")}</dt>
          <dd>${formatNumber(
            organism.coreMass + organism.motorMass + organism.slotMasses.reduce((a, b) => a + b, 0)
          )}</dd>
        </div>
        <div>
          <dt>${t(locale, "app.focus.lifeLeft")}</dt>
          <dd>${formatNumber(remainingLife(organism))} ${timeUnitLabel()}</dd>
        </div>
        <div>
          <dt>${t(locale, "app.focus.age")}</dt>
          <dd>${formatNumber(organism.age)} ${timeUnitLabel()}</dd>
        </div>
        <div>
          <dt>${t(locale, "app.focus.mode")}</dt>
          <dd>${modeLabel}</dd>
        </div>
      </div>
    `;
  }

  function updateStats(force = false) {
    if (!fastMode) {
      updateHoveredOrganism();
    } else {
      hoveredOrganismId = null;
    }
    if (
      selectedOrganismId !== null &&
      !simulation.organisms.some((organism) => organism.id === selectedOrganismId)
    ) {
      selectedOrganismId = null;
    }
    if (
      selectedLineageId !== null &&
      !simulation.organisms.some((organism) => organism.lineageId === selectedLineageId)
    ) {
      selectedLineageId = null;
    }
    const now = performance.now();
    const uiInterval = fastMode ? FAST_UI_UPDATE_INTERVAL_MS : UI_UPDATE_INTERVAL_MS;
    const lineageInterval = fastMode
      ? FAST_LINEAGE_UPDATE_INTERVAL_MS
      : LINEAGE_UPDATE_INTERVAL_MS;
    if (!force && now - lastUiUpdateAt < uiInterval) {
      return;
    }
    lastUiUpdateAt = now;
    const shouldRefreshLineages =
      force || now - lastLineageUpdateAt >= lineageInterval;
    const stats = simulation.stats({
      includeDominantLineages: shouldRefreshLineages,
      includePhylogeny: phylogenyEnabled && shouldRefreshLineages
    });
    config.world.totalMaterial = simulation.config.world.totalMaterial;
    if (document.activeElement !== quickTotalMaterialInput) {
      syncQuickTotalMaterialInput(config.world.totalMaterial);
    }
    if (menuOpen) {
      statPopulation.textContent = String(stats.living);
      statLineages.textContent = String(stats.lineages);
      statAvgMass.textContent = formatNumber(stats.avgMass);
      statFreeMass.textContent = formatNumber(stats.freeMaterial);
      statBoundMass.textContent = formatNumber(stats.organismMaterial);
      statTotalMass.textContent = formatNumber(stats.totalMaterial);
      statBirths.textContent = String(stats.births);
      statDeaths.textContent = String(stats.deaths);
      statDrift.textContent = formatNumber(stats.drift, 3);
      statLifeLeft.textContent = `${formatNumber(stats.avgRemainingLife)} ${timeUnitLabel()}`;
      statBiodiversityEntropy.textContent = formatNumber(stats.biodiversityEntropy, 3);
    }
    mainStatPopulation.textContent = String(stats.living);
    mainStatBiodiversityEntropy.textContent = formatNumber(stats.biodiversityEntropy, 3);
    mainStatTotalMass.textContent = formatNumber(stats.totalMaterial);
    detailStatLineages.textContent = String(stats.lineages);
    detailStatAvgMass.textContent = formatNumber(stats.avgMass);
    detailStatFreeMass.textContent = formatNumber(stats.freeMaterial);
    detailStatBoundMass.textContent = formatNumber(stats.organismMaterial);
    detailStatLifeLeft.textContent = `${formatNumber(stats.avgRemainingLife)} ${timeUnitLabel()}`;
    detailStatBirths.textContent = String(stats.births);
    detailStatDeaths.textContent = String(stats.deaths);
    detailStatDrift.textContent = formatNumber(stats.drift, 3);
    renderLineageShare({
      living: stats.living,
      dominantLineages: shouldRefreshLineages
        ? stats.dominantLineages
        : cachedDominantLineages
    });
    if (shouldRefreshLineages) {
      cachedDominantLineages = freezeLineageSamples(stats.dominantLineages);
      cachedPhylogenyLineages = phylogenyEnabled
        ? stats.phylogenyLineages.map((entry) => ({
            ...entry,
            sample: cloneLineageSample(entry.sample),
            visualFeatures: entry.visualFeatures ? { ...entry.visualFeatures } : null
          }))
        : [];
      if (
        selectedLineageId !== null &&
        !cachedDominantLineages.some((entry) => entry.lineageId === selectedLineageId)
      ) {
        selectedLineageId = null;
      }
      lastLineageUpdateAt = now;
      renderLineages({ ...stats, dominantLineages: cachedDominantLineages });
      if (menuOpen) {
        renderPhylogeny();
      }
    }
    if (!shouldRefreshLineages && menuOpen) {
      renderPhylogeny();
    }
    if (menuOpen) {
      renderFocusCell();
    }

    if (broadcastChannel) {
      if (now - lastBroadcastAt > 300) {
        lastBroadcastAt = now;
        broadcastChannel.postMessage({
          type: "snapshot",
          payload: stats
        });
      }
    }
  }

  function notePerformance(frameCostMs) {
    const lagMs = Math.max(0, frameCostMs - FRAME_BUDGET_MS);
    if (!hasPerformanceSample) {
      smoothedFrameCostMs = frameCostMs;
      smoothedComputeLagMs = lagMs;
      hasPerformanceSample = true;
      return;
    }
    smoothedFrameCostMs = lerp(smoothedFrameCostMs, frameCostMs, PERF_EMA_ALPHA);
    smoothedComputeLagMs = lerp(smoothedComputeLagMs, lagMs, PERF_EMA_ALPHA);
  }

  function lagLevel(lagMs) {
    if (lagMs >= 12) {
      return "high";
    }
    if (lagMs >= 4) {
      return "warn";
    }
    return "ok";
  }

  function renderLagIndicator(force = false) {
    if (!stageLagIndicator || !mainStatLag) {
      return;
    }
    const now = performance.now();
    if (!force && now - lastLagUpdateAt < LAG_UPDATE_INTERVAL_MS) {
      return;
    }
    lastLagUpdateAt = now;
    const displayedLagMs = Math.max(0, smoothedComputeLagMs);
    stageLagIndicator.dataset.level = lagLevel(displayedLagMs);
    mainStatLag.textContent = `${formatNumber(displayedLagMs, displayedLagMs >= 10 ? 0 : 1)} ms`;
    stageLagIndicator.setAttribute(
      "title",
      `${t(locale, "app.computeLagTitle")} · ${formatNumber(smoothedFrameCostMs, 1)} ms`
    );
  }

  function renderLegend() {
    legendList.innerHTML = "";
    for (const gadget of gadgetEntries(config)) {
      const label = translateConfigText(locale, gadget.label);
      const roleLabel = t(locale, `common.gadgetRole.${gadget.role}`);
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-swatch" style="background:${gadget.color};"></span>
        <strong>${label}</strong>
        <span>${roleLabel}</span>
      `;
      legendList.appendChild(item);
    }
  }

  function resetSimulation(reason = "manual") {
    debugState.resetCount += 1;
    debugState.lastResetReason = reason;
    const previousSimulation = simulation;
    baseConfig = loadConfig();
    config = buildSimulationConfig(baseConfig, useUltrawideWorld);
    simulation = new Simulation(config);
    preserveTerrainAcrossSimulationReset(previousSimulation, simulation, config);
    simulation.fastMode = fastMode;
    hoverWorldPoint = null;
    hoveredOrganismId = null;
    selectedOrganismId = null;
    selectedLineageId = null;
    designerDeployArmed = false;
    cachedDominantLineages = [];
    cachedPhylogenyLineages = [];
    cachedLineageSamples.clear();
    terrainTextureCache = { version: -1, canvas: null };
    lastLineageUpdateAt = -Infinity;
    clearHeldInteractionCommands();
    mountainArmed = false;
    syncQuickPopulationInput();
    syncQuickTotalMaterialInput();
    syncPhylogenyToggle();
    syncDesignerDeployToggle();
    syncAudioMixControls();
    renderLegend();
    resizeCanvas();
    updateStats(true);
    renderDesignerPreview();
    draw(true);
    updateDebugHandle();
    if (reason === "storage") {
      showStatus(t(locale, "app.status.configUpdated"));
      window.setTimeout(() => {
        showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
      }, 1800);
    }
  }

  function syncPauseLabel() {
    toggleButton.textContent = paused ? t(locale, "app.resume") : t(locale, "app.pause");
    toggleButton.title = paused
      ? `${t(locale, "app.resume")} (Space)`
      : `${t(locale, "app.pause")} (Space)`;
  }

  function setSpeed(nextSpeed) {
    const referenceInput = quickSpeedInput ?? speedInput;
    const min = Number(referenceInput.min);
    const max = Number(referenceInput.max);
    const step = Number(referenceInput.step) || 0.25;
    const clamped = Math.max(min, Math.min(max, nextSpeed));
    const snapped = Math.round(clamped / step) * step;
    speedScale = Number(snapped.toFixed(2));
    speedInput.value = String(speedScale);
    speedLabel.textContent = `${speedScale.toFixed(2)}x`;
    if (quickSpeedInput) {
      quickSpeedInput.value = String(speedScale);
    }
    if (quickSpeedLabel) {
      quickSpeedLabel.textContent = `${speedScale.toFixed(2)}x`;
    }
  }

  function setAudioVolume(nextVolume, options = {}) {
    const { persist = true } = options;
    const min = Number(quickAudioVolumeInput?.min ?? 0);
    const max = Number(quickAudioVolumeInput?.max ?? 1);
    const step = Number(quickAudioVolumeInput?.step ?? 0.05) || 0.05;
    const clamped = Math.max(min, Math.min(max, Number(nextVolume) || 0));
    const snapped = Math.round(clamped / step) * step;
    audioVolume = Number(snapped.toFixed(2));
    if (persist) {
      audioVolume = saveAudioVolume(audioVolume);
    }
    audioDirector.setVolume(audioVolume);
    syncAudioVolume();
  }

  function setAudioBgmVolume(nextVolume, options = {}) {
    const { persist = true } = options;
    const min = Number(bgmVolumeInput?.min ?? 0);
    const max = Number(bgmVolumeInput?.max ?? 1);
    const step = Number(bgmVolumeInput?.step ?? 0.05) || 0.05;
    const clamped = Math.max(min, Math.min(max, Number(nextVolume) || 0));
    const snapped = Math.round(clamped / step) * step;
    audioBgmVolume = Number(snapped.toFixed(2));
    if (persist) {
      audioBgmVolume = saveAudioBgmVolume(audioBgmVolume);
    }
    audioDirector.setBgmVolume(audioBgmVolume);
    syncAudioMixControls();
  }

  function setAudioSfxVolume(nextVolume, options = {}) {
    const { persist = true } = options;
    const min = Number(sfxVolumeInput?.min ?? 0);
    const max = Number(sfxVolumeInput?.max ?? 1);
    const step = Number(sfxVolumeInput?.step ?? 0.05) || 0.05;
    const clamped = Math.max(min, Math.min(max, Number(nextVolume) || 0));
    const snapped = Math.round(clamped / step) * step;
    audioSfxVolume = Number(snapped.toFixed(2));
    if (persist) {
      audioSfxVolume = saveAudioSfxVolume(audioSfxVolume);
    }
    audioDirector.setSfxVolume(audioSfxVolume);
    syncAudioMixControls();
  }

  async function exportSnapshotImage() {
    draw(true);
    const filename = `genericalgoid-${exportTimestamp()}.png`;
    try {
      const blob = await canvasToBlob(canvas, "image/png");
      if (!blob) {
        throw new Error("snapshot-blob-empty");
      }
      downloadBlob(blob, filename);
      showStatus(t(locale, "app.status.exportSnapshotSaved", { name: filename }));
    } catch {
      showStatus(t(locale, "app.status.exportSnapshotFailed"), "alert");
    }
  }

  function finalizeVideoExport(chunks, mimeType, filename) {
    if (!chunks.length) {
      showStatus(t(locale, "app.status.exportVideoFailed"), "alert");
      return;
    }
    const blob = new Blob(chunks, {
      type: mimeType || "video/webm"
    });
    if (!(blob.size > 0)) {
      showStatus(t(locale, "app.status.exportVideoFailed"), "alert");
      return;
    }
    downloadBlob(blob, filename);
    showStatus(t(locale, "app.status.exportVideoSaved", { name: filename }));
  }

  function exportWorldVideo() {
    if (exportRecordingState) {
      showStatus(t(locale, "app.status.exportVideoBusy"), "alert");
      return;
    }
    if (
      typeof MediaRecorder === "undefined" ||
      typeof canvas.captureStream !== "function"
    ) {
      showStatus(t(locale, "app.status.exportVideoUnsupported"), "alert");
      return;
    }

    draw(true);
    const recordingSeconds = 5;
    const filename = `genericalgoid-${exportTimestamp()}.webm`;
    const stream = canvas.captureStream(30);
    const mimeType = pickRecordingMimeType();
    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      showStatus(t(locale, "app.status.exportVideoUnsupported"), "alert");
      return;
    }

    const chunks = [];
    exportRecordingState = {
      filename,
      recorder
    };
    syncExportControls();
    showStatus(
      t(locale, "app.status.exportVideoStarting", { seconds: recordingSeconds })
    );

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      exportRecordingState = null;
      syncExportControls();
      showStatus(t(locale, "app.status.exportVideoFailed"), "alert");
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const recordedMimeType = recorder.mimeType || mimeType;
      exportRecordingState = null;
      syncExportControls();
      finalizeVideoExport(chunks, recordedMimeType, filename);
    };

    recorder.start(200);
    window.setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, recordingSeconds * 1000);
  }

  function setFastMode(nextFastMode, options = {}) {
    const { persist = true, notify = true } = options;
    fastMode = Boolean(nextFastMode);
    if (persist) {
      fastMode = saveFastMode(fastMode);
    }
    simulation.fastMode = fastMode;
    audioDirector.setBgmEnabled(audioBgmEnabled && !fastMode);
    audioDirector.setSfxEnabled(audioSfxEnabled && !fastMode);
    audioDirector.setBgmVolume(audioBgmVolume);
    audioDirector.setSfxVolume(audioSfxVolume);
    hoveredOrganismId = null;
    hoverWorldPoint = null;
    if (fastMode) {
      selectedOrganismId = null;
      pointerDragState = null;
    }
    lastUiUpdateAt = 0;
    lastLineageUpdateAt = -Infinity;
    lastDrawAt = 0;
    syncFastModeToggle();
    syncAudioMixControls();
    if (notify) {
      showStatus(t(locale, fastMode ? "app.status.fastOn" : "app.status.fastOff"));
      restoreRunningStatus(1200);
    }
    updateStats(true);
    draw(true);
  }

  function syncQuickPopulationInput() {
    if (!quickPopulationInput) {
      return;
    }
    quickPopulationInput.value = String(baseConfig.world.initialOrganisms);
  }

  function syncQuickTotalMaterialInput(value = config.world.totalMaterial) {
    if (!quickTotalMaterialInput) {
      return;
    }
    quickTotalMaterialInput.value = String(Math.round(value));
  }

  function setInitialOrganisms(nextCount) {
    const min = Number(quickPopulationInput?.min ?? 6);
    const max = Number(quickPopulationInput?.max ?? 500);
    const normalized = Math.max(min, Math.min(max, Math.round(nextCount)));
    baseConfig = saveConfig({
      ...baseConfig,
      world: {
        ...baseConfig.world,
        initialOrganisms: normalized
      }
    });
    syncQuickPopulationInput();
    resetSimulation("storage");
  }

  function setTotalMaterial(nextTotalMaterial) {
    const min = Number(quickTotalMaterialInput?.min ?? 800);
    const max = Number(quickTotalMaterialInput?.max ?? 60000);
    const step = Number(quickTotalMaterialInput?.step ?? 10) || 10;
    const clamped = Math.max(min, Math.min(max, nextTotalMaterial));
    const normalized = Math.round(clamped / step) * step;
    baseConfig = saveConfig({
      ...baseConfig,
      world: {
        ...baseConfig.world,
        totalMaterial: normalized
      }
    });
    syncQuickPopulationInput();
    syncQuickTotalMaterialInput(baseConfig.world.totalMaterial);
    resetSimulation("storage");
  }

  function spawnDesignedOrganismAt(worldPoint) {
    if (!worldPoint) {
      return null;
    }

    const draft = readDesignerDraft();
    const genome = currentDesignerGenome();
    const requestedMass = Math.max(
      config.organisms.minViableMass + 1,
      Number(draft.initialMass) || config.world.initialOrganismMass
    );
    const maxBudget = Number(quickTotalMaterialInput?.max ?? 60000);
    const remainingBudget = Math.max(0, maxBudget - simulation.config.world.totalMaterial);
    const spawnMass = Math.min(requestedMass, remainingBudget);
    if (spawnMass <= 0) {
      showStatus(t(locale, "app.status.materialCap"), "alert");
      restoreRunningStatus(1200);
      return null;
    }

    const result = simulation.spawnDesignedOrganism(worldPoint.x, worldPoint.y, draft, {
      genome,
      mass: spawnMass,
      lineageName: draft.lineageName
    });
    config.world.totalMaterial = simulation.config.world.totalMaterial;
    syncQuickTotalMaterialInput(config.world.totalMaterial);
    showStatus(
      t(locale, "app.status.designerSpawned", {
        name: result.lineageName,
        mass: formatNumber(result.mass, 0)
      })
    );
    audioDirector.playDeploy();
    restoreRunningStatus(1200);
    updateStats(true);
    draw(true);
    return result;
  }

  function manualResourceStepMass() {
    return Math.max(2, config.economy.debrisUnitMass);
  }

  function springBudgetCap() {
    return Number(quickTotalMaterialInput?.value ?? config.world.totalMaterial);
  }

  function manualResourceSpacing() {
    return Math.max(10, Math.sqrt(manualResourceStepMass()) * 3.6);
  }

  function mountainBrushRadius() {
    return Math.max(
      18,
      (Number(config.terrain?.radiusMin ?? 0) + Number(config.terrain?.radiusMax ?? 0)) *
        MOUNTAIN_BRUSH_RADIUS_FACTOR
    );
  }

  function mountainBrushSpacing() {
    return Math.max(12, mountainBrushRadius() * MOUNTAIN_BRUSH_SPACING_FACTOR);
  }

  function holdMountainStrength(elapsedMs) {
    return clampNumber(
      (Math.max(0, elapsedMs) / 1000) * MOUNTAIN_BRUSH_HOLD_STRENGTH_PER_SECOND,
      MOUNTAIN_BRUSH_HOLD_STRENGTH_MIN,
      MOUNTAIN_BRUSH_HOLD_STRENGTH_MAX
    );
  }

  function raiseMountainAt(worldPoint, options = {}) {
    const {
      strength = MOUNTAIN_BRUSH_INITIAL_STRENGTH,
      silent = false,
      playAudio = !silent,
      redraw = !silent
    } = options;
    if (Number(config.terrain?.enabled ?? 0) < 0.5) {
      if (!silent) {
        showStatus(t(locale, "app.status.mountainDisabled"), "alert");
        restoreRunningStatus(1200);
      }
      return false;
    }
    const wrappedPoint = wrapWorldPoint(worldPoint, config.world);
    if (!wrappedPoint) {
      return false;
    }
    const raised = simulation.raiseTerrain(wrappedPoint.x, wrappedPoint.y, {
      radius: mountainBrushRadius(),
      strength
    });
    if (!raised) {
      return false;
    }
    terrainTextureCache = { version: -1, canvas: null };
    if (!silent) {
      showStatus(t(locale, "app.status.mountainRaised"));
      restoreRunningStatus(900);
    }
    if (playAudio) {
      audioDirector.playUiToggle(true);
    }
    if (redraw) {
      draw(true);
    }
    return true;
  }

  function sculptMountainToward(targetPoint, now, options = {}) {
    const { forceTail = false } = options;
    if (!pointerDragState || pointerDragState.mode !== "mountain-sculpt" || !targetPoint) {
      return false;
    }

    const nextPoint = wrapWorldPoint(targetPoint, config.world);
    const fromPoint = pointerDragState.lastRaisedPoint ?? nextPoint;
    const dx = torusDelta(fromPoint.x, nextPoint.x, config.world.width);
    const dy = torusDelta(fromPoint.y, nextPoint.y, config.world.height);
    const distance = Math.hypot(dx, dy);
    const spacing = mountainBrushSpacing();
    const elapsedMs = Math.max(0, now - pointerDragState.lastRaisedAt);
    pointerDragState.currentPoint = nextPoint;

    let applied = false;
    if (distance >= spacing) {
      const steps = Math.max(1, Math.floor(distance / spacing));
      for (let step = 1; step <= steps; step += 1) {
        const t = Math.min(1, (spacing * step) / distance);
        const point = wrapWorldPoint({
          x: fromPoint.x + dx * t,
          y: fromPoint.y + dy * t
        }, config.world);
        if (
          raiseMountainAt(point, {
            strength: MOUNTAIN_BRUSH_TRAIL_STRENGTH,
            silent: true,
            playAudio: false,
            redraw: false
          })
        ) {
          pointerDragState.totalRaised += MOUNTAIN_BRUSH_TRAIL_STRENGTH;
          pointerDragState.raisedDabs += 1;
          pointerDragState.lastRaisedPoint = point;
          applied = true;
        }
      }
    } else if (elapsedMs >= MOUNTAIN_BRUSH_INTERVAL_MS || forceTail) {
      const strength = forceTail
        ? Math.max(MOUNTAIN_BRUSH_HOLD_STRENGTH_MIN, holdMountainStrength(elapsedMs) * 0.82)
        : holdMountainStrength(elapsedMs);
      if (
        raiseMountainAt(nextPoint, {
          strength,
          silent: true,
          playAudio: false,
          redraw: false
        })
      ) {
        pointerDragState.totalRaised += strength;
        pointerDragState.raisedDabs += 1;
        pointerDragState.lastRaisedPoint = nextPoint;
        applied = true;
      }
    }

    if (applied) {
      pointerDragState.lastRaisedAt = now;
    }
    return applied;
  }

  function beginMountainSculpt(worldPoint, pointerId) {
    if (Number(config.terrain?.enabled ?? 0) < 0.5) {
      showStatus(t(locale, "app.status.mountainDisabled"), "alert");
      restoreRunningStatus(1200);
      return false;
    }
    const wrappedPoint = wrapWorldPoint(worldPoint, config.world);
    const now = performance.now();
    const initialRaised = raiseMountainAt(wrappedPoint, {
      strength: MOUNTAIN_BRUSH_INITIAL_STRENGTH,
      silent: true,
      playAudio: false,
      redraw: false
    });
    pointerDragState = {
      pointerId,
      mode: "mountain-sculpt",
      currentPoint: wrappedPoint,
      lastRaisedPoint: wrappedPoint,
      lastRaisedAt: now,
      totalRaised: initialRaised ? MOUNTAIN_BRUSH_INITIAL_STRENGTH : 0,
      raisedDabs: initialRaised ? 1 : 0
    };
    return true;
  }

  function strikeLightningBurst(centerPoint, radius) {
    if (!centerPoint || !Number.isFinite(radius) || radius <= 0) {
      return { removedMass: 0, count: 0, springsRemoved: 0, terrainChanged: false };
    }

    const hitIds = [];
    const hitSpringIds = [];

    for (const organism of simulation.organisms) {
      const offset = torusOffset(centerPoint, organism);
      const hitRadius = radius + organismRadius(organism, config) * 0.58;
      if (offset.dx * offset.dx + offset.dy * offset.dy <= hitRadius * hitRadius) {
        hitIds.push(organism.id);
      }
    }

    for (const spring of simulation.springs) {
      const offset = torusOffset(centerPoint, spring);
      const hitRadius = radius + spring.radius * 1.05;
      if (offset.dx * offset.dx + offset.dy * offset.dy <= hitRadius * hitRadius) {
        hitSpringIds.push(spring.id);
      }
    }

    const terrainEroded =
      Number(config.terrain?.enabled ?? 0) >= 0.5 &&
      simulation.erodeTerrain(centerPoint.x, centerPoint.y, {
        radius: radius * 1.16,
        strength: clampNumber(0.08 + radius / 220, 0.1, 0.28)
      });

    if (hitIds.length === 0 && hitSpringIds.length === 0 && !terrainEroded) {
      return { removedMass: 0, count: 0, springsRemoved: 0, terrainChanged: false };
    }

    const result =
      hitIds.length > 0
        ? simulation.vaporizeOrganisms(hitIds)
        : { removedMass: 0, count: 0 };
    let springsRemoved = 0;
    if (hitSpringIds.length > 0) {
      const hitSet = new Set(hitSpringIds);
      const before = simulation.springs.length;
      simulation.springs = simulation.springs.filter((spring) => !hitSet.has(spring.id));
      springsRemoved = before - simulation.springs.length;
    }
    if (result.count > 0) {
      config.world.totalMaterial = simulation.config.world.totalMaterial;
      syncQuickTotalMaterialInput(config.world.totalMaterial);
    }
    if (terrainEroded) {
      terrainTextureCache = { version: -1, canvas: null };
    }
    return {
      removedMass: result.removedMass,
      count: result.count,
      springsRemoved,
      terrainChanged: terrainEroded
    };
  }

  function restoreRunningStatus(delay = 900) {
    window.setTimeout(() => {
      showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
    }, delay);
  }

  async function primeAudioIfNeeded() {
    if (!anyAudioEnabled() || fastMode) {
      return false;
    }
    return audioDirector.prime();
  }

  function maybePlayFeedingSound(addedMass) {
    if (!(addedMass > 0) || !audioSfxEnabled || fastMode) {
      return;
    }
    const now = performance.now();
    if (now - lastFeedSoundAt < 90) {
      return;
    }
    lastFeedSoundAt = now;
    audioDirector.playFeeding(addedMass);
  }

  function placeManualResource(worldPoint, options = {}) {
    if (!worldPoint) {
      return { addedMass: 0, capReached: false };
    }
    const {
      adjustBudget = true,
      mergeResources = true,
      rebuildIndex = true,
      silent = false
    } = options;
    const perClickMass = manualResourceStepMass();
    const maxBudget = Number(quickTotalMaterialInput?.max ?? 60000);
    const remainingBudget = Math.max(0, maxBudget - simulation.config.world.totalMaterial);
    const placementMass = Math.min(perClickMass, remainingBudget);
    if (placementMass <= 0) {
      if (!silent) {
        showStatus(t(locale, "app.status.materialCap"), "alert");
        restoreRunningStatus(1200);
      }
      return { addedMass: 0, capReached: true };
    }
    const addedMass = simulation.injectResource(worldPoint.x, worldPoint.y, placementMass, {
      adjustBudget,
      mergeResources,
      rebuildIndex
    });
    if (addedMass <= 0) {
      return { addedMass: 0, capReached: false };
    }
    config.world.totalMaterial = simulation.config.world.totalMaterial;
    syncQuickTotalMaterialInput(config.world.totalMaterial);
    maybePlayFeedingSound(addedMass);
    if (!silent) {
      showStatus(
        t(locale, "app.status.dropped", {
          mass: formatNumber(addedMass, 0)
        })
      );
      restoreRunningStatus();
    }
    return { addedMass, capReached: false };
  }

  function placeManualResourceTrail(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) {
      return { totalAdded: 0, lastPlacedPoint: fromPoint ?? toPoint ?? null, capReached: false };
    }

    const stepDistance = manualResourceSpacing();
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const distance = Math.hypot(dx, dy);
    if (distance < stepDistance) {
      return { totalAdded: 0, lastPlacedPoint: fromPoint, capReached: false };
    }

    let totalAdded = 0;
    let capReached = false;
    let lastPlacedPoint = fromPoint;
    const steps = Math.floor(distance / stepDistance);

    for (let step = 1; step <= steps; step += 1) {
      const t = (stepDistance * step) / distance;
      const point = {
        x: fromPoint.x + dx * t,
        y: fromPoint.y + dy * t
      };
      const result = placeManualResource(point, {
        mergeResources: false,
        rebuildIndex: false,
        silent: true
      });
      totalAdded += result.addedMass;
      if (result.addedMass > 0) {
        lastPlacedPoint = point;
      }
      if (result.capReached) {
        capReached = true;
        break;
      }
    }

    if (totalAdded > 0) {
      simulation.finalizeResourceInjection();
      config.world.totalMaterial = simulation.config.world.totalMaterial;
      syncQuickTotalMaterialInput(config.world.totalMaterial);
    }

    return { totalAdded, lastPlacedPoint, capReached };
  }

  function worldPointFromPointerEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    const localX = (canvasX - viewport.offsetX) / viewport.scale;
    const localY = (canvasY - viewport.offsetY) / viewport.scale;

    if (
      localX < 0 ||
      localY < 0 ||
      localX > config.world.width ||
      localY > config.world.height
    ) {
      return null;
    }

    return { x: localX, y: localY };
  }

  function finishPointerDrag() {
    if (!pointerDragState) {
      return;
    }
    if (pointerDragState.mode === "lightning-charge") {
      const radius = currentLightningChargeRadius(pointerDragState.chargeStartedAt);
      const result = strikeLightningBurst(pointerDragState.centerPoint, radius);
      if (result.removedMass > 0 && result.springsRemoved > 0) {
        audioDirector.playLightning(radius);
        showStatus(
          t(locale, "app.status.lightningMixed", {
            kills: result.count,
            springs: result.springsRemoved,
            mass: formatNumber(result.removedMass, 0)
          })
        );
        restoreRunningStatus(1200);
      } else if (result.removedMass > 0) {
        audioDirector.playLightning(radius);
        showStatus(
          t(locale, "app.status.lightning", {
            kills: result.count,
            mass: formatNumber(result.removedMass, 0)
          })
        );
        restoreRunningStatus(1200);
      } else if (result.springsRemoved > 0) {
        audioDirector.playLightning(radius * 0.82);
        showStatus(
          t(locale, "app.status.lightningSpring", {
            springs: result.springsRemoved
          })
        );
        restoreRunningStatus(1200);
      } else if (result.terrainChanged) {
        audioDirector.playLightning(radius * 0.72);
        showStatus(t(locale, "app.status.lightningTerrain"));
        restoreRunningStatus(1200);
      } else {
        restoreRunningStatus(180);
      }
    } else if (pointerDragState.mode === "mountain-sculpt") {
      if (pointerDragState.raisedDabs > 0) {
        showStatus(t(locale, "app.status.mountainRaised"));
        audioDirector.playUiToggle(true);
        restoreRunningStatus(900);
      } else {
        restoreRunningStatus(180);
      }
      draw(true);
    } else if (pointerDragState.totalAdded > 0) {
      showStatus(
        t(locale, "app.status.dropped", {
          mass: formatNumber(pointerDragState.totalAdded, 0)
        })
      );
      restoreRunningStatus();
    } else if (pointerDragState.capReached) {
      showStatus(t(locale, "app.status.materialCap"), "alert");
      restoreRunningStatus(1200);
    }
    updateStats(true);
    pointerDragState = null;
  }

  function placeSpring(worldPoint) {
    if (!worldPoint) {
      return null;
    }

    const spring = simulation.addSpring(worldPoint.x, worldPoint.y, {
      budgetCap: springBudgetCap()
    });
    if (!spring) {
      showStatus(t(locale, "app.status.springCap"), "alert");
      restoreRunningStatus(1200);
      return null;
    }

    showStatus(t(locale, "app.status.springPlaced"));
    audioDirector.playSpringPlaced();
    restoreRunningStatus();
    updateStats(true);
    draw(true);
    return spring;
  }

  function removeSpring(spring) {
    if (!spring) {
      return false;
    }

    const removed = simulation.removeSpring(spring.id);
    if (!removed) {
      return false;
    }

    showStatus(t(locale, "app.status.springRemoved"));
    audioDirector.playSpringRemoved();
    restoreRunningStatus();
    updateStats(true);
    draw();
    return true;
  }

  function togglePause() {
    paused = !paused;
    syncPauseLabel();
    showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
    audioDirector.playUiToggle(!paused);
  }

  function isEditableTarget(target) {
    return (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    );
  }

  function shouldIgnoreForComposition(event) {
    return event.isComposing && isEditableTarget(event.target);
  }

  function shortcutActionFromEvent(event) {
    const code = event.code;
    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

    if (code === "Escape" || key === "escape") {
      return "close-menu";
    }
    if (code === "Space" || key === " " || key === "space" || key === "spacebar") {
      return "toggle-pause";
    }
    if (code === "KeyM" || key === "m") {
      return "toggle-menu";
    }
    if (code === "KeyR" || key === "r") {
      return "reset";
    }
    if (code === "KeyF" || key === "f") {
      return "fullscreen";
    }
    if (code === "KeyD" || key === "d") {
      return "developer";
    }
    if (
      code === "BracketLeft" ||
      code === "Minus" ||
      code === "NumpadSubtract" ||
      key === "[" ||
      key === "{" ||
      key === "-" ||
      key === "_"
    ) {
      return "speed-down";
    }
    if (
      code === "BracketRight" ||
      code === "Equal" ||
      code === "NumpadAdd" ||
      key === "]" ||
      key === "}" ||
      key === "=" ||
      key === "+"
    ) {
      return "speed-up";
    }

    return null;
  }

  function triggerReset() {
    resetSimulation("manual");
    showStatus(t(locale, "app.status.worldReseeded"));
    audioDirector.playUiToggle(true);
    window.setTimeout(() => {
      showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
    }, 1200);
  }

  function performCommandPanelAction(action) {
    if (!action) {
      return;
    }
    if (action === "menu") {
      setMenuOpen(!menuOpen);
      audioDirector.playUiToggle(menuOpen === false);
      return;
    }
    if (action === "run") {
      togglePause();
      return;
    }
    if (action === "reset") {
      triggerReset();
      return;
    }
    if (action === "fullscreen") {
      void toggleFullscreenMode("command-panel");
      return;
    }
    if (action === "developer") {
      window.location.href = "./dev.html";
    }
  }

  toggleButton.addEventListener("click", () => {
    togglePause();
  });

  resetButton.addEventListener("click", () => {
    triggerReset();
  });

  exportSnapshotButton?.addEventListener("click", () => {
    void exportSnapshotImage();
  });

  exportVideoButton?.addEventListener("click", () => {
    exportWorldVideo();
  });

  speedInput.addEventListener("input", () => {
    setSpeed(Number(speedInput.value));
  });

  quickSpeedInput?.addEventListener("input", () => {
    setSpeed(Number(quickSpeedInput.value));
  });

  quickPopulationInput?.addEventListener("change", () => {
    setInitialOrganisms(Number(quickPopulationInput.value));
  });

  quickTotalMaterialInput?.addEventListener("change", () => {
    setTotalMaterial(Number(quickTotalMaterialInput.value));
  });

  quickAudioVolumeInput?.addEventListener("input", () => {
    setAudioVolume(Number(quickAudioVolumeInput.value));
  });

  bgmVolumeInput?.addEventListener("input", () => {
    setAudioBgmVolume(Number(bgmVolumeInput.value));
  });

  sfxVolumeInput?.addEventListener("input", () => {
    setAudioSfxVolume(Number(sfxVolumeInput.value));
  });

  const designerReactiveInputs = [
    designerNameInput,
    designerMassInput,
    designerSlotCountInput,
    designerCoreShareInput,
    designerMotorShareInput,
    designerGadgetShareInput,
    designerSensorInput,
    designerCooperationInput,
    designerLifeInput,
    designerBirthThresholdInput,
    designerBudFractionInput,
    designerApproachRatioInput,
    designerAvoidRatioInput,
    designerShapeLobesInput,
    designerShapeAmplitudeInput,
    designerShapeWobbleInput,
    designerShapeSquishInput,
    ...designerSlotInputs
  ];

  for (const input of designerReactiveInputs) {
    input?.addEventListener("input", () => {
      syncDesignerSlotInputs();
      renderDesignerPreview();
    });
    input?.addEventListener("change", () => {
      syncDesignerSlotInputs();
      renderDesignerPreview();
    });
  }

  designerRandomizeButton?.addEventListener("click", () => {
    writeDesignerDraft(buildDesignerDraftFromGenome(createRandomGenome(config)));
    syncDesignerSlotInputs();
    renderDesignerPreview();
  });

  designerDeployToggleButton?.addEventListener("click", () => {
    mountainArmed = false;
    designerDeployArmed = !designerDeployArmed;
    syncDesignerDeployToggle();
    showStatus(t(locale, designerDeployArmed ? "app.status.designerArmed" : "app.status.designerDisarmed"));
    audioDirector.playUiToggle(designerDeployArmed);
    restoreRunningStatus(1100);
  });

  phylogenyToggle?.addEventListener("change", () => {
    phylogenyEnabled = savePhylogenyEnabled(Boolean(phylogenyToggle.checked));
    if (!phylogenyEnabled) {
      cachedPhylogenyLineages = [];
    }
    syncPhylogenyToggle();
    updateStats(true);
  });

  bgmToggle?.addEventListener("change", async () => {
    audioBgmEnabled = saveAudioBgmEnabled(Boolean(bgmToggle.checked));
    audioDirector.setBgmEnabled(audioBgmEnabled && !fastMode);
    syncAudioToggles();
    if (audioBgmEnabled) {
      const started = await primeAudioIfNeeded();
      showStatus(
        t(locale, started ? "app.status.audioBgmOn" : "app.status.audioAwaitGesture")
      );
    } else {
      showStatus(t(locale, "app.status.audioBgmOff"));
    }
    restoreRunningStatus(1300);
  });

  sfxToggle?.addEventListener("change", async () => {
    audioSfxEnabled = saveAudioSfxEnabled(Boolean(sfxToggle.checked));
    audioDirector.setSfxEnabled(audioSfxEnabled && !fastMode);
    syncAudioToggles();
    if (audioSfxEnabled) {
      const started = await primeAudioIfNeeded();
      showStatus(
        t(locale, started ? "app.status.audioSfxOn" : "app.status.audioAwaitGesture")
      );
    } else {
      showStatus(t(locale, "app.status.audioSfxOff"));
    }
    restoreRunningStatus(1300);
  });

  modeToggleButton?.addEventListener("click", () => {
    setFastMode(!fastMode);
  });

  localeToggleButton?.addEventListener("click", () => {
    locale = saveLocale(locale === "ja" ? "en" : "ja");
    applyLocale();
  });

  menuToggleButton?.addEventListener("click", () => {
    setMenuOpen(!menuOpen);
  });

  closeMenuButton?.addEventListener("click", () => {
    setMenuOpen(false);
  });

  menuBackdrop?.addEventListener("click", () => {
    setMenuOpen(false);
  });

  async function toggleFullscreenMode(source = "button") {
    recordCommandTrace("fullscreen-toggle", { source });
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      syncDisplayMode(true);
      resizeCanvas();
      draw(true);
    } catch (error) {
      console.warn("Fullscreen toggle failed.", error);
      showStatus(t(locale, "app.status.fullscreenUnavailable"), "alert");
      window.setTimeout(() => {
        showStatus(paused ? t(locale, "app.paused") : t(locale, "app.running"));
      }, 1400);
    }
  }

  fullscreenButton?.addEventListener("click", async () => {
    await toggleFullscreenMode("button");
  });

  canvas.addEventListener("pointerdown", (event) => {
    recordCommandTrace("canvas-pointerdown", {
      button: event.button,
      x: Number(event.clientX.toFixed(1)),
      y: Number(event.clientY.toFixed(1)),
      command: worldInteractionCommand()
    });
    if (event.button !== 0) {
      return;
    }
    if (fastMode) {
      showStatus(t(locale, "app.status.fastBlocked"), "alert");
      restoreRunningStatus(1100);
      return;
    }
    const worldPoint = worldPointFromPointerEvent(event);
    if (!worldPoint) {
      return;
    }
    hoverWorldPoint = worldPoint;
    const interactionCommand = worldInteractionCommand();
    if (interactionCommand === "lightning") {
      recordCommandTrace("command-armed", { command: "lightning" });
      pointerDragState = {
        pointerId: event.pointerId,
        mode: "lightning-charge",
        centerPoint: worldPoint,
        chargeStartedAt: performance.now(),
        branchSeeds: Array.from(
          { length: LOW_FIDELITY_RENDER ? 4 : 7 },
          () => Math.random()
        )
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (interactionCommand === "spring") {
      recordCommandTrace("command-armed", { command: "spring" });
      const clickedSpring = findSpringAt(worldPoint);
      if (clickedSpring) {
        removeSpring(clickedSpring);
        return;
      }
      const clickedOrganism = findOrganismAt(worldPoint);
      if (!clickedOrganism) {
        placeSpring(worldPoint);
      }
      return;
    }
    if (interactionCommand === "designer") {
      recordCommandTrace("command-armed", { command: "designer" });
      spawnDesignedOrganismAt(worldPoint);
      return;
    }
    if (interactionCommand === "mountain") {
      recordCommandTrace("command-armed", { command: "mountain" });
      if (!beginMountainSculpt(worldPoint, event.pointerId)) {
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (interactionCommand === "feed") {
      recordCommandTrace("command-armed", { command: "feed" });
      const initialDrop = placeManualResource(worldPoint, { silent: true });
      pointerDragState = {
        pointerId: event.pointerId,
        mode: "drop",
        lastPlacedPoint: worldPoint,
        totalAdded: initialDrop.addedMass,
        capReached: initialDrop.capReached
      };
      canvas.setPointerCapture(event.pointerId);
      updateStats();
      return;
    }
    const clicked = findOrganismAt(worldPoint);
    if (clicked) {
      recordCommandTrace("command-armed", { command: "select", organismId: clicked.id });
      selectedOrganismId = clicked.id;
      pointerDragState = {
        pointerId: event.pointerId,
        mode: "select",
        totalAdded: 0,
        capReached: false
      };
      canvas.setPointerCapture(event.pointerId);
      updateStats(true);
      return;
    }
    selectedOrganismId = null;
    updateStats(true);
    draw(true);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (fastMode) {
      hoverWorldPoint = null;
      hoveredOrganismId = null;
      return;
    }
    const worldPoint = worldPointFromPointerEvent(event);
    if (!worldPoint) {
      hoverWorldPoint = null;
      hoveredOrganismId = null;
      return;
    }
    hoverWorldPoint = worldPoint;

    if (
      pointerDragState &&
      pointerDragState.pointerId === event.pointerId &&
      pointerDragState.mode === "lightning-charge"
    ) {
      return;
    }

    if (
      pointerDragState &&
      pointerDragState.pointerId === event.pointerId &&
      pointerDragState.mode === "mountain-sculpt"
    ) {
      sculptMountainToward(worldPoint, performance.now());
      return;
    }

    if (
      pointerDragState &&
      pointerDragState.pointerId === event.pointerId &&
      pointerDragState.mode === "drop" &&
      !pointerDragState.capReached
    ) {
      const result = placeManualResourceTrail(pointerDragState.lastPlacedPoint, worldPoint);
      pointerDragState.totalAdded += result.totalAdded;
      pointerDragState.lastPlacedPoint = result.lastPlacedPoint;
      pointerDragState.capReached = result.capReached;
      if (result.totalAdded > 0 || result.capReached) {
        updateStats();
      }
    }
  });

  canvas.addEventListener("pointerleave", () => {
    hoverWorldPoint = null;
    hoveredOrganismId = null;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (fastMode) {
      return;
    }
    if (!pointerDragState || pointerDragState.pointerId !== event.pointerId) {
      return;
    }
    if (pointerDragState.mode === "drop") {
      const worldPoint = worldPointFromPointerEvent(event);
      if (worldPoint && !pointerDragState.capReached) {
        const stepDistance = manualResourceSpacing();
        const dx = worldPoint.x - pointerDragState.lastPlacedPoint.x;
        const dy = worldPoint.y - pointerDragState.lastPlacedPoint.y;
        const distance = Math.hypot(dx, dy);
        if (distance > stepDistance * 0.35) {
          const result = placeManualResource(worldPoint, { silent: true });
          pointerDragState.totalAdded += result.addedMass;
          pointerDragState.lastPlacedPoint = worldPoint;
          pointerDragState.capReached = result.capReached;
        }
      }
      finishPointerDrag();
    } else if (pointerDragState.mode === "mountain-sculpt") {
      const worldPoint = worldPointFromPointerEvent(event) ?? pointerDragState.currentPoint;
      if (worldPoint) {
        sculptMountainToward(worldPoint, performance.now(), { forceTail: true });
      }
      finishPointerDrag();
    } else if (pointerDragState.mode === "lightning-charge") {
      finishPointerDrag();
    } else {
      pointerDragState = null;
      updateStats(true);
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (fastMode) {
      pointerDragState = null;
      return;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    finishPointerDrag();
  });

  lineageList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const item = target.closest(".lineage-item");
    if (!(item instanceof HTMLElement)) {
      return;
    }
    const lineageId = Number(item.dataset.lineageId);
    if (!Number.isFinite(lineageId)) {
      return;
    }
    selectedLineageId = selectedLineageId === lineageId ? null : lineageId;
    audioDirector.playUiToggle(selectedLineageId !== null);
    renderLineages({ dominantLineages: cachedDominantLineages });
    draw(true);
  });

  commandsPanel?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const card = target.closest("[data-command-action]");
    if (!(card instanceof HTMLElement)) {
      return;
    }
    performCommandPanelAction(card.dataset.commandAction);
  });

  commandsPanel?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const card = target.closest("[data-command-action]");
    if (!(card instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    performCommandPanelAction(card.dataset.commandAction);
  });

  window.addEventListener("pointerdown", () => {
    void primeAudioIfNeeded();
  }, { capture: true });

  window.addEventListener("keydown", async (event) => {
    void primeAudioIfNeeded();
    const composingInEditable = shouldIgnoreForComposition(event);
    if (
      INTERACTION_COMMAND_CODES.has(event.code) &&
      !event.defaultPrevented &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !composingInEditable
    ) {
      pressedInteractionCodes.add(event.code);
      refreshHeldInteractionCommand();
      recordCommandTrace("key-down", {
        code: event.code,
        key: event.key,
        command: heldInteractionCommand
      });
    }
    if (
      event.defaultPrevented ||
      composingInEditable ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const action = shortcutActionFromEvent(event);
    if (!action) {
      return;
    }
    if (action !== "close-menu" && isEditableTarget(event.target)) {
      return;
    }

    if (action === "toggle-menu") {
      event.preventDefault();
      setMenuOpen(!menuOpen);
      return;
    }
    if (action === "close-menu") {
      if (menuOpen) {
        event.preventDefault();
        setMenuOpen(false);
      }
      return;
    }
    if (action === "toggle-pause") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (action === "reset") {
      event.preventDefault();
      triggerReset();
      return;
    }
    if (action === "fullscreen") {
      event.preventDefault();
      void toggleFullscreenMode("shortcut");
      return;
    }
    if (action === "speed-down") {
      event.preventDefault();
      setSpeed(speedScale - 0.25);
      return;
    }
    if (action === "speed-up") {
      event.preventDefault();
      setSpeed(speedScale + 0.25);
      return;
    }
    if (action === "developer") {
      event.preventDefault();
      window.location.href = "./dev.html";
    }
  });

  window.addEventListener("keyup", (event) => {
    if (!INTERACTION_COMMAND_CODES.has(event.code)) {
      return;
    }
    if (shouldIgnoreForComposition(event)) {
      return;
    }
    pressedInteractionCodes.delete(event.code);
    refreshHeldInteractionCommand();
    recordCommandTrace("key-up", {
      code: event.code,
      key: event.key,
      command: heldInteractionCommand
    });
  });

  window.addEventListener("blur", () => {
    clearHeldInteractionCommands();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("resize", () => {
    debugState.resizeCount += 1;
    syncDisplayMode();
    resizeCanvas();
    fitLineageListLayout();
    draw(true);
    updateDebugHandle();
  });
  document.addEventListener("fullscreenchange", () => {
    syncDisplayMode(true);
    resizeCanvas();
    draw(true);
    window.setTimeout(() => {
      syncDisplayMode();
      resizeCanvas();
      fitLineageListLayout();
      draw(true);
    }, 220);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === CONFIG_STORAGE_KEY) {
      resetSimulation("storage");
      return;
    }
    if (event.key === LOCALE_STORAGE_KEY) {
      locale = loadLocale();
      applyLocale();
      return;
    }
    if (event.key === PHYLOGENY_STORAGE_KEY) {
      phylogenyEnabled = loadPhylogenyEnabled();
      syncPhylogenyToggle();
      updateStats(true);
      return;
    }
    if (event.key === LEGACY_AUDIO_STORAGE_KEY) {
      audioBgmEnabled = loadAudioBgmEnabled();
      audioSfxEnabled = loadAudioSfxEnabled();
      audioDirector.setBgmEnabled(audioBgmEnabled && !fastMode);
      audioDirector.setSfxEnabled(audioSfxEnabled && !fastMode);
      syncAudioToggles();
      return;
    }
    if (event.key === AUDIO_BGM_STORAGE_KEY) {
      audioBgmEnabled = loadAudioBgmEnabled();
      audioDirector.setBgmEnabled(audioBgmEnabled && !fastMode);
      syncAudioToggles();
      return;
    }
    if (event.key === AUDIO_SFX_STORAGE_KEY) {
      audioSfxEnabled = loadAudioSfxEnabled();
      audioDirector.setSfxEnabled(audioSfxEnabled && !fastMode);
      syncAudioToggles();
      return;
    }
    if (event.key === AUDIO_VOLUME_STORAGE_KEY) {
      setAudioVolume(loadAudioVolume(), { persist: false });
      return;
    }
    if (event.key === AUDIO_BGM_VOLUME_STORAGE_KEY) {
      setAudioBgmVolume(loadAudioBgmVolume(), { persist: false });
      return;
    }
    if (event.key === AUDIO_SFX_VOLUME_STORAGE_KEY) {
      setAudioSfxVolume(loadAudioSfxVolume(), { persist: false });
      return;
    }
    if (event.key === FAST_MODE_STORAGE_KEY) {
      setFastMode(loadFastMode(), { persist: false, notify: false });
    }
  });

  function frame(now) {
    const deltaSeconds = (now - lastTime) / 1000;
    lastTime = now;
    const frameStartedAt = performance.now();

    if (!fastMode && pointerDragState?.mode === "mountain-sculpt") {
      sculptMountainToward(pointerDragState.currentPoint, now);
    }

    if (!paused) {
      simulation.step(deltaSeconds * speedScale);
    }

    if (!fastMode) {
      audioDirector.tick();
    }
    updateStats();
    draw();
    notePerformance(performance.now() - frameStartedAt);
    renderLagIndicator();
    window.requestAnimationFrame(frame);
  }

  document.body.classList.toggle("ultrawide-mode", useUltrawideWorld);
  setSpeed(speedScale);
  setAudioVolume(audioVolume, { persist: false });
  setAudioBgmVolume(audioBgmVolume, { persist: false });
  setAudioSfxVolume(audioSfxVolume, { persist: false });
  syncQuickPopulationInput();
  syncQuickTotalMaterialInput();
  setMenuOpen(false);
  writeDesignerDraft(buildDesignerDraftFromGenome(createRandomGenome(config)));
  syncDesignerSlotInputs();
  syncDesignerDeployToggle();
  resizeCanvas();
  applyLocale();
  renderLagIndicator(true);
  updateDebugHandle();
  window.requestAnimationFrame(frame);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", startApp);
}
