/* MelodyVR — an ambient audio-visual relaxation experience.
   Everything is generated in-browser: canvas landscape + Web Audio soundscape. */

(() => {
  "use strict";

  // ---------------------------------------------------------------- state
  const state = {
    tunedIn: false,
    muted: false,
    breathing: false,
    scene: "aurora",
    breathPattern: "box",
    starDensity: 0.6,
    fireflyDensity: 0.4,
    driftSpeed: 0.3,
    volPad: 0.55,
    volNoise: 0.35,
    volChime: 0.45,
  };

  const SCENES = {
    aurora: {
      skyTop: [8, 10, 28], skyBottom: [24, 34, 66],
      ridges: [[16, 22, 44], [11, 15, 33], [6, 9, 22]],
      glow: [142, 197, 255], hasAurora: true, hasWater: false, hasTrees: false,
      moon: { x: 0.78, y: 0.2, r: 34, color: [225, 235, 255] },
      accent: "#8ec5ff",
    },
    sunset: {
      skyTop: [38, 22, 60], skyBottom: [244, 130, 90],
      ridges: [[70, 36, 66], [48, 26, 52], [26, 16, 38]],
      glow: [255, 170, 110], hasAurora: false, hasWater: true, hasTrees: false,
      moon: { x: 0.5, y: 0.52, r: 46, color: [255, 200, 140] },
      accent: "#ffb27a",
    },
    forest: {
      skyTop: [12, 24, 26], skyBottom: [52, 84, 74],
      ridges: [[30, 52, 46], [20, 38, 34], [10, 22, 20]],
      glow: [150, 230, 180], hasAurora: false, hasWater: false, hasTrees: true,
      moon: { x: 0.24, y: 0.18, r: 26, color: [220, 245, 230] },
      accent: "#9ae6b4",
    },
    dawn: {
      skyTop: [46, 44, 92], skyBottom: [250, 190, 150],
      ridges: [[110, 90, 130], [70, 60, 100], [40, 36, 66]],
      glow: [255, 214, 160], hasAurora: false, hasWater: false, hasTrees: false,
      moon: { x: 0.62, y: 0.4, r: 40, color: [255, 235, 200] },
      accent: "#ffd6a0",
    },
  };

  const BREATH_PATTERNS = {
    box:      { name: "Box Breathing",  steps: [["Breathe In", 4], ["Hold", 4], ["Breathe Out", 4], ["Hold", 4]] },
    "478":    { name: "4·7·8 Calm",     steps: [["Breathe In", 4], ["Hold", 7], ["Breathe Out", 8]] },
    coherent: { name: "Coherent",       steps: [["Breathe In", 5], ["Breathe Out", 5]] },
  };

  // ---------------------------------------------------------------- canvas
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildRidges();
    seedParticles();
  }

  // Deterministic value noise for silhouettes
  function noise1d(x, seed) {
    const s = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }
  function smoothNoise(x, seed) {
    const i = Math.floor(x), f = x - i;
    const a = noise1d(i, seed), b = noise1d(i + 1, seed);
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  }
  function fbm(x, seed) {
    return smoothNoise(x, seed) * 0.55 + smoothNoise(x * 2.1, seed + 5) * 0.28 + smoothNoise(x * 4.3, seed + 9) * 0.17;
  }

  let ridgePaths = [];
  function buildRidges() {
    ridgePaths = [];
    const cfg = SCENES[state.scene];
    const layers = cfg.ridges.length;
    for (let l = 0; l < layers; l++) {
      const pts = [];
      const base = H * (0.52 + l * 0.13);
      const amp = H * (0.16 - l * 0.03);
      const freq = 2.2 + l * 1.4;
      for (let x = 0; x <= W + 20; x += 8) {
        const y = base - fbm((x / W) * freq, l * 17 + state.scene.length) * amp;
        pts.push([x, y]);
      }
      ridgePaths.push(pts);
    }
  }

  // ---------------------------------------------------------------- particles
  let stars = [], fireflies = [], clouds = [], ripples = [];

  function seedParticles() {
    stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.62,
      r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2,
      sp: 0.4 + Math.random() * 1.2,
    }));
    fireflies = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: H * (0.45 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.25,
      ph: Math.random() * Math.PI * 2, r: 1.2 + Math.random() * 1.8,
    }));
    clouds = Array.from({ length: 7 }, () => ({
      x: Math.random() * W, y: H * (0.08 + Math.random() * 0.3),
      w: W * (0.18 + Math.random() * 0.25), h: 26 + Math.random() * 34,
      v: 0.08 + Math.random() * 0.14, a: 0.05 + Math.random() * 0.08,
    }));
  }

  // ---------------------------------------------------------------- drawing
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  let t = 0;
  function draw(dt) {
    const cfg = SCENES[state.scene];
    t += dt * (0.4 + state.driftSpeed * 1.2);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgb(cfg.skyTop));
    sky.addColorStop(1, rgb(cfg.skyBottom));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // stars
    const starCount = Math.floor(stars.length * state.starDensity);
    for (let i = 0; i < starCount; i++) {
      const s = stars[i];
      const a = 0.35 + 0.6 * Math.abs(Math.sin(t * 0.6 * s.sp + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // aurora
    if (cfg.hasAurora) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let band = 0; band < 3; band++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) {
          const y = H * (0.16 + band * 0.07)
            + Math.sin(x * 0.004 + t * 0.5 + band * 2.1) * 42
            + Math.sin(x * 0.011 - t * 0.32 + band) * 20;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const hue = 130 + band * 45 + Math.sin(t * 0.2 + band) * 25;
        ctx.strokeStyle = `hsla(${hue}, 85%, 62%, 0.16)`;
        ctx.lineWidth = 46 + band * 22;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();
    }

    // moon / sun with halo
    const m = cfg.moon;
    const mx = m.x * W, my = m.y * H;
    const halo = ctx.createRadialGradient(mx, my, m.r * 0.4, mx, my, m.r * 5);
    halo.addColorStop(0, rgb(m.color, 0.35));
    halo.addColorStop(1, rgb(m.color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(mx - m.r * 5, my - m.r * 5, m.r * 10, m.r * 10);
    ctx.fillStyle = rgb(m.color, 0.95);
    ctx.beginPath();
    ctx.arc(mx, my, m.r, 0, Math.PI * 2);
    ctx.fill();

    // clouds / mist
    for (const c of clouds) {
      c.x += c.v * (0.4 + state.driftSpeed * 2);
      if (c.x - c.w > W) c.x = -c.w;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w / 2);
      g.addColorStop(0, `rgba(255,255,255,${c.a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, c.h / (c.w / 2));
      ctx.beginPath();
      ctx.arc(0, 0, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ridges (back to front)
    ridgePaths.forEach((pts, i) => {
      ctx.beginPath();
      ctx.moveTo(-20, H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(W + 20, H);
      ctx.closePath();
      ctx.fillStyle = rgb(cfg.ridges[i]);
      ctx.fill();

      // trees on the front ridge for the forest scene
      if (cfg.hasTrees && i === ridgePaths.length - 1) {
        ctx.fillStyle = rgb(cfg.ridges[i]);
        for (let k = 0; k < pts.length; k += 6) {
          const [x, y] = pts[k];
          const h = 18 + noise1d(k, 3.7) * 30;
          ctx.beginPath();
          ctx.moveTo(x - 6, y + 4);
          ctx.lineTo(x, y - h);
          ctx.lineTo(x + 6, y + 4);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    // water reflection
    if (cfg.hasWater) {
      const wy = H * 0.78;
      const wat = ctx.createLinearGradient(0, wy, 0, H);
      wat.addColorStop(0, rgb(cfg.skyBottom, 0.85));
      wat.addColorStop(1, rgb(cfg.skyTop, 0.9));
      ctx.fillStyle = wat;
      ctx.fillRect(0, wy, W, H - wy);
      // shimmer path under the sun
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 26; i++) {
        const ly = wy + (i / 26) * (H - wy);
        const lw = m.r * (1 + i * 0.35) * (0.7 + 0.3 * Math.sin(t * 2 + i));
        ctx.fillStyle = rgb(m.color, 0.05 + 0.05 * Math.sin(t * 3 + i * 1.7));
        ctx.fillRect(mx - lw / 2, ly, lw, 2.2);
      }
      ctx.restore();
    }

    // fireflies
    const ffCount = Math.floor(fireflies.length * state.fireflyDensity);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < ffCount; i++) {
      const f = fireflies[i];
      f.x += f.vx + Math.sin(t + f.ph) * 0.18;
      f.y += f.vy + Math.cos(t * 0.8 + f.ph) * 0.12;
      if (f.x < -10) f.x = W + 10; if (f.x > W + 10) f.x = -10;
      if (f.y < H * 0.35) f.y = H * 0.35; if (f.y > H) f.y = H * 0.5;
      const a = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.4 + f.ph));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
      g.addColorStop(0, rgb(cfg.glow, a * 0.9));
      g.addColorStop(1, rgb(cfg.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // click ripples
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      const p = r.age / r.life;
      if (p >= 1) { ripples.splice(i, 1); continue; }
      const rad = 12 + p * 130;
      ctx.strokeStyle = rgb(cfg.glow, (1 - p) * 0.55);
      ctx.lineWidth = 2.5 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
      g.addColorStop(0, rgb(cfg.glow, (1 - p) * 0.12));
      g.addColorStop(1, rgb(cfg.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // gentle vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(dt);
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- audio
  let AC = null, master = null, padGain = null, noiseGain = null, chimeGain = null;
  let padOscs = [], chimeTimer = null, chordTimer = null;

  // A gentle A-minor pentatonic-friendly chord cycle (Hz)
  const CHORDS = [
    [110.0, 164.81, 220.0, 261.63],   // Am
    [87.31, 130.81, 174.61, 220.0],   // F
    [98.0, 146.83, 196.0, 246.94],    // G
    [82.41, 123.47, 164.81, 207.65],  // E-ish
  ];
  const CHIME_NOTES = [440, 523.25, 587.33, 659.25, 783.99, 880];

  function initAudio() {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0;
    master.connect(AC.destination);

    // --- pad: detuned triangle oscillators through a warm lowpass
    padGain = AC.createGain();
    const padFilter = AC.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.4;
    const padLfo = AC.createOscillator();
    const padLfoGain = AC.createGain();
    padLfo.frequency.value = 0.08;
    padLfoGain.gain.value = 260;
    padLfo.connect(padLfoGain).connect(padFilter.frequency);
    padLfo.start();
    padGain.connect(padFilter).connect(master);

    let chordIdx = 0;
    const buildChord = () => {
      const now = AC.currentTime;
      padOscs.forEach(({ osc, g }) => {
        g.gain.setTargetAtTime(0, now, 2.5);
        osc.stop(now + 9);
      });
      padOscs = [];
      for (const f of CHORDS[chordIdx]) {
        for (const det of [-4, 4]) {
          const osc = AC.createOscillator();
          const g = AC.createGain();
          osc.type = "triangle";
          osc.frequency.value = f;
          osc.detune.value = det;
          g.gain.value = 0;
          g.gain.setTargetAtTime(0.05, now, 3.5);
          osc.connect(g).connect(padGain);
          osc.start();
          padOscs.push({ osc, g });
        }
      }
      chordIdx = (chordIdx + 1) % CHORDS.length;
    };
    buildChord();
    chordTimer = setInterval(buildChord, 16000);

    // --- ocean / wind: filtered noise with a slow swell
    noiseGain = AC.createGain();
    const noiseBuf = AC.createBuffer(1, AC.sampleRate * 4, AC.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let lastN = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lastN = (lastN + 0.02 * white) / 1.02;   // brown-ish noise
      data[i] = lastN * 3.5;
    }
    const noiseSrc = AC.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    const noiseFilter = AC.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 420;
    const swell = AC.createOscillator();
    const swellGain = AC.createGain();
    swell.frequency.value = 0.07;               // slow ocean swell
    swellGain.gain.value = 180;
    swell.connect(swellGain).connect(noiseFilter.frequency);
    swell.start();
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(master);
    noiseSrc.start();

    // --- chimes: occasional soft bells
    chimeGain = AC.createGain();
    const chimeVerb = AC.createDelay(1);
    chimeVerb.delayTime.value = 0.28;
    const verbFb = AC.createGain();
    verbFb.gain.value = 0.35;
    chimeGain.connect(master);
    chimeGain.connect(chimeVerb);
    chimeVerb.connect(verbFb).connect(chimeVerb);
    chimeVerb.connect(master);

    const scheduleChime = () => {
      if (!state.muted && state.volChime > 0.02) {
        playChime(CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)], 0.5);
      }
      chimeTimer = setTimeout(scheduleChime, 4000 + Math.random() * 9000);
    };
    chimeTimer = setTimeout(scheduleChime, 3000);

    applyVolumes();
    master.gain.setTargetAtTime(0.9, AC.currentTime, 2.0);
  }

  function playChime(freq, vel) {
    if (!AC) return;
    const now = AC.currentTime;
    const osc = AC.createOscillator();
    const g = AC.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12 * vel, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    // faint octave shimmer
    const osc2 = AC.createOscillator();
    const g2 = AC.createGain();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2.01;
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.035 * vel, now + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    osc.connect(g).connect(chimeGain);
    osc2.connect(g2).connect(chimeGain);
    osc.start(now); osc.stop(now + 3.5);
    osc2.start(now); osc2.stop(now + 2.5);
  }

  function applyVolumes() {
    if (!AC) return;
    const now = AC.currentTime;
    padGain.gain.setTargetAtTime(state.volPad * 0.9, now, 0.4);
    noiseGain.gain.setTargetAtTime(state.volNoise * 0.7, now, 0.4);
    chimeGain.gain.setTargetAtTime(state.volChime, now, 0.4);
  }

  function setMuted(m) {
    state.muted = m;
    if (AC) master.gain.setTargetAtTime(m ? 0 : 0.9, AC.currentTime, 0.5);
    const btn = document.getElementById("toggleAudio");
    btn.innerHTML = m ? "🔇 <span>Sound</span>" : "🔊 <span>Sound</span>";
  }

  // ---------------------------------------------------------------- breathing
  const breathGuide = document.getElementById("breathGuide");
  const breathCircle = document.getElementById("breathCircle");
  const breathText = document.getElementById("breathText");
  const breathCount = document.getElementById("breathCount");
  let breathTimeout = null, breathCycles = 0;

  function runBreathStep(stepIdx) {
    const pattern = BREATH_PATTERNS[state.breathPattern];
    const [label, secs] = pattern.steps[stepIdx];
    breathText.textContent = label;
    breathCount.textContent = `${pattern.name} · cycle ${breathCycles + 1}`;

    breathCircle.style.transition = `transform ${secs}s cubic-bezier(0.45, 0, 0.55, 1)`;
    if (label.includes("In")) {
      breathCircle.style.transform = "scale(1)";
      playChime(523.25, 0.25);
    } else if (label.includes("Out")) {
      breathCircle.style.transform = "scale(0.55)";
      playChime(392, 0.25);
    }
    // "Hold" keeps the current scale

    breathTimeout = setTimeout(() => {
      const next = (stepIdx + 1) % pattern.steps.length;
      if (next === 0) breathCycles++;
      if (state.breathing) runBreathStep(next);
    }, secs * 1000);
  }

  function setBreathing(on) {
    state.breathing = on;
    clearTimeout(breathTimeout);
    breathGuide.classList.toggle("hidden", !on);
    document.getElementById("toggleBreath").classList.toggle("active", on);
    if (on) {
      breathCycles = 0;
      breathCircle.style.transition = "transform 1s ease";
      breathCircle.style.transform = "scale(0.55)";
      setTimeout(() => state.breathing && runBreathStep(0), 1100);
    }
  }

  // ---------------------------------------------------------------- UI wiring
  document.getElementById("tuneIn").addEventListener("click", () => {
    state.tunedIn = true;
    initAudio();
    document.getElementById("welcome").classList.add("hidden");
    document.getElementById("topBar").classList.remove("hidden");
    setTimeout(() => setBreathing(true), 1800);
  });

  document.getElementById("toggleBreath").addEventListener("click", () => setBreathing(!state.breathing));
  document.getElementById("toggleAudio").addEventListener("click", () => setMuted(!state.muted));

  const settingsPanel = document.getElementById("settings");
  document.getElementById("toggleSettings").addEventListener("click", (e) => {
    settingsPanel.classList.toggle("hidden");
    e.currentTarget.classList.toggle("active", !settingsPanel.classList.contains("hidden"));
  });

  document.getElementById("sceneChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#sceneChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.scene = chip.dataset.scene;
    document.documentElement.style.setProperty("--accent", SCENES[state.scene].accent);
    buildRidges();
  });

  document.getElementById("breathChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#breathChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.breathPattern = chip.dataset.pattern;
    if (state.breathing) setBreathing(true); // restart with new pattern
  });

  const bindSlider = (id, key, scale = 100) => {
    document.getElementById(id).addEventListener("input", (e) => {
      state[key] = e.target.value / scale;
      applyVolumes();
    });
  };
  bindSlider("starDensity", "starDensity");
  bindSlider("fireflyDensity", "fireflyDensity");
  bindSlider("driftSpeed", "driftSpeed");
  bindSlider("volPad", "volPad");
  bindSlider("volNoise", "volNoise");
  bindSlider("volChime", "volChime");

  canvas.addEventListener("pointerdown", (e) => {
    if (!state.tunedIn) return;
    ripples.push({ x: e.clientX, y: e.clientY, age: 0, life: 2.2 });
    playChime(CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)], 0.6);
    // nudge nearby fireflies toward the ripple
    for (const f of fireflies) {
      const dx = e.clientX - f.x, dy = e.clientY - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 260 && d > 1) {
        f.vx += (dx / d) * 0.6;
        f.vy += (dy / d) * 0.4;
      }
    }
  });

  window.addEventListener("resize", resize);

  // ---------------------------------------------------------------- go
  resize();
  requestAnimationFrame(loop);
})();
