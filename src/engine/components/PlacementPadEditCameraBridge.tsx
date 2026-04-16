'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '@/engine/store/engine.store';
import {
    expandWorldGroundBox,
    footprintMaxDollyWhenPadEditingRect,
    rectangularParcelMaxDollyAlongUnitRay,
    snapDefaultObliqueExterior,
    snapPlacementPadTopDown,
} from '@/engine/lib/exteriorGroundOrbitMath';

type OrbitLike = {
    target: THREE.Vector3;
    object: THREE.PerspectiveCamera;
    update: () => void;
};

/**
 * When placement pad edit turns on: save orbit, snap top-down with editing zoom headroom.
 * When it turns off (Done / Clear): restore saved oblique view or a default oblique framing.
 */
export default function PlacementPadEditCameraBridge() {
    const placementPadEditActive = useEngineStore((s) => s.placementPadEditActive);
    const viewMode = useEngineStore((s) => s.viewMode);
    const { camera, controls, scene } = useThree();
    const prevEdit = useRef(false);

    useEffect(() => {
        if (viewMode !== 'exterior') {
            prevEdit.current = placementPadEditActive;
            return;
        }
        const oc = controls as unknown as OrbitLike | null;
        const persp = camera as THREE.PerspectiveCamera;
        if (!oc || !persp.isPerspectiveCamera) {
            prevEdit.current = placementPadEditActive;
            return;
        }

        const entering = placementPadEditActive && !prevEdit.current;
        const leaving = !placementPadEditActive && prevEdit.current;

        if (entering) {
            const st0 = useEngineStore.getState();
            if (!st0.orbitBookmarkBeforePadEdit) {
                const t = oc.target.toArray() as [number, number, number];
                const p = persp.position.toArray() as [number, number, number];
                st0.setOrbitBookmarkBeforePadEdit({ target: t, position: p });
            }

            const box = new THREE.Box3();
            expandWorldGroundBox(scene, box);
            if (!box.isEmpty()) {
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                box.getCenter(center);
                box.getSize(size);
                const hx = Math.max(size.x * 0.5, 0.35);
                const hz = Math.max(size.z * 0.5, 0.35);
                const planeY = box.min.y;
                const widerAlongX = size.x >= size.z;
                const theta = widerAlongX ? Math.PI / 2 : 0;
                const phi = 0.11;
                const offsetDir = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, phi, theta));
                const alongStrict = rectangularParcelMaxDollyAlongUnitRay(
                    persp,
                    center,
                    offsetDir,
                    hx,
                    hz,
                    planeY,
                    center.x,
                    center.z
                );
                const dist = footprintMaxDollyWhenPadEditingRect(alongStrict);
                snapPlacementPadTopDown(scene, persp, oc, dist);
            }
        }

        if (leaving) {
            const bm = useEngineStore.getState().orbitBookmarkBeforePadEdit;
            useEngineStore.getState().setOrbitBookmarkBeforePadEdit(null);
            if (bm) {
                oc.target.fromArray(bm.target);
                persp.position.fromArray(bm.position);
                persp.up.set(0, 1, 0);
                oc.update();
            } else {
                snapDefaultObliqueExterior(scene, persp, oc);
            }
        }

        prevEdit.current = placementPadEditActive;
    }, [placementPadEditActive, viewMode, camera, controls, scene]);

    return null;
}
