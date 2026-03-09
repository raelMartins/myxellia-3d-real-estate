import { useRef, useLayoutEffect, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { Suspense } from 'react';
import { ModelLoader } from './BuildingModel';
import type { PlanViewBounds, PlanViewSize } from './BuildingPlanTopDownView';

const MAX_DIM = 480;

function fitSize(bounds: PlanViewBounds): PlanViewSize {
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    const aspect = w / (d || 1);
    if (aspect >= 1) return { width: MAX_DIM, height: Math.round(MAX_DIM / aspect) };
    return { height: MAX_DIM, width: Math.round(MAX_DIM * aspect) };
}

function MeasureModel({ modelUrl, modelExtension, onBounds }: { modelUrl: string; modelExtension?: string; onBounds: (b: PlanViewBounds) => void }) {
    const groupRef = useRef<THREE.Group>(null);
    useLayoutEffect(() => {
        const g = groupRef.current;
        if (!g) return;
        const box = new THREE.Box3().setFromObject(g);
        const { minX, maxX, minZ, maxZ } = box;
        if (minX !== maxX || minZ !== maxZ) onBounds({ minX, maxX, minZ, maxZ });
    }, [modelUrl, modelExtension, onBounds]);
    return (
        <group ref={groupRef}>
            <Center top>
                <ModelLoader url={modelUrl} extension={modelExtension} />
            </Center>
        </group>
    );
}

function OrthoAndCapture({ bounds, onCapture }: { bounds: PlanViewBounds; onCapture: (dataUrl: string, size: PlanViewSize) => void }) {
    const { gl, set } = useThree();
    const camRef = useRef<THREE.OrthographicCamera | null>(null);
    const capturedRef = useRef(false);

    useLayoutEffect(() => {
        const w = bounds.maxX - bounds.minX;
        const d = bounds.maxZ - bounds.minZ;
        if (w <= 0 || d <= 0) return;
        if (!camRef.current) {
            camRef.current = new THREE.OrthographicCamera(bounds.minX, bounds.maxX, -bounds.minZ, -bounds.maxZ, 0.1, 100);
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
    }, [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, set]);

    useLayoutEffect(() => {
        if (capturedRef.current) return;
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (capturedRef.current) return;
                try {
                    const dataUrl = gl.domElement.toDataURL('image/png', 0.92);
                    capturedRef.current = true;
                    onCapture(dataUrl, fitSize(bounds));
                } catch {
                    onCapture('', fitSize(bounds));
                }
            });
        });
        return () => cancelAnimationFrame(id);
    }, [bounds, gl, onCapture]);

    return null;
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

function CaptureScene({
    blobUrl,
    modelExtension,
    onBounds,
    bounds,
    onCapture,
}: {
    blobUrl: string;
    modelExtension?: string;
    onBounds: (b: PlanViewBounds) => void;
    bounds: PlanViewBounds | null;
    onCapture: (dataUrl: string, size: PlanViewSize) => void;
}) {
    const handleBounds = useCallback((b: PlanViewBounds) => onBounds(b), [onBounds]);
    return (
        <>
            <color attach="background" args={['#0A0A0B']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            {bounds && <OrthoAndCapture bounds={bounds} onCapture={onCapture} />}
            {bounds && <ModelBase bounds={bounds} />}
            <Suspense fallback={null}>
                <MeasureModel modelUrl={blobUrl} modelExtension={modelExtension} onBounds={handleBounds} />
            </Suspense>
        </>
    );
}

interface BirdEyeScreenshotCaptureProps {
    modelUrl: string;
    modelExtension?: string;
    onCapture: (dataUrl: string, size: PlanViewSize) => void;
    onError?: () => void;
}

export default function BirdEyeScreenshotCapture({ modelUrl, modelExtension, onCapture, onError }: BirdEyeScreenshotCaptureProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [bounds, setBounds] = useState<PlanViewBounds | null>(null);
    const [size, setSize] = useState<PlanViewSize>({ width: MAX_DIM, height: MAX_DIM });

    useEffect(() => {
        let url: string | null = null;
        fetch(modelUrl)
            .then((r) => r.blob())
            .then((blob) => {
                url = URL.createObjectURL(blob);
                setBlobUrl(url);
            })
            .catch(() => {
                onError?.();
            });
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [modelUrl, onError]);

    const handleBounds = useCallback((b: PlanViewBounds) => {
        const w = b.maxX - b.minX;
        const d = b.maxZ - b.minZ;
        if (w <= 0 || d <= 0) return;
        setBounds(b);
        setSize(fitSize(b));
    }, []);

    if (!blobUrl) return null;

    return (
        <div
            style={{
                position: 'fixed',
                left: -9999,
                top: 0,
                width: size.width,
                height: size.height,
                zIndex: -1,
            }}
        >
            <Canvas
                gl={{ antialias: true, alpha: false }}
                dpr={[1, 1]}
                camera={{ position: [0, 20, 0], rotation: [-Math.PI / 2, 0, 0], fov: 38 }}
            >
                <CaptureScene
                    blobUrl={blobUrl}
                    modelExtension={modelExtension}
                    onBounds={handleBounds}
                    bounds={bounds}
                    onCapture={onCapture}
                />
            </Canvas>
        </div>
    );
}
