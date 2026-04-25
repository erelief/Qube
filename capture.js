import * as THREE from 'three';

export class ScreenshotCapture {
  constructor() {
    this.renderWidth = 1440;
    this.renderHeight = 1440;
    this.fov = 90;
  }

  setFov(fov) {
    this.fov = fov;
  }

  setResolution(width, height) {
    this.renderWidth = width;
    this.renderHeight = height;
  }

  captureSingleView(scene, yaw, pitch, fov, width, height) {
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const renderTarget = new THREE.WebGLRenderTarget(width, height);
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const euler = new THREE.Euler(pitch, yaw + Math.PI, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    const buffer = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

    const flipped = new Uint8Array(buffer.length);
    const rowSize = width * 4;
    for (let y = 0; y < height; y++) {
      const src = (height - y - 1) * rowSize;
      const dst = y * rowSize;
      flipped.set(buffer.subarray(src, src + rowSize), dst);
    }

    const result = this._toDataUrl(flipped);

    renderTarget.dispose();
    renderer.dispose();

    return result;
  }

  captureSixFaces(scene, yaw) {
    const size = this.renderWidth;
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const renderTarget = new THREE.WebGLRenderTarget(size, size);
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const yaw0 = yaw + Math.PI;
    const directions = [
      { name: 'front', yaw: yaw0,               pitch: 0 },
      { name: 'right', yaw: yaw0 - Math.PI / 2, pitch: 0 },
      { name: 'back',  yaw: yaw0 + Math.PI,     pitch: 0 },
      { name: 'left',  yaw: yaw0 + Math.PI / 2, pitch: 0 },
      { name: 'up',    yaw: yaw0,               pitch: Math.PI / 2 },
      { name: 'down',  yaw: yaw0,               pitch: -Math.PI / 2 },
    ];

    const results = {};

    for (const dir of directions) {
      const euler = new THREE.Euler(dir.pitch, dir.yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      const buffer = new Uint8Array(size * size * 4);
      renderer.readRenderTargetPixels(renderTarget, 0, 0, size, size, buffer);

      const flipped = new Uint8Array(buffer.length);
      const rowSize = size * 4;
      for (let y = 0; y < size; y++) {
        const src = (size - y - 1) * rowSize;
        const dst = y * rowSize;
        flipped.set(buffer.subarray(src, src + rowSize), dst);
      }

      results[dir.name] = this._toDataUrl(flipped, size, size);
    }

    renderTarget.dispose();
    renderer.dispose();

    return results;
  }

  captureFourDirections(scene, yaw, pitch) {
    const camera = new THREE.PerspectiveCamera(
      this.fov,
      this.renderWidth / this.renderHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(this.renderWidth, this.renderHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const renderTarget = new THREE.WebGLRenderTarget(
      this.renderWidth,
      this.renderHeight
    );
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const yaw0 = yaw + Math.PI;
    const directions = [
      { name: 'front', yaw: yaw0, pitch: pitch },
      { name: 'right', yaw: yaw0 - Math.PI / 2, pitch: pitch },
      { name: 'back', yaw: yaw0 + Math.PI, pitch: -pitch },
      { name: 'left', yaw: yaw0 + Math.PI / 2, pitch: pitch },
    ];

    const results = {};

    for (const dir of directions) {
      const euler = new THREE.Euler(dir.pitch, dir.yaw, 0, 'YXZ');
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

  _toDataUrl(pixels, w, h) {
    const width = w || this.renderWidth;
    const height = h || this.renderHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
