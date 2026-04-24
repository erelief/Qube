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
