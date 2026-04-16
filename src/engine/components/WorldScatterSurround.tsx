'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF, useFBX } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import type { SurroundLayoutMode } from '@/lib/worldEnvironments';
import { extensionFromModelUrl } from '@/lib/model3dFormats';
import { computeGroundSurroundLayout } from '@/engine/lib/worldSurroundLayout';

const MAX_INSTANCES = 4096;

const SCATTER_VISUAL_SCALE = 2.35;

function hashStringToSeed(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0 || 1;
}

function mulberry32(seed: number) {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function isInsideGroundFootprint(
    x: number,
    z: number,
    cx: number,
    cz: number,
    innerHx: number,
    innerHz: number
): boolean {
    return Math.abs(x - cx) < innerHx && Math.abs(z - cz) < innerHz;
}

function prepareScatterMaterial(mat: THREE.Material): THREE.Material {
    const m = mat.clone() as THREE.MeshStandardMaterial & { side?: number; polygonOffset?: boolean };
    if ('side' in m) m.side = THREE.DoubleSide;
    if ('polygonOffset' in m) {
        m.polygonOffset = true;
        m.polygonOffsetFactor = 1;
        m.polygonOffsetUnits = 1;
    }
    if ('depthWrite' in m) m.depthWrite = true;
    return m;
}

/** Prefer the largest mesh by local AABB volume so tiny helpers are not instanced alone. */
function pickLargestMeshData(root: THREE.Object3D): {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    meshScale: number;
} | null {
    root.updateMatrixWorld(true);
    const candidates: THREE.Mesh[] = [];
    root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) candidates.push(obj);
    });
    if (candidates.length === 0) return null;
    let picked = candidates[0];
    let bestVol = -1;
    for (const m of candidates) {
        const g = m.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox;
        if (!bb) continue;
        const s = new THREE.Vector3();
        bb.getSize(s);
        const vol = s.x * s.y * s.z;
        if (vol > bestVol) {
            bestVol = vol;
            picked = m;
        }
    }
    const geom = picked.geometry.clone();
    if (!geom.getAttribute('normal')) geom.computeVertexNormals();
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    if (!box) return null;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const mats = Array.isArray(picked.material) ? picked.material : [picked.material];
    const mat = mats[0] ? prepareScatterMaterial(mats[0]) : new THREE.MeshStandardMaterial({ color: '#5A8F4A' });
    return { geometry: geom, material: mat, meshScale: 1 / maxDim };
}

/** Even grid over the outer parcel, skipping the inner ground footprint. */
function buildClumpGridPositions(
    rng: () => number,
    cx: number,
    cz: number,
    innerHx: number,
    innerHz: number,
    outerHx: number,
    outerHz: number,
    maxN: number,
    densityMul = 1
): { x: number; z: number; yaw: number; scaleJitter: number }[] {
    const spanX = 2 * outerHx;
    const spanZ = 2 * outerHz;
    const ringArea = Math.max(0, 4 * outerHx * outerHz - 4 * innerHx * innerHz);
    const desired = Math.min(maxN, Math.max(320, Math.floor(ringArea * 6.5 * densityMul)));
    const cell = Math.max(0.12, Math.min(0.48, Math.sqrt((spanX * spanZ) / desired)));
    const nx = Math.max(2, Math.ceil(spanX / cell));
    const nz = Math.max(2, Math.ceil(spanZ / cell));
    const stepX = spanX / nx;
    const stepZ = spanZ / nz;
    const out: { x: number; z: number; yaw: number; scaleJitter: number }[] = [];
    for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
            if (out.length >= maxN) return out;
            const x = cx - outerHx + (i + 0.5) * stepX;
            const z = cz - outerHz + (j + 0.5) * stepZ;
            if (isInsideGroundFootprint(x, z, cx, cz, innerHx, innerHz)) continue;
            out.push({
                x,
                z,
                yaw: rng() * Math.PI * 2,
                scaleJitter: 0.88 + rng() * 0.24,
            });
        }
    }
    return out;
}

