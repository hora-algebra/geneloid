export const CONFIG_STORAGE_KEY = "genericalgoid.config.v1";
export const SNAPSHOT_CHANNEL = "genericalgoid.snapshot";
export const minSlotCount = 3;
export const directionCount = 7;
export const gadgetOrder = ["melee", "ranged", "shield"];
export const speciesCount = Array.from(
  { length: directionCount - minSlotCount + 1 },
  (_, index) => gadgetOrder.length ** (index + minSlotCount)
).reduce((total, count) => total + count, 0);

export const defaultConfig = {
  world: {
    width: 3500,
    height: 2150,
    totalMaterial: 40000,
    initialOrganisms: 500,
    initialOrganismMass: 50,
    resourceNodeCap: 1800
  },
  organisms: {
    minViableCore: 2.2,
    minViableMass: 6,
    minBirthThresholdMass: 46,
    baseLifespan: 130,
    lifespanSpread: 0.2,
    baseTurnRate: 1.88,
    motorTurnFactor: 0.2,
    baseThrust: 14.3,
    motorThrustFactor: 1.4,
    dragPerSecond: 1.26,
    sensoryBase: 95,
    sensoryMassFactor: 7.9,
    resourceIntakeRate: 28,
    reproductionCooldown: 6.5,
    reproductionTax: 0.12,
    birthScatter: 12,
    sameSpeciesSpacing: 10
  },
  flocking: {
    neighborhoodFactor: 0.72,
    influenceScale: 1.15,
    alignmentWeight: 1.02,
    cohesionWeight: 1.36,
    separationWeight: 0.98,
    countInfluence: 0.13
  },
  economy: {
    upkeepBase: 0.08,
    upkeepMassFactor: 0.006,
    gadgetMaintenanceFactor: 0.0042,
    corpseLootFraction: 0.16,
    globalRespawnFraction: 0.08,
    debrisUnitMass: 10,
    corpseScatterRadius: 50,
    resourceLifetime: 14
  },
  springs: {
    initialCount: 4,
    packetMass: 1.6,
    interval: 0.36,
    scatter: 118,
    radius: 18,
    pauseNearbyMass: 68,
    maxCount: 22
  },
  terrain: {
    enabled: 1,
    peakCount: 8,
    radiusMin: 120,
    radiusMax: 250,
    slowdownStart: 0.41,
    dragBoost: 1.08,
    blockThreshold: 0.88,
    minTraversal: 0.46
  },
  combat: {
    attackScale: 0.27,
    defenseScale: 0.22,
    coreArmor: 0.08,
    impactBonus: 0.06,
    contactDamageRate: 0.66,
    rangedDamageScale: 0.79,
    shieldBlockFraction: 0.82,
    lootEfficiency: 0.8
  },
  mutation: {
    slotCountChance: 0.046,
    slotTypeChance: 0.088,
    allocationJitter: 0.31,
    traitJitter: 0.28,
    hueJitter: 10,
    speciationChance: 0.019,
    speciationDriftFactor: 0.43,
    speciesShiftSpeciationBonus: 0.25
  },
  render: {
    organismScale: 2.3,
    resourceScale: 1.35
  },
  gadgets: {
    melee: {
      label: "Melee",
      role: "attack",
      mode: "melee",
      attack: 1.12,
      defense: 0.16,
      steal: 0.1,
      upkeep: 1.32,
      color: "#ff8f6a"
    },
    ranged: {
      label: "Ranged",
      role: "attack",
      mode: "ranged",
      attack: 1.2,
      defense: 0.08,
      steal: 0.15,
      upkeep: 1.4,
      range: 238,
      cooldown: 0.99,
      color: "#79b5ff"
    },
    shield: {
      label: "Shield",
      role: "defense",
      mode: "shield",
      attack: 0,
      defense: 0.98,
      steal: 0,
      upkeep: 0.96,
      color: "#6ee7d2"
    }
  }
};

