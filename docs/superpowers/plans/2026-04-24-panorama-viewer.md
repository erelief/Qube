# 360 Panorama Viewer & Multi-Angle Screenshot Tool

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform desktop app (Tauri v2) that loads equirectangular panorama images, renders them in an interactive 3D viewer (Three.js), and captures 4-direction screenshots (front/back/left/right) with optional merged export.

**Architecture:** Frontend vanilla JS + Three.js handles 3D rendering and offscreen screenshot capture. Rust backend handles file I/O, image dimension checking, downsampled loading for oversized images, and image merging/saving. Communication via Tauri IPC (`invoke`).

**Tech Stack:** Tauri v2, Vite, vanilla JavaScript, Three.js, Rust (image crate, base64, tauri-plugin-dialog, tauri-plugin-fs)

---

## File Structure

```
360-camera/
├── index.html                  # App HTML layout
├── style.css                   # Dark theme styles
├── main.js                     # App controller: state, IPC, UI orchestration
├── viewer.js                   # PanoramaViewer class (Three.js scene, sphere, controls)
├── capture.js                  # ScreenshotCapture class (offscreen rendering, 4-dir capture)
├── package.json                # NPM deps (three, @tauri-apps/api, etc.)
├── vite.config.js              # Vite dev server on port 1420
├── src-tauri/
│   ├── Cargo.toml              # Rust deps (image, base64, tauri plugins)
│   ├── build.rs                # Tauri build script
│   ├── tauri.conf.json         # Window config, file associations
│   ├── capabilities/
│   │   └── default.json        # Permissions (fs, dialog)
│   └── src/
│       ├── main.rs             # Entry point
│       └── lib.rs              # IPC commands + tests
```

**Responsibilities:**
- `lib.rs`: All Rust IPC commands — file reading, image info, resize, save, merge. Includes `#[cfg(test)]` module.
- `viewer.js`: Encapsulates Three.js scene, inverted sphere, camera, OrbitControls, texture loading/disposal, resize handling.
- `capture.js`: Encapsulates offscreen WebGLRenderTarget, 4-direction camera rotation, pixel reading, data URL conversion.
- `main.js`: Orchestrates viewer and capture, handles file open dialog, FOV control, capture trigger, export dialog, IPC calls.

---

### Task 1: Project Scaffold and Dependencies

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "panorama-viewer",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "vite": "^6"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "three": "^0.174"
  }
}
```

- [ ] **Step 2: Install npm dependencies**

Run: `npm install`

- [ ] **Step 3: Create vite.config.js**

```javascript
const host = process.env.TAURI_DEV_HOST;

export default {
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
};
```

- [ ] **Step 4: Create src-tauri/Cargo.toml**

```toml
[package]
name = "panorama-viewer"
version = "1.0.0"
edition = "2021"

[lib]
name = "panorama_viewer_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
image = "0.25"
base64 = "0.22"
```

- [ ] **Step 5: Create src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 6: Create src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    panorama_viewer_lib::run()
}
```

- [ ] **Step 7: Create minimal src-tauri/src/lib.rs (placeholder)**

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 8: Commit**

```bash
git add package.json vite.config.js src-tauri/Cargo.toml src-tauri/build.rs src-tauri/src/main.rs src-tauri/src/lib.rs
git commit -m "chore: initialize Tauri v2 project with Three.js and image deps"
```

---

### Task 2: Tauri Configuration

**Files:**
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Create src-tauri/tauri.conf.json**

```json
{
  "productName": "360 Panorama Viewer",
  "version": "1.0.0",
  "identifier": "com.panorama-viewer",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "360 Panorama Viewer",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 2: Create src-tauri/capabilities/default.json**

```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-save",
    "fs:default",
    {
      "identifier": "fs:allow-read-file",
      "allow": [{ "path": "$**" }]
    },
    {
      "identifier": "fs:allow-write-file",
      "allow": [{ "path": "$**" }]
    },
    {
      "identifier": "fs:allow-exists",
      "allow": [{ "path": "$**" }]
    }
  ]
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run tauri build -- --debug` (or `npm run tauri dev` if tauri.conf.json is ready)
Expected: Compiles without errors, opens an empty window.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "chore: add Tauri window config and filesystem permissions"
```

---

### Task 3: Rust Backend — Image Info and File Reading Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing tests for get_image_info and read_file_as_data_url**

