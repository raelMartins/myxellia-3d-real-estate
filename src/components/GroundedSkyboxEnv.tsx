import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';

const HEIGHT = 5;
const RADIUS = 5;
const RESOLUTION = 128;

interface GroundedSkyboxEnvProps {
    envUrl: string;
}

/**
 * Renders a ground-projected skybox so the horizon and "floor" of the
 * equirectangular image stay fixed under the building instead of sliding.
 * Use with <Environment background={false} /> for lighting-only.
 */
export default function GroundedSkyboxEnv({ envUrl }: GroundedSkyboxEnvProps) {
    const texture = useTexture(envUrl);
    const skybox = useMemo(() => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const g = new GroundedSkybox(texture, HEIGHT, RADIUS, RESOLUTION);
        g.position.y = HEIGHT; // projected ground at y = 0; smaller radius = sharper texture
        return g;
    }, [texture]);
    return <primitive object={skybox} />;
}
