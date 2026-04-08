'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import GroundedSkyboxEnv from '@/engine/components/GroundedSkyboxEnv';

function isHdrUrl(url: string): boolean {
    const u = url.toLowerCase().split('?')[0];
    return u.endsWith('.hdr') || u.endsWith('.hdri');
}

interface SkyboxPreviewCanvasProps {
    envUrl: string;
}

export default function SkyboxPreviewCanvas({ envUrl }: SkyboxPreviewCanvasProps) {
    const isHdr = isHdrUrl(envUrl);
    return (
        <Canvas
            camera={{ position: [0, 2, 8], fov: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
        >
            {isHdr ? null : <color attach="background" args={['#0A0A0B']} />}
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <Suspense fallback={null}>
                <GroundedSkyboxEnv envUrl={envUrl} />
                {!isHdr && <Environment files={envUrl} background />}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                    <planeGeometry args={[50, 50]} />
                    <meshStandardMaterial color="#0A0A0B" roughness={1} metalness={0} />
                </mesh>
            </Suspense>
            <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.05}
                minPolarAngle={0.1}
                maxPolarAngle={Math.PI / 2}
                minDistance={2}
                maxDistance={50}
            />
        </Canvas>
    );
}
