import { useRef, useMemo, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Html, Center, useFBX } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useEngineStore } from '../store/engine.store';
import { ErrorBoundary } from 'react-error-boundary';
import { getGroundColor } from '../lib/groundColor';
import type { Database } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];
type DisplayUnit = { id: string; position: [number, number, number]; size: [number, number, number] };

/* ──────────────────────────────────────────────
   Status → Color mapping (Midnight Luxe palette)
   ────────────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
    available: '#39FF14',
    pending: '#F97316',
    sold: '#EF4444',
};

const STATUS_EMISSIVE: Record<string, string> = {
    available: '#1A6600',
    pending: '#7A3800',
    sold: '#6A0000',
};

interface UnitMesh { id: string; position: [number, number, number]; size: [number, number, number] }

/* Fallback units if none are defined in DB */
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

function UnitBox({ unit }: { unit: UnitMesh }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const { selectedUnit, hoveredUnit, unitStatuses, setSelectedUnit, setHoveredUnit, setViewMode } = useEngineStore();
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const status = unitStatuses[unit.id] ?? 'available';
    const isHovered = hoveredUnit === unit.id;
    const isSelected = selectedUnit === unit.id;

    const baseColor = useMemo(() => new THREE.Color(STATUS_COLOR[status]), [status]);
    const emissiveColor = useMemo(() => new THREE.Color(STATUS_EMISSIVE[status]), [status]);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        if (status === 'pending') {
            const pulse = Math.sin(clock.elapsedTime * 3) * 0.5 + 0.5;
            mat.emissiveIntensity = 0.3 + pulse * 0.5;
        } else if (isHovered || isSelected) {
            mat.emissiveIntensity = 0.6;
        } else {
            mat.emissiveIntensity = 0.18;
        }
    });

    const handleClick = () => {
        clickCountRef.current += 1;
        if (clickCountRef.current === 1) {
            setSelectedUnit(unit.id);
            clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 350);
        } else if (clickCountRef.current >= 2) {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickCountRef.current = 0;
            setViewMode('interior');
        }
    };

    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;

    return (
        <mesh
            ref={meshRef}
            position={unit.position}
            scale={[scale, scale, scale]}
            onClick={handleClick}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredUnit(unit.id); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHoveredUnit(null); document.body.style.cursor = 'auto'; }}
            castShadow
            receiveShadow
        >
            <boxGeometry args={unit.size} />
            <meshStandardMaterial
                color={isSelected ? '#FFFFFF' : baseColor}
                emissive={emissiveColor}
                emissiveIntensity={0.2}
                roughness={0.3}
                metalness={0.6}
                transparent
                opacity={isSelected ? 0.95 : 0.4} // Lowered opacity so real model is visible through them
            />
        </mesh>
    );
}

/** Radial gradient texture (white center → transparent edge) for hero ground alpha */
function useRadialAlphaTexture(size = 256) {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const cx = size / 2;
        const r = cx;
        const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }, [size]);
}

function HeroGround({ envContext }: { envContext: string | null | undefined }) {
    const color = getGroundColor(envContext);
    const alphaMap = useRadialAlphaTexture(128);
    const geometry = useMemo(() => new THREE.CircleGeometry(18, 64), []);
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow geometry={geometry}>
            <meshStandardMaterial
                color={color}
                roughness={0.95}
                metalness={0.05}
                transparent
                opacity={0.92}
                alphaMap={alphaMap}
                depthWrite={false}
            />
        </mesh>
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
    const { building, units } = useEngineStore();

    // Use DB units if available, otherwise fallback only if no real model exists
    const displayUnits: DisplayUnit[] = units.length > 0
        ? units.map((u: UnitRow) => ({
            id: u.id,
            position: (u as UnitRow & { position?: [number, number, number] }).position || [0, u.floor * 3, 0],
            size: (u as UnitRow & { size?: [number, number, number] }).size || [3, 2, 3]
        }))
        : !building?.model_url ? FALLBACK_UNITS : [];

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
                    <Center top>
                        <ModelLoader url={building.model_url} />
                    </Center>
                ) : (
                    <PlaceholderBuilding />
                )}
            </Suspense>

            {/* Overlay Status units - only if they exist or as fallback */}
            {displayUnits.map((u: DisplayUnit) => (
                <UnitBox key={u.id} unit={u} />
            ))}

            {/* Hero ground: circle under building that fades into skybox */}
            <HeroGround envContext={building?.env_context} />

            {/* Ground plane (shadow receiver) — minimal */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.91, 0]} receiveShadow>
                <planeGeometry args={[14, 14]} />
                <meshStandardMaterial color="#0A0A0B" roughness={1} metalness={0} />
            </mesh>
        </group>
    );
}
