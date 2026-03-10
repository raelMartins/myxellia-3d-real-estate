import { Suspense, useRef, useLayoutEffect, useState, useCallback, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Html, Center, useFBX } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useEngineStore } from '../store/engine.store';
import { ErrorBoundary } from 'react-error-boundary';
import UnitBox, { type UnitMesh } from './UnitBox';
import UnitPrism from './UnitPrism';
import type { Database } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];
type DisplayUnit = { id: string; position: [number, number, number]; size: [number, number, number]; footprint?: [number, number][] | null; rotation?: number };

const FALLBACK_UNITS: UnitMesh[] = [
    { id: 'u-101', position: [-3, 1, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-102', position: [3, 1, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-201', position: [-3, 3, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-202', position: [3, 3, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-301', position: [-3, 5, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-302', position: [3, 5, 0], size: [2.8, 1.8, 2.8] },
    { id: 'u-PH1', position: [0, 7.5, 0], size: [6.4, 2.4, 2.8] },
];

/* Separate components per format so hooks are never called conditionally */
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

function Model({ url, extension }: { url: string; extension?: string }) {
    const ext = (extension || url.split('.').pop() || '').toLowerCase().replace(/^\./, '');
    if (ext === 'fbx') return <ModelFBX url={url} />;
    if (ext === 'obj') return <ModelOBJ url={url} />;
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
            {/* Base platform */}
            <mesh position={[0, -0.5, 0]} receiveShadow>
                <boxGeometry args={[14, 0.8, 8]} />
                <meshStandardMaterial color="#141416" roughness={0.8} metalness={0.2} />
            </mesh>
            {/* Central spine */}
            <mesh position={[0, 4, 1.5]} receiveShadow castShadow>
                <boxGeometry args={[1, 9, 1]} />
                <meshStandardMaterial color="#1F1F23" roughness={0.6} metalness={0.4} />
            </mesh>
        </group>
    );
}

export default function BuildingModel() {
    const { building, units, setModelBoundsXZ, focusUnitId } = useEngineStore();
    const onBounds = useCallback((b: { minX: number; maxX: number; minZ: number; maxZ: number }) => setModelBoundsXZ(b), [setModelBoundsXZ]);
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
        }))
        : !building?.model_url ? FALLBACK_UNITS : [];

    const displayUnits = focusUnitId
        ? allDisplayUnits.filter((u) => u.id === focusUnitId)
        : allDisplayUnits;

    return (
        <group>
            <Suspense fallback={
                <Html center>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#C6A664] whitespace-nowrap animate-pulse bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                        Loading 3D Geometry...
                    </div>
                </Html>
            }>
                {building?.model_url ? (
                    <ModelWithRedBase url={building.model_url} onBounds={onBounds} />
                ) : (
                    <PlaceholderBuilding />
                )}
            </Suspense>

            {/* Overlay Status units - only if they exist or as fallback */}
            {/* Prism drag/resize: set allowDrag=false for section-created units unless a global "allow drag section units" toggle is on */}
            {displayUnits.map((u: DisplayUnit) =>
                u.footprint && u.footprint.length >= 3 ? (
                    <UnitPrism
                        key={u.id}
                        unit={{ id: u.id, position: u.position, size: u.size, footprint: u.footprint, rotation: u.rotation ?? 0 }}
                        allowDrag={true}
                    />
                ) : (
                    <UnitBox key={u.id} unit={u} />
                )
            )}
        </group>
    );
}
