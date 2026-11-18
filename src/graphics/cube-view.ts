import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FACES, toFacelets, type CubeState } from '../cube/state';
export const COLORS: Record<string, string> = { U: '#f4efd9', R: '#f16c64', F: '#9ad17b', D: '#f4cd5e', L: '#efa760', B: '#79b5cf' };
export class CubeView {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private cubies: THREE.Group[] = [];
  private body = new THREE.BoxGeometry(.96, .96, .96);
  private sticker = new THREE.PlaneGeometry(.78, .78);
  private bodyMaterial = new THREE.MeshBasicMaterial({ color: '#18201e' });
  private materials = Object.fromEntries(Object.entries(COLORS).map(([k,v]) => [k, new THREE.MeshBasicMaterial({ color: v })]));
  private observer: ResizeObserver;
  private pixel = true;
  private tick?: (now: number) => void;
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', 'Interactive Rubik’s cube. Drag to rotate the view.');
    this.camera.position.set(6, 5, 7); this.camera.lookAt(0,0,0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.enablePan = false; this.controls.minZoom = .7; this.controls.maxZoom = 1.8;
    this.scene.add(this.root);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
    this.renderer.setAnimationLoop(now => { this.tick?.(now); this.controls.update(); this.renderer.render(this.scene, this.camera); });
  }
  private resize() {
    const w = this.host.clientWidth || 600, h = this.host.clientHeight || 420, aspect = w / h;
    this.camera.left = -3.05 * aspect; this.camera.right = 3.05 * aspect; this.camera.top = 3.05; this.camera.bottom = -3.05; this.camera.updateProjectionMatrix();
    const scale = this.pixel ? .54 : Math.min(devicePixelRatio, 2);
    this.renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.imageRendering = this.pixel ? 'pixelated' : 'auto';
  }
  setPixel(value: boolean) { this.pixel = value; this.resize(); }
  resetView() { this.camera.position.set(6,5,7); this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.controls.target.set(0,0,0); this.controls.update(); }
  setState(state: CubeState) {
    this.root.clear(); this.cubies = [];
    const positions = new Map<string, THREE.Group>();
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue;
      const group = new THREE.Group(); group.position.set(x,y,z); group.add(new THREE.Mesh(this.body, this.bodyMaterial));
      this.root.add(group); this.cubies.push(group); positions.set(`${x},${y},${z}`, group);
    }
    const facelets = toFacelets(state);
    for (let face = 0; face < 6; face++) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const xyz = [[col-1,1,row-1],[1,1-row,1-col],[col-1,1-row,1],[col-1,-1,1-row],[-1,1-row,col-1],[1-col,1-row,-1]][face];
      const normal = new THREE.Vector3(...([[0,1,0],[1,0,0],[0,0,1],[0,-1,0],[-1,0,0],[0,0,-1]][face] as [number,number,number]));
      const tile = new THREE.Mesh(this.sticker, this.materials[facelets[face * 9 + row * 3 + col]]);
      tile.position.copy(normal).multiplyScalar(.485); tile.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
      positions.get(xyz.join(','))!.add(tile);
    }
  }
  async turn(m: number, before: CubeState, after: CubeState, duration: number): Promise<void> {
    this.setState(before);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0) { this.setState(after); return; }
    const face = Math.floor(m / 3), axis = ['y','x','z','y','x','z'][face] as 'x' | 'y' | 'z', sign = face < 3 ? 1 : -1;
    const pivot = new THREE.Group(); this.root.add(pivot);
    for (const cubie of this.cubies) if (Math.round(cubie.position[axis]) === sign) pivot.attach(cubie);
    const turns = m % 3 === 0 ? 1 : m % 3 === 1 ? 2 : -1, angle = -sign * turns * Math.PI / 2;
    await new Promise<void>(resolve => {
      let start: number | undefined;
      this.tick = now => {
        start ??= now; const p = Math.min((now - start) / duration, 1), ease = p * p * (3 - 2 * p);
        pivot.rotation[axis] = angle * ease;
        if (p >= 1) { this.tick = undefined; this.setState(after); resolve(); }
      };
    });
  }
}
export function renderNet(element: HTMLElement, state: CubeState, labels: boolean) {
  const stickers = toFacelets(state);
  element.innerHTML = FACES.map((f, i) => `<div class="net-face net-${f}" aria-label="${f} face"><small>${f}</small><div>${[...stickers.slice(i*9,i*9+9)].map(color => `<span style="--sticker:${COLORS[color]}" aria-label="${color}">${labels ? color : ''}</span>`).join('')}</div></div>`).join('');
}