function buildTreeScatterPositions(
    rng: () => number,
    cx: number,
    cz: number,
    innerHx: number,
    innerHz: number,
    outerHx: number,
    outerHz: number,
    maxN: number,
    opts: { areaFactor: number; minDScale: number; minCount: number }
): { x: number; z: number; yaw: number; scaleJitter: number }[] {
    const ringArea = Math.max(0, 4 * outerHx * outerHz - 4 * innerHx * innerHz);
    const stripW = Math.min(2 * (outerHx - innerHx), 2 * (outerHz - innerHz));
    const targetCount = Math.min(maxN, Math.max(opts.minCount, Math.floor(ringArea * opts.areaFactor)));
    const minD = Math.max(0.75, stripW * 0.14, Math.min(innerHx, innerHz) * 0.16) * opts.minDScale;
    const placed: [number, number][] = [];
    const out: { x: number; z: number; yaw: number; scaleJitter: number }[] = [];
    const maxAttempts = Math.min(25000, targetCount * 200);
    let attempts = 0;
    while (out.length < targetCount && attempts < maxAttempts) {
        attempts++;
        const x = cx + (rng() * 2 - 1) * outerHx;
        const z = cz + (rng() * 2 - 1) * outerHz;
        if (isInsideGroundFootprint(x, z, cx, cz, innerHx, innerHz)) continue;
        let ok = true;
        for (let k = 0; k < placed.length; k++) {
            const dx = x - placed[k][0];
            const dz = z - placed[k][1];
            if (dx * dx + dz * dz < minD * minD) {
                ok = false;
                break;
            }
        }
        if (!ok) continue;
        placed.push([x, z]);
        out.push({
            x,
            z,
            yaw: rng() * Math.PI * 2,
            scaleJitter: 0.85 + rng() * 0.35,
        });
    }
    return out;
}

function layoutRingPositions(
    rng: () => number,
    cx: number,
    cz: number,
    innerHx: number,
    innerHz: number,
    outerHx: number,
    outerHz: number,
    maxN: number,
    layoutMode: SurroundLayoutMode
): { x: number; z: number; yaw: number; scaleJitter: number }[] {
    if (layoutMode === 'packed') {
        return buildClumpGridPositions(rng, cx, cz, innerHx, innerHz, outerHx, outerHz, maxN, 1.15);
    }
    if (layoutMode === 'spread') {
        return buildTreeScatterPositions(rng, cx, cz, innerHx, innerHz, outerHx, outerHz, maxN, {
            areaFactor: 0.14,
            minDScale: 1,
            minCount: 36,
        });
    }
    return buildTreeScatterPositions(rng, cx, cz, innerHx, innerHz, outerHx, outerHz, maxN, {
        areaFactor: 0.055,
        minDScale: 1.55,
        minCount: 18,
    });
}

type ScatterCoreProps = {
    modelWrapRef: React.RefObject<THREE.Group | null>;
    scatterUrl: string;
    layoutMode: SurroundLayoutMode;
    worldId: string;
    formatSourceScale: number;
    root: THREE.Object3D;
};