Add this test module to `src-tauri/src/lib.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, RgbaImage};

    fn create_test_image(path: &str, w: u32, h: u32) {
        let img = RgbaImage::from_pixel(w, h, image::Rgba([255, 0, 0, 255]));
        img.save_with_format(path, ImageFormat::Png).unwrap();
    }

    #[test]
    fn test_get_image_info() {
        let path = std::env::temp_dir().join("test_panorama_info.png");
        create_test_image(path.to_str().unwrap(), 4096, 2048);
        let info = get_image_info(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(info.width, 4096);
        assert_eq!(info.height, 2048);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_file_as_data_url_png() {
        let path = std::env::temp_dir().join("test_panorama_read.png");
        create_test_image(path.to_str().unwrap(), 100, 50);
        let result = read_file_as_data_url(path.to_str().unwrap().to_string()).unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        assert!(result.len() > 100);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_file_as_data_url_jpg() {
        let path = std::env::temp_dir().join("test_panorama_read.jpg");
        let img = RgbaImage::from_pixel(100, 50, image::Rgba([0, 255, 0, 255]));
        img.save_with_format(&path, ImageFormat::Jpeg).unwrap();
        let result = read_file_as_data_url(path.to_str().unwrap().to_string()).unwrap();
        assert!(result.starts_with("data:image/jpeg;base64,"));
        let _ = std::fs::remove_file(&path);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test`
Expected: Compile errors — `get_image_info` and `read_file_as_data_url` not defined.

- [ ] **Step 3: Write the implementations**

Add these structs and commands above the `#[cfg(test)]` module in `src-tauri/src/lib.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;

#[derive(Serialize, Deserialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn get_image_info(path: String) -> Result<ImageInfo, String> {
    let reader = image::io::Reader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?;
    let (w, h) = reader.into_dimensions()
        .map_err(|e| format!("Failed to read dimensions: {}", e))?;
    Ok(ImageInfo { width: w, height: h })
}

fn mime_from_path(path: &str) -> &'static str {
    match std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    }
}

#[tauri::command]
pub fn read_file_as_data_url(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let mime = mime_from_path(&path);
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}
```

- [ ] **Step 4: Register commands in lib.rs run()**

Update the `run()` function:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_image_info,
            read_file_as_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test`
Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): add get_image_info and read_file_as_data_url commands"
```

---

### Task 4: Rust Backend — Image Resize Command

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing test for resize_image**

Add to the `#[cfg(test)]` mod tests block:

```rust
    #[test]
    fn test_resize_image_no_resize_needed() {
        let path = std::env::temp_dir().join("test_small.png");
        create_test_image(path.to_str().unwrap(), 200, 100);
        let result = resize_image(path.to_str().unwrap().to_string(), 1000).unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_resize_image_downsamples() {
        let path = std::env::temp_dir().join("test_large.png");
        create_test_image(path.to_str().unwrap(), 2000, 1000);
        let result = resize_image(path.to_str().unwrap().to_string(), 500).unwrap();
        // Decode the returned data URL and verify dimensions
        let b64_part = result.split(',').nth(1).unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64_part).unwrap();
        let img = image::load_from_memory(&bytes).unwrap();
        assert!(img.width() <= 500);
        assert!(img.height() <= 500);
        let _ = std::fs::remove_file(&path);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test`
Expected: Compile error — `resize_image` not defined.

- [ ] **Step 3: Implement resize_image**

Add to `lib.rs` (above `#[cfg(test)]`):

```rust
#[tauri::command]
pub fn resize_image(path: String, max_size: u32) -> Result<String, String> {
    let img = image::io::Reader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let max_dim = img.width().max(img.height());
    if max_dim <= max_size {
        return read_file_as_data_url(path);
    }

    let ratio = max_size as f32 / max_dim as f32;
    let new_w = (img.width() as f32 * ratio) as u32;
    let new_h = (img.height() as f32 * ratio) as u32;
    let resized = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);

    let mut buf = Vec::new();
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    let format = match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        _ => image::ImageFormat::Png,
    };
    resized.write_to(&mut Cursor::new(&mut buf), format)
        .map_err(|e| format!("Failed to encode: {}", e))?;

    let mime = if matches!(ext, "jpg" | "jpeg") { "image/jpeg" } else { "image/png" };
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}
```

- [ ] **Step 4: Register the command**

Add `resize_image` to the `invoke_handler` list:

```rust
        .invoke_handler(tauri::generate_handler![
            get_image_info,
            read_file_as_data_url,
            resize_image,
        ])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test`
Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): add resize_image command for oversized panoramas"
```

---

### Task 5: Rust Backend — Save and Merge Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing tests for save_image and merge_images**

Add to the `#[cfg(test)]` mod tests block:

