'use client';

import { useRef, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useEngineStore } from '@/engine/store/engine.store';
import type { GroundPlacementPad } from '@/lib/groundPlacementPad';
import {
    clampPadVerticalOffsetM,
    defaultPlacementPadFromGroundXZBounds,
    MIN_PAD_HALF_EXTENT_M,
} from '@/lib/groundPlacementPad';
import { expandWorldGroundBox } from '@/engine/lib/exteriorGroundOrbitMath';

const GOLD = '#C6A664';
const CORNER_HIT_PX = 16;
const MAX_PAD_HALF_M = 48;
const PAD_VERTICAL_NUDGE_M = 0.12;

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

function intersectHorizontalPlaneInFront(ray: THREE.Ray, planeY: number, target: THREE.Vector3): boolean {
    const oy = ray.origin.y;
    const dy = ray.direction.y;
    if (Math.abs(dy) < 1e-8) return false;
    const t = (planeY - oy) / dy;
    if (!Number.isFinite(t) || t <= 1e-6) return false;
    target.copy(ray.origin).addScaledVector(ray.direction, t);
    return true;
}

function projectWorldToClient(
    v: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    scratch: THREE.Vector3,
    rect: DOMRect
): [number, number] {
    scratch.copy(v).project(camera);
    const x = (scratch.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-scratch.y * 0.5 + 0.5) * rect.height + rect.top;
    return [x, y];
}

function cornerCursorFromScreenDelta(u: number, v: number): string {
    const a = (Math.atan2(v, u) * 180) / Math.PI;
    const norm = ((a + 22.5 + 360) % 360);
    const sector = Math.floor(norm / 45) % 8;
    const map = ['e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize', 'nw-resize', 'n-resize', 'ne-resize'];
    return map[sector] ?? 'nwse-resize';
}

function resizedPadFromAnchor(
    anchorX: number,
    anchorZ: number,
    wx: number,
    wz: number
): { center: [number, number]; halfExtents: [number, number] } {
    const minX = Math.min(anchorX, wx);
    const maxX = Math.max(anchorX, wx);
    const minZ = Math.min(anchorZ, wz);
    const maxZ = Math.max(anchorZ, wz);
    const ncx = (minX + maxX) / 2;
    const ncz = (minZ + maxZ) / 2;
    const nhx = Math.min(MAX_PAD_HALF_M, Math.max(MIN_PAD_HALF_EXTENT_M, (maxX - minX) / 2));
    const nhz = Math.min(MAX_PAD_HALF_M, Math.max(MIN_PAD_HALF_EXTENT_M, (maxZ - minZ) / 2));
    return { center: [ncx, ncz], halfExtents: [nhx, nhz] };
}

/** (sx, sz) each in {-1, +1} */
const CORNERS: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
];

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

type DragState =
    | { kind: 'move'; startCx: number; startCz: number; startWx: number; startWz: number; planeY: number }
    | { kind: 'resize'; anchorX: number; anchorZ: number; planeY: number };

