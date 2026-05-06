import * as THREE from 'three';

const SIZE = 100;
const AXIS_CONFIGS = [
  { dir: [1, 0, 0], color: 0xff4444 },
  { dir: [0, 1, 0], color: 0x44ff44 },
  { dir: [0, 0, 1], color: 0x4488ff },
];

function createAxisLine(dir, color) {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir).multiplyScalar(0.92)];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

function createArrow(dir, color) {
  const geo = new THREE.ConeGeometry(0.09, 0.22, 12);
  const mat = new THREE.MeshBasicMaterial({ color });
  const cone = new THREE.Mesh(geo, mat);
  const tip = new THREE.Vector3(...dir).multiplyScalar(0.92);
  cone.position.copy(tip);
  const axis = new THREE.Vector3(0, 1, 0);
  const target = new THREE.Vector3(...dir);
  cone.quaternion.setFromUnitVectors(axis, target);
  return cone;
}

export class AxisGizmo {
  constructor(container, mainCamera) {
    this.container = container;
    this.mainCamera = mainCamera;

    // --- DOM: angle text (independent, interactive) ---
    this.angleText = document.createElement('div');
    this.angleText.className = 'axis-gizmo-angle';
    this.angleText.textContent = 'Y 0.0°  P 0.0°';

    // --- DOM: sphere canvas (inside non-interactive wrapper) ---
    this.element = document.createElement('div');
    this.element.className = 'axis-gizmo-wrapper';

    const canvas = document.createElement('canvas');
    this.element.appendChild(canvas);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(SIZE, SIZE);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);

    // --- Camera (fixed, looking at origin) ---
    this.gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.gizmoCamera.position.set(0, 0, 3.5);
    this.gizmoCamera.lookAt(0, 0, 0);

    // --- Scene ---
    this.gizmoScene = new THREE.Scene();

    // Axes group — gets the conjugated camera quaternion applied each frame
    this.axesGroup = new THREE.Group();
    this.gizmoScene.add(this.axesGroup);

    for (const { dir, color } of AXIS_CONFIGS) {
      this.axesGroup.add(createAxisLine(dir, color));
      this.axesGroup.add(createArrow(dir, color));
    }

    this._enabled = false;
    this._editing = false;
    this._outsideHandler = null;
    this._submitTimer = null;
    this._onAngleChange = null;
    this.element.style.display = 'none';
    this.angleText.style.display = 'none';

    // mousedown fires before the document-level outside handler,
    // so we can cancel any pending submit before entering edit mode
    this.angleText.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._cancelPendingSubmit();
      if (this._editing) return;
      const dir = new THREE.Vector3();
      this.mainCamera.getWorldDirection(dir);
      const yaw = THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z));
      const pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, dir.y))));
      this._enterEditMode(yaw, pitch);
    });
  }

  setOnAngleChange(fn) {
    this._onAngleChange = fn;
  }

  setEnabled(enabled) {
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    const display = enabled ? '' : 'none';
    this.element.style.display = display;
    this.angleText.style.display = display;
  }

  _cancelPendingSubmit() {
    if (this._submitTimer !== null) {
      clearTimeout(this._submitTimer);
      this._submitTimer = null;
    }
  }

  _enterEditMode(yawDeg, pitchDeg) {
    if (this._editing) return;
    this._editing = true;

    const yawInput = document.createElement('input');
    yawInput.type = 'number';
    yawInput.className = 'axis-gizmo-angle-input';
    yawInput.value = yawDeg.toFixed(1);
    yawInput.step = '0.1';

    const pitchInput = document.createElement('input');
    pitchInput.type = 'number';
    pitchInput.className = 'axis-gizmo-angle-input';
    pitchInput.value = pitchDeg.toFixed(1);
    pitchInput.step = '0.1';
    pitchInput.min = '-90';
    pitchInput.max = '90';

    this.angleText.innerHTML = '';
    this.angleText.append('Y ', yawInput, '°  P ', pitchInput, '°');

    requestAnimationFrame(() => {
      yawInput.focus();
      yawInput.select();
    });

    const submit = () => {
      if (!this._editing) return;
      this._editing = false;
      this._cleanupOutsideHandler();
      const newYaw = parseFloat(yawInput.value);
      const newPitch = parseFloat(pitchInput.value);
      if (!isNaN(newYaw) && !isNaN(newPitch) && this._onAngleChange) {
        this._onAngleChange(newYaw, Math.max(-90, Math.min(90, newPitch)));
      }
    };

    // Click outside the inputs → submit (deferred to avoid catching the initiating click)
    this._outsideHandler = (e) => {
      if (!yawInput.contains(e.target) && !pitchInput.contains(e.target)) {
        submit();
      }
    };
    this._submitTimer = setTimeout(() => {
      this._submitTimer = null;
      document.addEventListener('mousedown', this._outsideHandler);
    }, 0);

    // mousedown on inputs: stop propagation so outside handler doesn't fire
    const onInputMousedown = (e) => e.stopPropagation();
    yawInput.addEventListener('mousedown', onInputMousedown);
    pitchInput.addEventListener('mousedown', onInputMousedown);

    const onKeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { this._editing = false; this._cleanupOutsideHandler(); this._updateAngleText(); }
    };
    yawInput.addEventListener('keydown', onKeydown);
    pitchInput.addEventListener('keydown', onKeydown);
  }

  _cleanupOutsideHandler() {
    this._cancelPendingSubmit();
    if (this._outsideHandler) {
      document.removeEventListener('mousedown', this._outsideHandler);
      this._outsideHandler = null;
    }
  }

  _updateAngleText() {
    const dir = new THREE.Vector3();
    this.mainCamera.getWorldDirection(dir);
    const yaw = THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z));
    const pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, dir.y))));
    this.angleText.innerHTML = `<span class="axis-gizmo-yaw">Y ${yaw.toFixed(1)}°</span>  <span class="axis-gizmo-pitch">P ${pitch.toFixed(1)}°</span>`;
  }

  update() {
    if (!this._enabled) return;

    // Mirror camera orientation: conjugate = inverse quaternion
    this.axesGroup.quaternion.copy(this.mainCamera.quaternion).conjugate();

    // Angle readout (skip while editing)
    if (!this._editing) {
      const dir = new THREE.Vector3();
      this.mainCamera.getWorldDirection(dir);
      const yaw = THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z));
      const pitch = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, dir.y))));
      this.angleText.innerHTML = `<span class="axis-gizmo-yaw">Y ${yaw.toFixed(1)}°</span>  <span class="axis-gizmo-pitch">P ${pitch.toFixed(1)}°</span>`;
    }

    this.renderer.render(this.gizmoScene, this.gizmoCamera);
  }

  dispose() {
    this._cleanupOutsideHandler();
    this.gizmoScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    if (this.angleText.parentNode) {
      this.angleText.parentNode.removeChild(this.angleText);
    }
  }
}