function ScatterInstancedCore({
    modelWrapRef,
    scatterUrl,
    layoutMode,
    worldId,
    formatSourceScale,
    root,
}: ScatterCoreProps) {
    const meshData = useMemo(() => pickLargestMeshData(root), [root]);
    const instancedRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const geomKey = useRef('');
    const lastCount = useRef(0);

    useEffect(() => {
        geomKey.current = '';
        lastCount.current = 0;
    }, [scatterUrl, layoutMode, worldId]);

    useLayoutEffect(() => {
        const mesh = instancedRef.current;
        if (!mesh || !meshData) return;
        mesh.count = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.excludeFromGroundOrbitBox = true;
        mesh.renderOrder = 2;
    }, [meshData]);

    useEffect(() => {
        return () => {
            meshData?.geometry.dispose();
            const m = meshData?.material;
            if (m && 'dispose' in m && typeof m.dispose === 'function') m.dispose();
        };
    }, [meshData]);

    useFrame(() => {
        const wrap = modelWrapRef.current;
        const mesh = instancedRef.current;
        if (!wrap || !mesh || !meshData) return;

        const layout = computeGroundSurroundLayout(wrap);
        if (!layout) return;
        const { cx, cz, innerHx, innerHz, outerHx, outerHz, scatterSurfaceY } = layout;

        const key = `${outerHx.toFixed(3)}:${outerHz.toFixed(3)}:${innerHx.toFixed(3)}:${innerHz.toFixed(3)}:${layoutMode}`;
        if (key === geomKey.current && lastCount.current > 0) return;

        const rng = mulberry32(hashStringToSeed(`${worldId}|${scatterUrl}|${layoutMode}|${key}`));
        const positions = layoutRingPositions(
            rng,
            cx,
            cz,
            innerHx,
            innerHz,
            outerHx,
            outerHz,
            MAX_INSTANCES,
            layoutMode
        );
        geomKey.current = key;
        const n = Math.min(positions.length, MAX_INSTANCES);
        mesh.count = n;
        lastCount.current = n;

        const groundSpan = Math.max(innerHx * 2, innerHz * 2);
        const targetWorldSize =
            layoutMode === 'packed'
                ? Math.min(11, Math.max(3.6, groundSpan * 0.13))
                : layoutMode === 'spread'
                  ? Math.min(16, Math.max(6, groundSpan * 0.28))
                  : Math.min(18, Math.max(7, groundSpan * 0.32));
        const minFootprintWorld =
            layoutMode === 'packed'
                ? Math.max(0.65, groundSpan * 0.07)
                : layoutMode === 'spread'
                  ? Math.max(1.4, groundSpan * 0.16)
                  : Math.max(1.55, groundSpan * 0.18);

        const geom = meshData.geometry;
        if (!geom.boundingBox) geom.computeBoundingBox();
        const geomMinY = geom.boundingBox?.min.y ?? 0;

        for (let i = 0; i < n; i++) {
            const p = positions[i];
            const rawS = meshData.meshScale * targetWorldSize * formatSourceScale * p.scaleJitter;
            const minS = minFootprintWorld * meshData.meshScale * formatSourceScale;
            const s = Math.max(rawS, minS) * SCATTER_VISUAL_SCALE;
            dummy.rotation.set(0, p.yaw, 0);
            dummy.scale.setScalar(s);
            dummy.position.set(p.x, scatterSurfaceY - s * geomMinY, p.z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    if (!meshData) return null;

    return (
        <instancedMesh
            key={scatterUrl}
            ref={instancedRef}
            args={[meshData.geometry, meshData.material, MAX_INSTANCES]}
            frustumCulled={false}
        />
    );
}

function ScatterFromGLTF({
    modelWrapRef,
    scatterUrl,
    layoutMode,
    worldId,
}: Omit<ScatterCoreProps, 'formatSourceScale' | 'root'>) {
    const { scene } = useGLTF(scatterUrl);
    return (
        <ScatterInstancedCore
            modelWrapRef={modelWrapRef}
            scatterUrl={scatterUrl}
            layoutMode={layoutMode}
            worldId={worldId}
            formatSourceScale={1}
            root={scene}
        />
    );
}

function ScatterFromFBX({
    modelWrapRef,
    scatterUrl,
    layoutMode,
    worldId,
}: Omit<ScatterCoreProps, 'formatSourceScale' | 'root'>) {
    const fbx = useFBX(scatterUrl);
    return (
        <ScatterInstancedCore
            modelWrapRef={modelWrapRef}
            scatterUrl={scatterUrl}
            layoutMode={layoutMode}
            worldId={worldId}
            formatSourceScale={0.008}
            root={fbx}
        />
    );
}

function ScatterFromOBJ({
    modelWrapRef,
    scatterUrl,
    layoutMode,
    worldId,
}: Omit<ScatterCoreProps, 'formatSourceScale' | 'root'>) {
    const obj = useLoader(OBJLoader, scatterUrl);
    return (
        <ScatterInstancedCore
            modelWrapRef={modelWrapRef}
            scatterUrl={scatterUrl}
            layoutMode={layoutMode}
            worldId={worldId}
            formatSourceScale={0.08}
            root={obj}
        />
    );
}

export default function WorldScatterSurround({
    modelWrapRef,
    scatterUrl,
    layoutMode,
    worldId,
}: {
    modelWrapRef: React.RefObject<THREE.Group | null>;
    scatterUrl: string;
    layoutMode: SurroundLayoutMode;
    worldId: string;
}) {
    const ext = extensionFromModelUrl(scatterUrl).toLowerCase().replace(/^\./, '');
    const common = { modelWrapRef, scatterUrl, layoutMode, worldId };
    if (ext === 'fbx') return <ScatterFromFBX {...common} />;
    if (ext === 'obj') return <ScatterFromOBJ {...common} />;
    return <ScatterFromGLTF {...common} />;
}