```rust
    #[test]
    fn test_save_image() {
        let path = std::env::temp_dir().join("test_save_out.png");
        let data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==".to_string();
        save_image(data_url, path.to_str().unwrap().to_string()).unwrap();
        assert!(path.exists());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_merge_images_horizontal() {
        let img = RgbaImage::from_pixel(100, 50, image::Rgba([255, 0, 0, 255]));
        let mut png_buf = Vec::new();
        img.write_to(&mut Cursor::new(&mut png_buf), ImageFormat::Png).unwrap();
        let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_buf);
        let data_url = format!("data:image/png;base64,{}", b64);

        let output = std::env::temp_dir().join("test_merged_h.png");
        merge_images(
            vec![data_url.clone(); 4],
            MergeOptions { layout: "horizontal".to_string(), format: "png".to_string(), quality: 95 },
            output.to_str().unwrap().to_string(),
        ).unwrap();

        let merged = image::io::Reader::open(&output).unwrap().decode().unwrap();
        assert_eq!(merged.width(), 400);
        assert_eq!(merged.height(), 50);
        let _ = std::fs::remove_file(&output);
    }

    #[test]
    fn test_merge_images_grid() {
        let img = RgbaImage::from_pixel(100, 50, image::Rgba([0, 0, 255, 255]));
        let mut png_buf = Vec::new();
        img.write_to(&mut Cursor::new(&mut png_buf), ImageFormat::Png).unwrap();
        let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_buf);
        let data_url = format!("data:image/png;base64,{}", b64);

        let output = std::env::temp_dir().join("test_merged_grid.png");
        merge_images(
            vec![data_url.clone(); 4],
            MergeOptions { layout: "grid".to_string(), format: "png".to_string(), quality: 95 },
            output.to_str().unwrap().to_string(),
        ).unwrap();

        let merged = image::io::Reader::open(&output).unwrap().decode().unwrap();
        assert_eq!(merged.width(), 200);
        assert_eq!(merged.height(), 100);
        let _ = std::fs::remove_file(&output);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test`
Expected: Compile errors — `save_image`, `merge_images`, `MergeOptions` not defined.

- [ ] **Step 3: Implement save_image and merge_images**

Add to `lib.rs` (above `#[cfg(test)]`):

```rust
#[derive(Serialize, Deserialize)]
pub struct MergeOptions {
    pub layout: String,
    pub format: String,
    pub quality: u8,
}

#[tauri::command]
pub fn save_image(data_url: String, output_path: String) -> Result<(), String> {
    let b64 = data_url.split(',').nth(1).ok_or("Invalid data URL")?;
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    fs::write(&output_path, bytes).map_err(|e| format!("Write error: {}", e))
}

#[tauri::command]
pub fn merge_images(images: Vec<String>, options: MergeOptions, output_path: String) -> Result<(), String> {
    let mut decoded = Vec::new();
    for (i, data_url) in images.iter().enumerate() {
        let b64 = data_url.split(',').nth(1)
            .ok_or_else(|| format!("Invalid data URL at index {}", i))?;
        let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64)
            .map_err(|e| format!("Base64 decode error at index {}: {}", i, e))?;
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Image decode error at index {}: {}", i, e))?;
        decoded.push(img);
    }

    if decoded.is_empty() {
        return Err("No images to merge".to_string());
    }

    let w = decoded[0].width();
    let h = decoded[0].height();
    let count = decoded.len() as u32;

    let (out_w, out_h) = match options.layout.as_str() {
        "horizontal" => (w * count, h),
        "grid" => (w * 2, h * ((count + 1) / 2)),
        _ => return Err(format!("Unknown layout: {}", options.layout)),
    };

    let mut output = image::RgbaImage::new(out_w, out_h);

    for (i, img) in decoded.iter().enumerate() {
        let (x, y) = match options.layout.as_str() {
            "horizontal" => (i as u32 * w, 0),
            "grid" => ((i as u32 % 2) * w, (i as u32 / 2) * h),
            _ => unreachable!(),
        };
        image::imageops::overlay(&mut output, img, x as i64, y as i64);
    }

    let format = match options.format.as_str() {
        "jpeg" | "jpg" => image::ImageFormat::Jpeg,
        _ => image::ImageFormat::Png,
    };
    output.save_with_format(&output_path, format)
        .map_err(|e| format!("Save error: {}", e))
}
```

