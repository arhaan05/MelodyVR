# MelodyVR

An immersive audio-visual relaxation experience that runs entirely in your browser. Tune in, breathe, and unwind in a living, interactive landscape.

**Live app:** https://arhaan05.github.io/MelodyVR/

## Features

- **Tune In** — one click starts a generative ambient soundscape (warm melodic pads, ocean/wind textures, and soft chimes), synthesized in real time with the Web Audio API. No audio files, no downloads.
- **Guided breathing** — choose Box Breathing (4·4·4·4), 4·7·8 Calm, or Coherent (5·5). A glowing circle expands and contracts to pace your breath, with gentle chime cues on each inhale and exhale.
- **Interactive landscape** — click anywhere to release a ripple of light and a chime; nearby fireflies drift toward it.
- **Customize your surroundings** — pick from four scenes (Aurora Night, Ocean Sunset, Misty Forest, Mountain Dawn) and fine-tune stars, fireflies, drift speed, and each layer of the soundscape.

- **Describe Your Scenery** — type a description of your perfect place ("a misty forest at dawn with a quiet lake") and the app generates a 360° panoramic environment you can look around in by dragging (mouse or touch). Powered by the Blockade Labs Skybox AI API through a serverless proxy. Generated scenes are saved to localStorage so you can revisit them from the history list. Until the proxy is connected, the feature runs in demo mode with locally painted sample panoramas.

## Connecting the scenery generator (one-time setup)

The API key must never live in this public repo, so it sits in a tiny proxy function on Vercel:

1. Create an account at [skybox.blockadelabs.com](https://skybox.blockadelabs.com) and copy your API key from the API dashboard ([api.blockadelabs.com](https://api.blockadelabs.com)).
2. Create a free [vercel.com](https://vercel.com) account (sign in with GitHub) and import this repository as a new project. The `api/generate.js` function is detected automatically; all defaults are fine.
3. In the Vercel project: **Settings → Environment Variables** → add `BLOCKADE_API_KEY` with your key as the value → redeploy.
4. Verify it's alive: open `https://<your-project>.vercel.app/api/generate` — you should see `"MelodyVR proxy is alive and has its key."`
5. In `scenery.js`, set `PROXY_URL` to `https://<your-project>.vercel.app/api/generate` and push.

## Running locally

It's a fully static site — just open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

## Tech

Vanilla HTML/CSS/JS. The landscape is procedurally rendered on a 2D canvas (value-noise ridgelines, aurora bands, water shimmer, particles) and the audio is fully generative via the Web Audio API. Zero dependencies.
