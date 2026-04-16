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
    scatter?: { url: string; layoutMode: SurroundLayoutMode; worldId: string; catalogOctet?: boolean } | null;
}) {
    const modelWrapRef = useRef<THREE.Group>(null);

    useLayoutEffect(() => {
        const wrap = modelWrapRef.current;
        if (!wrap) return;
        wrap.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.receiveShadow = true;
                mesh.castShadow = true;
                // Required for orbit limits & pad raycasts; do not tag decorative surround the same way.
                mesh.userData.isWorldGround = true;
            }
        });
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
                        catalogOctet={scatter.catalogOctet ?? false}
                        worldId={scatter.worldId}
                    />
                </Suspense>
            ) : null}
        </group>
    );
}