- [ ] **Step 4: Register the new commands**

```rust
        .invoke_handler(tauri::generate_handler![
            get_image_info,
            read_file_as_data_url,
            resize_image,
            save_image,
            merge_images,
        ])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test`
Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): add save_image and merge_images commands with tests"
```

---

### Task 6: Frontend — HTML Layout

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write index.html with full app structure**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>360 Panorama Viewer</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div id="app">
    <!-- Toolbar -->
    <div id="toolbar">
      <div class="tool-group">
        <button id="btn-open" title="Open Panorama (O)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      <div class="tool-group">
        <label for="fov-slider" class="tool-label">FOV</label>
        <input type="range" id="fov-slider" min="30" max="120" value="90" />
        <span id="fov-value" class="tool-value">90°</span>
      </div>

      <div class="tool-separator"></div>

      <div class="tool-group">
        <button id="btn-capture" title="Capture 4 Directions (C)" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <button id="btn-export" title="Export (E)" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>

      <div class="tool-spacer"></div>

      <div class="tool-info">
        <span id="image-info">No image loaded</span>
      </div>
    </div>

    <!-- 3D Viewer Container -->
    <div id="viewer"></div>

    <!-- Empty state overlay -->
    <div id="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <p>Drop a panorama image here or click Open</p>
      <p class="hint">Supports JPG, PNG, WebP, BMP</p>
    </div>

    <!-- Export Dialog -->
    <div id="export-dialog" class="dialog hidden">
      <div class="dialog-backdrop"></div>
      <div class="dialog-content">
        <h2>Export Screenshots</h2>

        <div id="preview-grid">
          <div class="preview-item">
            <img id="preview-front" alt="Front" />
            <span>Front</span>
          </div>
          <div class="preview-item">
            <img id="preview-right" alt="Right" />
            <span>Right</span>
          </div>
          <div class="preview-item">
            <img id="preview-back" alt="Back" />
            <span>Back</span>
          </div>
          <div class="preview-item">
            <img id="preview-left" alt="Left" />
            <span>Left</span>
          </div>
        </div>

        <div class="export-options">
          <div class="option-row">
            <label for="export-layout">Layout:</label>
            <select id="export-layout">
              <option value="grid">2x2 Grid</option>
              <option value="horizontal">1x4 Horizontal</option>
            </select>
          </div>
          <div class="option-row">
            <label for="export-format">Format:</label>
            <select id="export-format">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </div>
          <div class="option-row" id="quality-row">
            <label for="export-quality">Quality:</label>
            <input type="range" id="export-quality" min="1" max="100" value="95" />
            <span id="quality-value">95%</span>
          </div>
        </div>

        <div class="dialog-actions">
          <button id="btn-save-merged" class="btn-primary">Save Merged</button>
          <button id="btn-save-individual">Save Individual</button>
          <button id="btn-cancel-export">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Drop zone overlay -->
    <div id="drop-zone" class="hidden">
      <div class="drop-zone-content">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drop panorama image here</p>
      </div>
    </div>
  </div>

  <script type="module" src="/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify HTML renders in browser**

Run: `npm run tauri dev`
Expected: Window opens showing toolbar and empty state message. No styling yet.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add HTML layout with toolbar, viewer, export dialog"
```

---

### Task 7: Frontend — CSS Dark Theme

**Files:**
- Create: `style.css`

- [ ] **Step 1: Write style.css with complete dark theme**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #0d0d14;
  --bg-secondary: #16162a;
  --bg-tertiary: #1e1e3a;
  --bg-hover: #2a2a50;
  --accent: #e94560;
  --accent-hover: #ff5a75;
  --text-primary: #e8e8f0;
  --text-secondary: #8888aa;
  --border: #2a2a44;
  --radius: 6px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  height: 100vh;
  user-select: none;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Toolbar */
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  height: 46px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.tool-value {
  font-size: 12px;
  color: var(--text-primary);
  min-width: 30px;
  text-align: center;
}

.tool-separator {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 4px;
}

.tool-spacer {
  flex: 1;
}

.tool-info {
  font-size: 12px;
  color: var(--text-secondary);
}

#toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

#toolbar button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--accent);
}

#toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

#toolbar button.active {
  background: var(--accent);
  border-color: var(--accent);
}

input[type="range"] {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

/* Viewer */
#viewer {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#viewer canvas {
  display: block;
}

/* Empty State */
#empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-secondary);
  pointer-events: none;
}

