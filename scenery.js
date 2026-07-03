/* scenery.js — the "Describe Your Scenery" feature.
   Takes the user's description, asks the proxy (which holds the secret API key)
   to generate a 360° skybox, shows a calm loading state while it works,
   and remembers every finished scene in the browser's localStorage. */

(() => {
  "use strict";

  // After deploying the proxy to Vercel, put its URL here, e.g.
  //   const PROXY_URL = "https://melody-vr.vercel.app/api/generate";
  // While this is empty the app runs in DEMO MODE and paints a sample
  // panorama locally instead of calling the real generator.
  const PROXY_URL = "";

  const HISTORY_KEY = "melodyvr_scenes";
  const POLL_MS = 4000;
  const MAX_WAIT_MS = 4 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const els = {
    describe: $("describe"),
    input: $("sceneryInput"),
    error: $("describeError"),
    generate: $("generateBtn"),
    skip: $("skipDescribe"),
    historyWrap: $("historyWrap"),
    historyList: $("historyList"),
    loading: $("genLoading"),
    status: $("genStatus"),
    cancel: $("cancelGen"),
    newScenery: $("newScenery"),
    openDescribe: $("openDescribe"),
    scene2d: $("scene"),
  };

  let polling = null;
  let cancelled = false;

  // ---------------------------------------------------------------- helpers
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");

  function showError(message) {
    els.error.textContent = message;
    show(els.error);
    els.generate.textContent = "Retry";
  }
  function clearError() {
    hide(els.error);
    els.generate.textContent = "Generate";
  }

  function openDescribe() {
    clearError();
    renderHistory();
    show(els.describe);
  }
  function closeDescribe() {
    hide(els.describe);
  }

  function enterPanorama() {
    els.scene2d.style.display = "none";
    show(els.newScenery);
  }
  function exitToClassic() {
    window.PanoViewer.hide();
    els.scene2d.style.display = "";
    hide(els.newScenery);
  }

  // ---------------------------------------------------------------- history
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }
  function saveScene(prompt, url) {
    const list = getHistory().filter((s) => s.url !== url);
    list.unshift({ prompt, url, date: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 24)));
  }
  function renderHistory() {
    const list = getHistory();
    if (!list.length) { hide(els.historyWrap); return; }
    show(els.historyWrap);
    els.historyList.innerHTML = "";
    for (const item of list) {
      const b = document.createElement("button");
      b.className = "chip history-chip";
      b.textContent = item.prompt.length > 60 ? item.prompt.slice(0, 57) + "..." : item.prompt;
      b.title = item.prompt;
      b.addEventListener("click", () => revisit(item));
      els.historyList.appendChild(b);
    }
  }

  function revisit(item) {
    if (item.url === "demo") {
      showPanoFromCanvas(makeSamplePanorama(item.prompt));
      closeDescribe();
      return;
    }
    setLoading("Reopening your scenery...");
    loadImage(item.url)
      .then((img) => {
        hideLoading();
        showPano(img);
        closeDescribe();
      })
      .catch(() => {
        hideLoading();
        showError("That scenery could not be reloaded. It may have expired - try generating it again.");
        els.input.value = item.prompt;
      });
  }

  // ---------------------------------------------------------------- loading UI
  function setLoading(text) {
    els.status.textContent = text;
    show(els.loading);
    hide(els.describe);
  }
  function hideLoading() {
    hide(els.loading);
  }

  // ---------------------------------------------------------------- panorama display
  function showPano(img) {
    if (!window.PanoViewer.show(img)) {
      showError("Your browser could not display the 360 view (WebGL unavailable). Try a different browser.");
      openDescribe();
      return false;
    }
    enterPanorama();
    return true;
  }
  const showPanoFromCanvas = showPano; // canvases and images are both fine as textures

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
  }

  // ---------------------------------------------------------------- demo mode
  // Paints a simple sample panorama locally so the whole flow can be tested
  // before the real generator is connected. Seeded by the prompt text so
  // different descriptions look slightly different.
  function makeSamplePanorama(prompt) {
    let seed = 0;
    for (const ch of prompt) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const Wc = 2048, Hc = 1024;
    const c = document.createElement("canvas");
    c.width = Wc; c.height = Hc;
    const x = c.getContext("2d");

    const hueA = Math.floor(rand() * 360), hueB = (hueA + 40 + rand() * 60) % 360;
    const sky = x.createLinearGradient(0, 0, 0, Hc * 0.62);
    sky.addColorStop(0, `hsl(${hueA}, 45%, 12%)`);
    sky.addColorStop(1, `hsl(${hueB}, 60%, 45%)`);
    x.fillStyle = sky;
    x.fillRect(0, 0, Wc, Hc * 0.62);

    // stars
    for (let i = 0; i < 300; i++) {
      x.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.7})`;
      x.fillRect(rand() * Wc, rand() * Hc * 0.4, 1.6, 1.6);
    }

    // sun with halo
    const sx = rand() * Wc, sy = Hc * (0.3 + rand() * 0.2);
    const halo = x.createRadialGradient(sx, sy, 6, sx, sy, 190);
    halo.addColorStop(0, "rgba(255,235,190,0.95)");
    halo.addColorStop(0.18, "rgba(255,215,150,0.5)");
    halo.addColorStop(1, "rgba(255,215,150,0)");
    x.fillStyle = halo;
    x.fillRect(sx - 190, sy - 190, 380, 380);

    // mountain ridges - built from sine waves that repeat around the seam
    const TWO_PI = Math.PI * 2;
    for (let layer = 0; layer < 3; layer++) {
      const base = Hc * (0.5 + layer * 0.05);
      const amp = 60 - layer * 14;
      const f1 = 2 + Math.floor(rand() * 3), f2 = 5 + Math.floor(rand() * 4);
      const p1 = rand() * TWO_PI, p2 = rand() * TWO_PI;
      x.beginPath();
      x.moveTo(0, Hc);
      for (let px = 0; px <= Wc; px += 8) {
        const a = (px / Wc) * TWO_PI;
        x.lineTo(px, base - (Math.sin(a * f1 + p1) * 0.6 + Math.sin(a * f2 + p2) * 0.4) * amp);
      }
      x.lineTo(Wc, Hc);
      x.closePath();
      x.fillStyle = `hsl(${hueA}, 30%, ${14 - layer * 4}%)`;
      x.fill();
    }

    // ground / water sheen
    const gnd = x.createLinearGradient(0, Hc * 0.62, 0, Hc);
    gnd.addColorStop(0, `hsl(${hueB}, 35%, 22%)`);
    gnd.addColorStop(1, `hsl(${hueA}, 40%, 6%)`);
    x.fillStyle = gnd;
    x.fillRect(0, Hc * 0.62, Wc, Hc * 0.38);

    return c;
  }

  function runDemoGeneration(prompt) {
    const lines = [
      "Demo mode - painting a sample scenery...",
      "Sketching the horizon...",
      "Adding light and air...",
    ];
    let i = 0;
    setLoading(lines[0]);
    const tick = setInterval(() => {
      i++;
      if (i < lines.length) { els.status.textContent = lines[i]; return; }
      clearInterval(tick);
      if (cancelled) return;
      hideLoading();
      showPanoFromCanvas(makeSamplePanorama(prompt));
      saveScene(prompt, "demo");
    }, 1400);
  }

  // ---------------------------------------------------------------- real generation
  async function requestGeneration(prompt) {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (res.status === 429) throw new Error("busy");
    if (!res.ok) throw new Error("start-failed");
    const data = await res.json();
    if (!data.id) throw new Error("start-failed");
    return data.id;
  }

  async function pollStatus(id) {
    const res = await fetch(`${PROXY_URL}?id=${encodeURIComponent(id)}`);
    if (res.status === 429) throw new Error("busy");
    if (!res.ok) throw new Error("poll-failed");
    return res.json();
  }

  async function runRealGeneration(prompt) {
    const started = Date.now();
    setLoading("Sending your description to the dream engine...");
    const id = await requestGeneration(prompt);

    while (!cancelled) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (cancelled) return;
      if (Date.now() - started > MAX_WAIT_MS) throw new Error("timeout");

      const s = await pollStatus(id);
      if (s.status === "complete" && s.fileUrl) {
        els.status.textContent = "Almost there - opening your scenery...";
        const img = await loadImage(s.fileUrl);
        if (cancelled) return;
        hideLoading();
        if (showPano(img)) saveScene(prompt, s.fileUrl);
        return;
      }
      if (s.status === "error" || s.status === "abort") throw new Error("generation-failed");

      const pct = typeof s.progress === "number" && s.progress > 0
        ? ` ${Math.min(99, Math.round(s.progress))}%`
        : "";
      els.status.textContent = s.status === "processing"
        ? `Painting your world...${pct}`
        : "Dreaming up your scenery...";
    }
  }

  const FRIENDLY = {
    busy: "The scenery generator is a little busy right now. Take a breath and try again in a minute.",
    timeout: "This one is taking longer than expected. Your description was fine - please try again.",
    "generation-failed": "The generator could not finish this scenery. A slightly different description often helps.",
    "start-failed": "The scenery service could not be reached. Please try again in a moment.",
    "poll-failed": "Lost track of the generation midway. Please try again.",
    default: "Something went wrong on the way to your scenery. Check your connection and try again.",
  };

  async function generate() {
    const prompt = els.input.value.trim();
    if (prompt.length < 3) {
      showError("Describe your place in a few words first - for example: a misty forest at dawn with a quiet lake.");
      return;
    }
    clearError();
    cancelled = false;

    if (!PROXY_URL) { runDemoGeneration(prompt); return; }

    try {
      await runRealGeneration(prompt);
    } catch (err) {
      if (cancelled) return;
      hideLoading();
      openDescribe();
      showError(FRIENDLY[err.message] || FRIENDLY.default);
    }
  }

  // ---------------------------------------------------------------- wiring
  els.generate.addEventListener("click", generate);
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); }
  });

  els.skip.addEventListener("click", () => {
    closeDescribe();
    if (window.PanoViewer.isActive()) exitToClassic();
  });

  els.cancel.addEventListener("click", () => {
    cancelled = true;
    clearTimeout(polling);
    hideLoading();
    openDescribe();
  });

  els.newScenery.addEventListener("click", openDescribe);
  els.openDescribe.addEventListener("click", openDescribe);

  // After "Tune In", land on the describe screen once the welcome has faded
  document.getElementById("tuneIn").addEventListener("click", () => {
    setTimeout(openDescribe, 1600);
  });
})();
