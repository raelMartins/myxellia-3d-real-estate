'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '@/engine/store/engine.store';
import {
    expandWorldGroundBox,
    expandWorldRootGroundFootprintFallback,
    footprintMaxDollyWhenPadEditingRect,
    rectangularParcelMaxDolly,
    snapDefaultObliqueExterior,
} from '@/engine/lib/exteriorGroundOrbitMath';

type OrbitLike = {
    target: THREE.Vector3;
    object: THREE.PerspectiveCamera;
    minDistance: number;
    maxDistance: number;
    update: () => void;
};

const DEFAULT_EXTERIOR_MAX = 144;
const DEFAULT_EXTERIOR_MIN = 4;
/** Closest dolly vs. smaller horizontal half-extent */
const MIN_DIST_HALF_EXTENT_MULT = 0.06;
const MIN_DIST_FLOOR = 0.55;

/**
 * Exterior orbit limits (see `exteriorGroundOrbitMath.ts` header — do not revert):
 * - `maxDistance` = strict **rectangular** XZ parcel limit for the current view (frustum vs ground plane),
 *   not a circular min(hx,hz) bound — so long narrow lots behave correctly.
 * - Looser max only while `placementPadEditActive` (`footprintMaxDollyWhenPadEditingRect`).
 * - Decorative ground surround must NOT use `isWorldGround`; it uses `excludeFromGroundOrbitBox`.
 */
export default function WorldGroundOrbitLimits({
    worldRootRef,
    groundUrl,
}: {
    worldRootRef: React.RefObject<THREE.Group | null>;
    groundUrl: string | null | undefined;
}) {
    const viewMode = useEngineStore((s) => s.viewMode);
    const padDragging = useEngineStore((s) => s.padHandleDragging);
    const placementPadEditActive = useEngineStore((s) => s.placementPadEditActive);
    const { camera, controls, scene } = useThree();
    const oc = controls as unknown as OrbitLike | null;

    const box = useRef(new THREE.Box3());
    const center = useRef(new THREE.Vector3());
    const size = useRef(new THREE.Vector3());
    const offset = useRef(new THREE.Vector3());
    const snappedUrl = useRef<string | null>(null);

    useFrame(() => {
        if (!oc || viewMode === 'interior' || padDragging) {
            return;
        }

        if (!groundUrl?.trim() || !worldRootRef.current) {
            oc.maxDistance = DEFAULT_EXTERIOR_MAX;
            oc.minDistance = DEFAULT_EXTERIOR_MIN;
            snappedUrl.current = null;
            return;
        }

        const persp = camera as THREE.PerspectiveCamera;
        if (!persp.isPerspectiveCamera) {
            return;
        }

        expandWorldGroundBox(worldRootRef.current, box.current);
        if (box.current.isEmpty()) {
            worldRootRef.current.updateWorldMatrix(true, true);
            expandWorldRootGroundFootprintFallback(worldRootRef.current, box.current);
        }
        if (box.current.isEmpty()) {
            oc.maxDistance = DEFAULT_EXTERIOR_MAX;
            oc.minDistance = DEFAULT_EXTERIOR_MIN;
            return;
        }

        box.current.getCenter(center.current);
        box.current.getSize(size.current);

        if (snappedUrl.current !== groundUrl) {
            if (!snapDefaultObliqueExterior(scene, persp, oc)) {
                oc.target.copy(center.current);
            }
            snappedUrl.current = groundUrl;
        }

        // Horizontal parcel half-extents (world ground is treated as living on XZ)
        const hx = Math.max(size.current.x * 0.5, 0.35);
        const hz = Math.max(size.current.z * 0.5, 0.35);

        const groundY = box.current.min.y;
        const strictRectMax = rectangularParcelMaxDolly(
            persp,
            oc.object.position,
            oc.target,
            center.current.x,
            center.current.z,
            hx,
            hz,
            groundY
        );
        oc.maxDistance = placementPadEditActive ? footprintMaxDollyWhenPadEditingRect(strictRectMax) : strictRectMax;

        const minByExtent = Math.max(Math.min(hx, hz) * MIN_DIST_HALF_EXTENT_MULT, MIN_DIST_FLOOR);
        oc.minDistance = Math.min(minByExtent, oc.maxDistance * 0.35);

        offset.current.subVectors(oc.object.position, oc.target);
        const dist = offset.current.length();
        if (dist > oc.maxDistance && dist > 1e-6) {
            offset.current.normalize().multiplyScalar(oc.maxDistance);
            oc.object.position.copy(oc.target).add(offset.current);
        } else if (dist < oc.minDistance && dist > 1e-6) {
            offset.current.normalize().multiplyScalar(oc.minDistance);
            oc.object.position.copy(oc.target).add(offset.current);
        }

        oc.update();
    });

    return null;
}
