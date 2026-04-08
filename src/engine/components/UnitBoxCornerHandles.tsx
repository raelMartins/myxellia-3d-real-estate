'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { UnitMesh } from './UnitBox';

const GROUND_Y = -0.9;
const MIN_SIZE = 0.5;
const L_LENGTH = 0.24;
const L_THICKNESS = 0.028;
const CORNER_OFFSET = 0.045;
type R3FPointerEvent = { stopPropagation: () => void; intersections: Array<{ point: THREE.Vector3 }>; nativeEvent?: PointerEvent };
const CORNER_SIGNS: [number, number, number][] = [
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
    [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1],
];

const AXES = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
];

export interface UnitBoxCornerHandlesProps {
    unit: UnitMesh;
    displaySize: [number, number, number];
    displayPosition: [number, number, number];
    visible: boolean;
    wouldOverlapOtherUnits?: (center: [number, number, number], size: [number, number, number]) => boolean;
    onIndicatorHoverChange?: (hovered: boolean) => void;
    onResize: (size: [number, number, number], position: [number, number, number]) => void;
    onResizeEnd: () => void;
}

function rightAngleAxes(viewDir: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
    const dots = [Math.abs(viewDir.x), Math.abs(viewDir.y), Math.abs(viewDir.z)];
    const a = dots[0] <= dots[1] && dots[0] <= dots[2] ? 0 : dots[1] <= dots[2] ? 1 : 2;
    const b = dots[(a + 1) % 3] <= dots[(a + 2) % 3] ? (a + 1) % 3 : (a + 2) % 3;
    return [AXES[a].clone(), AXES[b].clone()];
}

