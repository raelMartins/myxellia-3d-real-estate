'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '@/engine/store/engine.store';
import { findDescendantWithUnitId } from '@/engine/lib/findUnitDescendant';
import { cameraDistanceForVerticalFill } from '@/engine/lib/noWorldMeshView';

type OrbitLike = {
    target: THREE.Vector3;
    object: THREE.PerspectiveCamera;
    minDistance: number;
    maxDistance: number;
    update: () => void;
};

/** Seconds: orbit target eases toward the selected unit’s center (also smooths unit switches). */
const TARGET_TAU_SEC = 0.42;
/** Duration of distance ease when the selected unit id changes (zoom settles smoothly). */
const DIST_BLEND_DURATION_SEC = 0.52;
/** Target vertical fill fraction for auto distance at end of unit switch (moderate framing). */
const UNIT_SWITCH_HEIGHT_FRAC = 0.44;

function smoothstep01(t: number) {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

/**
 * With a unit selected, ease the orbit target toward that unit’s world center so
 * rotate / zoom / pan keep it as the focal anchor. On unit change, eases camera
 * distance toward a sensible default for the new prism while preserving view direction.
 * Runs after Drei OrbitControls `update()` (priority -2 vs -1).
 */
export default function SelectedUnitOrbitFocus({
    buildingRootRef,
}: {
    buildingRootRef: React.RefObject<THREE.Group | null | undefined>;
}) {
    const selectedUnit = useEngineStore((s) => s.selectedUnit);
    const viewMode = useEngineStore((s) => s.viewMode);
    const placementPadEditActive = useEngineStore((s) => s.placementPadEditActive);
    const padDragging = useEngineStore((s) => s.padHandleDragging);

    const { camera, controls } = useThree();
    const offset = useRef(new THREE.Vector3());
    const unitCenter = useRef(new THREE.Vector3());
    const box = useRef(new THREE.Box3());
    const smoothedTarget = useRef(new THREE.Vector3());
    const prevSelectedId = useRef<string | null>(null);
    const distBlendElapsed = useRef(0);
    const distBlendStart = useRef(0);
    const distBlendGoal = useRef(0);
    const distBlendActive = useRef(false);

    useFrame((_, delta) => {
        if (viewMode !== 'exterior' || !selectedUnit || placementPadEditActive || padDragging) {
            prevSelectedId.current = null;
            distBlendActive.current = false;
            return;
        }
        const oc = controls as unknown as OrbitLike | null;
        const persp = camera as THREE.PerspectiveCamera;
        const root = buildingRootRef.current;
        if (!oc || !persp.isPerspectiveCamera || !root) return;

        const group = findDescendantWithUnitId(root, selectedUnit);
        if (!group) return;

        group.updateWorldMatrix(true, true);
        box.current.setFromObject(group);
        if (box.current.isEmpty()) return;
        box.current.getCenter(unitCenter.current);

        const sx = box.current.max.x - box.current.min.x;
        const sy = box.current.max.y - box.current.min.y;
        const sz = box.current.max.z - box.current.min.z;
        const unitSpan = Math.max(sx, sy, sz, 0.22);
        const goalDistRaw = cameraDistanceForVerticalFill(
            unitSpan,
            UNIT_SWITCH_HEIGHT_FRAC,
            persp.fov,
        );
        const goalDist = THREE.MathUtils.clamp(goalDistRaw, oc.minDistance, oc.maxDistance);

        const selectionChanged = prevSelectedId.current !== selectedUnit;
        if (selectionChanged) {
            prevSelectedId.current = selectedUnit;
            smoothedTarget.current.copy(oc.target);
            offset.current.subVectors(persp.position, oc.target);
            const startLen = offset.current.length();
            distBlendStart.current = startLen > 1e-6 ? startLen : goalDist;
            distBlendGoal.current = goalDist;
            distBlendElapsed.current = 0;
            distBlendActive.current = true;
        }

        const targetAlpha = 1 - Math.exp(-delta / TARGET_TAU_SEC);
        smoothedTarget.current.lerp(unitCenter.current, targetAlpha);

        offset.current.subVectors(persp.position, oc.target);
        let dist = offset.current.length();

        if (distBlendActive.current) {
            distBlendElapsed.current += delta;
            const u = smoothstep01(distBlendElapsed.current / DIST_BLEND_DURATION_SEC);
            const eased = THREE.MathUtils.lerp(distBlendStart.current, distBlendGoal.current, u);
            if (u >= 1 - 1e-4) {
                distBlendActive.current = false;
            }
            if (dist > 1e-6) {
                offset.current.multiplyScalar(eased / dist);
                dist = eased;
            }
        }

        oc.target.copy(smoothedTarget.current);
        persp.position.copy(oc.target).add(offset.current);

        dist = offset.current.length();
        if (dist > oc.maxDistance && dist > 1e-6) {
            offset.current.normalize().multiplyScalar(oc.maxDistance);
            persp.position.copy(oc.target).add(offset.current);
        } else if (dist < oc.minDistance && dist > 1e-6) {
            offset.current.normalize().multiplyScalar(oc.minDistance);
            persp.position.copy(oc.target).add(offset.current);
        }

        oc.update();
    }, -2);

    return null;
}
