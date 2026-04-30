'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '@/engine/store/engine.store';
import {
    NO_WORLD_MESH_HEIGHT_FRAC,
    NO_WORLD_MESH_UNIT_SIDEBAR_HEIGHT_FRAC,
    cameraDistanceForVerticalFill,
    noWorldMeshIsometricUnitViewDirection,
    worldHorizontalFrontFromUnitGroup,
} from '@/engine/lib/noWorldMeshView';
import type { StudioExteriorFront } from '@/lib/groundPlacementPad';
import { findDescendantWithUnitId } from '@/engine/lib/findUnitDescendant';

function cameraOffsetForStudioFront(
    front: StudioExteriorFront,
    size: THREE.Vector3,
    distance: number,
    out: THREE.Vector3,
) {
    switch (front) {
        case '+x':
            out.set(distance, 0, 0);
            break;
        case '-x':
            out.set(-distance, 0, 0);
            break;
        case '+z':
            out.set(0, 0, distance);
            break;
        case '-z':
            out.set(0, 0, -distance);
            break;
        default: {
            const alongX = size.x >= size.z - 1e-6;
            if (alongX) out.set(0, 0, distance);
            else out.set(distance, 0, 0);
            break;
        }
    }
}

type OrbitLike = {
    target: THREE.Vector3;
    object: THREE.PerspectiveCamera;
    minDistance: number;
    maxDistance: number;
    update: () => void;
};

/** Lerp `out` toward `goal` (same length path in vector space), then normalize. */
function lerpDirection(out: THREE.Vector3, goal: THREE.Vector3, t: number) {
    out.lerp(goal, t);
    if (out.lengthSq() < 1e-12) out.copy(goal);
    else out.normalize();
}

/**
 * Head-on exterior framing + zoom limits when "No world mesh" is selected.
 * Runs after WorldGroundOrbitLimits so min/max distance win for this mode.
 * When the studio **sidebar** list hovers a unit, eases orbit target and **rotation**
 * only (orbit radius stays the default building studio distance). 3D prism hover
 * does not trigger this — see `studioSidebarHoveredUnitId`.
 */