#empty-state svg {
  margin-bottom: 16px;
  opacity: 0.4;
}

#empty-state p {
  margin: 4px 0;
  font-size: 14px;
}

#empty-state .hint {
  font-size: 12px;
  opacity: 0.6;
}

#empty-state.hidden {
  display: none;
}

/* Export Dialog */
.dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
}

.dialog.hidden {
  display: none;
}

.dialog-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
}

.dialog-content {
  position: relative;
  max-width: 640px;
  margin: 60px auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.dialog-content h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

/* Preview Grid */
#preview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.preview-item {
  text-align: center;
}

.preview-item img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.preview-item span {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Export Options */
.export-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius);
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-row label {
  font-size: 13px;
  min-width: 60px;
  color: var(--text-secondary);
}

.option-row select {
  flex: 1;
  padding: 4px 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
}

/* Dialog Actions */
.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.dialog-actions button {
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.dialog-actions button:hover {
  background: var(--bg-hover);
}

.dialog-actions .btn-primary {
  background: var(--accent);
  border-color: var(--accent);
}

.dialog-actions .btn-primary:hover {
  background: var(--accent-hover);
}

/* Drop Zone */
#drop-zone {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(233, 69, 96, 0.15);
  border: 3px dashed var(--accent);
  z-index: 999;
  pointer-events: none;
}

#drop-zone.hidden {
  display: none;
}

.drop-zone-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--accent);
}

.drop-zone-content p {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 600;
}
```

- [ ] **Step 2: Verify styling in dev mode**

Run: `npm run tauri dev`
Expected: Dark themed toolbar, centered empty state with globe icon.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat(ui): add dark theme CSS with toolbar, viewer, dialog styles"
```

---

### Task 8: Frontend — PanoramaViewer Class

**Files:**
- Create: `viewer.js`

- [ ] **Step 1: Write the PanoramaViewer class**

```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class PanoramaViewer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.texture = null;

    this.camera = new THREE.PerspectiveCamera(
      90,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 0.01);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    this.sphere = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    this.scene.add(this.sphere);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = -0.3;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.2;

    this._onResize = () => this._handleResize();
    window.addEventListener('resize', this._onResize);

    this._animate();
  }

  _handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  async loadTexture(dataUrl) {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }

    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        dataUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this.texture = texture;
          this.sphere.material.dispose();
          this.sphere.material = new THREE.MeshBasicMaterial({ map: texture });
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  setFov(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  getYawPitch() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return {
      yaw: Math.atan2(dir.x, dir.z),
      pitch: Math.asin(Math.max(-1, Math.min(1, dir.y))),
    };
  }

  getScene() {
    return this.scene;
  }

  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    if (this.texture) this.texture.dispose();
    this.sphere.geometry.dispose();
    this.sphere.material.dispose();
    this.renderer.dispose();
    this.controls.dispose();
  }
}
```

- [ ] **Step 2: Verify by temporarily importing in main.js**

Create a minimal `main.js` for verification:

```javascript
import { PanoramaViewer } from './viewer.js';

const container = document.getElementById('viewer');
if (container) {
  const viewer = new PanoramaViewer(container);
}
```

Run: `npm run tauri dev`
Expected: Window opens with dark sphere visible, mouse drag rotates view.

- [ ] **Step 3: Commit**

```bash
git add viewer.js main.js
git commit -m "feat(frontend): add PanoramaViewer class with Three.js sphere and orbit controls"
```

---

### Task 9: Frontend — ScreenshotCapture Class

**Files:**
- Create: `capture.js`

- [ ] **Step 1: Write the ScreenshotCapture class**

