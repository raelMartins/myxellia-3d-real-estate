import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

function isHdrUrl(url: string): boolean {
    const u = url.toLowerCase().split('?')[0];
    return u.endsWith('.hdr') || u.endsWith('.hdri');
}

interface GroundedSkyboxEnvProps {
    envUrl: string;
}

/** HDR only: sets scene.background and scene.environment (no dome geometry). */
function GroundedSkyboxEnvHdr({ envUrl }: GroundedSkyboxEnvProps) {
    const { scene, gl } = useThree();
    const cleanupRef = useRef<{ tex: THREE.DataTexture | null; envMap: THREE.Texture | null }>({ tex: null, envMap: null });

    useEffect(() => {
        const loader = new RGBELoader();
        let cancelled = false;
        loader.loadAsync(envUrl).then((tex) => {
            if (cancelled) {
                tex.dispose();
                return;
            }
            tex.mapping = THREE.EquirectangularReflectionMapping;
            cleanupRef.current.tex = tex;
            scene.background = tex;
            const pmrem = new THREE.PMREMGenerator(gl);
            const envMap = pmrem.fromEquirectangular(tex).texture;
            cleanupRef.current.envMap = envMap;
            scene.environment = envMap;
            pmrem.dispose();
        }).catch(() => {});
        return () => {
            cancelled = true;
            const { tex, envMap } = cleanupRef.current;
            if (scene.background === tex) scene.background = null;
            if (envMap) {
                envMap.dispose();
                if (scene.environment === envMap) scene.environment = null;
            }
            if (tex) tex.dispose();
            cleanupRef.current = { tex: null, envMap: null };
        };
    }, [envUrl, scene, gl]);

    return null;
}

export default function GroundedSkyboxEnv({ envUrl }: GroundedSkyboxEnvProps) {
    if (isHdrUrl(envUrl)) return <GroundedSkyboxEnvHdr envUrl={envUrl} />;
    return null;
}
