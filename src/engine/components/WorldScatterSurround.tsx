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

/** Legacy per-world scatter (layout modes). */
const SCATTER_VISUAL_SCALE = 9.5;
/** Catalog surround: eight props, each very large on the exposed base ring. */
const OCTET_VISUAL_SCALE = 14;

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

/** ~2–3 large props along each free segment of the rectangular ring (outside inner footprint). */
function buildHeroRingSidePositions(
    rng: () => number,
    cx: number,
    cz: number,
    innerHx: number,
    innerHz: number,
    outerHx: number,
    outerHz: number,
    perSide: number,
    maxN: number
): { x: number; z: number; yaw: number; scaleJitter: number }[] {
    const out: { x: number; z: number; yaw: number; scaleJitter: number }[] = [];
    const jitter = () => 0.94 + rng() * 0.12;
    const pushSeg = (x0: number, z0: number, x1: number, z1: number, n: number) => {
        const nn = Math.max(1, Math.min(maxN, Math.round(n)));
        for (let k = 0; k < nn && out.length < maxN; k++) {
            const t = nn <= 1 ? 0.5 : k / (nn - 1);
            out.push({
                x: x0 + (x1 - x0) * t,
                z: z0 + (z1 - z0) * t,
                yaw: rng() * Math.PI * 2,
                scaleJitter: jitter(),
            });
        }
    };

    const zN = cz + 0.5 * (innerHz + outerHz);
    const zS = cz - 0.5 * (innerHz + outerHz);
    const xE = cx + 0.5 * (innerHx + outerHx);
    const xW = cx - 0.5 * (innerHx + outerHx);

    const splitCounts = (lenA: number, lenB: number): [number, number] => {
        if (lenA < 1e-6 && lenB < 1e-6) return [0, 0];
        if (lenA < 1e-6) return [0, perSide];
        if (lenB < 1e-6) return [perSide, 0];
        const t = lenA + lenB;
        let nA = Math.round((perSide * lenA) / t);
        nA = Math.max(1, Math.min(perSide - 1, nA));
        return [nA, perSide - nA];
    };

    // North (+z): x along outer span, skip inner x gap
    {
        const xa = cx - outerHx;
        const xb = cx + outerHx;
        const xi0 = cx - innerHx;
        const xi1 = cx + innerHx;
        if (xi1 <= xa || xi0 >= xb) {
            pushSeg(xa, zN, xb, zN, perSide);
        } else {
            const lenL = Math.max(0, xi0 - xa);
            const lenR = Math.max(0, xb - xi1);
            const [nL, nR] = splitCounts(lenL, lenR);
            if (lenL > 1e-4) pushSeg(xa, zN, xi0, zN, nL);
            if (lenR > 1e-4) pushSeg(xi1, zN, xb, zN, nR);
        }
    }
    // South (-z)
    {
        const xa = cx - outerHx;
        const xb = cx + outerHx;
        const xi0 = cx - innerHx;
        const xi1 = cx + innerHx;
        if (xi1 <= xa || xi0 >= xb) {
            pushSeg(xa, zS, xb, zS, perSide);
        } else {
            const lenL = Math.max(0, xi0 - xa);
            const lenR = Math.max(0, xb - xi1);
            const [nL, nR] = splitCounts(lenL, lenR);
            if (lenL > 1e-4) pushSeg(xa, zS, xi0, zS, nL);
            if (lenR > 1e-4) pushSeg(xi1, zS, xb, zS, nR);
        }
    }
    // East (+x): z along outer span, skip inner z gap
    {
        const za = cz - outerHz;
        const zb = cz + outerHz;
        const zi0 = cz - innerHz;
        const zi1 = cz + innerHz;
        if (zi1 <= za || zi0 >= zb) {
            pushSeg(xE, za, xE, zb, perSide);
        } else {
            const lenLo = Math.max(0, zi0 - za);
            const lenHi = Math.max(0, zb - zi1);
            const [nLo, nHi] = splitCounts(lenLo, lenHi);
            if (lenLo > 1e-4) pushSeg(xE, za, xE, zi0, nLo);
            if (lenHi > 1e-4) pushSeg(xE, zi1, xE, zb, nHi);
        }
    }
    // West (-x)
    {
        const za = cz - outerHz;
        const zb = cz + outerHz;
        const zi0 = cz - innerHz;
        const zi1 = cz + innerHz;
        if (zi1 <= za || zi0 >= zb) {
            pushSeg(xW, za, xW, zb, perSide);
        } else {
            const lenLo = Math.max(0, zi0 - za);
            const lenHi = Math.max(0, zb - zi1);
            const [nLo, nHi] = splitCounts(lenLo, lenHi);
            if (lenLo > 1e-4) pushSeg(xW, za, xW, zi0, nLo);
            if (lenHi > 1e-4) pushSeg(xW, zi1, xW, zb, nHi);
        }
    }

    return out.slice(0, maxN);
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
    const perSide = layoutMode === 'sparse' ? 2 : 3;
    return buildHeroRingSidePositions(rng, cx, cz, innerHx, innerHz, outerHx, outerHz, perSide, maxN);
}

type ScatterCoreProps = {
    modelWrapRef: React.RefObject<THREE.Group | null>;
    scatterUrl: string;
    layoutMode: SurroundLayoutMode;
    /** Global catalog: exactly eight instances around the base ring (layout dropdown unused). */
    catalogOctet: boolean;
    worldId: string;
    /** Matches [`BuildingModel`](BuildingModel.tsx) primitive scales for FBX/OBJ. */
    formatSourceScale: number;
    root: THREE.Object3D;
};

