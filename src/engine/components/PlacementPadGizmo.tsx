'use client';

import { useRef, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useEngineStore } from '@/engine/store/engine.store';
import type { GroundPlacementPad } from '@/lib/groundPlacementPad';

const GOLD = '#C6A664';
const MIN_HALF = 0.5;
const MIN_DRAG_PX = 10;

function useRayGroundY() {
    const { scene } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    return useCallback(
        (x: number, z: number) => {
            const origin = new THREE.Vector3(x, 400, z);
            raycaster.current.set(origin, new THREE.Vector3(0, -1, 0));
            const hits = raycaster.current.intersectObjects(scene.children, true).filter((h) => h.object.userData?.isWorldGround);
            return hits[0]?.point?.y ?? 0;
        },
        [scene]
    );
}

function clientToNdc(clientX: number, clientY: number, rect: DOMRect, out: THREE.Vector2) {
    out.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    out.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function padFromGroundHits(pts: THREE.Vector3[], prev: GroundPlacementPad): GroundPlacementPad | null {
    if (pts.length < 2) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
    }
    const ncx = (minX + maxX) / 2;
    const ncz = (minZ + maxZ) / 2;
    const nhx = Math.max(MIN_HALF, (maxX - minX) / 2);
    const nhz = Math.max(MIN_HALF, (maxZ - minZ) / 2);
    return {
        ...prev,
        center: [ncx, ncz],
        halfExtents: [nhx, nhz],
    };
}

function PadFillFlat({
    cx,
    cz,
    hx,
    hz,
    y,
    subtle,
}: {
    cx: number;
    cz: number;
    hx: number;
    hz: number;
    y: number;
    subtle: boolean;
}) {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, y + 0.03, cz]} renderOrder={1}>
            <planeGeometry args={[hx * 2, hz * 2]} />
            <meshStandardMaterial
                color={GOLD}
                emissive={GOLD}
                emissiveIntensity={subtle ? 0.08 : 0.14}
                transparent
                opacity={subtle ? 0.12 : 0.2}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
            />
        </mesh>
    );
}

function PadOutlineFollow({
    cx,
    cz,
    hx,
    hz,
    heights,
}: {
    cx: number;
    cz: number;
    hx: number;
    hz: number;
    heights: number[];
}) {
    const { scene } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const lineObj = useMemo(() => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < heights.length; i++) {
            const t = i / (heights.length - 1);
            let x: number;
            let z: number;
            if (t <= 0.25) {
                const u = t / 0.25;
                x = cx + hx;
                z = cz + hz + u * (-2 * hz);
            } else if (t <= 0.5) {
                const u = (t - 0.25) / 0.25;
                x = cx + hx + u * (-2 * hx);
                z = cz - hz;
            } else if (t <= 0.75) {
                const u = (t - 0.5) / 0.25;
                x = cx - hx;
                z = cz - hz + u * (2 * hz);
            } else {
                const u = (t - 0.75) / 0.25;
                x = cx - hx + u * (2 * hx);
                z = cz + hz;
            }
            const y = heights[i] ?? 0;
            pts.push(new THREE.Vector3(x, y + 0.04, z));
        }
        if (pts.length > 0) pts.push(pts[0].clone());
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color: GOLD,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
        });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 2;
        return line;
    }, [cx, cz, hx, hz, heights]);

    useLayoutEffect(() => {
        return () => {
            lineObj.geometry.dispose();
            (lineObj.material as THREE.Material).dispose();
        };
    }, [lineObj]);

    return <primitive object={lineObj} />;
}

function PadFlatOutline({ cx, cz, hx, hz, y }: { cx: number; cz: number; hx: number; hz: number; y: number }) {
    const lineObj = useMemo(() => {
        const y0 = y + 0.02;
        const pts = [
            new THREE.Vector3(cx + hx, y0, cz + hz),
            new THREE.Vector3(cx - hx, y0, cz + hz),
            new THREE.Vector3(cx - hx, y0, cz - hz),
            new THREE.Vector3(cx + hx, y0, cz - hz),
            new THREE.Vector3(cx + hx, y0, cz + hz),
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color: GOLD,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
        });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 3;
        return line;
    }, [cx, cz, hx, hz, y]);

    useLayoutEffect(() => {
        return () => {
            lineObj.geometry.dispose();
            (lineObj.material as THREE.Material).dispose();
        };
    }, [lineObj]);

    return <primitive object={lineObj} />;
}

