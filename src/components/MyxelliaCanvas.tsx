import { Suspense, useEffect, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { PresetsType } from '@react-three/drei/helpers/environment-assets';
import AssetLoader from './AssetLoader';
import BuildingModel from './BuildingModel';
import GroundedSkyboxEnv from './GroundedSkyboxEnv';
import InteriorModel from './InteriorModel';
import { useEngineStore } from '../store/engine.store';

type LightingKey = 'morning' | 'golden' | 'night';

/** Registers canvas screenshot handler with the store for AI Suggest units */
function ScreenshotCapture() {
    const { gl } = useThree();
    const setScreenshotHandler = useEngineStore((s: { setScreenshotHandler: (h: (() => Promise<string>) | null) => void }) => s.setScreenshotHandler);
    useEffect(() => {
        const handler = () =>
            new Promise<string>((resolve) => {
                requestAnimationFrame(() => {
                    try {
                        const data = gl.domElement.toDataURL('image/jpeg', 0.85);
                        resolve(data);
                    } catch {
                        resolve('');
                    }
                });
            });
        setScreenshotHandler(() => handler());
        return () => setScreenshotHandler(null);
    }, [gl, setScreenshotHandler]);
    return null;
}

/** When entering interior view, set camera to a far zoomed-out starting position */
function InteriorCameraReset() {
    const { camera } = useThree();
    const viewMode = useEngineStore((s) => s.viewMode);
    useEffect(() => {
        if (viewMode !== 'interior') return;
        camera.position.set(28, 22, 28);
        camera.updateProjectionMatrix();
    }, [viewMode, camera]);
    return null;
}

/** When hotspot placement mode is on, capture click and raycast to get 3D position */
function HotspotPlacementCapture() {
    const { gl, camera, scene } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());
    const hotspotPlacementMode = useEngineStore((s) => s.hotspotPlacementMode);
    const setHotspotPlacementMode = useEngineStore((s) => s.setHotspotPlacementMode);
    const setCapturedHotspotPosition = useEngineStore((s) => s.setCapturedHotspotPosition);

    useEffect(() => {
        if (!hotspotPlacementMode) return;
        const el = gl.domElement;
        const onPointerDown = (e: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.current.setFromCamera(mouse.current, camera);
            const hits = raycaster.current.intersectObjects(scene.children, true);
            const hit = hits.find((i) => i.object instanceof THREE.Mesh);
            if (hit?.point) {
                const p = hit.point;
                setCapturedHotspotPosition([p.x, p.y, p.z]);
                setHotspotPlacementMode(false);
            }
        };
        el.addEventListener('pointerdown', onPointerDown);
        return () => el.removeEventListener('pointerdown', onPointerDown);
    }, [hotspotPlacementMode, gl, camera, scene, setHotspotPlacementMode, setCapturedHotspotPosition]);
    return null;
}

const LIGHTING = {
    morning: { preset: 'dawn' as const, ambient: 0.6, dirColor: '#FFD9A0', dirIntensity: 1.2, dirPos: [8, 20, 8] as [number, number, number] },
    golden: { preset: 'sunset' as const, ambient: 0.4, dirColor: '#FFC060', dirIntensity: 1.8, dirPos: [-15, 12, 10] as [number, number, number] },
    night: { preset: 'night' as const, ambient: 0.15, dirColor: '#8EB4FF', dirIntensity: 0.6, dirPos: [0, 30, 0] as [number, number, number] },
};

export default function MyxelliaCanvas() {
    const { viewMode, lightingMode, building, selectedSkyboxUrl } = useEngineStore();
    const L = LIGHTING[lightingMode as LightingKey];

    const envUrl = (selectedSkyboxUrl ?? building?.generated_env_url)?.trim() || null;
    const hasCustomEnv = !!envUrl;

    // Fallback: keyword-based preset when no generated image
    const envCtx = (building?.env_context || '').toLowerCase();
    const useCloudFog = envCtx.includes('hillside') || envCtx.includes('mountain') || envCtx.includes('misty') || envCtx.includes('cloud');
    const useForest = envCtx.includes('forest') || envCtx.includes('lush') || envCtx.includes('jungle') || envCtx.includes('garden');
    const useBeach = envCtx.includes('beach') || envCtx.includes('ocean') || envCtx.includes('tropical') || envCtx.includes('coast');

    let finalPreset: PresetsType = L.preset;
    if (useForest && lightingMode !== 'night') finalPreset = 'park';
    if (useBeach && lightingMode !== 'night') finalPreset = 'apartment';

    return (
        <Canvas
            camera={{ position: [3.4, 2.75, 3.4], fov: 32 }}
            dpr={[1, 2]}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
            shadows
        >
            <color attach="background" args={['#0A0A0B']} />

            {viewMode === 'exterior' && useCloudFog && !hasCustomEnv && <fog attach="fog" args={['#141416', 10, 80]} />}

            <ambientLight intensity={L.ambient} />
            <directionalLight
                position={L.dirPos}
                intensity={L.dirIntensity}
                color={L.dirColor}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />

            <Suspense fallback={<AssetLoader />}>
                {viewMode === 'exterior' && (
                    <ErrorBoundary fallback={null}>
                        {hasCustomEnv && envUrl ? (
                            <>
                                <GroundedSkyboxEnv envUrl={envUrl} />
                                <Environment files={envUrl} background={false} />
                            </>
                        ) : (
                            <Environment preset={finalPreset} background={true} />
                        )}
                    </ErrorBoundary>
                )}

                {viewMode === 'exterior' && (
                    <ContactShadows
                        resolution={1024}
                        scale={18}
                        blur={2}
                        opacity={lightingMode === 'night' ? 0.8 : 0.5}
                        far={10}
                        color="#000000"
                    />
                )}

                {viewMode === 'exterior' ? <BuildingModel /> : <InteriorModel />}
                {viewMode === 'exterior' && <ScreenshotCapture />}
                {viewMode === 'interior' && <InteriorCameraReset />}
                {viewMode === 'interior' && <HotspotPlacementCapture />}
            </Suspense>

            <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.06}
                minPolarAngle={0.1}
                maxPolarAngle={Math.PI / 2.2}
                minDistance={viewMode === 'interior' ? 1.5 : 4}
                maxDistance={viewMode === 'interior' ? 180 : 144}
                enablePan={false}
            />
        </Canvas>
    );
}
