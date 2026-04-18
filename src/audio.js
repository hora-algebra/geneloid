function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function audioContextClass() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.AudioContext || window.webkitAudioContext || null;
}

function canUseAudio() {
  return audioContextClass() !== null;
}

function createNoiseBuffer(context) {
  const length = Math.max(1, Math.floor(context.sampleRate * 0.45));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function createAudioDirector() {
  let bgmEnabled = false;
  let sfxEnabled = false;
  let volume = 0.6;
  let bgmVolume = 1;
  let sfxVolume = 1;
  let bgmSource = "";
  let context = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;
  let bgmElement = null;
  let bgmNode = null;
  let bgmFailed = false;
  let primed = false;
  let ambientMeasure = 0;
  let nextAmbientAt = 0;
  const sfxCounts = {
    springPlaced: 0,
    springRemoved: 0,
    lightning: 0,
    deploy: 0,
    feeding: 0,
    uiToggle: 0
  };

  function unlockContext(nextContext) {
    if (!nextContext) {
      return;
    }
    try {
      const source = nextContext.createBufferSource();
      source.buffer = nextContext.createBuffer(1, 1, nextContext.sampleRate);
      source.connect(nextContext.destination);
      source.start(0);
    } catch {
      // Ignore unlock failures; resume() result is still authoritative.
    }
  }

  function anyAudioEnabled() {
    return bgmEnabled || sfxEnabled;
  }

  function currentMasterTarget() {
    if (!anyAudioEnabled()) {
      return 0.0001;
    }
    const normalized = clamp(volume, 0, 1);
    return Math.max(0.0001, 0.9 * normalized * normalized);
  }

  function currentBgmTarget() {
    const normalized = clamp(bgmVolume, 0, 1);
    return Math.max(0.0001, 0.32 * (0.18 + normalized * normalized * 0.82));
  }

  function currentSfxTarget() {
    const normalized = clamp(sfxVolume, 0, 1);
    return Math.max(0.0001, 0.58 * (0.15 + normalized * normalized * 0.85));
  }

  function rampBusGain(node, target, duration = 0.18) {
    if (!context || !node) {
      return;
    }
    const now = context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), now);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + duration);
  }

  function syncBusLevels(duration = 0.18) {
    if (!context) {
      return;
    }
    rampBusGain(musicGain, currentBgmTarget(), duration);
    rampBusGain(sfxGain, currentSfxTarget(), duration);
  }

  function ensureContext() {
    if (!anyAudioEnabled() || !canUseAudio()) {
      return null;
    }
    if (context) {
      return context;
    }

    const AudioContextClass = audioContextClass();
    if (!AudioContextClass) {
      return null;
    }

    context = new AudioContextClass();
    masterGain = context.createGain();
    musicGain = context.createGain();
    sfxGain = context.createGain();
    const compressor = context.createDynamicsCompressor();

    compressor.threshold.value = -22;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.22;

    masterGain.gain.value = 0.0001;
    musicGain.gain.value = currentBgmTarget();
    sfxGain.gain.value = currentSfxTarget();

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    noiseBuffer = createNoiseBuffer(context);
    ensureExternalBgm();
    return context;
  }

  function ensureExternalBgm() {
    if (!context || !musicGain || !bgmSource || bgmElement || typeof window === "undefined") {
      return;
    }
    try {
      bgmElement = new window.Audio(bgmSource);
      bgmElement.preload = "auto";
      bgmElement.loop = true;
      bgmElement.playsInline = true;
      bgmElement.crossOrigin = "anonymous";
      bgmElement.volume = 1;
      bgmElement.addEventListener("error", () => {
        bgmFailed = true;
      });
      bgmNode = context.createMediaElementSource(bgmElement);
      bgmNode.connect(musicGain);
      bgmElement.load();
    } catch {
      bgmFailed = true;
    }
  }

  function syncBgmPlayback() {
    if (!bgmElement) {
      return;
    }
    if (bgmEnabled && primed && !bgmFailed) {
      const maybePromise = bgmElement.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {});
      }
      return;
    }
    bgmElement.pause();
  }

  function rampMaster(target, duration = 0.45) {
    if (!context || !masterGain) {
      return;
    }
    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
    masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + duration);
  }

  function createStereoPanner() {
    if (!context) {
      return null;
    }
    return typeof context.createStereoPanner === "function"
      ? context.createStereoPanner()
      : null;
  }

  function scheduleTone(options = {}) {
    if (!context || !primed) {
      return;
    }

    const {
      frequency = 220,
      start = context.currentTime,
      duration = 1.2,
      gain = 0.02,
      type = "triangle",
      detune = 0,
      attack = 0.02,
      release = 0.35,
      pan = 0,
      filter = 1800,
      bus = "music"
    } = options;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filterNode = context.createBiquadFilter();
    const panner = createStereoPanner();
    const destination = bus === "sfx" ? sfxGain : musicGain;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(detune, start);

    filterNode.type = "lowpass";
    filterNode.frequency.setValueAtTime(filter, start);
    filterNode.Q.value = 0.8;

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.linearRampToValueAtTime(gain, start + attack);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, gain * 0.4),
      start + Math.max(attack + 0.05, duration - release)
    );
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    if (panner) {
      panner.pan.setValueAtTime(clamp(pan, -1, 1), start);
      gainNode.connect(panner);
      panner.connect(destination);
    } else {
      gainNode.connect(destination);
    }

    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function scheduleNoiseBurst(options = {}) {
    if (!context || !primed || !noiseBuffer) {
      return;
    }

    const {
      start = context.currentTime,
      duration = 0.22,
      gain = 0.03,
      pan = 0,
      filter = 2200
    } = options;

    const source = context.createBufferSource();
    const gainNode = context.createGain();
    const filterNode = context.createBiquadFilter();
    const panner = createStereoPanner();

    source.buffer = noiseBuffer;
    filterNode.type = "bandpass";
    filterNode.frequency.setValueAtTime(filter, start);
    filterNode.Q.value = 0.8;

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.linearRampToValueAtTime(gain, start + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filterNode);
    filterNode.connect(gainNode);
    if (panner) {
      panner.pan.setValueAtTime(clamp(pan, -1, 1), start);
      gainNode.connect(panner);
      panner.connect(sfxGain);
    } else {
      gainNode.connect(sfxGain);
    }

    source.start(start);
    source.stop(start + duration + 0.01);
  }

  function scheduleAmbientUntil(targetTime) {
    if (!context || !primed || !bgmEnabled) {
      return;
    }

    const chords = [
      [45, 52, 57, 61],
      [47, 54, 59, 62],
      [40, 47, 52, 56],
      [43, 50, 55, 59]
    ];

    while (nextAmbientAt < targetTime) {
      const chord = chords[ambientMeasure % chords.length];
      const start = nextAmbientAt;
      const phraseLength = 2.8;
      const rootPan = Math.sin(ambientMeasure * 0.7) * 0.35;

      chord.forEach((note, index) => {
        const frequency = midiToFrequency(note);
        scheduleTone({
          frequency,
          start: start + index * 0.035,
          duration: phraseLength,
          gain: index === 0 ? 0.02 : 0.014,
          type: index % 2 === 0 ? "triangle" : "sine",
          detune: index % 2 === 0 ? -4 : 3,
          attack: 0.28,
          release: 0.9,
          pan: clamp(rootPan + (index - 1.5) * 0.16, -0.7, 0.7),
          filter: 980 + index * 240
        });
      });

      scheduleTone({
        frequency: midiToFrequency(chord[0] - 12),
        start,
        duration: phraseLength * 0.92,
        gain: 0.012,
        type: "sine",
        attack: 0.18,
        release: 0.8,
        pan: rootPan * 0.4,
        filter: 540
      });

      nextAmbientAt += phraseLength * 0.92;
      ambientMeasure += 1;
    }
  }

  async function prime() {
    if (!anyAudioEnabled()) {
      return false;
    }
    const nextContext = ensureContext();
    if (!nextContext) {
      return false;
    }
    if (nextContext.state === "suspended") {
      try {
        unlockContext(nextContext);
        await nextContext.resume();
      } catch {
        return false;
      }
    }
    primed = nextContext.state === "running";
    if (primed) {
      rampMaster(currentMasterTarget(), 0.55);
      nextAmbientAt = Math.max(nextAmbientAt, nextContext.currentTime + 0.08);
      syncBgmPlayback();
    }
    return primed;
  }

  function syncAudioState() {
    if (!anyAudioEnabled()) {
      primed = false;
      syncBgmPlayback();
      if (context && masterGain) {
        rampMaster(0.0001, 0.3);
      }
      return;
    }
    if (!context) {
      return;
    }
    syncBgmPlayback();
    if (context && masterGain) {
      rampMaster(currentMasterTarget(), 0.18);
      syncBusLevels(0.18);
    }
  }

  function setBgmEnabled(nextEnabled) {
    bgmEnabled = Boolean(nextEnabled);
    syncAudioState();
  }

  function setSfxEnabled(nextEnabled) {
    sfxEnabled = Boolean(nextEnabled);
    syncAudioState();
  }

  function setVolume(nextVolume) {
    volume = clamp(Number(nextVolume) || 0, 0, 1);
    if (context && masterGain) {
      rampMaster(currentMasterTarget(), 0.18);
    }
  }

  function setBgmVolume(nextVolume) {
    bgmVolume = clamp(Number(nextVolume) || 0, 0, 1);
    syncBusLevels(0.18);
  }

  function setSfxVolume(nextVolume) {
    sfxVolume = clamp(Number(nextVolume) || 0, 0, 1);
    syncBusLevels(0.18);
  }

  function tick() {
    if (!bgmEnabled || !primed || !context) {
      return;
    }
    if (bgmElement && !bgmFailed) {
      syncBgmPlayback();
      return;
    }
    scheduleAmbientUntil(context.currentTime + 2.8);
  }

  function setBgmSource(nextSource) {
    bgmSource = String(nextSource || "");
    if (!bgmSource) {
      bgmFailed = false;
      if (bgmElement) {
        bgmElement.pause();
      }
      return;
    }
    if (!context || bgmElement) {
      return;
    }
    bgmFailed = false;
    ensureExternalBgm();
    syncBgmPlayback();
  }

  function playSpringPlaced() {
    if (!sfxEnabled || !context || !primed) {
      return;
    }
    sfxCounts.springPlaced += 1;
    const now = context.currentTime;
    scheduleTone({
      frequency: midiToFrequency(72),
      start: now,
      duration: 0.8,
      gain: 0.032,
      type: "sine",
      attack: 0.03,
      release: 0.38,
      pan: -0.22,
      filter: 1800,
      bus: "sfx"
    });
    scheduleTone({
      frequency: midiToFrequency(79),
      start: now + 0.07,
      duration: 0.92,
      gain: 0.026,
      type: "triangle",
      attack: 0.03,
      release: 0.42,
      pan: 0.18,
      filter: 2200,
      bus: "sfx"
    });
    scheduleNoiseBurst({
      start: now + 0.02,
      duration: 0.18,
      gain: 0.01,
      filter: 2800,
      pan: 0.05
    });
  }

  function playSpringRemoved() {
    if (!sfxEnabled || !context || !primed) {
      return;
    }
    sfxCounts.springRemoved += 1;
    const now = context.currentTime;
    scheduleTone({
      frequency: midiToFrequency(69),
      start: now,
      duration: 0.5,
      gain: 0.024,
      type: "triangle",
      attack: 0.015,
      release: 0.28,
      pan: -0.1,
      filter: 1400,
      bus: "sfx"
    });
    scheduleTone({
      frequency: midiToFrequency(62),
      start: now + 0.08,
      duration: 0.58,
      gain: 0.02,
      type: "sine",
      attack: 0.02,
      release: 0.3,
      pan: 0.12,
      filter: 1200,
      bus: "sfx"
    });
  }

  function playLightning(radius = 120) {
    if (!sfxEnabled || !context || !primed) {
      return;
    }
    sfxCounts.lightning += 1;
    const now = context.currentTime;
    const strength = clamp(radius / 260, 0.4, 1.2);
    scheduleNoiseBurst({
      start: now,
      duration: 0.24 + strength * 0.1,
      gain: 0.04 * strength,
      filter: 2500 + strength * 1000
    });
    scheduleNoiseBurst({
      start: now + 0.045,
      duration: 0.18,
      gain: 0.022 * strength,
      filter: 4200
    });
    scheduleTone({
      frequency: 120,
      start: now,
      duration: 0.22 + strength * 0.14,
      gain: 0.042 * strength,
      type: "sawtooth",
      attack: 0.01,
      release: 0.1,
      filter: 1600,
      bus: "sfx"
    });
    scheduleTone({
      frequency: 76,
      start: now + 0.02,
      duration: 0.34,
      gain: 0.03 * strength,
      type: "triangle",
      attack: 0.01,
      release: 0.14,
      filter: 1100,
      bus: "sfx"
    });
  }

  function playDeploy() {
    if (!sfxEnabled || !context || !primed) {
      return;
    }
    sfxCounts.deploy += 1;
    const now = context.currentTime;
    [64, 71, 76].forEach((note, index) => {
      scheduleTone({
        frequency: midiToFrequency(note),
        start: now + index * 0.06,
        duration: 0.48 + index * 0.1,
        gain: 0.02,
        type: "triangle",
        attack: 0.015,
        release: 0.24,
        pan: -0.16 + index * 0.16,
        filter: 1800 + index * 220,
        bus: "sfx"
      });
    });
  }

  function playFeeding(amount = 1) {
    if (!sfxEnabled || !context || !primed) {
      return;
    }
    sfxCounts.feeding += 1;
    const now = context.currentTime;
    const strength = clamp(amount / 10, 0.35, 1);
    scheduleTone({
      frequency: midiToFrequency(76) - strength * 18,
      start: now,
      duration: 0.14 + strength * 0.04,
      gain: 0.011 + strength * 0.01,
      type: "sine",
      attack: 0.008,
      release: 0.08,
      pan: -0.08,
      filter: 1500 + strength * 500,
      bus: "sfx"
    });
    scheduleTone({
      frequency: midiToFrequency(83) + strength * 10,
      start: now + 0.018,
      duration: 0.11 + strength * 0.04,
      gain: 0.009 + strength * 0.008,
      type: "triangle",
      attack: 0.008,
      release: 0.07,
      pan: 0.1,
      filter: 2200 + strength * 700,
      bus: "sfx"
    });
    scheduleNoiseBurst({
      start: now + 0.01,
      duration: 0.05 + strength * 0.03,
      gain: 0.004 + strength * 0.003,
      filter: 1800 + strength * 900,
      pan: 0.03
    });
  }

  function playUiToggle(active = true) {
    if (!sfxEnabled || !context || !primed) {
      return;
    }
    sfxCounts.uiToggle += 1;
    const now = context.currentTime;
    scheduleTone({
      frequency: active ? midiToFrequency(72) : midiToFrequency(67),
      start: now,
      duration: 0.22,
      gain: 0.014,
      type: "sine",
      attack: 0.01,
      release: 0.12,
      filter: 2000,
      bus: "sfx"
    });
  }

  function getDebugState() {
    return {
      available: canUseAudio(),
      primed,
      bgmEnabled,
      sfxEnabled,
      contextState: context?.state ?? "none",
      hasContext: Boolean(context),
      contextTime: context?.currentTime ?? null,
      bgmSource,
      hasBgmElement: Boolean(bgmElement),
      bgmPaused: bgmElement ? bgmElement.paused : null,
      bgmCurrentTime: bgmElement ? bgmElement.currentTime : null,
      bgmReadyState: bgmElement ? bgmElement.readyState : null,
      bgmNetworkState: bgmElement ? bgmElement.networkState : null,
      bgmFailed,
      sfxCounts: { ...sfxCounts }
    };
  }

  return {
    prime,
    tick,
    setBgmEnabled,
    setSfxEnabled,
    setVolume,
    setBgmVolume,
    setSfxVolume,
    setBgmSource,
    playSpringPlaced,
    playSpringRemoved,
    playLightning,
    playDeploy,
    playFeeding,
    playUiToggle,
    getDebugState
  };
}
