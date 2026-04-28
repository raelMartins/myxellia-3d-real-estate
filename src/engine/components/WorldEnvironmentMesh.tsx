'use client';

import { Suspense, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { ModelLoader } from '@/engine/components/BuildingModel';
import WorldGroundSurround from '@/engine/components/WorldGroundSurround';
import WorldScatterSurround from '@/engine/components/WorldScatterSurround';
import type { SurroundLayoutMode } from '@/lib/worldEnvironments';

export default function WorldEnvironmentMesh({
    url,
    envContext,
    scatter,
}: {
    url: string;
    envContext?: string | null;
    scatter?: { url: string; layoutMode: SurroundLayoutMode; worldId: string } | null;
}) {
    const modelWrapRef = useRef<THREE.Group>(null);

    // ModelLoader resolves asynchronously (Suspense). A single layout effect on [url] often runs
    // before any meshes exist, so pad raycasts would never hit `isWorldGround`. Re-try until tagged.
    useLayoutEffect(() => {
        const wrap = modelWrapRef.current;
        if (!wrap) return;
        let cancelled = false;
        let raf = 0;
        let attempts = 0;
        const MAX_ATTEMPTS = 900;

        const tagMeshes = () => {
            if (cancelled) return;
            attempts += 1;
            let meshCount = 0;
            wrap.traverse((obj) => {
                const mesh = obj as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.receiveShadow = true;
                    mesh.castShadow = true;
                    mesh.userData.isWorldGround = true;
                    meshCount += 1;
                }
            });
            if (meshCount === 0 && attempts < MAX_ATTEMPTS && !cancelled) {
                raf = requestAnimationFrame(tagMeshes);
            }
        };

        tagMeshes();
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
        };
    }, [url]);

    return (
        <group>
            <group ref={modelWrapRef}>
                <ModelLoader url={url} />
            </group>
            <WorldGroundSurround modelWrapRef={modelWrapRef} envContext={envContext} />
            {scatter ? (
                <Suspense fallback={null}>
                    <WorldScatterSurround
                        modelWrapRef={modelWrapRef}
                        scatterUrl={scatter.url}
                        layoutMode={scatter.layoutMode}
                        worldId={scatter.worldId}
                    />
                </Suspense>
            ) : null}
        </group>
    );
}
