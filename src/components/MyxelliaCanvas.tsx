import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import type { PresetsType } from '@react-three/drei/helpers/environment-assets';
import AssetLoader from './AssetLoader';
import BuildingModel from './BuildingModel';
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

const LIGHTING = {
    morning: { preset: 'dawn' as const, ambient: 0.6, dirColor: '#FFD9A0', dirIntensity: 1.2, dirPos: [8, 20, 8] as [number, number, number] },
    golden: { preset: 'sunset' as const, ambient: 0.4, dirColor: '#FFC060', dirIntensity: 1.8, dirPos: [-15, 12, 10] as [number, number, number] },
    night: { preset: 'night' as const, ambient: 0.15, dirColor: '#8EB4FF', dirIntensity: 0.6, dirPos: [0, 30, 0] as [number, number, number] },
};

export default function MyxelliaCanvas() {
    const { viewMode, lightingMode, building } = useEngineStore();
    const L = LIGHTING[lightingMode as LightingKey];

    // AI-generated environment: use Pollinations skybox URL when present
    const hasGeneratedEnv = !!building?.generated_env_url;

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
            camera={{ position: [25, 20, 25], fov: 32 }}
            dpr={[1, 2]}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
            shadows
        >
            <color attach="background" args={['#0A0A0B']} />

            {useCloudFog && !hasGeneratedEnv && <fog attach="fog" args={['#141416', 10, 80]} />}

            {/* Dynamic Lighting */}
            <ambientLight intensity={L.ambient} />
            <directionalLight
                position={L.dirPos}
                intensity={L.dirIntensity}
                color={L.dirColor}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />

            <Suspense fallback={<AssetLoader />}>
                {hasGeneratedEnv ? (
                    <Environment files={building!.generated_env_url!} background />
                ) : (
                    <Environment preset={finalPreset} background={true} />
                )}

                <ContactShadows
                    resolution={1024}
                    scale={120}
                    blur={3}
                    opacity={lightingMode === 'night' ? 0.8 : 0.45}
                    far={60}
                    color="#000000"
                />

                {viewMode === 'exterior' ? <BuildingModel /> : <InteriorModel />}
                {viewMode === 'exterior' && <ScreenshotCapture />}
            </Suspense>

            <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.06}
                minPolarAngle={0.1}
                maxPolarAngle={Math.PI / 2.2}
                minDistance={12}
                maxDistance={55}
                enablePan={false}
            />
        </Canvas>
    );
}