export const parameterGroups = [
  {
    key: "world",
    title: "World envelope",
    description:
      "Arena size and the closed material budget. Raising total material increases carrying capacity immediately.",
    fields: [
      {
        path: "world.width",
        label: "World width",
        min: 900,
        max: 6000,
        step: 10,
        help: "Logical width of the toroidal arena."
      },
      {
        path: "world.height",
        label: "World height",
        min: 600,
        max: 4000,
        step: 10,
        help: "Logical height of the toroidal arena."
      },
      {
        path: "world.totalMaterial",
        label: "Total material",
        min: 800,
        max: 60000,
        step: 10,
        help: "Mass conserved across cells and free debris."
      },
      {
        path: "world.initialOrganisms",
        label: "Initial organisms",
        min: 6,
        max: 500,
        step: 1,
        help: "Number of initial cells seeded into the world."
      },
      {
        path: "world.initialOrganismMass",
        label: "Initial organism mass",
        min: 10,
        max: 220,
        step: 1,
        help: "Average starting mass before the remaining material becomes debris."
      },
      {
        path: "world.resourceNodeCap",
        label: "Resource node cap",
        min: 20,
        max: 4000,
        step: 1,
        help: "Upper bound on how many debris packets can exist at once."
      }
    ]
  },
  {
    key: "organisms",
    title: "Locomotion and life cycle",
    description:
      "These parameters define viability, movement, sensing, intake rate, and the cost of budding offspring.",
    fields: [
      {
        path: "organisms.minViableCore",
        label: "Minimum viable core",
        min: 1,
        max: 8,
        step: 0.1,
        help: "Cells die once their core drops below this mass."
      },
      {
        path: "organisms.minViableMass",
        label: "Minimum viable mass",
        min: 2,
        max: 14,
        step: 0.1,
        help: "Absolute lower size limit for a living cell."
      },
      {
        path: "organisms.minBirthThresholdMass",
        label: "Minimum birth threshold",
        min: 8,
        max: 160,
        step: 1,
        help: "Hard lower bound for the inherited reproduction threshold mass."
      },
      {
        path: "organisms.baseLifespan",
        label: "Base lifespan",
        min: 20,
        max: 400,
        step: 1,
        help: "Reference lifetime in seconds before age death starts occurring."
      },
      {
        path: "organisms.lifespanSpread",
        label: "Lifespan spread",
        min: 0,
        max: 0.8,
        step: 0.01,
        help: "Random and mutational variation applied around the base lifespan."
      },
      {
        path: "organisms.baseTurnRate",
        label: "Base turn rate",
        min: 0.5,
        max: 5,
        step: 0.05,
        help: "Angular agility before motor mass is considered."
      },
      {
        path: "organisms.motorTurnFactor",
        label: "Motor turn factor",
        min: 0.01,
        max: 0.8,
        step: 0.01,
        help: "Extra turn speed granted by motor allocation."
      },
      {
        path: "organisms.baseThrust",
        label: "Base thrust",
        min: 2,
        max: 35,
        step: 0.5,
        help: "Forward acceleration available to every cell."
      },
      {
        path: "organisms.motorThrustFactor",
        label: "Motor thrust factor",
        min: 0.2,
        max: 3,
        step: 0.05,
        help: "How strongly motor mass scales acceleration."
      },
      {
        path: "organisms.dragPerSecond",
        label: "Drag per second",
        min: 0.2,
        max: 4,
        step: 0.05,
        help: "Higher values damp velocity faster."
      },
      {
        path: "organisms.sensoryBase",
        label: "Base sensing range",
        min: 20,
        max: 180,
        step: 1,
        help: "Minimum radius used to look for prey, threats, and debris."
      },
      {
        path: "organisms.sensoryMassFactor",
        label: "Sensing mass factor",
        min: 1,
        max: 20,
        step: 0.1,
        help: "Extra sensing range unlocked by body mass and genome traits."
      },
      {
        path: "organisms.resourceIntakeRate",
        label: "Debris intake rate",
        min: 2,
        max: 80,
        step: 0.5,
        help: "Maximum debris mass consumed per second while in contact."
      },
      {
        path: "organisms.reproductionCooldown",
        label: "Budding cooldown",
        min: 0,
        max: 20,
        step: 0.25,
        help: "Ignored in forced budding mode. Cells above threshold split immediately."
      },
      {
        path: "organisms.reproductionTax",
        label: "Budding tax",
        min: 0,
        max: 0.5,
        step: 0.01,
        help: "Fraction of the exported mass shed as debris during reproduction."
      },
      {
        path: "organisms.birthScatter",
        label: "Birth scatter",
        min: 4,
        max: 100,
        step: 1,
        help: "Distance between parent and child after budding."
      },
      {
        path: "organisms.sameSpeciesSpacing",
        label: "Same-species spacing",
        min: 0,
        max: 64,
        step: 1,
        help: "Extra body-edge clearance same-species cells try to preserve while schooling."
      }
    ]
  },
  {
    key: "flocking",
    title: "Flocking",
    description:
      "Local Boids-style weights for same-species grouping. These tune neighborhood size and the balance of alignment, cohesion, and separation.",
    fields: [
      {
        path: "flocking.neighborhoodFactor",
        label: "Neighborhood factor",
        min: 0.2,
        max: 1,
        step: 0.02,
        help: "Fraction of visual range used for same-species Boids interactions."
      },
      {
        path: "flocking.influenceScale",
        label: "Flock influence",
        min: 0.2,
        max: 2.5,
        step: 0.02,
        help: "Overall strength of Boids steering relative to chasing and wandering."
      },
      {
        path: "flocking.alignmentWeight",
        label: "Alignment weight",
        min: 0.2,
        max: 2.5,
        step: 0.02,
        help: "How strongly cells align their direction with nearby conspecifics."
      },
      {
        path: "flocking.cohesionWeight",
        label: "Cohesion weight",
        min: 0.2,
        max: 2.5,
        step: 0.02,
        help: "How strongly cells steer toward the local same-species center."
      },
      {
        path: "flocking.separationWeight",
        label: "Separation weight",
        min: 0.2,
        max: 2.5,
        step: 0.02,
        help: "How strongly cells push away when the flock gets too dense."
      },
      {
        path: "flocking.countInfluence",
        label: "Count influence",
        min: 0,
        max: 0.3,
        step: 0.01,
        help: "Extra Boids pull that appears as more same-species neighbors join the local school."
      }
    ]
  },
  {
    key: "economy",
    title: "Material economy",
    description:
      "Upkeep and combat spills stay local. Dead cells can shatter into nearby debris, with part of that debris recycled into random clustered patches elsewhere in the arena.",
    fields: [
      {
        path: "economy.upkeepBase",
        label: "Base upkeep",
        min: 0,
        max: 0.4,
        step: 0.005,
        help: "Mass every cell leaks each second before body size is counted."
      },
      {
        path: "economy.upkeepMassFactor",
        label: "Mass upkeep factor",
        min: 0,
        max: 0.03,
        step: 0.0005,
        help: "Extra upkeep per total body mass."
      },
      {
        path: "economy.gadgetMaintenanceFactor",
        label: "Gadget upkeep factor",
        min: 0,
        max: 0.03,
        step: 0.0005,
        help: "Heavy directional gadgets cost more to maintain."
      },
      {
        path: "economy.corpseLootFraction",
        label: "Corpse loot fraction",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Fraction of a dead cell looted by the last attacker before debris spills out."
      },
      {
        path: "economy.globalRespawnFraction",
        label: "Global respawn fraction",
        min: 0,
        max: 0.8,
        step: 0.01,
        help: "Fraction of dead-cell debris recycled into random clustered patches elsewhere in the arena."
      },
      {
        path: "economy.debrisUnitMass",
        label: "Debris unit mass",
        min: 2,
        max: 40,
        step: 0.5,
        help: "Reference chunk size used when shattered corpse material is split into many debris packets."
      },
      {
        path: "economy.corpseScatterRadius",
        label: "Corpse scatter radius",
        min: 8,
        max: 180,
        step: 1,
        help: "Radius used when a dead cell spills debris around its body."
      },
      {
        path: "economy.resourceLifetime",
        label: "Resource lifetime",
        min: 2,
        max: 180,
        step: 1,
        help: "Free material that is not collected for this many seconds evaporates from the world."
      }
    ]
  },
  {
    key: "springs",
    title: "Material springs",
    description:
      "User-placed springs drip new debris into the arena for sandbox experiments. They pause when enough free material has already piled up nearby, then resume after the area is eaten down again.",
    fields: [
      {
        path: "springs.initialCount",
        label: "Initial spring count",
        min: 0,
        max: 16,
        step: 1,
        help: "How many foothill-biased springs are seeded automatically when the world resets."
      },
      {
        path: "springs.packetMass",
        label: "Packet mass",
        min: 1,
        max: 20,
        step: 0.5,
        help: "Mass emitted by one spring pulse."
      },
      {
        path: "springs.interval",
        label: "Pulse interval",
        min: 0.08,
        max: 4,
        step: 0.02,
        help: "Seconds between spring emission pulses."
      },
      {
        path: "springs.scatter",
        label: "Scatter radius",
        min: 0,
        max: 220,
        step: 1,
        help: "How far a spring can toss each new debris packet from its center."
      },
      {
        path: "springs.radius",
        label: "Visual radius",
        min: 8,
        max: 42,
        step: 1,
        help: "Drawn size and click hit radius of a spring."
      },
      {
        path: "springs.pauseNearbyMass",
        label: "Pause nearby mass",
        min: 10,
        max: 400,
        step: 2,
        help: "If free mass inside a spring's local field exceeds this, the spring pauses until the area is eaten down again."
      },
      {
        path: "springs.maxCount",
        label: "Spring cap",
        min: 1,
        max: 48,
        step: 1,
        help: "Maximum number of springs that can exist at once."
      }
    ]
  },
  {
    key: "terrain",
    title: "Terrain drag",
    description:
      "Soft mountain fields that slow movement. High ridges become nearly impassable, so local basins and corridors can emerge inside the toroidal world.",
    fields: [
      {
        path: "terrain.enabled",
        label: "Terrain enabled",
        min: 0,
        max: 1,
        step: 1,
        help: "Set to 0 to disable terrain slowdown entirely."
      },
      {
        path: "terrain.peakCount",
        label: "Mountain count",
        min: 0,
        max: 18,
        step: 1,
        help: "Number of mountain seeds used to build the terrain field."
      },
      {
        path: "terrain.radiusMin",
        label: "Minimum mountain radius",
        min: 40,
        max: 420,
        step: 1,
        help: "Smallest radius used for a terrain peak."
      },
      {
        path: "terrain.radiusMax",
        label: "Maximum mountain radius",
        min: 80,
        max: 900,
        step: 1,
        help: "Largest radius used for a terrain peak."
      },
      {
        path: "terrain.slowdownStart",
        label: "Slowdown start",
        min: 0,
        max: 0.95,
        step: 0.01,
        help: "Terrain height where drag starts to noticeably increase."
      },
      {
        path: "terrain.dragBoost",
        label: "Drag boost",
        min: 0,
        max: 8,
        step: 0.1,
        help: "Extra drag applied inside rough terrain."
      },
      {
        path: "terrain.blockThreshold",
        label: "Ridge threshold",
        min: 0.2,
        max: 0.98,
        step: 0.01,
        help: "Terrain height where mountains become almost blocking."
      },
      {
        path: "terrain.minTraversal",
        label: "Minimum traversal",
        min: 0.01,
        max: 0.8,
        step: 0.01,
        help: "Minimum fraction of movement allowed through the harshest ridge."
      }
    ]
  },
  {
    key: "combat",
    title: "Combat resolution",
    description:
      "Melee strikes happen on contact, ranged shots fire out of aligned slots, and shields soften attacks entering their 120 degree sector instead of erasing them outright. Material only changes hands after a kill.",
    fields: [
      {
        path: "combat.attackScale",
        label: "Attack scale",
        min: 0.05,
        max: 1.5,
        step: 0.01,
        help: "Base conversion from attack gadget mass to lifetime damage."
      },
      {
        path: "combat.defenseScale",
        label: "Defense scale",
        min: 0.05,
        max: 1.5,
        step: 0.01,
        help: "Base conversion from defensive gadget mass to mitigation."
      },
      {
        path: "combat.coreArmor",
        label: "Core armor",
        min: 0,
        max: 0.5,
        step: 0.005,
        help: "Innate defense contributed by core mass regardless of side."
      },
      {
        path: "combat.impactBonus",
        label: "Impact bonus",
        min: 0,
        max: 0.3,
        step: 0.005,
        help: "Relative closing speed converted into extra lifetime damage."
      },
      {
        path: "combat.contactDamageRate",
        label: "Contact damage rate",
        min: 0.1,
        max: 3,
        step: 0.05,
        help: "Multiplier applied after offense minus defense is converted into lifetime loss."
      },
      {
        path: "combat.rangedDamageScale",
        label: "Ranged damage scale",
        min: 0.05,
        max: 3,
        step: 0.05,
        help: "Lifetime loss per ranged hit after offense minus defense is resolved."
      },
      {
        path: "combat.shieldBlockFraction",
        label: "Shield block fraction",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Fraction of incoming damage removed when an attack enters an active shield arc."
      },
      {
        path: "combat.lootEfficiency",
        label: "Loot efficiency",
        min: 0,
        max: 1.5,
        step: 0.01,
        help: "Multiplier on how much corpse material the killer captures immediately."
      }
    ]
  },
  {
    key: "mutation",
    title: "Genetic drift",
    description:
      "These values govern how often lineages swap gadgets or perturb allocations and behavioral traits during reproduction.",
    fields: [
      {
        path: "mutation.slotCountChance",
        label: "Slot-count mutation",
        min: 0,
        max: 0.5,
        step: 0.005,
        help: "Chance for offspring to gain or lose one gadget slot, between three and seven total."
      },
      {
        path: "mutation.slotTypeChance",
        label: "Slot mutation chance",
        min: 0,
        max: 0.5,
        step: 0.005,
        help: "Chance for each directional gadget to mutate at birth."
      },
      {
        path: "mutation.allocationJitter",
        label: "Allocation jitter",
        min: 0,
        max: 0.8,
        step: 0.01,
        help: "Relative noise applied to core, motor, and slot ratios."
      },
      {
        path: "mutation.traitJitter",
        label: "Trait jitter",
        min: 0,
        max: 0.8,
        step: 0.01,
        help: "Noise magnitude applied to sensing, reproduction, and species response thresholds."
      },
      {
        path: "mutation.hueJitter",
        label: "Hue jitter",
        min: 0,
        max: 60,
        step: 1,
        help: "Color drift between parent and child render hues."
      },
      {
        path: "mutation.speciationChance",
        label: "Base speciation chance",
        min: 0,
        max: 0.12,
        step: 0.001,
        help: "Baseline chance that an offspring branches into a new visible lineage."
      },
      {
        path: "mutation.speciationDriftFactor",
        label: "Speciation drift factor",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Extra branching chance gained from how far the child genome drifted from the parent."
      },
      {
        path: "mutation.speciesShiftSpeciationBonus",
        label: "Species-shift bonus",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Extra branching chance when the offspring changes gadget-pattern species."
      }
    ]
  },
  {
    key: "render",
    title: "Rendering",
    description:
      "Purely visual scale controls for body silhouettes and debris packets.",
    fields: [
      {
        path: "render.organismScale",
        label: "Organism scale",
        min: 0.5,
        max: 5,
        step: 0.05,
        help: "Multiplies rendered body radius."
      },
      {
        path: "render.resourceScale",
        label: "Resource scale",
        min: 0.5,
        max: 4,
        step: 0.05,
        help: "Multiplies rendered debris radius."
      }
    ]
  },
  {
    key: "gadgets",
    title: "Directional gadget coefficients",
    description:
      "Each cell can carry between three and seven slots, and every active slot chooses either a melee weapon, a ranged emitter, or a shield.",
    fields: [
      {
        path: "gadgets.melee.attack",
        label: "Melee attack",
        min: 0,
        max: 3,
        step: 0.05,
        help: "Raw attack weight of the close-range weapon."
      },
      {
        path: "gadgets.melee.defense",
        label: "Melee defense",
        min: 0,
        max: 2,
        step: 0.05,
        help: "Incidental mitigation while a melee slot is struck."
      },
      {
        path: "gadgets.melee.steal",
        label: "Melee harvest bias",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Extra corpse capture bias when a melee strike lands the killing blow."
      },
      {
        path: "gadgets.melee.upkeep",
        label: "Melee upkeep",
        min: 0,
        max: 3,
        step: 0.05,
        help: "Maintenance multiplier for close-range weapon mass."
      },
      {
        path: "gadgets.ranged.attack",
        label: "Ranged attack",
        min: 0,
        max: 3,
        step: 0.05,
        help: "Raw attack weight of the ranged emitter."
      },
      {
        path: "gadgets.ranged.defense",
        label: "Ranged defense",
        min: 0,
        max: 2,
        step: 0.05,
        help: "Incidental mitigation while a ranged slot is struck."
      },
      {
        path: "gadgets.ranged.steal",
        label: "Ranged harvest bias",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Extra corpse capture bias when a ranged hit lands the killing blow."
      },
      {
        path: "gadgets.ranged.upkeep",
        label: "Ranged upkeep",
        min: 0,
        max: 3,
        step: 0.05,
        help: "Maintenance multiplier for ranged-emitter mass."
      },
      {
        path: "gadgets.ranged.range",
        label: "Ranged base range",
        min: 40,
        max: 420,
        step: 2,
        help: "Maximum reach of a ranged shot before slot mass adds a little extra."
      },
      {
        path: "gadgets.ranged.cooldown",
        label: "Ranged cooldown",
        min: 0.1,
        max: 4,
        step: 0.05,
        help: "Seconds before the same ranged slot can fire again."
      },
      {
        path: "gadgets.shield.defense",
        label: "Shield field strength",
        min: 0,
        max: 3,
        step: 0.05,
        help: "Visual and secondary strength value of the shield field."
      },
      {
        path: "gadgets.shield.steal",
        label: "Shield harvest bias",
        min: 0,
        max: 0.5,
        step: 0.01,
        help: "Extra corpse capture bias if a shield bash still lands the killing blow."
      },
      {
        path: "gadgets.shield.upkeep",
        label: "Shield upkeep",
        min: 0,
        max: 3,
        step: 0.05,
        help: "Maintenance multiplier for shield mass."
      },
    ]
  }
];