export default function NoWorldMeshExteriorCamera({
    buildingRootRef,
    active,
}: {
    buildingRootRef: React.RefObject<THREE.Group | null | undefined>;
    active: boolean;
}) {
    const viewMode = useEngineStore((s) => s.viewMode);
    const placementPadEditActive = useEngineStore((s) => s.placementPadEditActive);
    const padDragging = useEngineStore((s) => s.padHandleDragging);
    const buildingId = useEngineStore((s) => s.buildingId);
    const modelUrl = useEngineStore((s) => s.building?.model_url);
    const placementPad = useEngineStore((s) => s.placementPad);
    const studioExteriorFront = useEngineStore((s) => s.studioExteriorFront);
    const studioSidebarHoveredUnitId = useEngineStore((s) => s.studioSidebarHoveredUnitId);

    const { camera, controls } = useThree();
    const offset = useRef(new THREE.Vector3());
    const needsInitialSnap = useRef(true);
    const frontH = useRef(new THREE.Vector3());
    const goalOffsetDir = useRef(new THREE.Vector3());
    const orbitOffsetDir = useRef(new THREE.Vector3());
    const buildingCenter = useRef(new THREE.Vector3());
    const buildingSize = useRef(new THREE.Vector3());
    const unitCenter = useRef(new THREE.Vector3());
    const unitBox = useRef(new THREE.Box3());
    const studioDelta = useRef(new THREE.Vector3());
    const tmpBlendA = useRef(new THREE.Vector3());
    const tmpBlendB = useRef(new THREE.Vector3());
    /** Previous frame had studio list hover — used to sync orbit direction / distance from the live camera once on enter. */
    const wasStudioSidebarHoveringRef = useRef(false);
    /** Smoothed camera–target distance while sidebar-framing a unit. */
    const orbitDistanceRef = useRef(1);

    const resetKey = `${buildingId ?? ''}|${modelUrl ?? ''}|${placementPad ? JSON.stringify(placementPad.halfExtents) : ''}|${placementPad?.buildingYaw ?? 0}|${placementPad?.buildingVerticalOffsetM ?? 0}|${studioExteriorFront}`;

    useEffect(() => {
        needsInitialSnap.current = true;
        wasStudioSidebarHoveringRef.current = false;
    }, [active, resetKey]);

    useFrame((_, delta) => {
        if (!active || viewMode !== 'exterior' || placementPadEditActive || padDragging) {
            return;
        }
        const oc = controls as unknown as OrbitLike | null;
        const persp = camera as THREE.PerspectiveCamera;
        const root = buildingRootRef.current;
        if (!oc || !persp.isPerspectiveCamera || !root) return;

        root.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(root);
        if (box.isEmpty()) return;

        box.getCenter(buildingCenter.current);
        box.getSize(buildingSize.current);
        const modelH = Math.max(buildingSize.current.y, 1e-3);

        const fMin = NO_WORLD_MESH_HEIGHT_FRAC.max;
        const fMax = NO_WORLD_MESH_HEIGHT_FRAC.min;

        const dClose = cameraDistanceForVerticalFill(modelH, fMin, persp.fov);
        const dFar = cameraDistanceForVerticalFill(modelH, fMax, persp.fov);

        oc.minDistance = Math.min(dClose, dFar);
        oc.maxDistance = Math.max(dClose, dFar);
        if (oc.minDistance > oc.maxDistance) {
            const mid = (oc.minDistance + oc.maxDistance) * 0.5;
            oc.minDistance = mid * 0.99;
            oc.maxDistance = mid * 1.01;
        }

        const d0Building = cameraDistanceForVerticalFill(
            modelH,
            NO_WORLD_MESH_HEIGHT_FRAC.default,
            persp.fov,
        );

        cameraOffsetForStudioFront(
            studioExteriorFront,
            buildingSize.current,
            d0Building,
            studioDelta.current,
        );

        const sid = studioSidebarHoveredUnitId;
        const hoverGroup =
            sid != null && sid.length > 0 ? findDescendantWithUnitId(root, sid) : null;

        let sidebarFocus = false;
        if (hoverGroup) {
            unitBox.current.setFromObject(hoverGroup);
            if (!unitBox.current.isEmpty()) {
                unitBox.current.getCenter(unitCenter.current);
                sidebarFocus = true;
            }
        }

        if (sidebarFocus && hoverGroup) {
            worldHorizontalFrontFromUnitGroup(hoverGroup, frontH.current);
            noWorldMeshIsometricUnitViewDirection(
                frontH.current,
                studioDelta.current,
                unitCenter.current,
                buildingCenter.current,
                tmpBlendA.current,
                tmpBlendB.current,
                goalOffsetDir.current,
            );
        }

        /** Middle ground: responsive but not snappy. */
        const smooth = THREE.MathUtils.clamp(delta * 2.35, 0.014, 0.052);
        const smoothDir = THREE.MathUtils.clamp(delta * 2.05, 0.012, 0.048);
        /** Zoom eases slightly gentler than rotation so distance does not overshoot harshly. */
        const smoothZoom = THREE.MathUtils.clamp(delta * 1.65, 0.009, 0.036);

        if (needsInitialSnap.current) {
            oc.target.copy(buildingCenter.current);
            orbitOffsetDir.current.copy(studioDelta.current);
            if (orbitOffsetDir.current.lengthSq() < 1e-12) orbitOffsetDir.current.set(0, 0.35, 1);
            orbitOffsetDir.current.normalize();
            orbitDistanceRef.current = d0Building;
            persp.position.copy(buildingCenter.current).addScaledVector(orbitOffsetDir.current, orbitDistanceRef.current);
            needsInitialSnap.current = false;
        } else if (sidebarFocus) {
            /** Orbit offset / distance were not driven while the user orbited freely — seed from the live camera. */
            if (!wasStudioSidebarHoveringRef.current) {
                offset.current.subVectors(persp.position, oc.target);
                const len = offset.current.length();
                if (len > 1e-6) {
                    orbitOffsetDir.current.copy(offset.current).multiplyScalar(1 / len);
                    orbitDistanceRef.current = len;
                }
            }

            const sx = unitBox.current.max.x - unitBox.current.min.x;
            const sy = unitBox.current.max.y - unitBox.current.min.y;
            const sz = unitBox.current.max.z - unitBox.current.min.z;
            const uSpan = Math.max(sx, sy, sz, 0.22);
            let goalDist = cameraDistanceForVerticalFill(
                uSpan,
                NO_WORLD_MESH_UNIT_SIDEBAR_HEIGHT_FRAC.default,
                persp.fov,
            );
            goalDist = THREE.MathUtils.clamp(goalDist, oc.minDistance, oc.maxDistance);

            orbitDistanceRef.current = THREE.MathUtils.lerp(orbitDistanceRef.current, goalDist, smoothZoom);

            oc.target.lerp(unitCenter.current, smooth);
            lerpDirection(orbitOffsetDir.current, goalOffsetDir.current, smoothDir);
            persp.position.copy(oc.target).addScaledVector(orbitOffsetDir.current, orbitDistanceRef.current);
        }
        /** When not hovering the studio list: do not fight user orbit / pan. */

        wasStudioSidebarHoveringRef.current = sidebarFocus;

        offset.current.subVectors(oc.object.position, oc.target);
        const dist = offset.current.length();
        if (dist > oc.maxDistance && dist > 1e-6) {
            offset.current.normalize().multiplyScalar(oc.maxDistance);
            oc.object.position.copy(oc.target).add(offset.current);
        } else if (dist < oc.minDistance && dist > 1e-6) {
            offset.current.normalize().multiplyScalar(oc.minDistance);
            oc.object.position.copy(oc.target).add(offset.current);
        }
        if (sidebarFocus) {
            orbitDistanceRef.current = oc.object.position.distanceTo(oc.target);
        }

        oc.update();
    });

    return null;
}