```javascript
import * as THREE from 'three';

export class ScreenshotCapture {
  constructor() {
    this.renderWidth = 1920;
    this.renderHeight = 1080;
    this.fov = 90;
  }

  setFov(fov) {
    this.fov = fov;
  }

  setResolution(width, height) {
    this.renderWidth = width;
    this.renderHeight = height;
  }

  captureFourDirections(scene, yaw) {
    const camera = new THREE.PerspectiveCamera(
      this.fov,
      this.renderWidth / this.renderHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(this.renderWidth, this.renderHeight);

    const renderTarget = new THREE.WebGLRenderTarget(
      this.renderWidth,
      this.renderHeight
    );

    const directions = [
      { name: 'front', yaw: yaw },
      { name: 'right', yaw: yaw - Math.PI / 2 },
      { name: 'back', yaw: yaw + Math.PI },
      { name: 'left', yaw: yaw + Math.PI / 2 },
    ];

    const results = {};

    for (const dir of directions) {
      const euler = new THREE.Euler(0, dir.yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      const buffer = new Uint8Array(this.renderWidth * this.renderHeight * 4);
      renderer.readRenderTargetPixels(
        renderTarget,
        0, 0,
        this.renderWidth,
        this.renderHeight,
        buffer
      );

      // Flip vertically (WebGL renders bottom-up)
      const flipped = new Uint8Array(buffer.length);
      const rowSize = this.renderWidth * 4;
      for (let y = 0; y < this.renderHeight; y++) {
        const src = (this.renderHeight - y - 1) * rowSize;
        const dst = y * rowSize;
        flipped.set(buffer.subarray(src, src + rowSize), dst);
      }

      results[dir.name] = this._toDataUrl(flipped);
    }

    renderTarget.dispose();
    renderer.dispose();

    return results;
  }

  _toDataUrl(pixels) {
    const canvas = document.createElement('canvas');
    canvas.width = this.renderWidth;
    canvas.height = this.renderHeight;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(this.renderWidth, this.renderHeight);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
```

- [ ] **Step 2: Verify capture produces data URLs (manual test in browser console)**

Add a temporary test to `main.js`:

```javascript
import { PanoramaViewer } from './viewer.js';
import { ScreenshotCapture } from './capture.js';

const container = document.getElementById('viewer');
const viewer = new PanoramaViewer(container);

// Test capture after 2 seconds
setTimeout(() => {
  const capture = new ScreenshotCapture();
  const results = capture.captureFourDirections(viewer.getScene(), 0);
  console.log('Captured directions:', Object.keys(results));
  for (const [dir, url] of Object.entries(results)) {
    console.log(`${dir}: ${url.substring(0, 50)}... (${url.length} chars)`);
  }
}, 2000);
```

Run: `npm run tauri dev`
Expected: Console logs 4 data URLs for front, right, back, left directions.

- [ ] **Step 3: Commit**

```bash
git add capture.js
git commit -m "feat(frontend): add ScreenshotCapture class with offscreen 4-direction rendering"
```

---

### Task 10: Frontend — Main App Controller

**Files:**
- Modify: `main.js` (replace temporary test code)

- [ ] **Step 1: Write the full main.js controller**

