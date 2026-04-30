'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { engineCanvasPointerRef } from '@/engine/lib/engineCanvasPointerRef';

/** Keeps last pointer coords while the cursor is over the canvas. */
export function CanvasPointerTracking() {
    const { gl } = useThree();
    useEffect(() => {
        const el = gl.domElement;
        const onMove = (e: PointerEvent) => {
            engineCanvasPointerRef.clientX = e.clientX;
            engineCanvasPointerRef.clientY = e.clientY;
            engineCanvasPointerRef.pointerId = e.pointerId;
            engineCanvasPointerRef.pointerType = e.pointerType || 'mouse';
            engineCanvasPointerRef.overCanvas = true;
        };
        const onLeave = () => {
            engineCanvasPointerRef.overCanvas = false;
        };
        const onEnter = () => {
            engineCanvasPointerRef.overCanvas = true;
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        el.addEventListener('pointerenter', onEnter);
        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
            el.removeEventListener('pointerenter', onEnter);
        };
    }, [gl]);
    return null;
}

type OrbitLike = { target?: THREE.Vector3 };

/**
 * When the camera or orbit target moves without a native pointermove (e.g. SelectedUnitOrbitFocus
 * easing the camera toward the selection), R3F hover state can stay stale while the ray under the
 * cursor changes — clicks then hit a different unit than the one highlighted. Re-dispatch
 * pointermove at the last canvas position so hover and pick stay aligned.
 */
export default function R3fPointerHoverResync() {
    const { camera, controls, gl } = useThree();
    const camPos = useRef(new THREE.Vector3());
    const tgt = useRef(new THREE.Vector3());
    const primed = useRef(false);

    useFrame(() => {
        const oc = controls as OrbitLike | null;
        const t = oc?.target;
        if (!t) return;

        if (!primed.current) {
            camPos.current.copy(camera.position);
            tgt.current.copy(t);
            primed.current = true;
            return;
        }

        const eps = 1e-6;
        const camMoved = camera.position.distanceToSquared(camPos.current) > eps * eps;
        const targetMoved = t.distanceToSquared(tgt.current) > eps * eps;
        camPos.current.copy(camera.position);
        tgt.current.copy(t);

        if (!camMoved && !targetMoved) return;
        if (!engineCanvasPointerRef.overCanvas) return;

        const el = gl.domElement;
        const { clientX, clientY, pointerId, pointerType } = engineCanvasPointerRef;
        el.dispatchEvent(
            new PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                pointerId,
                pointerType,
                isPrimary: true,
            }),
        );
    }, -1);

    return null;
}
