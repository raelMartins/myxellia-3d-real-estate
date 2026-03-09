import { useRef, useLayoutEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { Suspense } from 'react';
import { ModelLoader } from './BuildingModel';

const MAX_DIM = 480;

export type PlanViewBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type PlanViewSize = { width: number; height: number };

interface BuildingPlanTopDownViewProps {
    modelUrl: string | null;
    modelExtension?: string;
    onSizeChange?: (size: PlanViewSize) => void;
    /** Increment to trigger re-measure and re-fit (e.g. from "Fit Model" button) */
    fitTrigger?: number;
}

function fitSize(bounds: PlanViewBounds): PlanViewSize {
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    const aspect = w / (d || 1);
    if (aspect >= 1) return { width: MAX_DIM, height: Math.round(MAX_DIM / aspect) };
    return { height: MAX_DIM, width: Math.round(MAX_DIM * aspect) };
}

function MeasureModel({
    modelUrl,
    modelExtension,
    onBounds,
    fitTrigger = 0,
}: {
    modelUrl: string;
    modelExtension?: string;
    onBounds: (b: PlanViewBounds) => void;
    fitTrigger?: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    useLayoutEffect(() => {
        const g = groupRef.current;
        if (!g) return;
        const box = new THREE.Box3().setFromObject(g);
        const minX = box.min.x;
        const maxX = box.max.x;
        const minZ = box.min.z;
        const maxZ = box.max.z;
        if (minX !== maxX || minZ !== maxZ) onBounds({ minX, maxX, minZ, maxZ });
    }, [modelUrl, modelExtension, onBounds, fitTrigger]);

    return (
        <group ref={groupRef}>
            <Center top>
                <ModelLoader url={modelUrl} extension={modelExtension} />
            </Center>
        </group>
    );
}

function ModelBase({ bounds }: { bounds: PlanViewBounds }) {
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    return (
        <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color="#9ca3af" roughness={0.8} metalness={0.05} transparent opacity={0.5} />
        </mesh>
    );
}

function OrthoCameraController({ bounds, fitTrigger = 0 }: { bounds: PlanViewBounds; fitTrigger?: number }) {
    const set = useThree((s) => s.set);
    const camRef = useRef<THREE.OrthographicCamera | null>(null);

    useLayoutEffect(() => {
        const w = bounds.maxX - bounds.minX;
        const d = bounds.maxZ - bounds.minZ;
        if (w <= 0 || d <= 0) return;
        if (!camRef.current) {
            camRef.current = new THREE.OrthographicCamera(
                bounds.minX,
                bounds.maxX,
                -bounds.minZ,
                -bounds.maxZ,
                0.1,
                100
            );
            camRef.current.position.set(0, 20, 0);
            camRef.current.rotation.set(-Math.PI / 2, 0, 0);
        }
        const cam = camRef.current;
        cam.left = bounds.minX;
        cam.right = bounds.maxX;
        cam.top = -bounds.minZ;
        cam.bottom = -bounds.maxZ;
        cam.updateProjectionMatrix();
        set({ camera: cam });
    }, [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, fitTrigger, set]);

    return null;
}

function TopDownScene({
    modelUrl,
    modelExtension,
    onBounds,
    bounds,
    fitTrigger = 0,
}: {
    modelUrl: string;
    modelExtension?: string;
    onBounds: (b: PlanViewBounds) => void;
    bounds: PlanViewBounds | null;
    fitTrigger?: number;
}) {
    const handleBounds = useCallback(
        (b: PlanViewBounds) => {
            onBounds(b);
        },
        [onBounds]
    );

    return (
        <>
            <color attach="background" args={['#0A0A0B']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            {bounds && <OrthoCameraController bounds={bounds} fitTrigger={fitTrigger} />}
            {bounds && <ModelBase bounds={bounds} />}
            <Suspense fallback={null}>
                <MeasureModel
                    modelUrl={modelUrl}
                    modelExtension={modelExtension}
                    onBounds={handleBounds}
                    fitTrigger={fitTrigger}
                />
            </Suspense>
        </>
    );
}

export default function BuildingPlanTopDownView({ modelUrl, modelExtension, onSizeChange, fitTrigger = 0 }: BuildingPlanTopDownViewProps) {
    const [bounds, setBounds] = useState<PlanViewBounds | null>(null);
    const [size, setSize] = useState<PlanViewSize>({ width: MAX_DIM, height: MAX_DIM });

    const handleBounds = useCallback(
        (b: PlanViewBounds) => {
            const w = b.maxX - b.minX;
            const d = b.maxZ - b.minZ;
            if (w <= 0 || d <= 0) return;
            requestAnimationFrame(() => {
                setBounds(b);
                const s = fitSize(b);
                setSize(s);
                onSizeChange?.(s);
            });
        },
        [onSizeChange]
    );

    const containerStyle = { width: size.width, height: size.height };

    return (
        <div
            className="border-[0.5px] border-white/10 overflow-hidden bg-[#0A0A0B]"
            style={containerStyle}
        >
            {modelUrl ? (
                <Canvas
                    key={`plan-canvas-${modelUrl}`}
                    style={{ display: 'block', width: '100%', height: '100%' }}
                    gl={{ antialias: true, alpha: false }}
                    dpr={[1, 1.5]}
                    camera={{ position: [0, 20, 0], rotation: [-Math.PI / 2, 0, 0], fov: 38 }}
                >
                    <TopDownScene
                        modelUrl={modelUrl}
                        modelExtension={modelExtension}
                        onBounds={handleBounds}
                        bounds={bounds}
                        fitTrigger={fitTrigger}
                    />
                </Canvas>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] tracking-widest text-[#94A3B8]/60 uppercase">
                    No building model
                </div>
            )}
        </div>
    );
}
