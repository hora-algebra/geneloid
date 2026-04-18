import {
  deepClone,
  defaultConfig,
  loadConfig,
  saveConfig,
  parameterGroups,
  getValueByPath,
  setValueByPath,
  clampConfig,
  SNAPSHOT_CHANNEL
} from "./sim/config.js";
import {
  LOCALE_STORAGE_KEY,
  loadLocale,
  localeToggleLabel,
  localeToggleTitle,
  saveLocale,
  t,
  translateParameterGroups
} from "./i18n.js";
import {
  Simulation,
  gadgetColor,
  genomeVisualShape,
  lifeBrightness,
  organismPalette,
  organismRadius,
  sensorRange,
  slotAngleOffset,
  terrainMovementProfile
} from "./sim/core.js";

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function mixColor(start, end, t) {
  return Math.round(start + (end - start) * t);
}

function blendTerrainTriplets(stops, t) {
  const clamped = Math.min(1, Math.max(0, t));
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
  const mobility = Math.min(1, Math.max(0, profile.mobility));
  const height = Math.min(1, Math.max(0, profile.height));
  const ridge = Math.min(1, Math.max(0, profile.ridge));
  const slowdown = Math.min(1, Math.max(0, profile.slowdown));
  const terrainLevel = Math.min(
    1,
    Math.max(0, height * 0.62 + (1 - mobility) * 0.28 + ridge * 0.1)
  );
  const steppedLevel = Math.round(terrainLevel * 6) / 6;
  const shadedLevel = terrainLevel + (steppedLevel - terrainLevel) * 0.58;
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
  const minorWave = ((height * 19.5 + slowdown * 1.2 + mobility * 0.35) % 1 + 1) % 1;
  const majorContour = Math.max(0, 1 - Math.abs(majorWave * 2 - 1) * 18);
  const minorContour = Math.max(0, 1 - Math.abs(minorWave * 2 - 1) * 26);
  const hatch = ridge > 0.1 && (column * 3 + row * 5) % 11 === 0 ? ridge * 10 : 0;
  const reliefShadow = ridge * 20 + slowdown * 14 + hatch;
  const lowlandLift = mobility * (1 - height) * 6;

  return {
    r: Math.min(
      255,
      Math.max(
        0,
        Math.round(baseR + lowlandLift - reliefShadow - majorContour * 18 - minorContour * 5)
      )
    ),
    g: Math.min(
      255,
      Math.max(
        0,
        Math.round(baseG + lowlandLift * 0.7 - reliefShadow * 0.72 - majorContour * 12 - minorContour * 4)
      )
    ),
    b: Math.min(
      255,
      Math.max(
        0,
        Math.round(baseB + lowlandLift * 0.3 - reliefShadow * 0.44 - majorContour * 6 - minorContour * 2)
      )
    ),
    a: 0.6 + terrainLevel * 0.18 + ridge * 0.04 + majorContour * 0.03
  };
}

