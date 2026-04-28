import * as THREE from "three";

/*
 * Exterior orbit zoom policy (do not regress):
 * - Max zoom-out (`rectangularParcelMaxDolly`) uses the **axis-aligned rectangular** XZ footprint of the
 *   imported ground (`isWorldGround` only): for the **current** retreat direction, sample rays through
 *   the view frustum onto the ground plane must stay inside [cx±hx, cz±hz] — view-dependent, not a
 *   circular min(hx,hz) shortcut, so long narrow lots stop at the correct parcel edge.
 * - Decorative meshes use `excludeFromGroundOrbitBox` and must NOT use `isWorldGround`.
 * - Looser max dolly **only** while the placement pad is edited (`footprintMaxDollyWhenPadEditingRect`).
 * - Default oblique framing: `DEFAULT_EXTERIOR_OBLIQUE_DOLLY_MULT` × strict rectangular max along that ray
 *   (`snapDefaultObliqueExterior`).
 */

/** Legacy analytic cap (FOV + hx/hz); used only as a search seed / fallback if ray tests fail. */
const FOOTPRINT_SLACK = 0.8;
export const ABS_MAX_DOLLY = 1200;
const MIN_DIST_FLOOR = 0.55;
/** Classic exterior cap; used as floor while pad editing and for fallback views */
export const DEFAULT_EXTERIOR_ORBIT_MAX = 144;
/** Extra zoom headroom while drawing the placement pad (orbit max vs strict footprint) */
export const PAD_EDIT_ORBIT_MAX_MULT = 1.85;

const _raycaster = new THREE.Raycaster();
const _camPos = new THREE.Vector3();
const _u = new THREE.Vector3();
const _savedCamPos = new THREE.Vector3();
const _savedCamQuat = new THREE.Quaternion();

/** NDC samples: perimeter + diagonals + center — enough to bound the ground-plane footprint of the frustum. */
const _ndcSamples: THREE.Vector2[] = (() => {
  const pts: THREE.Vector2[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n;
    pts.push(
      new THREE.Vector2(t, -1),
      new THREE.Vector2(t, 1),
      new THREE.Vector2(-1, t),
      new THREE.Vector2(1, t),
    );
  }
  pts.push(
    new THREE.Vector2(0, 0),
    new THREE.Vector2(-0.65, -0.65),
    new THREE.Vector2(0.65, -0.65),
    new THREE.Vector2(0.65, 0.65),
    new THREE.Vector2(-0.65, 0.65),
  );
  return pts;
})();

type OrbitLike = {
  target: THREE.Vector3;
  object: THREE.PerspectiveCamera;
  update: () => void;
};

/** Analytic FOV vs parcel half-extents (used as seed / fallback only). */
export function footprintMaxDolly(
  persp: THREE.PerspectiveCamera,
  hx: number,
  hz: number,
): number {
  const fovV = THREE.MathUtils.degToRad(persp.fov);
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * persp.aspect);
  const dAxisAligned = Math.min(
    hx / Math.tan(fovH / 2),
    hz / Math.tan(fovV / 2),
  );
  const dYawSafe = Math.min(hx, hz) / Math.tan(Math.max(fovH, fovV) / 2);
  const dFootprint = Math.min(dAxisAligned, dYawSafe) * FOOTPRINT_SLACK;
  return THREE.MathUtils.clamp(dFootprint, MIN_DIST_FLOOR * 6, ABS_MAX_DOLLY);
}

/** Looser max dolly while placement-pad edit is active (multiplier on rectangular strict max). */
export function footprintMaxDollyWhenPadEditingRect(
  strictRectangularMax: number,
): number {
  return THREE.MathUtils.clamp(
    Math.max(
      strictRectangularMax * PAD_EDIT_ORBIT_MAX_MULT,
      DEFAULT_EXTERIOR_ORBIT_MAX * 0.92,
    ),
    MIN_DIST_FLOOR * 6,
    ABS_MAX_DOLLY,
  );
}

/** @deprecated Prefer `footprintMaxDollyWhenPadEditingRect` + `rectangularParcelMaxDolly`. */
export function footprintMaxDollyWhenPadEditing(
  persp: THREE.PerspectiveCamera,
  hx: number,
  hz: number,
): number {
  return footprintMaxDollyWhenPadEditingRect(footprintMaxDolly(persp, hx, hz));
}