```javascript
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { PanoramaViewer } from './viewer.js';
import { ScreenshotCapture } from './capture.js';

const MAX_TEXTURE_SIZE = 8192;

let viewer = null;
let capture = null;
let capturedImages = null;
let currentImagePath = null;

// DOM elements
const btnOpen = document.getElementById('btn-open');
const btnCapture = document.getElementById('btn-capture');
const btnExport = document.getElementById('btn-export');
const fovSlider = document.getElementById('fov-slider');
const fovValue = document.getElementById('fov-value');
const imageInfo = document.getElementById('image-info');
const emptyState = document.getElementById('empty-state');
const viewerContainer = document.getElementById('viewer');

const exportDialog = document.getElementById('export-dialog');
const exportLayout = document.getElementById('export-layout');
const exportFormat = document.getElementById('export-format');
const exportQuality = document.getElementById('export-quality');
const qualityValue = document.getElementById('quality-value');
const qualityRow = document.getElementById('quality-row');
const btnSaveMerged = document.getElementById('btn-save-merged');
const btnSaveIndividual = document.getElementById('btn-save-individual');
const btnCancelExport = document.getElementById('btn-cancel-export');

const dropZone = document.getElementById('drop-zone');

// Initialize viewer and capture
viewer = new PanoramaViewer(viewerContainer);
capture = new ScreenshotCapture();

// --- File Open ---
btnOpen.addEventListener('click', () => openPanorama());

async function openPanorama() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Images',
      extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']
    }]
  });
  if (!selected) return;
  await loadPanorama(selected);
}

async function loadPanorama(path) {
  try {
    imageInfo.textContent = 'Loading...';

    const info = await invoke('get_image_info', { path });
    imageInfo.textContent = `${info.width} x ${info.height}`;

    let dataUrl;
    const maxDim = Math.max(info.width, info.height);
    if (maxDim > MAX_TEXTURE_SIZE) {
      dataUrl = await invoke('resize_image', { path, maxSize: MAX_TEXTURE_SIZE });
    } else {
      dataUrl = await invoke('read_file_as_data_url', { path });
    }

    await viewer.loadTexture(dataUrl);
    currentImagePath = path;

    emptyState.classList.add('hidden');
    btnCapture.disabled = false;
    capturedImages = null;
    btnExport.disabled = true;

    imageInfo.textContent = `${info.width} x ${info.height}`;
  } catch (err) {
    imageInfo.textContent = 'Error: ' + err;
    console.error('Failed to load panorama:', err);
  }
}

// --- FOV Control ---
fovSlider.addEventListener('input', () => {
  const fov = parseInt(fovSlider.value);
  fovValue.textContent = fov + '°';
  viewer.setFov(fov);
  capture.setFov(fov);
});

// --- Capture ---
btnCapture.addEventListener('click', () => doCapture());

async function doCapture() {
  if (!currentImagePath) return;

  btnCapture.disabled = true;
  imageInfo.textContent = 'Capturing...';

  // Small delay to let UI update
  await new Promise(r => setTimeout(r, 50));

  try {
    const { yaw } = viewer.getYawPitch();
    capturedImages = capture.captureFourDirections(viewer.getScene(), yaw);

    btnExport.disabled = false;
    imageInfo.textContent = 'Captured 4 directions';
  } catch (err) {
    imageInfo.textContent = 'Capture failed: ' + err;
    console.error('Capture error:', err);
  }

  btnCapture.disabled = false;
}

// --- Export Dialog ---
btnExport.addEventListener('click', () => showExportDialog());

function showExportDialog() {
  if (!capturedImages) return;

  document.getElementById('preview-front').src = capturedImages.front;
  document.getElementById('preview-right').src = capturedImages.right;
  document.getElementById('preview-back').src = capturedImages.back;
  document.getElementById('preview-left').src = capturedImages.left;

  exportDialog.classList.remove('hidden');
}

function hideExportDialog() {
  exportDialog.classList.add('hidden');
}

btnCancelExport.addEventListener('click', () => hideExportDialog());
exportDialog.querySelector('.dialog-backdrop').addEventListener('click', () => hideExportDialog());

exportFormat.addEventListener('change', () => {
  qualityRow.style.display = exportFormat.value === 'jpeg' ? 'flex' : 'none';
});

exportQuality.addEventListener('input', () => {
  qualityValue.textContent = exportQuality.value + '%';
});

// --- Save Merged ---
btnSaveMerged.addEventListener('click', async () => {
  const layout = exportLayout.value;
  const format = exportFormat.value;
  const quality = parseInt(exportQuality.value);

  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const filePath = await save({
    defaultPath: `panorama_merged.${ext}`,
    filters: [{ name: format.toUpperCase(), extensions: [ext] }]
  });
  if (!filePath) return;

  try {
    await invoke('merge_images', {
      images: [capturedImages.front, capturedImages.right, capturedImages.back, capturedImages.left],
      options: { layout, format, quality },
      outputPath: filePath,
    });
    imageInfo.textContent = 'Saved: ' + filePath;
    hideExportDialog();
  } catch (err) {
    imageInfo.textContent = 'Save failed: ' + err;
    console.error('Merge save error:', err);
  }
});

// --- Save Individual ---
btnSaveIndividual.addEventListener('click', async () => {
  const format = exportFormat.value;
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  for (const dir of ['front', 'right', 'back', 'left']) {
    const filePath = await save({
      defaultPath: `panorama_${dir}.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }]
    });
    if (!filePath) continue;

    try {
      await invoke('save_image', {
        dataUrl: capturedImages[dir],
        outputPath: filePath,
      });
      imageInfo.textContent = `Saved: ${dir}`;
    } catch (err) {
      imageInfo.textContent = 'Save failed: ' + err;
    }
  }
  hideExportDialog();
});

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.key.toLowerCase()) {
    case 'o':
      openPanorama();
      break;
    case 'c':
      if (!btnCapture.disabled) doCapture();
      break;
    case 'e':
      if (!btnExport.disabled) showExportDialog();
      break;
    case 'escape':
      hideExportDialog();
      break;
  }
});

// --- Drag and Drop ---
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.remove('hidden');
});

document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null || !document.contains(e.relatedTarget)) {
    dropZone.classList.add('hidden');
  }
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.add('hidden');

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext)) return;

  // Tauri file drop gives us the path in the file object
  // We need to use the path from the dataTransfer
  const path = file.path || (file instanceof File && file.name);
  if (path) {
    await loadPanorama(path);
  }
});

