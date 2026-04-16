'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '@/engine/store/engine.store';
import { useAuthStore } from '@/store/auth.store';
import { boxesOverlap, parseUnitPosition, parseUnitSize } from '@/engine/lib/unitBoxOverlap';
import type { Database } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

const GROUND_Y = -0.9;
const MIN_SIZE = 0.5;

function stepFromDimension(d: number) {
    return Math.max(d * 0.05, 0.08);
}

function isPrismUnit(u: UnitRow): boolean {
    const f = (u as { footprint?: [number, number][] | null }).footprint;
    return Array.isArray(f) && f.length >= 3;
}

function isSectionPlanSourced(u: UnitRow): boolean {
    return u.section_plan_sourced === true;
}

function isEditableTarget(el: EventTarget | null) {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
    return el.closest('input, textarea, select, [contenteditable="true"]') != null;
}

/** Horizontal “screen right” on the XZ plane: cross(viewForward, worldUp). */
function cameraRightOnGround(camera: THREE.Camera, out: THREE.Vector3) {
    camera.getWorldDirection(out);
    out.y = 0;
    if (out.lengthSq() < 1e-10) {
        out.set(1, 0, 0);
        return out.normalize();
    }
    out.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    out.crossVectors(out, up).normalize();
    return out;
}

export default function PrismKeyboardEdit() {
    const { camera } = useThree();
    const keysHeld = useRef(new Set<string>());
    const rightScratch = useRef(new THREE.Vector3());

    useEffect(() => {
        const heldKeys = keysHeld.current;
        const onKeyDown = (e: KeyboardEvent) => {
            if (isEditableTarget(e.target)) return;

            const engine = useEngineStore.getState();
            if (engine.viewMode !== 'exterior') return;
            if (useAuthStore.getState().profile?.role !== 'admin') return;

            const code = e.code;
            if (code === 'KeyL' || code === 'KeyH' || code === 'KeyB') {
                heldKeys.add(code);
                return;
            }

            if (!e.shiftKey) return;
            if (code !== 'ArrowUp' && code !== 'ArrowDown' && code !== 'ArrowLeft' && code !== 'ArrowRight') return;

            const { selectedUnit, units, unitPositionHandler, unitSizeHandler } = engine;
            if (!selectedUnit || !unitPositionHandler || !unitSizeHandler) return;

            const row = units.find((u) => u.id === selectedUnit);
            if (!row || !isPrismUnit(row) || isSectionPlanSourced(row)) return;

            const pos = parseUnitPosition(row);
            const size = parseUnitSize(row);
            const [w, h, d] = size;
            const [cx, cy, cz] = pos;

            const axisSign =
                code === 'ArrowUp' || code === 'ArrowRight' ? 1
                    : -1;

            const l = heldKeys.has('KeyL');
            const hKey = heldKeys.has('KeyH');
            const b = heldKeys.has('KeyB');

            if (l || hKey || b) {
                if (code !== 'ArrowUp' && code !== 'ArrowDown') return;

                const which: 'length' | 'height' | 'breadth' = l ? 'length' : hKey ? 'height' : 'breadth';

                let newW = w;
                let newH = h;
                let newD = d;
                const newCx = cx;
                let newCy = cy;
                const newCz = cz;

                if (which === 'length') {
                    const step = stepFromDimension(w) * axisSign;
                    newW = Math.max(MIN_SIZE, w + step);
                } else if (which === 'breadth') {
                    const step = stepFromDimension(d) * axisSign;
                    newD = Math.max(MIN_SIZE, d + step);
                } else {
                    const step = stepFromDimension(h) * axisSign;
                    newH = Math.max(MIN_SIZE, h + step);
                    const bottom = cy - h / 2;
                    newCy = bottom + newH / 2;
                    const minY = GROUND_Y + newH / 2;
                    if (newCy < minY) newCy = minY;
                }

                const nextPos: [number, number, number] = [newCx, newCy, newCz];
                const nextSize: [number, number, number] = [newW, newH, newD];
                const overlaps = units.some((u) => {
                    if (u.id === row.id) return false;
                    return boxesOverlap(nextPos, nextSize, parseUnitPosition(u), parseUnitSize(u));
                });
                if (overlaps) return;

                e.preventDefault();
                e.stopPropagation();
                if (which === 'height') {
                    void Promise.all([
                        unitSizeHandler(row.id, nextSize),
                        unitPositionHandler(row.id, nextPos),
                    ]);
                } else {
                    void unitSizeHandler(row.id, nextSize);
                }
                return;
            }

            let next: [number, number, number] = [cx, cy, cz];
            if (code === 'ArrowUp' || code === 'ArrowDown') {
                const stepY = stepFromDimension(h) * axisSign;
                next = [cx, cy + stepY, cz];
                const minY = GROUND_Y + h / 2;
                if (next[1] < minY) next[1] = minY;
            } else {
                const horizontalSpan = Math.max(w, d);
                const step = stepFromDimension(horizontalSpan) * axisSign;
                const right = cameraRightOnGround(camera, rightScratch.current);
                next = [cx + right.x * step, cy, cz + right.z * step];
            }

            const overlaps = units.some((u) => {
                if (u.id === row.id) return false;
                return boxesOverlap(next, size, parseUnitPosition(u), parseUnitSize(u));
            });
            if (overlaps) return;

            e.preventDefault();
            e.stopPropagation();
            void unitPositionHandler(row.id, next);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const code = e.code;
            if (code === 'KeyL' || code === 'KeyH' || code === 'KeyB') heldKeys.delete(code);
        };

        const onBlur = () => {
            heldKeys.clear();
        };

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
            window.removeEventListener('blur', onBlur);
            heldKeys.clear();
        };
    }, [camera]);

    return null;
}
