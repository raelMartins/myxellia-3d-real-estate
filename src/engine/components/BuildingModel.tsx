'use client';

import { Suspense, useRef, useLayoutEffect, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Html, Center, useFBX } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useEngineStore } from '@/engine/store/engine.store';
import { ErrorBoundary } from 'react-error-boundary';
import UnitBox, { type UnitMesh } from './UnitBox';
import UnitPrism from './UnitPrism';
import type { Database } from '@/lib/database.types';
import type { GroundPlacementPad } from '@/lib/groundPlacementPad';
import { extensionFromModelUrl } from '@/lib/model3dFormats';
import { meshAabbXZInAncestorSpace } from '@/engine/lib/modelBoundsInAncestorSpace';

type UnitRow = Database['public']['Tables']['units']['Row'];
type DisplayUnit = {
    id: string
    position: [number, number, number]
    size: [number, number, number]
    footprint?: [number, number][] | null
    rotation?: number
    section_plan_sourced?: boolean
};

const FALLBACK_UNITS: UnitMesh[] = [
    { id: 'u-101', position: [-3, 1, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-102', position: [3, 1, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-201', position: [-3, 3, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-202', position: [3, 3, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-301', position: [-3, 5, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-302', position: [3, 5, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-PH1', position: [0, 7.5, 0], size: [6.4, 2.4, 2.8] },
];

function ModelFBX({ url }: { url: string }) {
    const fbx = useFBX(url);
    return <primitive object={fbx} scale={0.005} />;
}
function ModelOBJ({ url }: { url: string }) {
    const obj = useLoader(OBJLoader, url);
    return <primitive object={obj} scale={0.05} />;
}
function ModelGLTF({ url }: { url: string }) {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
}

function ModelBlendUnsupported() {
    return (
        <Html center>
            <div className="max-w-[min(22rem,85vw)] bg-amber-500/15 text-amber-200/95 p-4 rounded-lg backdrop-blur-md border border-amber-500/25 text-[11px] leading-relaxed tracking-wide">
                Blender <span className="font-mono text-amber-100/90">.blend</span> is not rendered in this viewer. Export{' '}
                <span className="font-mono text-amber-100/90">.glb</span> from Blender (File → Export → glTF 2.0), or use world-environment upload with the conversion worker enabled.
            </div>
        </Html>
    );
}

function Model({ url, extension }: { url: string; extension?: string }) {
    const ext = (extension || extensionFromModelUrl(url)).toLowerCase().replace(/^\./, '');
    if (ext === 'fbx') return <ModelFBX url={url} />;
    if (ext === 'obj') return <ModelOBJ url={url} />;
    if (ext === 'blend') return <ModelBlendUnsupported />;
    return <ModelGLTF url={url} />;
}

export function ModelLoader({ url, extension }: { url: string; extension?: string }) {
    return (
        <ErrorBoundary fallback={
            <Html center>
                <div className="bg-red-500/20 text-red-400 p-4 rounded-lg backdrop-blur-md border border-red-500/30 text-xs tracking-widest uppercase">
                    Error Loading 3D Asset
                </div>
            </Html>
        }>
            <Model url={url} extension={extension} />
        </ErrorBoundary>
    );
}

const BASE_HEIGHT = 0.04;

function ModelWithRedBase({ url, extension, onBounds }: { url: string; extension?: string; onBounds: (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => void }) {
    const modelRef = useRef<THREE.Group>(null);
    const [groundOffset, setGroundOffset] = useState(0);

    useLayoutEffect(() => {
        const group = modelRef.current;
        if (!group) return;
        const box = new THREE.Box3().setFromObject(group);
        setGroundOffset(BASE_HEIGHT - box.min.y);
        onBounds({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    }, [url, onBounds]);

    return (
        <group position={[0, groundOffset, 0]}>
            <group ref={modelRef}>
                <Center top>
                    <ModelLoader url={url} extension={extension} />
                </Center>
            </group>
        </group>
    );
}

function PlaceholderBuilding() {
    return (
        <group>
            <mesh position={[0, -0.5, 0]} receiveShadow>
                <boxGeometry args={[14, 0.8, 8]} />
                <meshStandardMaterial color="#141416" roughness={0.8} metalness={0.2} />
            </mesh>
            <mesh position={[0, 4, 1.5]} receiveShadow castShadow>
                <boxGeometry args={[1, 9, 1]} />
                <meshStandardMaterial color="#1F1F23" roughness={0.6} metalness={0.4} />
            </mesh>
        </group>
    );
}

/** Pick 0 or π/2 so the building’s longer XZ footprint aligns with the pad’s larger half-extent (maximizes contain scale). */
function pickAutoLengthwiseYawRad(
    orient: THREE.Object3D,
    scaled: THREE.Object3D,
    modelOnly: THREE.Object3D,
    hx: number,
    hz: number
): number {
    const candidates = [0, Math.PI / 2];
    let best = 0;
    let bestFit = -1;
    scaled.scale.set(1, 1, 1);
    for (const b of candidates) {
        orient.rotation.set(0, b, 0);
        orient.updateMatrixWorld(true);
        scaled.updateMatrixWorld(true);
        modelOnly.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(modelOnly);
        const W = box.max.x - box.min.x;
        const D = box.max.z - box.min.z;
        if (W < 1e-6 || D < 1e-6) continue;
        const fit = Math.min((2 * hx) / W, (2 * hz) / D);
        if (fit > bestFit + 1e-9) {
            bestFit = fit;
            best = b;
        }
    }
    return best;
}

function BuildingPadFit({
    placementPad,
    url,
    extension,
    children,
    onModelBoundsXZ,
}: {
    placementPad: GroundPlacementPad;
    url: string;
    extension?: string;
    children: ReactNode;
    onModelBoundsXZ: (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => void;
}) {
    const [s, setS] = useState(1);
    const orientRef = useRef<THREE.Group>(null);
    const scaled = useRef<THREE.Group>(null);
    const modelOnlyRef = useRef<THREE.Group>(null);
    const [cx, cz] = placementPad.center;
    const userYaw = placementPad.buildingYaw ?? 0;

    useLayoutEffect(() => {
        const orient = orientRef.current;
        const g = scaled.current;
        const modelOnly = modelOnlyRef.current;
        if (!orient || !g || !modelOnly) return;
        const [hx, hz] = placementPad.halfExtents;

        g.scale.set(1, 1, 1);
        const base = pickAutoLengthwiseYawRad(orient, g, modelOnly, hx, hz);
        orient.rotation.set(0, base + userYaw, 0);

        let sRun = 1;
        for (let i = 0; i < 12; i++) {
            g.scale.set(sRun, sRun, sRun);
            orient.updateMatrixWorld(true);
            g.updateMatrixWorld(true);
            modelOnly.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(modelOnly);
            const W = box.max.x - box.min.x;
            const D = box.max.z - box.min.z;
            if (W < 1e-5 || D < 1e-5) return;
            const sNext = Math.min((2 * hx * sRun) / W, (2 * hz * sRun) / D);
            if (!Number.isFinite(sNext) || sNext <= 0) return;
            if (Math.abs(sNext - sRun) < 1e-5) {
                sRun = sNext;
                break;
            }
            sRun = sNext;
        }
        const clamped = Math.min(Math.max(sRun, 1e-4), 500);
        setS((prev) => (Math.abs(prev - clamped) > 1e-5 ? clamped : prev));

        orient.updateMatrixWorld(true);
        g.updateMatrixWorld(true);
        modelOnly.updateMatrixWorld(true);
        const xz = meshAabbXZInAncestorSpace(modelOnly, g);
        if (xz) onModelBoundsXZ(xz);
    }, [placementPad.halfExtents, placementPad.center, userYaw, url, onModelBoundsXZ]);

    return (
        <group position={[cx, 0, cz]}>
            <group ref={orientRef}>
                <group ref={scaled} scale={[s, s, s]}>
                    <group ref={modelOnlyRef}>
                        <ModelWithRedBase url={url} extension={extension} onBounds={() => {}} />
                    </group>
                    {children}
                </group>
            </group>
        </group>
    );
}

export default function BuildingModel() {
    const { building, units, setModelBoundsXZ, focusUnitId, placementPad, worldPreviewActive } = useEngineStore();
    const onBounds = useCallback(
        (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => {
            setModelBoundsXZ(b);
        },
        [setModelBoundsXZ]
    );
    useEffect(() => {
        if (!building?.model_url) setModelBoundsXZ(null);
    }, [building?.model_url, setModelBoundsXZ]);

    const parsePosition = (u: UnitRow): [number, number, number] => {
        const p = u.position;
        if (Array.isArray(p) && p.length >= 3) return [Number(p[0]), Number(p[1]), Number(p[2])];
        return [0, (u.floor ?? 1) * 3, 0];
    };
    const parseSize = (u: UnitRow): [number, number, number] => {
        const s = u.size;
        if (Array.isArray(s) && s.length >= 3) return [Number(s[0]), Number(s[1]), Number(s[2])];
        return [3, 2, 3];
    };
    const parseFootprint = (u: UnitRow): [number, number][] | null => {
        const f = (u as { footprint?: [number, number][] | null }).footprint;
        if (Array.isArray(f) && f.length >= 3) return f;
        return null;
    };
    const parseRotation = (u: UnitRow): number => {
        const r = (u as { rotation?: number | null }).rotation;
        return typeof r === 'number' && Number.isFinite(r) ? r : 0;
    };
    const allDisplayUnits: DisplayUnit[] = units.length > 0
        ? units.map((u: UnitRow) => ({
            id: u.id,
            position: parsePosition(u),
            size: parseSize(u),
            footprint: parseFootprint(u),
            rotation: parseRotation(u),
            section_plan_sourced: u.section_plan_sourced === true,
        }))
        : !building?.model_url ? FALLBACK_UNITS : [];

    const displayUnits = focusUnitId
        ? allDisplayUnits.filter((u) => u.id === focusUnitId)
        : allDisplayUnits;

    const unitNodes = displayUnits.map((u: DisplayUnit) =>
        u.footprint && u.footprint.length >= 3 ? (
            <UnitPrism
                key={u.id}
                unit={{ id: u.id, position: u.position, size: u.size, footprint: u.footprint, rotation: u.rotation ?? 0 }}
                allowDrag={!u.section_plan_sourced}
            />
        ) : (
            <UnitBox key={u.id} unit={u} />
        )
    );

    return (
        <group>
            <Suspense fallback={
                <Html center>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#C6A664] whitespace-nowrap animate-pulse bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                        Loading 3D Geometry...
                    </div>
                </Html>
            }>
                {building?.model_url && placementPad ? (
                    <BuildingPadFit
                        placementPad={placementPad}
                        url={building.model_url}
                        extension={(building as { model_extension?: string }).model_extension}
                        onModelBoundsXZ={onBounds}
                    >
                        {unitNodes}
                    </BuildingPadFit>
                ) : building?.model_url ? (
                    <>
                        <ModelWithRedBase url={building.model_url} onBounds={onBounds} />
                        {unitNodes}
                    </>
                ) : worldPreviewActive ? null : (
                    <PlaceholderBuilding />
                )}
            </Suspense>

            {!building?.model_url && !worldPreviewActive ? unitNodes : null}
        </group>
    );
}