/**
 * True iff every sample ray hits `y = planeY` in front of the camera and the hit lies inside the
 * axis-aligned rectangle [cx ± hx] × [cz ± hz] on that plane (parcel treated as a rectangle, not a disk).
 */
function isFrustumGroundInsideRect(
  cam: THREE.PerspectiveCamera,
  camPos: THREE.Vector3,
  target: THREE.Vector3,
  planeY: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  eps: number,
): boolean {
  cam.position.copy(camPos);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);

  for (let i = 0; i < _ndcSamples.length; i++) {
    _raycaster.setFromCamera(_ndcSamples[i], cam);
    const dir = _raycaster.ray.direction;
    const o = _raycaster.ray.origin;
    if (Math.abs(dir.y) < 1e-10) return false;
    const t = (planeY - o.y) / dir.y;
    if (t <= 0) return false;
    const x = o.x + dir.x * t;
    const z = o.z + dir.z * t;
    if (Math.abs(x - cx) > hx + eps || Math.abs(z - cz) > hz + eps)
      return false;
  }
  return true;
}

/**
 * Max |camera − target| along the current retreat direction so the full frustum samples on the ground
 * plane stay inside the rectangular parcel (view-dependent; respects long vs wide lots).
 */
export function rectangularParcelMaxDolly(
  persp: THREE.PerspectiveCamera,
  cameraWorldPosition: THREE.Vector3,
  orbitTarget: THREE.Vector3,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  groundPlaneY: number,
  edgeEps = 0.04,
): number {
  _savedCamPos.copy(persp.position);
  _savedCamQuat.copy(persp.quaternion);

  _u.subVectors(cameraWorldPosition, orbitTarget);
  const d0 = _u.length();
  if (d0 < 1e-6) _u.set(0, 0.35, 1).normalize();
  else _u.multiplyScalar(1 / d0);

  persp.updateProjectionMatrix();

  const seed = footprintMaxDolly(persp, hx, hz);
  const loFloor = Math.max(MIN_DIST_FLOOR * 6, 0.35);

  const test = (dist: number): boolean => {
    _camPos.copy(orbitTarget).addScaledVector(_u, dist);
    return isFrustumGroundInsideRect(
      persp,
      _camPos,
      orbitTarget,
      groundPlaneY,
      cx,
      cz,
      hx,
      hz,
      edgeEps,
    );
  };

  let lo = loFloor;
  if (!test(lo)) {
    persp.position.copy(_savedCamPos);
    persp.quaternion.copy(_savedCamQuat);
    persp.updateMatrixWorld(true);
    return THREE.MathUtils.clamp(
      seed * FOOTPRINT_SLACK,
      loFloor,
      ABS_MAX_DOLLY,
    );
  }

  let hi = Math.max(seed, lo * 1.5);
  let guard = 0;
  while (test(hi) && guard++ < 48 && hi < ABS_MAX_DOLLY) {
    hi += Math.max(seed * 0.2, 0.5);
  }
  hi = Math.min(hi, ABS_MAX_DOLLY);

  if (!test(hi)) {
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) * 0.5;
      if (test(mid)) lo = mid;
      else hi = mid;
    }
  } else {
    lo = Math.min(seed, hi);
  }

  persp.position.copy(_savedCamPos);
  persp.quaternion.copy(_savedCamQuat);
  persp.updateMatrixWorld(true);

  return THREE.MathUtils.clamp(lo, loFloor, ABS_MAX_DOLLY);
}

/**
 * Same as `rectangularParcelMaxDolly` but for a unit direction `unitFromTargetToCamera` (e.g. from spherical phi/theta).
 */
export function rectangularParcelMaxDollyAlongUnitRay(
  persp: THREE.PerspectiveCamera,
  orbitTarget: THREE.Vector3,
  unitFromTargetToCamera: THREE.Vector3,
  hx: number,
  hz: number,
  groundPlaneY: number,
  cx: number,
  cz: number,
  edgeEps = 0.04,
): number {
  const probe = _camPos
    .copy(orbitTarget)
    .addScaledVector(unitFromTargetToCamera, Math.max(MIN_DIST_FLOOR * 8, 1));
  return rectangularParcelMaxDolly(
    persp,
    probe,
    orbitTarget,
    cx,
    cz,
    hx,
    hz,
    groundPlaneY,
    edgeEps,
  );
}

