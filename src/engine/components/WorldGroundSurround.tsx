'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { inferGroundSurroundKind, type GroundSurroundKind } from '@/engine/lib/inferGroundSurroundKind';
import { computeGroundSurroundLayout, proceduralSlabTopY } from '@/engine/lib/worldSurroundLayout';

function sampleMeshAlbedoHex(root: THREE.Object3D): string | null {
    const acc = new THREE.Color(0, 0, 0);
    let n = 0;
    root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
            const m = mat as THREE.MeshStandardMaterial & { color?: THREE.Color };
            if (m.color && m.color.isColor) {
                acc.add(m.color);
                n++;
            }
        }
    });
    if (!n) return null;
    acc.multiplyScalar(1 / n);
    return `#${acc.getHexString()}`;
}

function makeNoiseDataTexture(res: number, contrast: number): THREE.DataTexture {
    const data = new Uint8Array(res * res * 4);
    for (let i = 0; i < res * res; i++) {
        const v = 128 + (Math.random() - 0.5) * contrast * 127;
        const b = Math.max(0, Math.min(255, Math.round(v)));
        const o = i * 4;
        data[o] = b;
        data[o + 1] = b;
        data[o + 2] = b;
        data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(28, 28);
    tex.needsUpdate = true;
    return tex;
}

/** Full rectangular slab in XZ (extends under the imported ground as well as around it). */
function buildFullBasePlane(outerHx: number, outerHz: number): THREE.PlaneGeometry {
    const geo = new THREE.PlaneGeometry(outerHx * 2, outerHz * 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
}

function materialParamsForKind(kind: GroundSurroundKind): {
    color: string;
    roughness: number;
    metalness: number;
    bumpScale: number;
    noiseRepeat: number;
} {
    switch (kind) {
        case 'sand':
            return { color: '#C9A574', roughness: 0.96, metalness: 0, bumpScale: 0.14, noiseRepeat: 36 };
        case 'grass':
            return { color: '#2F4A32', roughness: 0.92, metalness: 0, bumpScale: 0.22, noiseRepeat: 52 };
        default:
            return { color: '#5C5955', roughness: 0.9, metalness: 0.08, bumpScale: 0.18, noiseRepeat: 30 };
    }
}

/**
 * Granular base slab: same outer extent as before (ground footprint + strip on each side) but
 * one continuous plane under the whole parcel so sand/gravel/grass reads as the full foundation.
 */
export default function WorldGroundSurround({
    modelWrapRef,
    envContext,
}: {
    modelWrapRef: React.RefObject<THREE.Group | null>;
    envContext?: string | null;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const geomKey = useRef('');
    const envRef = useRef(envContext);
    envRef.current = envContext;

    const bumpTex = useMemo(() => makeNoiseDataTexture(128, 1.35), []);

    const mat = useMemo(() => {
        const p = materialParamsForKind('gravel');
        return new THREE.MeshStandardMaterial({
            color: p.color,
            roughness: p.roughness,
            metalness: p.metalness,
            bumpMap: bumpTex,
            bumpScale: p.bumpScale,
            polygonOffset: true,
            polygonOffsetFactor: -0.5,
            polygonOffsetUnits: -0.5,
        });
    }, [bumpTex]);

    useEffect(() => {
        return () => {
            bumpTex.dispose();
            mat.dispose();
            const mesh = meshRef.current;
            const g = mesh?.geometry as THREE.BufferGeometry | undefined;
            if (g) g.dispose();
        };
    }, [bumpTex, mat]);

    useFrame(() => {
        const wrap = modelWrapRef.current;
        const mesh = meshRef.current;
        if (!wrap || !mesh) return;

        const layout = computeGroundSurroundLayout(wrap);
        if (!layout) return;
        const { cx, cz, outerHx, outerHz, groundMinY } = layout;

        const key = `${outerHx.toFixed(4)}:${outerHz.toFixed(4)}`;
        if (key !== geomKey.current) {
            geomKey.current = key;
            const prev = mesh.geometry as THREE.BufferGeometry | undefined;
            if (prev) prev.dispose();
            mesh.geometry = buildFullBasePlane(outerHx, outerHz);
        }

        mesh.position.set(cx, proceduralSlabTopY(groundMinY), cz);

        const sampled = sampleMeshAlbedoHex(wrap);
        const kind = inferGroundSurroundKind(envRef.current, sampled);
        const p = materialParamsForKind(kind);
        const std = mat;
        std.color.set(p.color);
        if (sampled && kind === 'gravel') {
            std.color.lerp(new THREE.Color(sampled), 0.35);
        }
        std.roughness = p.roughness;
        std.metalness = p.metalness;
        std.bumpScale = p.bumpScale;
        if (std.bumpMap) {
            std.bumpMap.repeat.set(p.noiseRepeat, p.noiseRepeat);
            std.bumpMap.needsUpdate = true;
        }

        mesh.receiveShadow = true;
        mesh.castShadow = false;
        // Never set `isWorldGround` here — orbit max zoom uses the imported ground mesh only
        // (`exteriorGroundOrbitMath.ts`, `WorldGroundOrbitLimits`). Decorative base only.
        mesh.userData.excludeFromGroundOrbitBox = true;
    });

    return <mesh ref={meshRef} material={mat} />;
}
