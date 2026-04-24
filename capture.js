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

    const directions = [
      { name: 'front', yaw: yaw, pitch: pitch },
      { name: 'right', yaw: yaw - Math.PI / 2, pitch: pitch },
      { name: 'back', yaw: yaw + Math.PI, pitch: -pitch },
      { name: 'left', yaw: yaw + Math.PI / 2, pitch: pitch },
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