const parameterIndex = parameterGroups.flatMap((group) => group.fields);

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getValueByPath(object, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], object);
}

export function setValueByPath(object, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((cursor, key) => cursor[key], object);
  target[lastKey] = value;
}

function mergeIntoDefaults(defaultObject, incomingObject) {
  const merged = Array.isArray(defaultObject) ? [] : {};

  for (const [key, defaultValue] of Object.entries(defaultObject)) {
    const incomingValue = incomingObject?.[key];
    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      merged[key] = mergeIntoDefaults(defaultValue, incomingValue || {});
    } else if (incomingValue !== undefined) {
      merged[key] = incomingValue;
    } else {
      merged[key] = defaultValue;
    }
  }

  return merged;
}

export function clampConfig(config) {
  const normalized = mergeIntoDefaults(defaultConfig, config);

  for (const field of parameterIndex) {
    const rawValue = Number(getValueByPath(normalized, field.path));
    const clampedValue = clamp(rawValue, field.min, field.max);
    setValueByPath(normalized, field.path, clampedValue);
  }

  const minimumInitMass =
    normalized.world.initialOrganisms * normalized.organisms.minViableMass;
  if (minimumInitMass > normalized.world.totalMaterial * 0.92) {
    normalized.world.initialOrganisms = Math.max(
      1,
      Math.floor(
        (normalized.world.totalMaterial * 0.92) / normalized.organisms.minViableMass
      )
    );
  }

  normalized.terrain.radiusMax = Math.max(
    normalized.terrain.radiusMin,
    normalized.terrain.radiusMax
  );
  normalized.terrain.blockThreshold = Math.max(
    normalized.terrain.slowdownStart + 0.04,
    normalized.terrain.blockThreshold
  );
  normalized.terrain.minTraversal = Math.min(
    normalized.terrain.minTraversal,
    1
  );

  return normalized;
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadConfig() {
  if (!hasStorage()) {
    return deepClone(defaultConfig);
  }

  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return deepClone(defaultConfig);
    }

    const parsed = JSON.parse(raw);
    return clampConfig(parsed);
  } catch (error) {
    console.warn("Failed to load config from storage.", error);
    return deepClone(defaultConfig);
  }
}

export function saveConfig(config) {
  const normalized = clampConfig(config);
  if (hasStorage()) {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function resetConfig() {
  const normalized = deepClone(defaultConfig);
  if (hasStorage()) {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function gadgetEntries(config) {
  return gadgetOrder.map((key) => ({
    key,
    ...config.gadgets[key]
  }));
}