function ScatterInstancedCore({
    modelWrapRef,
    scatterUrl,
    layoutMode,
    catalogOctet,
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
    }, [scatterUrl, layoutMode, catalogOctet, worldId]);

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

        const key = `${outerHx.toFixed(3)}:${outerHz.toFixed(3)}:${innerHx.toFixed(3)}:${innerHz.toFixed(3)}:${layoutMode}|o:${catalogOctet ? 1 : 0}`;
        if (key === geomKey.current && lastCount.current > 0) return;

        const rng = mulberry32(
            hashStringToSeed(`${worldId}|${scatterUrl}|${layoutMode}|${catalogOctet ? 'oct' : 'leg'}|${key}`)
        );
        const positions = catalogOctet
            ? buildHeroRingSidePositions(rng, cx, cz, innerHx, innerHz, outerHx, outerHz, 2, 8).slice(0, 8)
            : layoutRingPositions(rng, cx, cz, innerHx, innerHz, outerHx, outerHz, MAX_INSTANCES, layoutMode);
        geomKey.current = key;
        const n = Math.min(positions.length, MAX_INSTANCES);
        mesh.count = n;
        lastCount.current = n;

        const groundSpan = Math.max(innerHx * 2, innerHz * 2);
        const stripW = Math.min(outerHx - innerHx, outerHz - innerHz) * 2;
        const ringSpan = Math.max(outerHx * 2, outerHz * 2);

        let targetWorldSize: number;
        let minFootprintWorld: number;
        let visualScale: number;
        if (catalogOctet) {
            targetWorldSize = Math.min(72, Math.max(22, ringSpan * 0.5, stripW * 3.2, groundSpan * 0.45));
            minFootprintWorld = Math.max(16, ringSpan * 0.28, stripW * 1.85, groundSpan * 0.26);
            visualScale = OCTET_VISUAL_SCALE;
        } else {
            targetWorldSize =
                layoutMode === 'packed'
                    ? Math.min(48, Math.max(14, groundSpan * 0.55, stripW * 2.2))
                    : layoutMode === 'spread'
                      ? Math.min(44, Math.max(12, groundSpan * 0.48, stripW * 2.0))
                      : Math.min(40, Math.max(11, groundSpan * 0.42, stripW * 1.85));
            minFootprintWorld =
                layoutMode === 'packed'
                    ? Math.max(8, groundSpan * 0.28, stripW * 1.1)
                    : layoutMode === 'spread'
                      ? Math.max(7, groundSpan * 0.24, stripW * 1.0)
                      : Math.max(6.5, groundSpan * 0.22, stripW * 0.95);
            visualScale = SCATTER_VISUAL_SCALE;
        }

        const geom = meshData.geometry;
        if (!geom.boundingBox) geom.computeBoundingBox();
        const geomMinY = geom.boundingBox?.min.y ?? 0;

        for (let i = 0; i < n; i++) {
            const p = positions[i];
            const rawS = meshData.meshScale * targetWorldSize * formatSourceScale * p.scaleJitter;
            const minS = minFootprintWorld * meshData.meshScale * formatSourceScale;
            const s = Math.max(rawS, minS) * visualScale;
            dummy.rotation.set(0, p.yaw, 0);
            dummy.scale.setScalar(s);
            /** Yaw about Y preserves local Y → lowest vertex world Y = pos.y + s * geomMinY. */
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
    catalogOctet,
    worldId,
}: Omit<ScatterCoreProps, 'formatSourceScale' | 'root'>) {
    const { scene } = useGLTF(scatterUrl);
    return (
        <ScatterInstancedCore
            modelWrapRef={modelWrapRef}
            scatterUrl={scatterUrl}
            layoutMode={layoutMode}
            catalogOctet={catalogOctet}
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
    catalogOctet,
    worldId,
}: Omit<ScatterCoreProps, 'formatSourceScale' | 'root'>) {
    const fbx = useFBX(scatterUrl);
    return (
        <ScatterInstancedCore
            modelWrapRef={modelWrapRef}
            scatterUrl={scatterUrl}
            layoutMode={layoutMode}
            catalogOctet={catalogOctet}
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
    catalogOctet,
    worldId,
}: Omit<ScatterCoreProps, 'formatSourceScale' | 'root'>) {
    const obj = useLoader(OBJLoader, scatterUrl);
    return (
        <ScatterInstancedCore
            modelWrapRef={modelWrapRef}
            scatterUrl={scatterUrl}
            layoutMode={layoutMode}
            catalogOctet={catalogOctet}
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
    catalogOctet = false,
    worldId,
}: {
    modelWrapRef: React.RefObject<THREE.Group | null>;
    scatterUrl: string;
    layoutMode: SurroundLayoutMode;
    catalogOctet?: boolean;
    worldId: string;
}) {
    const ext = extensionFromModelUrl(scatterUrl).toLowerCase().replace(/^\./, '');
    const common = { modelWrapRef, scatterUrl, layoutMode, catalogOctet, worldId };
    if (ext === 'fbx') return <ScatterFromFBX {...common} />;
    if (ext === 'obj') return <ScatterFromOBJ {...common} />;
    return <ScatterFromGLTF {...common} />;
}