export default function UnitBoxCornerHandles({
    unit: _unit,
    displaySize,
    displayPosition,
    visible,
    wouldOverlapOtherUnits,
    onIndicatorHoverChange,
    onResize,
    onResizeEnd,
}: UnitBoxCornerHandlesProps) {
    const { camera, gl } = useThree();
    const cornerIndexRef = useRef<number | null>(null);
    const fixedWorldRef = useRef(new THREE.Vector3());
    const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const intersectRef = useRef(new THREE.Vector3());
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());
    const opacityRef = useRef(0);
    const hoverOutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const materialRef = useRef(new THREE.MeshBasicMaterial({
        color: new THREE.Color('#FFFFFF'),
        transparent: true,
        depthTest: false,
    }));

    const handleIndicatorPointerOver = () => {
        if (hoverOutTimeoutRef.current) {
            clearTimeout(hoverOutTimeoutRef.current);
            hoverOutTimeoutRef.current = null;
        }
        document.body.style.cursor = 'nwse-resize';
        onIndicatorHoverChange?.(true);
    };
    const handleIndicatorPointerOut = () => {
        hoverOutTimeoutRef.current = setTimeout(() => {
            document.body.style.cursor = 'auto';
            onIndicatorHoverChange?.(false);
        }, 50);
    };

    const half = useMemo(() => [
        displaySize[0] / 2,
        displaySize[1] / 2,
        displaySize[2] / 2,
    ], [displaySize]);

    useFrame(() => {
        const target = visible ? 1 : 0;
        opacityRef.current += (target - opacityRef.current) * 0.32;
        materialRef.current.opacity = opacityRef.current;
    });

    const onPointerDown = (e: R3FPointerEvent, index: number) => {
        e.stopPropagation();
        const ne = e.nativeEvent;
        if (ne) {
            ne.preventDefault();
            ne.stopImmediatePropagation();
        }
        const [ix, iy, iz] = CORNER_SIGNS[index];
        fixedWorldRef.current.set(
            displayPosition[0] - half[0] * ix,
            displayPosition[1] - half[1] * iy,
            displayPosition[2] - half[2] * iz,
        );
        const hit = e.intersections[0]?.point;
        if (hit) planeRef.current.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit);
        cornerIndexRef.current = index;
        document.body.style.cursor = 'nwse-resize';
        gl.domElement.setPointerCapture(ne?.pointerId ?? 0);

        const onMove = (ev: PointerEvent) => {
            if (cornerIndexRef.current === null) return;
            ev.preventDefault();
            const rect = gl.domElement.getBoundingClientRect();
            pointerRef.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const planeHit = raycasterRef.current.ray.intersectPlane(planeRef.current, intersectRef.current);
            if (!planeHit) return;
            const fixed = fixedWorldRef.current;
            const w = Math.max(MIN_SIZE, Math.abs(planeHit.x - fixed.x));
            const h = Math.max(MIN_SIZE, Math.abs(planeHit.y - fixed.y));
            const d = Math.max(MIN_SIZE, Math.abs(planeHit.z - fixed.z));
            const cx = (fixed.x + planeHit.x) / 2;
            let cy = (fixed.y + planeHit.y) / 2;
            const cz = (fixed.z + planeHit.z) / 2;
            const minY = GROUND_Y + h / 2;
            if (cy < minY) cy = minY;
            if (wouldOverlapOtherUnits?.([cx, cy, cz], [w, h, d])) return;
            onResize([w, h, d], [cx, cy, cz]);
        };
        const onUp = (ev: PointerEvent) => {
            ev.preventDefault();
            gl.domElement.removeEventListener('pointermove', onMove, true);
            gl.domElement.removeEventListener('pointerup', onUp, true);
            gl.domElement.releasePointerCapture(ne?.pointerId ?? 0);
            document.body.style.cursor = 'auto';
            cornerIndexRef.current = null;
            onResizeEnd();
        };
        gl.domElement.addEventListener('pointermove', onMove, true);
        gl.domElement.addEventListener('pointerup', onUp, true);
    };

    const viewDir = useMemo(() => new THREE.Vector3(), []);
    camera.getWorldDirection(viewDir);
    const [axis1, axis2] = rightAngleAxes(viewDir);

    return (
        <>
            {CORNER_SIGNS.map(([ix, iy, iz], i) => {
                const sign1 = axis1.x ? ix : axis1.y ? iy : iz;
                const sign2 = axis2.x ? ix : axis2.y ? iy : iz;
                const leg1 = new THREE.Vector3().copy(axis1).multiplyScalar(-L_LENGTH * sign1);
                const leg2 = new THREE.Vector3().copy(axis2).multiplyScalar(-L_LENGTH * sign2);
                const o = CORNER_OFFSET / Math.sqrt(3);
                const cornerPos: [number, number, number] = [
                    (half[0] + o) * ix,
                    (half[1] + o) * iy,
                    (half[2] + o) * iz,
                ];
                const leg1Center = new THREE.Vector3(leg1.x * 0.5, leg1.y * 0.5, leg1.z * 0.5);
                const leg2Center = new THREE.Vector3(leg2.x * 0.5, leg2.y * 0.5, leg2.z * 0.5);
                const leg1Scale: [number, number, number] = [
                    Math.abs(axis1.x) * L_LENGTH + L_THICKNESS * (1 - Math.abs(axis1.x)),
                    Math.abs(axis1.y) * L_LENGTH + L_THICKNESS * (1 - Math.abs(axis1.y)),
                    Math.abs(axis1.z) * L_LENGTH + L_THICKNESS * (1 - Math.abs(axis1.z)),
                ];
                const leg2Scale: [number, number, number] = [
                    Math.abs(axis2.x) * L_LENGTH + L_THICKNESS * (1 - Math.abs(axis2.x)),
                    Math.abs(axis2.y) * L_LENGTH + L_THICKNESS * (1 - Math.abs(axis2.y)),
                    Math.abs(axis2.z) * L_LENGTH + L_THICKNESS * (1 - Math.abs(axis2.z)),
                ];
                return (
                    <group key={i} position={cornerPos}>
                        <mesh
                            position={[leg1Center.x, leg1Center.y, leg1Center.z]}
                            scale={leg1Scale}
                            onPointerOver={(e) => { e.stopPropagation(); handleIndicatorPointerOver(); }}
                            onPointerOut={handleIndicatorPointerOut}
                        >
                            <boxGeometry args={[1, 1, 1]} />
                            <primitive object={materialRef.current} attach="material" />
                        </mesh>
                        <mesh
                            position={[leg2Center.x, leg2Center.y, leg2Center.z]}
                            scale={leg2Scale}
                            onPointerOver={(e) => { e.stopPropagation(); handleIndicatorPointerOver(); }}
                            onPointerOut={handleIndicatorPointerOut}
                        >
                            <boxGeometry args={[1, 1, 1]} />
                            <primitive object={materialRef.current} attach="material" />
                        </mesh>
                        <mesh
                            position={[0, 0, 0]}
                            onPointerDown={(e) => onPointerDown(e, i)}
                            onPointerOver={(e) => { e.stopPropagation(); handleIndicatorPointerOver(); }}
                            onPointerOut={handleIndicatorPointerOut}
                        >
                            <boxGeometry args={[0.2, 0.2, 0.2]} />
                            <meshBasicMaterial visible={false} />
                        </mesh>
                    </group>
                );
            })}
        </>
    );
}
