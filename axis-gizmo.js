import * as THREE from 'three';

const SIZE = 100;
const AXIS_CONFIGS = [
  { dir: [1, 0, 0], color: 0xff4444, label: 'X' },
  { dir: [0, 1, 0], color: 0x44ff44, label: 'Y' },
  { dir: [0, 0, 1], color: 0x4488ff, label: 'Z' },
];

function createLabelTexture(letter, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createAxisLine(dir, color) {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir).multiplyScalar(0.85)];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

function createArrow(dir, color) {
  const geo = new THREE.ConeGeometry(0.08, 0.25, 12);
  const mat = new THREE.MeshBasicMaterial({ color });
  const cone = new THREE.Mesh(geo, mat);
  const tip = new THREE.Vector3(...dir).multiplyScalar(0.85);
  cone.position.copy(tip);
  // Orient cone to point along the axis direction
  const axis = new THREE.Vector3(0, 1, 0);
  const target = new THREE.Vector3(...dir);
  cone.quaternion.setFromUnitVectors(axis, target);
  return cone;
}

function createLabel(dir, color, letter) {
  const tex = createLabelTexture(letter, color);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(dir[0] * 1.15, dir[1] * 1.15, dir[2] * 1.15);
  sprite.scale.set(0.35, 0.35, 1);
  return sprite;
}

export class AxisGizmo {
  constructor(container, mainCamera) {
    this.container = container;
    this.mainCamera = mainCamera;

    // --- DOM wrapper ---
    this.element = document.createElement('div');
    this.element.className = 'axis-gizmo-wrapper';

    this.angleText = document.createElement('div');
    this.angleText.className = 'axis-gizmo-angle';
    this.angleText.textContent = 'Y 0.0°  P 0.0°';
    this.element.appendChild(this.angleText);

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

    // Wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
    const wireGeo = new THREE.WireframeGeometry(sphereGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      opacity: 0.12,
      transparent: true,
    });
    this.gizmoScene.add(new THREE.LineSegments(wireGeo, wireMat));

    // Axes group — gets the conjugated camera quaternion applied each frame
    this.axesGroup = new THREE.Group();
    this.gizmoScene.add(this.axesGroup);

    for (const { dir, color, label } of AXIS_CONFIGS) {
      this.axesGroup.add(createAxisLine(dir, color));
      this.axesGroup.add(createArrow(dir, color));
      this.axesGroup.add(createLabel(dir, color, label));
    }

    this._enabled = false;
    this._editing = false;
    this._onAngleChange = null;
    this.element.style.display = 'none';

    this.angleText.addEventListener('dblclick', (e) => {
      e.stopPropagation();
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
    this.element.style.display = enabled ? '' : 'none';
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
      const newYaw = parseFloat(yawInput.value);
      const newPitch = parseFloat(pitchInput.value);
      if (!isNaN(newYaw) && !isNaN(newPitch) && this._onAngleChange) {
        this._onAngleChange(newYaw, Math.max(-90, Math.min(90, newPitch)));
      }
    };

    yawInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { pitchInput.focus(); pitchInput.select(); }
      if (e.key === 'Escape') { this._editing = false; this._updateAngleText(); }
    });
    pitchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { this._editing = false; this._updateAngleText(); }
    });
    yawInput.addEventListener('blur', submit);
    pitchInput.addEventListener('blur', submit);
    yawInput.addEventListener('dblclick', (e) => e.stopPropagation());
    pitchInput.addEventListener('dblclick', (e) => e.stopPropagation());
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
  }
}