export default function PlacementPadGizmo() {
    const placementPad = useEngineStore((s) => s.placementPad);
    const editActive = useEngineStore((s) => s.placementPadEditActive);
    const placementPadSceneDefaultPending = useEngineStore((s) => s.placementPadSceneDefaultPending);
    const setPad = useEngineStore((s) => s.setPlacementPad);
    const setDragging = useEngineStore((s) => s.setPadHandleDragging);
    const setPadMarqueeScreen = useEngineStore((s) => s.setPadMarqueeScreen);

    const { camera, gl, scene } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const ndc = useRef(new THREE.Vector2());
    const planeHitScratch = useRef(new THREE.Vector3());
    const projScratch = useRef(new THREE.Vector3());
    const dragRef = useRef<DragState | null>(null);

    const groundY = useRayGroundY();

    const [cx, cz] = placementPad?.center ?? [0, 0];
    const [hx, hz] = placementPad?.halfExtents ?? [1, 1];
    const mode = placementPad?.padDisplayMode ?? 'flat';
    const padLiftM = placementPad?.padVerticalOffsetM ?? 0;

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

    const terrainFlatY = useMemo(() => {
        if (!placementPad) return 0;
        const ys = CORNERS.map(([sx, sz]) => {
            const [pcx, pcz] = placementPad.center;
            const [phx, phz] = placementPad.halfExtents;
            return groundY(pcx + sx * phx, pcz + sz * phz);
        });
        return ys.reduce((a, b) => a + b, 0) / ys.length;
    }, [placementPad, groundY]);

    const editPlaneY = terrainFlatY + padLiftM;
    const visualDeckY = editPlaneY;

    const liftedCornerHeights = useMemo(() => cornerHeights.map((h) => h + padLiftM), [cornerHeights, padLiftM]);

    const rayToPlaneXZ = useCallback(
        (clientX: number, clientY: number, planeY: number): [number, number] | null => {
            const rect = gl.domElement.getBoundingClientRect();
            clientToNdc(clientX, clientY, rect, ndc.current);
            raycaster.current.setFromCamera(ndc.current, camera);
            const ray = raycaster.current.ray;
            const hit = planeHitScratch.current;
            if (!intersectHorizontalPlaneInFront(ray, planeY, hit)) return null;
            return [hit.x, hit.z];
        },
        [camera, gl]
    );

    const pickCornerIndexForPad = useCallback(
        (clientX: number, clientY: number, pad: GroundPlacementPad, deckY: number): number | null => {
            const persp = camera as THREE.PerspectiveCamera;
            if (!persp.isPerspectiveCamera) return null;
            const rect = gl.domElement.getBoundingClientRect();
            const [pcx, pcz] = pad.center;
            const [phx, phz] = pad.halfExtents;
            let best: number | null = null;
            let bestD = CORNER_HIT_PX + 1;
            const scr = projScratch.current;
            CORNERS.forEach(([sx, sz], i) => {
                const wx = pcx + sx * phx;
                const wz = pcz + sz * phz;
                const [sxp, syp] = projectWorldToClient(new THREE.Vector3(wx, deckY + 0.04, wz), persp, scr, rect);
                const d = Math.hypot(clientX - sxp, clientY - syp);
                if (d < bestD && d <= CORNER_HIT_PX) {
                    bestD = d;
                    best = i;
                }
            });
            return best;
        },
        [camera, gl]
    );

    const isInsidePadXZFor = (wx: number, wz: number, pad: GroundPlacementPad): boolean => {
        const [pcx, pcz] = pad.center;
        const [phx, phz] = pad.halfExtents;
        return Math.abs(wx - pcx) <= phx + 1e-5 && Math.abs(wz - pcz) <= phz + 1e-5;
    };

    const updateHoverCursor = useCallback(
        (clientX: number, clientY: number) => {
            if (!editActive) return;
            const pad = useEngineStore.getState().placementPad;
            if (!pad) return;
            const ty =
                CORNERS.map(([sx, sz]) => {
                    const [pcx, pcz] = pad.center;
                    const [phx, phz] = pad.halfExtents;
                    return groundY(pcx + sx * phx, pcz + sz * phz);
                }).reduce((a, b) => a + b, 0) / CORNERS.length;
            const planeY = ty + (pad.padVerticalOffsetM ?? 0);
            const deckY = planeY;

            const cornerIdx = pickCornerIndexForPad(clientX, clientY, pad, deckY);
            if (cornerIdx != null) {
                const persp = camera as THREE.PerspectiveCamera;
                if (!persp.isPerspectiveCamera) return;
                const rect = gl.domElement.getBoundingClientRect();
                const [pcx, pcz] = pad.center;
                const [phx, phz] = pad.halfExtents;
                const [ccx, ccy] = projectWorldToClient(new THREE.Vector3(pcx, deckY, pcz), persp, projScratch.current, rect);
                const [sx, sz] = CORNERS[cornerIdx]!;
                const [vx, vy] = projectWorldToClient(
                    new THREE.Vector3(pcx + sx * phx, deckY, pcz + sz * phz),
                    persp,
                    projScratch.current,
                    rect
                );
                gl.domElement.style.cursor = cornerCursorFromScreenDelta(vx - ccx, vy - ccy);
                return;
            }
            const hit = rayToPlaneXZ(clientX, clientY, planeY);
            if (hit && isInsidePadXZFor(hit[0], hit[1], pad)) {
                gl.domElement.style.cursor = 'grab';
                return;
            }
            gl.domElement.style.cursor = 'crosshair';
        },
        [editActive, pickCornerIndexForPad, rayToPlaneXZ, gl, camera, groundY]
    );

    useEffect(() => {
        if (!editActive || !placementPadSceneDefaultPending) return;
        const pad = useEngineStore.getState().placementPad;
        if (!pad) {
            useEngineStore.getState().clearPlacementPadSceneDefaultPending();
            return;
        }
        const box = new THREE.Box3();
        expandWorldGroundBox(scene, box);
        if (!box.isEmpty()) {
            const d = defaultPlacementPadFromGroundXZBounds(box.min.x, box.max.x, box.min.z, box.max.z);
            setPad({
                ...d,
                padDisplayMode: pad.padDisplayMode ?? 'flat',
                ...(pad.buildingYaw != null && Number.isFinite(pad.buildingYaw) ? { buildingYaw: pad.buildingYaw } : {}),
                ...(pad.buildingVerticalOffsetM != null && Math.abs(pad.buildingVerticalOffsetM) > 1e-9
                    ? { buildingVerticalOffsetM: pad.buildingVerticalOffsetM }
                    : {}),
                ...(pad.padVerticalOffsetM != null && Math.abs(pad.padVerticalOffsetM) > 1e-9
                    ? { padVerticalOffsetM: pad.padVerticalOffsetM }
                    : {}),
            });
        }
        useEngineStore.getState().clearPlacementPadSceneDefaultPending();
    }, [editActive, placementPadSceneDefaultPending, scene, setPad]);

    useEffect(() => {
        if (!editActive) {
            dragRef.current = null;
            setPadMarqueeScreen(null);
            gl.domElement.style.cursor = '';
            return;
        }

        const cap = { capture: true } as const;
        const el = gl.domElement;

        const terrainYForPad = (pad: GroundPlacementPad) =>
            CORNERS.map(([sx, sz]) => {
                const [pcx, pcz] = pad.center;
                const [phx, phz] = pad.halfExtents;
                return groundY(pcx + sx * phx, pcz + sz * phz);
            }).reduce((a, b) => a + b, 0) / CORNERS.length;

        const onPointerMoveHover = (e: PointerEvent) => {
            if (dragRef.current) return;
            updateHoverCursor(e.clientX, e.clientY);
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            const pad = useEngineStore.getState().placementPad;
            if (!pad) return;
            const [pcx, pcz] = pad.center;
            const [phx, phz] = pad.halfExtents;
            const lift = pad.padVerticalOffsetM ?? 0;
            const ty = terrainYForPad(pad);
            const planeY = ty + lift;
            const deckY = planeY;

            const cornerIdx = pickCornerIndexForPad(e.clientX, e.clientY, pad, deckY);
            if (cornerIdx != null) {
                const [sx, sz] = CORNERS[cornerIdx]!;
                const anchorX = pcx - sx * phx;
                const anchorZ = pcz - sz * phz;
                dragRef.current = { kind: 'resize', anchorX, anchorZ, planeY };
                setDragging(true);
                el.style.cursor = 'grabbing';
                try {
                    el.setPointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
                e.preventDefault();
                return;
            }

            const hit = rayToPlaneXZ(e.clientX, e.clientY, planeY);
            if (!hit || !isInsidePadXZFor(hit[0], hit[1], pad)) return;

            dragRef.current = {
                kind: 'move',
                startCx: pcx,
                startCz: pcz,
                startWx: hit[0],
                startWz: hit[1],
                planeY,
            };
            setDragging(true);
            el.style.cursor = 'grabbing';
            try {
                el.setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            e.preventDefault();
        };

        const onPointerMove = (e: PointerEvent) => {
            const d = dragRef.current;
            if (!d) {
                updateHoverCursor(e.clientX, e.clientY);
                return;
            }
            const padNow = useEngineStore.getState().placementPad;
            if (!padNow) return;
            const hit = rayToPlaneXZ(e.clientX, e.clientY, d.planeY);
            if (!hit) return;

            if (d.kind === 'move') {
                const dwx = hit[0] - d.startWx;
                const dwz = hit[1] - d.startWz;
                setPad({
                    ...padNow,
                    center: [d.startCx + dwx, d.startCz + dwz],
                });
            } else {
                const { center, halfExtents } = resizedPadFromAnchor(d.anchorX, d.anchorZ, hit[0], hit[1]);
                setPad({
                    ...padNow,
                    center,
                    halfExtents,
                });
            }
        };

        const endDrag = (e: PointerEvent) => {
            if (!dragRef.current) return;
            dragRef.current = null;
            setDragging(false);
            try {
                el.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            updateHoverCursor(e.clientX, e.clientY);
        };

        el.addEventListener('pointermove', onPointerMoveHover, cap);
        el.addEventListener('pointerdown', onPointerDown, cap);
        el.addEventListener('pointermove', onPointerMove, cap);
        el.addEventListener('pointerup', endDrag, cap);
        el.addEventListener('pointercancel', endDrag, cap);

        return () => {
            el.style.cursor = '';
            el.removeEventListener('pointermove', onPointerMoveHover, cap);
            el.removeEventListener('pointerdown', onPointerDown, cap);
            el.removeEventListener('pointermove', onPointerMove, cap);
            el.removeEventListener('pointerup', endDrag, cap);
            el.removeEventListener('pointercancel', endDrag, cap);
            dragRef.current = null;
            setPadMarqueeScreen(null);
        };
    }, [
        editActive,
        gl,
        groundY,
        setDragging,
        setPadMarqueeScreen,
        pickCornerIndexForPad,
        rayToPlaneXZ,
        camera,
        setPad,
        updateHoverCursor,
    ]);

    useEffect(() => {
        if (!editActive) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (!e.shiftKey || e.repeat) return;
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (!useEngineStore.getState().placementPadEditActive) return;
            e.preventDefault();
            const pad = useEngineStore.getState().placementPad;
            if (!pad) return;
            const cur = pad.padVerticalOffsetM ?? 0;
            const delta = e.key === 'ArrowUp' ? PAD_VERTICAL_NUDGE_M : -PAD_VERTICAL_NUDGE_M;
            const next = clampPadVerticalOffsetM(cur + delta);
            const { padVerticalOffsetM: _d, ...rest } = pad;
            const nextPad: GroundPlacementPad =
                Math.abs(next) < 1e-9 ? rest : { ...rest, padVerticalOffsetM: next };
            setPad(nextPad);
        };
        window.addEventListener('keydown', onKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    }, [editActive, setPad]);

    if (!placementPad) return null;

    return (
        <group>
            {mode === 'flat' ? (
                <>
                    <PadFillFlat cx={cx} cz={cz} hx={hx} hz={hz} y={visualDeckY} subtle={!editActive} />
                    <PadFlatOutline cx={cx} cz={cz} hx={hx} hz={hz} y={visualDeckY} />
                </>
            ) : (
                <PadOutlineFollow cx={cx} cz={cz} hx={hx} hz={hz} heights={liftedCornerHeights} />
            )}
        </group>
    );
}
