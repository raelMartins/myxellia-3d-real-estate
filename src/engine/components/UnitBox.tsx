'use client';

import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '@/engine/store/engine.store';
import { useAuthStore } from '@/store/auth.store';
import { boxesOverlap, parseUnitPosition, parseUnitSize } from '@/engine/lib/unitBoxOverlap';
import { isUnitAllocatedToOtherClient } from '@/engine/lib/unitClientAccess';
import UnitBoxCornerHandles from './UnitBoxCornerHandles';

export interface UnitMesh {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
}

const STATUS_COLOR: Record<string, string> = {
    available: '#39FF14',
    pending: '#F97316',
    sold: '#EF4444',
};
const STATUS_EMISSIVE: Record<string, string> = {
    available: '#1A6600',
    pending: '#7A3800',
    sold: '#6A0000',
};

const GROUND_Y = -0.9;
/** Pixels of pointer movement before a press counts as a drag (preserves double-click for interior). */
const DRAG_THRESHOLD_PX = 6;

type R3FPointerEvent = { stopPropagation: () => void; intersections: Array<{ point: THREE.Vector3 }>; nativeEvent?: PointerEvent & { pointerId?: number } };

export default function UnitBox({ unit }: { unit: UnitMesh }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const groupRef = useRef<THREE.Group>(null!);
    const {
        units: storeUnits,
        selectedUnit,
        hoveredUnit,
        unitStatuses,
        unitAllocationUserIds,
        unitAllocationNames,
        setSelectedUnit,
        setHoveredUnit,
        setViewMode,
        setNotification,
        unitPositionHandler,
        unitSizeHandler,
    } = useEngineStore();
    const isAdmin = useAuthStore((s) => s.profile?.role === 'admin');
    const currentUserId = useAuthStore((s) => s.user?.id);
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragJustEndedRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<[number, number, number]>(unit.position);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeSize, setResizeSize] = useState<[number, number, number]>(unit.size);
    const [resizePosition, setResizePosition] = useState<[number, number, number]>(unit.position);
    const [isIndicatorHovered, setIsIndicatorHovered] = useState(false);
    const dragPositionRef = useRef<[number, number, number]>(unit.position);
    const offsetRef = useRef(new THREE.Vector3());
    const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const intersectRef = useRef(new THREE.Vector3());
    const cameraDirRef = useRef(new THREE.Vector3());
    const groupWorldPosRef = useRef(new THREE.Vector3());
    const { camera, gl } = useThree();
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());

    const status = unitStatuses[unit.id] ?? 'available';
    const isHovered = hoveredUnit === unit.id;
    const isSelected = selectedUnit === unit.id;
    const displayPos = isDragging ? dragPosition : isResizing ? resizePosition : unit.position;
    const displaySize = isResizing ? resizeSize : unit.size;

    const baseColor = useMemo(() => new THREE.Color(STATUS_COLOR[status]), [status]);
    const emissiveColor = useMemo(() => new THREE.Color(STATUS_EMISSIVE[status]), [status]);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        if (isDragging) {
            setDragPosition([...dragPositionRef.current]);
        } else if (!isResizing) {
            const mat = meshRef.current.material as THREE.MeshStandardMaterial;
            if (status === 'pending') {
                const pulse = Math.sin(clock.elapsedTime * 3) * 0.5 + 0.5;
                mat.emissiveIntensity = 0.3 + pulse * 0.5;
            } else if (isHovered || isSelected) {
                mat.emissiveIntensity = 0.6;
            } else {
                mat.emissiveIntensity = 0.18;
            }
        }
    });

    const handleClick = () => {
        if (dragJustEndedRef.current) {
            dragJustEndedRef.current = false;
            return;
        }
        if (
            isUnitAllocatedToOtherClient({
                unitId: unit.id,
                currentUserId,
                isAdmin,
                unitAllocationUserIds,
            })
        ) {
            const n = unitAllocationNames[unit.id]?.trim();
            setNotification(n ? `This unit is allocated to ${n}.` : 'This unit is already allocated to another client.');
            return;
        }
        clickCountRef.current += 1;
        if (clickCountRef.current === 1) {
            setSelectedUnit(unit.id);
            clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 350);
        } else if (clickCountRef.current >= 2) {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickCountRef.current = 0;
            setViewMode('interior');
        }
    };

    const onPointerDown = (e: R3FPointerEvent) => {
        if (!isAdmin || !unitPositionHandler) return;
        if (!isSelected) return;
        e.stopPropagation();
        const ne = e.nativeEvent;
        if (ne) {
            ne.preventDefault();
            ne.stopImmediatePropagation();
        }
        const hit = e.intersections[0]?.point;
        if (!hit || !groupRef.current) return;
        const el = gl.domElement;
        const pointerId = e.nativeEvent?.pointerId ?? 0;
        const startClientX = ne?.clientX ?? 0;
        const startClientY = ne?.clientY ?? 0;
        let dragCommitted = false;
        groupRef.current.getWorldPosition(groupWorldPosRef.current);
        offsetRef.current.copy(hit).sub(groupWorldPosRef.current);
        camera.getWorldDirection(cameraDirRef.current);
        planeRef.current.setFromNormalAndCoplanarPoint(cameraDirRef.current, hit);
        dragPositionRef.current = unit.position;
        el.setPointerCapture(pointerId);

        const applyPlaneDrag = (ev: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            pointerRef.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const planeHit = raycasterRef.current.ray.intersectPlane(planeRef.current, intersectRef.current);
            if (planeHit) {
                const minY = GROUND_Y + unit.size[1] / 2;
                let y = planeHit.y - offsetRef.current.y;
                if (y < minY) y = minY;
                const candidate: [number, number, number] = [
                    planeHit.x - offsetRef.current.x,
                    y,
                    planeHit.z - offsetRef.current.z,
                ];
                const overlapsOther = storeUnits.some((u) => {
                    if (u.id === unit.id) return false;
                    return boxesOverlap(candidate, unit.size, parseUnitPosition(u), parseUnitSize(u));
                });
                if (!overlapsOther) dragPositionRef.current = candidate;
            }
        };

        const onMove = (ev: PointerEvent) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (!dragCommitted) {
                const dx = ev.clientX - startClientX;
                const dy = ev.clientY - startClientY;
                if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
                dragCommitted = true;
                setDragPosition([...dragPositionRef.current]);
                setIsDragging(true);
                document.body.style.cursor = 'grabbing';
            }
            applyPlaneDrag(ev);
        };
        const onUp = (ev: PointerEvent) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            el.removeEventListener('pointermove', onMove, true);
            el.removeEventListener('pointerup', onUp, true);
            el.releasePointerCapture(pointerId);
            document.body.style.cursor = 'auto';
            if (dragCommitted) {
                dragJustEndedRef.current = true;
                const finalPos = [...dragPositionRef.current] as [number, number, number];
                unitPositionHandler(unit.id, finalPos)
                    .then(() => setIsDragging(false))
                    .catch(() => setIsDragging(false));
            }
        };
        el.addEventListener('pointermove', onMove, true);
        el.addEventListener('pointerup', onUp, true);
    };

    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;
    const showCornerHandles = (isHovered || isResizing || isIndicatorHovered) && isAdmin && !!unitSizeHandler && !isDragging;

    const wouldOverlapOtherUnits = useCallback((center: [number, number, number], size: [number, number, number]) => (
        storeUnits.some((u) => u.id !== unit.id && boxesOverlap(center, size, parseUnitPosition(u), parseUnitSize(u)))
    ), [storeUnits, unit.id]);

    const handleResizeEnd = () => {
        if (!unitSizeHandler || !unitPositionHandler) return;
        const finalSize = [...resizeSize] as [number, number, number];
        const finalPos = [...resizePosition] as [number, number, number];
        Promise.all([
            unitSizeHandler(unit.id, finalSize),
            unitPositionHandler(unit.id, finalPos),
        ]).finally(() => setIsResizing(false));
    };

    return (
        <group ref={groupRef} position={displayPos}>
            <mesh
                ref={meshRef}
                position={[0, 0, 0]}
                scale={[scale, scale, scale]}
                onClick={handleClick}
                onPointerDown={onPointerDown}
                onPointerOver={(e: R3FPointerEvent) => {
                    e.stopPropagation();
                    setHoveredUnit(unit.id);
                    if (!isDragging && !isResizing) {
                        const blocked =
                            !isAdmin &&
                            isUnitAllocatedToOtherClient({
                                unitId: unit.id,
                                currentUserId,
                                isAdmin,
                                unitAllocationUserIds,
                            });
                        document.body.style.cursor =
                            blocked ? 'not-allowed' : isAdmin && isSelected ? 'grab' : 'pointer';
                    }
                }}
                onPointerOut={() => { setHoveredUnit(null); if (!isDragging && !isResizing) document.body.style.cursor = 'auto'; }}
                castShadow
                receiveShadow
            >
                <boxGeometry args={displaySize} />
                <meshStandardMaterial
                    color={isSelected ? '#FFFFFF' : baseColor}
                    emissive={emissiveColor}
                    emissiveIntensity={0.2}
                    roughness={0.3}
                    metalness={0.6}
                    transparent
                    opacity={isSelected ? 0.55 : 0.4}
                />
            </mesh>
            <UnitBoxCornerHandles
                unit={unit}
                displaySize={displaySize}
                displayPosition={displayPos}
                visible={showCornerHandles}
                wouldOverlapOtherUnits={wouldOverlapOtherUnits}
                onIndicatorHoverChange={setIsIndicatorHovered}
                onResize={(size, pos) => {
                    setIsResizing(true);
                    setResizeSize(size);
                    setResizePosition(pos);
                }}
                onResizeEnd={handleResizeEnd}
            />
        </group>
    );
}
