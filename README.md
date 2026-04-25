# Q°ube

<p align="center">
  <img src="images/logo.png" alt="MiniMix Logo" width="120">
</p>


**One-click cubemap generator for 3D artists and game developers.**

Drop in any equirectangular HDR/EXR image — get a ready-to-use cubemap instantly.

![Tauri](https://img.shields.io/badge/built%20with-Tauri-blueviolet) ![License](https://img.shields.io/badge/license-MIT-green)

## Why Q°ube?

Cubemaps are essential for environment lighting, reflections, and skyboxes in 3D engines. But converting equirectangular images into proper cubemap formats is usually a pain — command-line tools, confusing parameters, wrong orientations, missing faces...

**Q°ube solves this with one click.**

## Features

- **One-click conversion** — Load an equirectangular image, click capture, done.
- **Live 3D preview** — See your cubemap applied to a sphere in real time before exporting.
- **Multiple export formats** — PNG cubemap faces, ready to drop into any engine.
- **Drag & drop** — Just drag your HDR/EXR file onto the window.
- **Cross-platform** — Windows, macOS, Linux.

## Quick Start

1. Download the latest release for your platform.
2. Open Q°ube.
3. Drag in an equirectangular HDR or EXR image (or use File > Open).
4. Click **Cubemap** to generate the cubemap.
5. Preview the result in the 3D viewer — rotate to inspect every face.
6. Export when you're happy.

That's it. No config files, no command line, no fuss.

## Screenshots

*(Add screenshots here)*

## Supported Formats

| Input | Output |
|-------|--------|
| HDR (.hdr) | Cubemap faces (PNG) |
| EXR (.exr) | Cubemap faces (PNG) |
| JPG / PNG | Cubemap faces (PNG) |

## Tech Stack

Built with [Tauri v2](https://tauri.app), [Three.js](https://threejs.org), and Rust.

## License

MIT