export default function PlacementPadGizmo() {
    const placementPad = useEngineStore((s) => s.placementPad);
    const editActive = useEngineStore((s) => s.placementPadEditActive);
    const setPad = useEngineStore((s) => s.setPlacementPad);
    const setDragging = useEngineStore((s) => s.setPadHandleDragging);
    const setPadMarqueeScreen = useEngineStore((s) => s.setPadMarqueeScreen);

    const { camera, gl, scene } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const ndc = useRef(new THREE.Vector2());
    const drag = useRef<{ x0: number; y0: number; active: boolean } | null>(null);

    const groundY = useRayGroundY();

    const [cx, cz] = placementPad?.center ?? [0, 0];
    const [hx, hz] = placementPad?.halfExtents ?? [1, 1];
    const mode = placementPad?.padDisplayMode ?? 'flat';

    const cornerHeights = useMemo(() => {
        if (!placementPad) return [];
        const steps = 10;
        const total = steps * 4;
        const arr: number[] = [];
        const [pcx, pcz] = placementPad.center;
        const [phx, phz] = placementPad.halfExtents;
        for (let i = 0; i <= total; i++) {
            const t = i / total;
            let x: number;
            let z: number;
            if (t <= 0.25) {
                const u = t / 0.25;
                x = pcx + phx;
                z = pcz + phz + u * (-2 * phz);
            } else if (t <= 0.5) {
                const u = (t - 0.25) / 0.25;
                x = pcx + phx + u * (-2 * phx);
                z = pcz - phz;
            } else if (t <= 0.75) {
                const u = (t - 0.5) / 0.25;
                x = pcx - phx;
                z = pcz - phz + u * (2 * phz);
            } else {
                const u = (t - 0.75) / 0.25;
                x = pcx - phx + u * (2 * phx);
                z = pcz + phz;
            }
            const origin = new THREE.Vector3(x, 400, z);
            raycaster.current.set(origin, new THREE.Vector3(0, -1, 0));
            const hits = raycaster.current.intersectObjects(scene.children, true).filter((h) => h.object.userData?.isWorldGround);
            arr.push(hits[0]?.point?.y ?? 0);
        }
        return arr;
    }, [placementPad, scene]);

    const flatY = useMemo(() => {
        if (!placementPad) return 0;
        const CORNER_SIGNS: [number, number][] = [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
        ];
        const [pcx, pcz] = placementPad.center;
        const [phx, phz] = placementPad.halfExtents;
        const ys = CORNER_SIGNS.map(([sx, sz]) => groundY(pcx + sx * phx, pcz + sz * phz));
        return ys.reduce((a, b) => a + b, 0) / ys.length;
    }, [placementPad, groundY]);

    const raycastGroundCorners = useCallback(
        (sx0: number, sy0: number, sx1: number, sy1: number) => {
            const rect = gl.domElement.getBoundingClientRect();
            const screenCorners: [number, number][] = [
                [sx0, sy0],
                [sx1, sy0],
                [sx1, sy1],
                [sx0, sy1],
            ];
            const pts: THREE.Vector3[] = [];
            for (const [cxp, cyp] of screenCorners) {
                clientToNdc(cxp, cyp, rect, ndc.current);
                raycaster.current.setFromCamera(ndc.current, camera);
                const hits = raycaster.current.intersectObjects(scene.children, true).filter((h) => h.object.userData?.isWorldGround);
                const p = hits[0]?.point;
                if (p) pts.push(p.clone());
            }
            return pts;
        },
        [camera, gl, scene]
    );

    const applyRectFromScreen = useCallback(
        (sx0: number, sy0: number, sx1: number, sy1: number) => {
            const pad = useEngineStore.getState().placementPad;
            if (!pad) return;
            const pts = raycastGroundCorners(sx0, sy0, sx1, sy1);
            const next = padFromGroundHits(pts, pad);
            if (next) setPad(next);
        },
        [raycastGroundCorners, setPad]
    );

    useEffect(() => {
        if (!editActive) {
            drag.current = null;
            setPadMarqueeScreen(null);
            gl.domElement.style.cursor = '';
            return;
        }

        gl.domElement.style.cursor = 'crosshair';

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            setDragging(true);
            drag.current = { x0: e.clientX, y0: e.clientY, active: true };
            setPadMarqueeScreen(null);
            try {
                gl.domElement.setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            const d = drag.current;
            if (!d?.active) return;
            setPadMarqueeScreen({ x0: d.x0, y0: d.y0, x1: e.clientX, y1: e.clientY });
            const dx = Math.abs(e.clientX - d.x0);
            const dy = Math.abs(e.clientY - d.y0);
            if (dx >= MIN_DRAG_PX || dy >= MIN_DRAG_PX) {
                applyRectFromScreen(d.x0, d.y0, e.clientX, e.clientY);
            }
        };

        const endDrag = (e: PointerEvent) => {
            const d = drag.current;
            if (!d?.active) return;
            drag.current = null;
            setPadMarqueeScreen(null);
            setDragging(false);
            try {
                gl.domElement.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            const dx = Math.abs(e.clientX - d.x0);
            const dy = Math.abs(e.clientY - d.y0);
            if (dx >= MIN_DRAG_PX || dy >= MIN_DRAG_PX) {
                applyRectFromScreen(d.x0, d.y0, e.clientX, e.clientY);
            }
        };

        const el = gl.domElement;
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);

        return () => {
            el.style.cursor = '';
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', endDrag);
            el.removeEventListener('pointercancel', endDrag);
            drag.current = null;
            setPadMarqueeScreen(null);
        };
    }, [editActive, gl, setDragging, setPadMarqueeScreen, applyRectFromScreen]);

    if (!placementPad) return null;

    return (
        <group>
            {mode === 'flat' ? (
                <>
                    <PadFillFlat cx={cx} cz={cz} hx={hx} hz={hz} y={flatY} subtle={!editActive} />
                    <PadFlatOutline cx={cx} cz={cz} hx={hx} hz={hz} y={flatY} />
                </>
            ) : (
                <PadOutlineFollow cx={cx} cz={cz} hx={hx} hz={hz} heights={cornerHeights} />
            )}
        </group>
    );
}