function startDeveloperPage() {
  const container = document.getElementById("parameter-groups");
  if (!container) {
    return;
  }

  const saveButton = document.getElementById("save-config");
  const reloadButton = document.getElementById("reload-config");
  const defaultsButton = document.getElementById("defaults-config");
  const localeToggleButton = document.getElementById("locale-toggle");
  const backToSimulationLink = document.getElementById("back-to-simulation");
  const configExport = document.getElementById("config-export");
  const derivedChecks = document.getElementById("derived-checks");
  const configState = document.getElementById("config-state");
  const liveSnapshot = document.getElementById("live-snapshot");
  const previewCanvas = document.getElementById("dev-preview-canvas");
  const previewContext = previewCanvas?.getContext("2d");

  let locale = loadLocale();
  let draftConfig = loadConfig();
  let savedFingerprint = JSON.stringify(draftConfig);
  let previewSimulation = previewCanvas
    ? new Simulation(clampConfig(deepClone(draftConfig)))
    : null;
  let previewLastTime = performance.now();
  let lastSnapshotPayload = null;
  let lastStateNoteKey = "dev.state.matches";
  let lastStateTone = "normal";

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

  function timeUnitLabel() {
    return locale === "ja" ? "秒" : "s";
  }

  function traceBlobShape(ctx, radius, shape, heading) {
    const steps = 28;
    ctx.beginPath();
    for (let index = 0; index <= steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      const point = blobShapePoint(radius, shape, angle, heading);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.closePath();
  }

  function drawPreviewThrusterWake(ctx, organism, radius, brightness) {
    const speed = Math.hypot(organism.vx, organism.vy);
    const wakeAngle = speed > 0.8 ? Math.atan2(organism.vy, organism.vx) : organism.heading;
    const wakeGain = Math.max(0.28, Math.min(1.18, speed / 18 + 0.28));

    ctx.save();
    ctx.translate(organism.x, organism.y);
    ctx.rotate(wakeAngle);
    ctx.globalAlpha = brightness * (0.18 + wakeGain * 0.14);
    ctx.fillStyle = "rgba(91, 226, 255, 0.92)";
    ctx.beginPath();
    ctx.ellipse(
      -radius * (0.96 + wakeGain * 0.16),
      0,
      radius * (0.18 + wakeGain * 0.18),
      radius * (0.08 + wakeGain * 0.06),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = brightness * 0.42;
    ctx.fillStyle = "rgba(255, 177, 110, 0.95)";
    for (const offset of [-0.16, 0.16]) {
      ctx.beginPath();
      ctx.ellipse(
        -radius * 0.56,
        offset * radius,
        radius * 0.11,
        radius * 0.07,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPreviewHullAccents(ctx, radius, palette, brightness) {
    ctx.save();

    ctx.globalAlpha = brightness * 0.58;
    ctx.fillStyle = "rgba(4, 16, 24, 0.92)";
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.08, sign * radius * 0.44);
      ctx.lineTo(-radius * 0.58, sign * radius * 0.7);
      ctx.lineTo(-radius * 0.44, sign * radius * 0.16);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = brightness * 0.42;
    ctx.fillStyle = "rgba(214, 241, 255, 0.96)";
    ctx.beginPath();
    ctx.ellipse(
      radius * 0.32,
      0,
      radius * 0.28,
      radius * 0.17,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = brightness * 0.4;
    ctx.fillStyle = "rgba(69, 142, 173, 0.96)";
    ctx.beginPath();
    ctx.ellipse(
      radius * 0.38,
      0,
      radius * 0.16,
      radius * 0.09,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = brightness * 0.84;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.18, 0);
    ctx.lineTo(radius * 0.56, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(radius * 0.5, -radius * 0.14);
    ctx.lineTo(radius * 0.82, 0);
    ctx.lineTo(radius * 0.5, radius * 0.14);
    ctx.stroke();

    ctx.restore();
  }

  function setLocalizedText(id, key) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = t(locale, key);
    }
  }

  function updateStateNote(messageKey, tone = "normal") {
    lastStateNoteKey = messageKey;
    lastStateTone = tone;
    configState.textContent = t(locale, messageKey);
    configState.style.color = tone === "alert" ? "#ffb19c" : "";
    configState.style.borderColor =
      tone === "alert" ? "rgba(255, 139, 107, 0.22)" : "rgba(255, 255, 255, 0.04)";
  }

  function applyLocale() {
    document.documentElement.lang = locale;
    document.title = t(locale, "dev.pageTitle");
    localeToggleButton?.setAttribute("title", localeToggleTitle(locale));
    localeToggleButton?.setAttribute("aria-label", localeToggleTitle(locale));
    if (localeToggleButton) {
      localeToggleButton.textContent = localeToggleLabel(locale);
    }
    backToSimulationLink?.setAttribute("aria-label", t(locale, "dev.back"));
    previewCanvas?.setAttribute("aria-label", t(locale, "dev.previewCanvasAria"));

    setLocalizedText("dev-header-eyebrow", "dev.headerEyebrow");
    setLocalizedText("dev-header-title", "dev.headerTitle");
    setLocalizedText("dev-header-lead", "dev.headerLead");
    setLocalizedText("back-to-simulation", "dev.back");
    setLocalizedText("save-config", "dev.save");
    setLocalizedText("reload-config", "dev.reload");
    setLocalizedText("defaults-config", "dev.defaults");
    setLocalizedText("snapshot-title", "dev.snapshotTitle");
    setLocalizedText("derived-title", "dev.derivedTitle");
    setLocalizedText("export-title", "dev.exportTitle");
    setLocalizedText("preview-title", "dev.previewTitle");
    setLocalizedText("preview-lead", "dev.previewLead");
    setLocalizedText("parameters-title", "dev.parametersTitle");

    renderDerivedChecks();
    renderControls();
    renderSnapshot(lastSnapshotPayload);
    updateStateNote(lastStateNoteKey, lastStateTone);
  }

  function renderDerivedChecks() {
    const intendedBiomass = Math.min(
      draftConfig.world.totalMaterial * 0.58,
      draftConfig.world.initialOrganisms * draftConfig.world.initialOrganismMass
    );
    const freeMaterial = draftConfig.world.totalMaterial - intendedBiomass;
    const meanSpawnUpkeep =
      draftConfig.economy.upkeepBase +
      draftConfig.world.initialOrganismMass * draftConfig.economy.upkeepMassFactor;

    derivedChecks.innerHTML = `
      <div>
        <dt>${t(locale, "dev.derived.initialBiomass")}</dt>
        <dd>${formatNumber(intendedBiomass)}</dd>
      </div>
      <div>
        <dt>${t(locale, "dev.derived.initialFree")}</dt>
        <dd>${formatNumber(freeMaterial)}</dd>
      </div>
      <div>
        <dt>${t(locale, "dev.derived.meanUpkeep")}</dt>
        <dd>${formatNumber(meanSpawnUpkeep, 3)}</dd>
      </div>
      <div>
        <dt>${t(locale, "dev.derived.minViable")}</dt>
        <dd>${formatNumber(
          draftConfig.world.initialOrganisms * draftConfig.organisms.minViableMass
        )}</dd>
      </div>
      <div>
        <dt>${t(locale, "dev.derived.nodeDensity")}</dt>
        <dd>${formatNumber(
          draftConfig.world.totalMaterial / draftConfig.world.resourceNodeCap,
          2
        )}</dd>
      </div>
    `;
  }

  function resizePreviewCanvas() {
    if (!previewCanvas) {
      return;
    }

    const rect = previewCanvas.parentElement.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    previewCanvas.width = Math.floor(rect.width * ratio);
    previewCanvas.height = Math.floor(rect.height * ratio);
  }

  function drawPreview() {
    if (!previewCanvas || !previewContext || !previewSimulation) {
      return;
    }

    const world = previewSimulation.config.world;
    const padding = 18;
    const usableWidth = previewCanvas.width - padding * 2;
    const usableHeight = previewCanvas.height - padding * 2;
    const scale = Math.min(usableWidth / world.width, usableHeight / world.height);
    const offsetX = (previewCanvas.width - world.width * scale) / 2;
    const offsetY = (previewCanvas.height - world.height * scale) / 2;

    previewContext.setTransform(1, 0, 0, 1, 0, 0);
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewContext.fillStyle = "rgba(255, 255, 255, 0.02)";
    previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    previewContext.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    previewContext.fillStyle = "#091c25";
    previewContext.fillRect(0, 0, world.width, world.height);

    const terrain = previewSimulation.terrain;
    if (terrain?.enabled && terrain.samples?.length) {
      const cellWidth = world.width / terrain.columns;
      const cellHeight = world.height / terrain.rows;
      for (let row = 0; row < terrain.rows; row += 1) {
        for (let column = 0; column < terrain.columns; column += 1) {
          const sampleX = ((column + 0.5) / terrain.columns) * world.width;
          const sampleY = ((row + 0.5) / terrain.rows) * world.height;
          const profile = terrainMovementProfile(previewSimulation, sampleX, sampleY);
          const tone = terrainTone(profile, column, row);
          previewContext.fillStyle = `rgba(${tone.r}, ${tone.g}, ${tone.b}, ${tone.a})`;
          previewContext.fillRect(
            column * cellWidth,
            row * cellHeight,
            cellWidth + 1,
            cellHeight + 1
          );
        }
      }
    }

    previewContext.save();
    previewContext.strokeStyle = "rgba(124, 186, 177, 0.06)";
    previewContext.lineWidth = 1;
    for (let x = 0; x <= world.width; x += 140) {
      previewContext.beginPath();
      previewContext.moveTo(x, 0);
      previewContext.lineTo(x, world.height);
      previewContext.stroke();
    }
    for (let y = 0; y <= world.height; y += 140) {
      previewContext.beginPath();
      previewContext.moveTo(0, y);
      previewContext.lineTo(world.width, y);
      previewContext.stroke();
    }
    previewContext.strokeStyle = "rgba(255, 226, 160, 0.25)";
    previewContext.lineWidth = 5;
    previewContext.strokeRect(2.5, 2.5, world.width - 5, world.height - 5);
    previewContext.restore();

    for (const resource of previewSimulation.resources) {
      const radius = Math.max(
        1.8,
        Math.sqrt(resource.mass) * previewSimulation.config.render.resourceScale
      );
      previewContext.fillStyle = "rgba(255, 214, 122, 0.92)";
      previewContext.beginPath();
      previewContext.arc(resource.x, resource.y, radius, 0, Math.PI * 2);
      previewContext.fill();
    }

    previewContext.save();
    previewContext.globalCompositeOperation = "lighter";
    for (const organism of previewSimulation.organisms) {
      const sensing = sensorRange(organism, previewSimulation.config);
      const palette = organismPalette(organism, previewSimulation.config, 1);
      previewContext.fillStyle = palette.secondary;
      previewContext.lineWidth = 1.4;
      previewContext.beginPath();
      previewContext.arc(organism.x, organism.y, sensing, 0, Math.PI * 2);
      previewContext.globalAlpha = 0.028;
      previewContext.fill();
      previewContext.strokeStyle = palette.accent;
      previewContext.globalAlpha = 0.12;
      previewContext.stroke();
    }
    previewContext.restore();

    for (const organism of previewSimulation.organisms) {
      const radius = organismRadius(organism, previewSimulation.config);
      const palette = organismPalette(organism, previewSimulation.config, 1);
      const shape = genomeVisualShape(organism.genome);
      const brightness = lifeBrightness(organism);

      drawPreviewThrusterWake(previewContext, organism, radius, brightness);

       for (let side = 0; side < organism.slotMasses.length; side += 1) {
        const slotMass = organism.slotMasses[side];
        const gadgetKey = organism.genome.slotTypes[side];
        const gadget = previewSimulation.config.gadgets[gadgetKey];
        const angle =
          organism.heading + slotAngleOffset(side, organism.slotMasses.length);
        const color = gadgetColor(previewSimulation.config, gadgetKey);

        previewContext.save();
        previewContext.translate(organism.x, organism.y);
        previewContext.rotate(angle);
        previewContext.strokeStyle = color;
        previewContext.fillStyle = color;

        if (gadget.mode === "shield") {
          const shieldOuter = radius + 7 + Math.sqrt(slotMass) * 1.7;
          previewContext.lineWidth = 2;
          previewContext.globalAlpha = 0.8;
          previewContext.beginPath();
          previewContext.arc(0, 0, shieldOuter, -Math.PI / 3, Math.PI / 3);
          previewContext.stroke();
          previewContext.restore();
          continue;
        }

        if (gadget.mode === "ranged") {
          const chamberStart = radius * 0.34;
          const chamberLength = 4.6 + Math.sqrt(slotMass) * 0.7;
          const barrelStart = chamberStart + chamberLength * 0.72;
          const barrelEnd = radius + 8 + Math.sqrt(slotMass) * 1.9;
          const bodyWidth = 3.4 + Math.sqrt(slotMass) * 0.24;
          const muzzleLength = 2.8 + Math.sqrt(slotMass) * 0.34;

          previewContext.globalAlpha = 0.95;
          previewContext.fillRect(
            chamberStart,
            -bodyWidth * 0.82,
            chamberLength,
            bodyWidth * 1.64
          );
          previewContext.fillRect(
            barrelStart,
            -bodyWidth * 0.34,
            barrelEnd - barrelStart,
            bodyWidth * 0.68
          );
          previewContext.fillRect(
            barrelEnd,
            -bodyWidth * 0.58,
            muzzleLength,
            bodyWidth * 1.16
          );
          previewContext.restore();
          continue;
        }

        const shaftStart = radius * 0.38;
        const shaftEnd = radius + 5 + Math.sqrt(slotMass) * 1.15;
        const bladeLength = 7.6 + Math.sqrt(slotMass) * 2.1;
        const bladeWidth = 3 + Math.sqrt(slotMass) * 0.46;

        previewContext.lineWidth = 2;
        previewContext.beginPath();
        previewContext.moveTo(shaftStart, 0);
        previewContext.lineTo(shaftEnd, 0);
        previewContext.stroke();

        previewContext.beginPath();
        previewContext.moveTo(shaftEnd + bladeLength, 0);
        previewContext.lineTo(shaftEnd + bladeLength * 0.16, -bladeWidth);
        previewContext.lineTo(shaftEnd - bladeLength * 0.16, -bladeWidth * 0.3);
        previewContext.lineTo(shaftEnd + bladeLength * 0.02, 0);
        previewContext.lineTo(shaftEnd - bladeLength * 0.16, bladeWidth * 0.3);
        previewContext.lineTo(shaftEnd + bladeLength * 0.16, bladeWidth);
        previewContext.closePath();
        previewContext.fill();
        previewContext.restore();
      }

      const fill = previewContext.createLinearGradient(
        organism.x - radius,
        organism.y - radius,
        organism.x + radius,
        organism.y + radius
      );
      fill.addColorStop(0, palette.shadow);
      fill.addColorStop(0.4, palette.primary);
      fill.addColorStop(1, palette.secondary);
      previewContext.fillStyle = fill;
      previewContext.globalAlpha = brightness;
      previewContext.save();
      previewContext.translate(organism.x, organism.y);
      traceBlobShape(previewContext, radius, shape, organism.heading);
      previewContext.fill();
      if (brightness < 0.995) {
        previewContext.fillStyle = `rgba(0, 0, 0, ${(1 - brightness) * 0.5})`;
        traceBlobShape(previewContext, radius, shape, organism.heading);
        previewContext.fill();
      }
      previewContext.restore();

      previewContext.strokeStyle = palette.accent;
      previewContext.lineWidth = 1.4;
      previewContext.globalAlpha = brightness;
      previewContext.save();
      previewContext.translate(organism.x, organism.y);
      traceBlobShape(previewContext, radius, shape, organism.heading);
      previewContext.stroke();
      previewContext.rotate(organism.heading);
      drawPreviewHullAccents(previewContext, radius, palette, brightness);
      previewContext.restore();
    }
  }

  function resetPreviewSimulation() {
    if (!previewCanvas) {
      return;
    }

    previewSimulation = new Simulation(clampConfig(deepClone(draftConfig)));
    previewLastTime = performance.now();
    resizePreviewCanvas();
    drawPreview();
  }

  function renderExport() {
    configExport.textContent = JSON.stringify(clampConfig(draftConfig), null, 2);
  }

  function onFieldInput(path, value) {
    setValueByPath(draftConfig, path, Number(value));
    draftConfig = clampConfig(draftConfig);
    renderExport();
    renderDerivedChecks();
    resetPreviewSimulation();
    const dirty = JSON.stringify(clampConfig(draftConfig)) !== savedFingerprint;
    updateStateNote(dirty ? "dev.state.unsaved" : "dev.state.matches");
  }

  function renderControls() {
    container.innerHTML = "";

    for (const group of translateParameterGroups(locale, parameterGroups)) {
      const section = document.createElement("section");
      section.className = "parameter-group";

      const heading = document.createElement("h2");
      heading.textContent = group.title;
      section.appendChild(heading);

      const description = document.createElement("p");
      description.textContent = group.description;
      section.appendChild(description);

      const grid = document.createElement("div");
      grid.className = "parameter-grid";

      for (const field of group.fields) {
        const value = getValueByPath(draftConfig, field.path);
        const wrapper = document.createElement("div");
        wrapper.className = "parameter-field";

        const label = document.createElement("label");
        label.innerHTML = `<span>${field.label}</span><span class="field-value">${value}</span>`;
        wrapper.appendChild(label);

        const input = document.createElement("input");
        input.type = "number";
        input.min = String(field.min);
        input.max = String(field.max);
        input.step = String(field.step);
        input.value = String(value);
        input.addEventListener("change", (event) => {
          onFieldInput(field.path, event.target.value);
          const normalizedValue = getValueByPath(draftConfig, field.path);
          event.target.value = String(normalizedValue);
          label.querySelector(".field-value").textContent = String(normalizedValue);
        });
        wrapper.appendChild(input);

        const help = document.createElement("small");
        help.textContent = field.help;
        wrapper.appendChild(help);

        grid.appendChild(wrapper);
      }

      section.appendChild(grid);
      container.appendChild(section);
    }
  }

  function renderSnapshot(payload) {
    lastSnapshotPayload = payload;
    if (!payload) {
      liveSnapshot.innerHTML =
        `<div class="snapshot-empty"><span>${t(locale, "dev.snapshotEmpty")}</span></div>`;
      return;
    }

    liveSnapshot.innerHTML = `
      <article>
        <span>${t(locale, "dev.snapshot.population")}</span>
        <strong>${payload.living}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.lineages")}</span>
        <strong>${payload.lineages}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.avgMass")}</span>
        <strong>${formatNumber(payload.avgMass)}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.freeMaterial")}</span>
        <strong>${formatNumber(payload.freeMaterial)}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.totalMaterial")}</span>
        <strong>${formatNumber(payload.totalMaterial)}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.avgLifeLeft")}</span>
        <strong>${formatNumber(payload.avgRemainingLife)} ${timeUnitLabel()}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.biodiversityEntropy")}</span>
        <strong>${formatNumber(payload.biodiversityEntropy, 3)}</strong>
      </article>
      <article>
        <span>${t(locale, "dev.snapshot.birthsDeaths")}</span>
        <strong>${payload.births} / ${payload.deaths}</strong>
      </article>
    `;
  }

  saveButton.addEventListener("click", () => {
    draftConfig = saveConfig(draftConfig);
    savedFingerprint = JSON.stringify(draftConfig);
    renderExport();
    renderDerivedChecks();
    renderControls();
    resetPreviewSimulation();
    updateStateNote("dev.state.saved", "normal");
  });

  reloadButton.addEventListener("click", () => {
    draftConfig = loadConfig();
    savedFingerprint = JSON.stringify(clampConfig(draftConfig));
    renderExport();
    renderDerivedChecks();
    renderControls();
    resetPreviewSimulation();
    updateStateNote("dev.state.reloaded");
  });

  defaultsButton.addEventListener("click", () => {
    draftConfig = deepClone(defaultConfig);
    renderExport();
    renderDerivedChecks();
    renderControls();
    resetPreviewSimulation();
    updateStateNote("dev.state.defaults");
  });

  localeToggleButton?.addEventListener("click", () => {
    locale = saveLocale(locale === "ja" ? "en" : "ja");
    applyLocale();
  });

  if (typeof window.BroadcastChannel !== "undefined") {
    const channel = new window.BroadcastChannel(SNAPSHOT_CHANNEL);
    channel.addEventListener("message", (event) => {
      if (event.data?.type === "snapshot") {
        renderSnapshot(event.data.payload);
      }
    });
  } else {
    renderSnapshot(null);
  }

  renderSnapshot(null);
  renderExport();
  renderDerivedChecks();
  renderControls();
  resetPreviewSimulation();
  updateStateNote("dev.state.matches");

  window.addEventListener("resize", () => {
    resizePreviewCanvas();
    drawPreview();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === LOCALE_STORAGE_KEY) {
      locale = loadLocale();
      applyLocale();
    }
  });

  function previewFrame(now) {
    if (previewSimulation) {
      const deltaSeconds = Math.min(
        0.05,
        Math.max(0.001, (now - previewLastTime) / 1000)
      );
      previewLastTime = now;
      previewSimulation.step(deltaSeconds * 0.9);
      drawPreview();
    }

    window.requestAnimationFrame(previewFrame);
  }

  window.requestAnimationFrame(previewFrame);
  applyLocale();
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", startDeveloperPage);
}
