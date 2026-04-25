# Q°ube

<p align="center">
  <img src="images/logo.png" alt="MiniMix Logo" width="120">
</p>


**One-click cubemap generator.**

Drop in any 360° panorama image — get a ready-to-use capture/cubemap instantly.

![Tauri](https://img.shields.io/badge/built%20with-Tauri-blueviolet) ![License](https://img.shields.io/badge/license-MIT-green)

## Why Q°ube?

- **Live 3D preview** — See your 360° panorama image applied to a sphere in real time before exporting.
- **One-click conversion** — Load an 360° panorama image, click capture, done.
- **Multiple export formats** — PNG cubemap faces, ready to drop into any engine.
- **Cross-platform** — Windows, macOS.

## Quick Start

1. Download the latest release for your platform.
2. Open Q°ube.
3. Drag in an equirectangular HDR or EXR image (or use File > Open).
4. Preview the 360° panorama image in the 3D viewer — rotate to inspect every face.
5. Click **Capture/Cubemap** to generate image(s).
6. Export when you're happy.

That's it. No config files, no command line, no fuss.


## Tech Stack

Built with [Tauri v2](https://tauri.app), [Three.js](https://threejs.org), and Rust.

## License

MIT
