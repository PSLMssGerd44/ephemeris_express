/**
 * 3D scene: the Moon lit by the true Sun direction (so the terminator is
 * physically correct for the selected time), the Earth and Sun shown in their
 * true DIRECTIONS (distances compressed for visibility), site marker, and a
 * line from the site to Earth colored by DTE visibility.
 *
 * Frame: lunar ME body-fixed coordinates used directly as scene coordinates;
 * +Z is the lunar north pole.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const R = 1; // Moon radius in scene units
const EARTH_DIST = 5.5;
const SUN_DIST = 9;

function latLonToVec(latDeg, lonDeg, r = R) {
  const lat = (latDeg * Math.PI) / 180, lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat)
  );
}

/** Procedural cratered texture (no external assets needed). */
function makeMoonTextures() {
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8f8f8f';
  ctx.fillRect(0, 0, w, h);
  // large maria-like patches
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 30 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = 110 + Math.random() * 25;
    g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
  }
  // craters
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(60,60,60,0.5)');
    g.addColorStop(0.75, 'rgba(60,60,60,0.12)');
    g.addColorStop(0.85, 'rgba(210,210,210,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { map: tex, bumpMap: new THREE.CanvasTexture(cv) };
}

function makeGlowSprite(color, size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + 'aa');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.setScalar(size);
  return spr;
}

export class Scene3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(2.2, -1.6, -1.6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.25;
    this.controls.maxDistance = 20;

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(2500 * 3);
    for (let i = 0; i < 2500; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9aa3b8, size: 0.07, sizeAttenuation: true })));

    // Moon
    const { map, bumpMap } = makeMoonTextures();
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(R, 96, 96),
      new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.02, roughness: 0.95, metalness: 0 })
    );
    this.scene.add(this.moon);

    // lights
    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 3.2);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x404a5c, 0.25)); // faint earthshine/starlight so night side isn't pure black

    // Sun & Earth markers
    this.sunSprite = makeGlowSprite('#ffd166', 1.6);
    this.scene.add(this.sunSprite);
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x2f7fd4, emissive: 0x16304d, roughness: 0.6 })
    );
    this.scene.add(this.earth);
    this.earthGlow = makeGlowSprite('#4cc9f0', 0.5);
    this.scene.add(this.earthGlow);

    // site marker
    this.siteMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff5964 })
    );
    this.scene.add(this.siteMarker);
    this.siteRing = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.06, 48),
      new THREE.MeshBasicMaterial({ color: 0xff5964, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    this.scene.add(this.siteRing);

    // DTE line site -> Earth
    this.dteGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.dteLine = new THREE.Line(this.dteGeo, new THREE.LineBasicMaterial({ color: 0x7ae582, transparent: true, opacity: 0.9 }));
    this.scene.add(this.dteLine);

    // graticule
    const grat = new THREE.Group();
    const gmat = new THREE.LineBasicMaterial({ color: 0x3a4255, transparent: true, opacity: 0.35 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 4) pts.push(latLonToVec(lat, lon, R * 1.001));
      grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gmat));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLonToVec(lat, lon, R * 1.001));
      grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gmat));
    }
    this.scene.add(grat);

    this._raf = null;
    this._animate = this._animate.bind(this);
    this._animate();
    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  _resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Move camera so the site faces the viewer. */
  focusSite(latDeg, lonDeg) {
    const dir = latLonToVec(latDeg, lonDeg, 1).normalize();
    const dist = this.camera.position.length() || 2.8;
    this.camera.position.copy(dir.multiplyScalar(Math.max(dist, 2.2)));
    this.controls.update();
  }

  /**
   * @param {Object} s
   *  sunDir, earthDir: unit vectors (ME frame); site: {lat, lon};
   *  earthVisible: boolean
   */
  setState(s) {
    const sunDir = new THREE.Vector3(...s.sunDir);
    const earthDir = new THREE.Vector3(...s.earthDir);
    this.sunLight.position.copy(sunDir.clone().multiplyScalar(20));
    this.sunSprite.position.copy(sunDir.clone().multiplyScalar(SUN_DIST));
    this.earth.position.copy(earthDir.clone().multiplyScalar(EARTH_DIST));
    this.earthGlow.position.copy(this.earth.position);

    const sitePos = latLonToVec(s.site.lat, s.site.lon, R * 1.002);
    this.siteMarker.position.copy(sitePos);
    this.siteRing.position.copy(sitePos.clone().multiplyScalar(1.001));
    this.siteRing.lookAt(sitePos.clone().multiplyScalar(2));

    this.dteGeo.setFromPoints([sitePos, this.earth.position]);
    this.dteLine.material.color.set(s.earthVisible ? 0x7ae582 : 0xef6d6d);
    this.dteLine.material.opacity = s.earthVisible ? 0.9 : 0.35;
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    this.controls.update();
    this._resize();
    this.renderer.render(this.scene, this.camera);
  }
}