/** Union AABB of meshes tagged `userData.isWorldGround` (imported ground only; see file header). */
export function expandWorldGroundBox(
  scene: THREE.Object3D,
  box: THREE.Box3,
): void {
  box.makeEmpty();
  scene.updateWorldMatrix(true, true);
  scene.traverse((obj) => {
    if (obj.userData?.excludeFromGroundOrbitBox) return;
    if (obj.userData?.isWorldGround && obj instanceof THREE.Mesh) {
      obj.updateWorldMatrix(true, false);
      box.expandByObject(obj);
    }
  });
}

/**
 * Fallback footprint under `worldRootRef` before ground meshes are tagged (load race).
 * Skips `excludeFromGroundOrbitBox` so decorative rings never affect zoom.
 */
export function expandWorldRootGroundFootprintFallback(
  root: THREE.Object3D,
  box: THREE.Box3,
): void {
  box.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverse((obj) => {
    if (obj.userData?.excludeFromGroundOrbitBox) return;
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.updateWorldMatrix(true, false);
      box.expandByObject(mesh);
    }
  });
}

/**
 * Top-down view over ground center; `cameraDistance` overrides default along the top-down ray.
 */
export function snapPlacementPadTopDown(
  scene: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: unknown | null,
  cameraDistance?: number,
): void {
  if (!controls || !camera.isPerspectiveCamera) return;
  const oc = controls as OrbitLike;
  const box = new THREE.Box3();
  expandWorldGroundBox(scene, box);
  if (box.isEmpty()) return;

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const hx = Math.max(size.x * 0.5, 0.35);
  const hz = Math.max(size.z * 0.5, 0.35);
  const planeY = box.min.y;

  const widerAlongX = size.x >= size.z;
  const theta = widerAlongX ? Math.PI / 2 : 0;
  const phi = 0.11;
  const offsetDir = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(1, phi, theta),
  );

  const strictAlongRay = rectangularParcelMaxDollyAlongUnitRay(
    camera,
    center,
    offsetDir,
    hx,
    hz,
    planeY,
    center.x,
    center.z,
  );
  const dist = cameraDistance ?? strictAlongRay;

  const offset = offsetDir.multiplyScalar(dist);
  oc.target.copy(center);
  camera.position.copy(center).add(offset);
  camera.up.set(0, 1, 0);
  oc.update();
}

/** Initial oblique radius = this × strict rectangular max along that view ray. 0.8 ≈ 20% zoomed in from max zoom-out. */
export const DEFAULT_EXTERIOR_OBLIQUE_DOLLY_MULT = 0.8;

/**
 * Default oblique / isometric-ish exterior when no saved bookmark exists (e.g. edge cases).
 * @returns false if ground could not be measured yet (caller may fall back to target-only).
 */
export function snapDefaultObliqueExterior(
  scene: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: unknown | null,
): boolean {
  if (!controls || !camera.isPerspectiveCamera) return false;
  const oc = controls as OrbitLike;
  const box = new THREE.Box3();
  expandWorldGroundBox(scene, box);
  if (box.isEmpty()) return false;

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const hx = Math.max(size.x * 0.5, 0.35);
  const hz = Math.max(size.z * 0.5, 0.35);
  const planeY = box.min.y;

  const phi = 0.52;
  const theta = Math.PI * 0.22;
  const offsetDir = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(1, phi, theta),
  );

  const maxAlongRay = rectangularParcelMaxDollyAlongUnitRay(
    camera,
    center,
    offsetDir,
    hx,
    hz,
    planeY,
    center.x,
    center.z,
  );
  const dist = maxAlongRay * DEFAULT_EXTERIOR_OBLIQUE_DOLLY_MULT;

  const offset = offsetDir.multiplyScalar(dist);
  oc.target.copy(center);
  camera.position.copy(center).add(offset);
  camera.up.set(0, 1, 0);
  oc.update();
  return true;
}
