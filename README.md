# MelodyVR

An immersive audio-visual relaxation experience that runs entirely in your browser. Tune in, breathe, and unwind in a living, interactive landscape.

**Live app:** https://arhaan05.github.io/MelodyVR/

## Features

- **Tune In** — one click starts a generative ambient soundscape (warm melodic pads, ocean/wind textures, and soft chimes), synthesized in real time with the Web Audio API. No audio files, no downloads.
- **Guided breathing** — choose Box Breathing (4·4·4·4), 4·7·8 Calm, or Coherent (5·5). A glowing circle expands and contracts to pace your breath, with gentle chime cues on each inhale and exhale.
- **Interactive landscape** — click anywhere to release a ripple of light and a chime; nearby fireflies drift toward it.
- **Customize your surroundings** — pick from four scenes (Aurora Night, Ocean Sunset, Misty Forest, Mountain Dawn) and fine-tune stars, fireflies, drift speed, and each layer of the soundscape.

## Running locally

It's a fully static site — just open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

## Tech

Vanilla HTML/CSS/JS. The landscape is procedurally rendered on a 2D canvas (value-noise ridgelines, aurora bands, water shimmer, particles) and the audio is fully generative via the Web Audio API. Zero dependencies.
