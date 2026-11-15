/**
 * 3D scene with two modes:
 *
 * GLOBE — the whole Moon in the ME body-fixed frame, lit by the true Sun
 * direction (the terminator is real for the selected time), Earth/Sun shown
 * in true directions (distances compressed), site marker, DTE line.
 *
 * TERRAIN — real LOLA topography around a south-polar site (96 km patch,
 * vertical scale 1:1, curvature included) in the site's local ENU frame,
 * lit by the Sun at its true azimuth/elevation with SHADOW MAPPING: the
 * long polar shadows you see are computed from real terrain and the real
 * Sun position.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PATCH_SCENE_SIZE, buildTerrainMesh } from './terrain.js';

const R = 1;
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

function azElToEnu(azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(el),   // east
    Math.cos(az) * Math.cos(el),   // north
    Math.sin(el)                   // up
  );
}

function makeMoonTextures() {
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8f8f8f';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 30 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = 110 + Math.random() * 25;
    g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
  }
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
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  spr.scale.setScalar(size);
  return spr;
}

function makeTextSprite(text, color = '#cfd6e4', px = 48) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = `bold ${px}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 32);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  spr.scale.set(0.3, 0.15, 1);
  return spr;
}

export class Scene3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.005, 100);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(2.2, -1.6, -1.6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.onCameraChange = null;
    this.controls.addEventListener('change', () => { if (this.onCameraChange) this.onCameraChange(); });
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 20;

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(2500 * 3);
    for (let i = 0; i < 2500; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9aa3b8, size: 0.07 })));

    // shared lights
    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 3.2);
    this.sunLight.castShadow = true;
    const sc = this.sunLight.shadow.camera;
    sc.left = sc.bottom = -PATCH_SCENE_SIZE * 0.75;
    sc.right = sc.top = PATCH_SCENE_SIZE * 0.75;
    sc.near = 0.1; sc.far = 40;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.002;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.ambient = new THREE.AmbientLight(0x404a5c, 0.25);
    this.scene.add(this.ambient);
    // fill light so terrain relief stays readable in lunar night / grazing sun
    this.hemi = new THREE.HemisphereLight(0x93a7cc, 0x16120d, 0.0);
    this.scene.add(this.hemi);

    this.sunSprite = makeGlowSprite('#ffd166', 1.6);
    this.scene.add(this.sunSprite);
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x2f7fd4, emissive: 0x16304d, roughness: 0.6 })
    );
    this.scene.add(this.earth);
    this.earthGlow = makeGlowSprite('#4cc9f0', 0.5);
    this.scene.add(this.earthGlow);

    // ---- globe group ----
    this.globe = new THREE.Group();
    const { map, bumpMap } = makeMoonTextures();
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(R, 96, 96),
      new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.02, roughness: 0.95 })
    );
    this.globe.add(this.moon);
    this.siteMarker = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff5964 }));
    this.globe.add(this.siteMarker);
    this.siteRing = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.06, 48),
      new THREE.MeshBasicMaterial({ color: 0xff5964, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    this.globe.add(this.siteRing);
    const gmat = new THREE.LineBasicMaterial({ color: 0x3a4255, transparent: true, opacity: 0.35 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 4) pts.push(latLonToVec(lat, lon, R * 1.001));
      this.globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gmat));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLonToVec(lat, lon, R * 1.001));
      this.globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gmat));
    }
    this.scene.add(this.globe);

    // ---- terrain group (mesh added per site) ----
    this.terrain = new THREE.Group();
    this.terrainMesh = null;
    this.tMarker = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 16), new THREE.MeshBasicMaterial({ color: 0xff5964 }));
    this.tMarker.rotation.x = Math.PI / 2; // point down (+z up)
    this.terrain.add(this.tMarker);
    const nArrow = new THREE.Group();
    const nCone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 12), new THREE.MeshBasicMaterial({ color: 0x9fb4d8 }));
    nCone.position.set(0, PATCH_SCENE_SIZE / 2 + 0.1, 0);
    nArrow.add(nCone);
    const nLabel = makeTextSprite('N');
    nLabel.position.set(0, PATCH_SCENE_SIZE / 2 + 0.22, 0.02);
    nArrow.add(nLabel);
    this.terrain.add(nArrow);
    this.scene.add(this.terrain);
    this.terrain.visible = false;

    // DTE line
    this.dteGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.dteLine = new THREE.Line(this.dteGeo, new THREE.LineBasicMaterial({ color: 0x7ae582, transparent: true, opacity: 0.9 }));
    this.scene.add(this.dteLine);

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

  focusSite(latDeg, lonDeg) {
    const dir = latLonToVec(latDeg, lonDeg, 1).normalize();
    const dist = Math.max(this.camera.position.length() || 2.8, 2.2);
    this.camera.position.copy(dir.multiplyScalar(dist));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  focusTerrain() {
    this.camera.position.set(PATCH_SCENE_SIZE * 0.55, -PATCH_SCENE_SIZE * 0.55, PATCH_SCENE_SIZE * 0.38);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Install (or clear) the terrain mesh for the current site. */
  setTerrainData(data, exaggeration = 3) {
    if (this.terrainMesh) {
      this.terrain.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      this.terrainMesh.material.dispose();
      this.terrainMesh = null;
    }
    this._terrainData = data;
    if (data) {
      const { mesh } = buildTerrainMesh(data, exaggeration);
      this.terrainMesh = mesh;
      this.terrain.add(mesh);
      this.tMarker.position.set(0, 0, 0.06);
    }
  }

  /** Rebuild the current terrain with a new vertical exaggeration. */
  setExaggeration(exaggeration) {
    if (this._terrainData) this.setTerrainData(this._terrainData, exaggeration);
  }

  camDistance() {
    return this.camera.position.distanceTo(this.controls.target);
  }

  setCamDistance(d) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target.clone().addScaledVector(dir, d));
    this.controls.update();
  }

  /**
   * mode: 'globe' | 'terrain'
   * Globe: sunDir/earthDir are ME-frame unit vectors, site {lat, lon}.
   * Terrain: sunAzEl/earthAzEl are {azDeg, elDeg} at the site.
   */
  setState(s) {
    const terrainMode = s.mode === 'terrain' && this.terrainMesh;
    this.globe.visible = !terrainMode;
    this.terrain.visible = !!terrainMode;

    let sunPos, earthPos, lineFrom;
    if (terrainMode) {
      const sd = azElToEnu(s.sunAzEl.azDeg, s.sunAzEl.elDeg);
      const ed = azElToEnu(s.earthAzEl.azDeg, s.earthAzEl.elDeg);
      sunPos = sd.clone().multiplyScalar(SUN_DIST);
      earthPos = ed.clone().multiplyScalar(EARTH_DIST);
      this.sunLight.position.copy(sd.clone().multiplyScalar(14));
      this.sunLight.target.position.set(0, 0, 0);
      lineFrom = new THREE.Vector3(0, 0, 0.03);
      // night: kill the direct sun so shadows read correctly; hemisphere fill
      // keeps the relief visible either way
      const night = s.sunAzEl.elDeg <= -0.6;
      this.sunLight.intensity = night ? 0.0 : 3.2;
      this.hemi.intensity = night ? 0.85 : 0.5;
      this.ambient.intensity = night ? 0.3 : 0.16;
    } else {
      this.hemi.intensity = 0.0;
      const sunDir = new THREE.Vector3(...s.sunDir);
      const earthDir = new THREE.Vector3(...s.earthDir);
      sunPos = sunDir.clone().multiplyScalar(SUN_DIST);
      earthPos = earthDir.clone().multiplyScalar(EARTH_DIST);
      this.sunLight.position.copy(sunDir.clone().multiplyScalar(20));
      this.sunLight.target.position.set(0, 0, 0);
      this.sunLight.intensity = 3.2;
      this.ambient.intensity = 0.25;
      const sitePos = latLonToVec(s.site.lat, s.site.lon, R * 1.002);
      this.siteMarker.position.copy(sitePos);
      this.siteRing.position.copy(sitePos.clone().multiplyScalar(1.001));
      this.siteRing.lookAt(sitePos.clone().multiplyScalar(2));
      lineFrom = sitePos;
    }
    this.sunSprite.position.copy(sunPos);
    this.earth.position.copy(earthPos);
    this.earthGlow.position.copy(earthPos);
    this.dteGeo.setFromPoints([lineFrom, earthPos]);
    this.dteLine.material.color.set(s.earthVisible ? 0x7ae582 : 0xef6d6d);
    this.dteLine.material.opacity = s.earthVisible ? 0.9 : 0.35;
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.controls.update();
    this._resize();
    this.renderer.render(this.scene, this.camera);
  }
}