// Initialize quality row visibility
qualityRow.style.display = 'none';
```

- [ ] **Step 2: Verify the full application flow**

Run: `npm run tauri dev`

Test sequence:
1. Click Open → file dialog appears → select a panorama image
2. Image loads into 3D sphere viewer
3. Drag to rotate the view
4. Adjust FOV slider → field of view changes
5. Click Capture → status shows "Captured 4 directions"
6. Click Export → preview dialog shows 4 thumbnails
7. Select layout and format → Save Merged
8. Press O/C/E keyboard shortcuts work
9. Drag and drop an image onto the window

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat(frontend): add main app controller with file open, capture, export, drag-drop"
```

---

### Task 11: Integration Testing and Polish

**Files:**
- Modify: `src-tauri/src/lib.rs` (if needed)
- Modify: `main.js` (if needed)

- [ ] **Step 1: Test with a real equirectangular panorama image**

Run: `npm run tauri dev`

Test with a 2:1 aspect ratio panorama (equirectangular projection):
1. Load a 4K panorama (8192x4096) → should load directly
2. Load an 8K panorama (16384x8192) → should auto-resize
3. Verify sphere renders correctly without distortion
4. Verify rotation is smooth with OrbitControls

- [ ] **Step 2: Test screenshot capture accuracy**

1. Face directly at a recognizable feature (e.g., a building or text)
2. Press C to capture
3. Open export dialog
4. Verify: Front shows the feature, Right shows 90° to the right, Back shows 180°, Left shows 270°
5. Verify all 4 images are 1920x1080 and properly oriented (not flipped/mirrored)

- [ ] **Step 3: Test export output**

1. Capture 4 directions
2. Export as merged 2x2 grid PNG
3. Open the exported file → verify correct layout and image quality
4. Export as merged 1x4 horizontal JPEG at 95% quality
5. Open the exported file → verify correct layout

- [ ] **Step 4: Test memory cleanup on image switch**

1. Load a large panorama image
2. Load a different panorama image
3. Monitor memory usage (Task Manager / Activity Monitor)
4. Verify no significant memory leak after 5+ image switches

- [ ] **Step 5: Test edge cases**

1. Drop a non-image file → should be ignored
2. Close export dialog with Escape → dialog closes
3. Open file dialog and cancel → no error
4. Very small image (e.g., 256x128) → should still render (may look blurry)
5. Non-2:1 aspect ratio image → should still render (may look distorted, expected behavior)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: integration testing and polish"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| 3D sphere scene with inverted normals | Task 8 (viewer.js) |
| OrbitControls (rotate only, no pan/zoom) | Task 8 (viewer.js) |
| Texture loading via data URL | Task 8 (viewer.js loadTexture) |
| File open dialog | Task 10 (main.js openPanorama) |
| 4-direction capture (front/left/back/right) | Task 9 (capture.js) |
| Offscreen WebGLRenderTarget rendering | Task 9 (capture.js) |
| Pitch forced to 0 during capture | Task 9 (Euler with pitch=0) |
| Yaw offsets: 0, +π/2, +π, -π/2 | Task 9 (capture.js directions) |
| Base64/pixel data extraction | Task 9 (capture.js readRenderTargetPixels) |
| Camera state preservation | Task 9 (separate camera instance) |
| Single image save | Task 5 (save_image), Task 10 (btnSaveIndividual) |
| Merged image (1x4 horizontal) | Task 5 (merge_images), Task 10 (exportLayout) |
| Merged image (2x2 grid) | Task 5 (merge_images), Task 10 (exportLayout) |
| Rust image crate for merge | Task 5 (image::imageops::overlay) |
| Max texture size check + downsample | Task 4 (resize_image), Task 10 (loadPanorama) |
| Tauri fs scope + convertFileSrc | Task 2 (capabilities), Task 3 (data URL approach) |
| Texture/material/geometry .dispose() | Task 8 (viewer.js dispose + loadTexture) |
| Dark theme UI | Task 7 (style.css) |

### Placeholder Scan

No TBD, TODO, "implement later", "add appropriate error handling", or "similar to Task N" found.

### Type Consistency

- `ImageInfo` struct: `width: u32, height: u32` — used in JS as `info.width`, `info.height`
- `MergeOptions` struct: `layout: String, format: String, quality: u8` — invoked from JS as `{ layout, format, quality }`
- `capturedImages` object keys: `front`, `right`, `back`, `left` — consistent across capture.js and main.js
- IPC parameter names match Rust function parameter names (Tauri deserializes by name): `path`, `maxSize`, `dataUrl`, `outputPath`, `images`, `options`
