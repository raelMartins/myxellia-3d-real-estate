import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '../store/engine.store';
import { useAuthStore } from '../store/auth.store';
import { boxesOverlap, parseUnitPosition, parseUnitSize } from '../lib/unitBoxOverlap';
import UnitBoxCornerHandles from './UnitBoxCornerHandles';
import UnitPrismRotateButtons from './UnitPrismRotateButtons';
import type { UnitMesh } from './UnitBox';

export interface UnitPrismMesh {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    footprint: [number, number][];
    /** Y-axis rotation in radians (horizontal turn). */
    rotation?: number;
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
type R3FPointerEvent = { stopPropagation: () => void; intersections: Array<{ point: THREE.Vector3 }>; nativeEvent?: PointerEvent & { pointerId?: number } };
export default function UnitPrism({ unit, allowDrag = true }: { unit: UnitPrismMesh; allowDrag?: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const groupRef = useRef<THREE.Group>(null!);
    const {
        units: storeUnits,
        selectedUnit,
        hoveredUnit,
        unitStatuses,
        setSelectedUnit,
        setHoveredUnit,
        setViewMode,
        unitPositionHandler,
        unitSizeHandler,
        unitRotationHandler,
    } = useEngineStore();
    const isAdmin = useAuthStore((s) => s.profile?.role === 'admin');
    const status = unitStatuses[unit.id] ?? 'available';
    const isHovered = hoveredUnit === unit.id;
    const isSelected = selectedUnit === unit.id;

    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<[number, number, number]>(unit.position);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeSize, setResizeSize] = useState<[number, number, number]>(unit.size);
    const [resizePosition, setResizePosition] = useState<[number, number, number]>(unit.position);
    const [isIndicatorHovered, setIsIndicatorHovered] = useState(false);
    const dragPositionRef = useRef<[number, number, number]>(unit.position);
    const dragJustEndedRef = useRef(false);
    const offsetRef = useRef(new THREE.Vector3());
    const cameraDirRef = useRef(new THREE.Vector3());
    const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const intersectRef = useRef(new THREE.Vector3());
    const groupWorldPosRef = useRef(new THREE.Vector3());
    const { camera, gl } = useThree();
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());

    const displayPos = isDragging ? dragPosition : isResizing ? resizePosition : unit.position;
    const displaySize = isResizing ? resizeSize : unit.size;
    const [width, height, depth] = displaySize;

    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        const pts = unit.footprint;
        if (pts.length < 3) return new THREE.BoxGeometry(width, height, depth);
        const scaleX = width;
        const scaleZ = depth;
        shape.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleZ);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * scaleX, pts[i][1] * scaleZ);
        shape.closePath();
        const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
        geom.rotateX(-Math.PI / 2);
        geom.translate(0, height / 2, 0);
        geom.computeBoundingBox();
        const center = new THREE.Vector3();
        geom.boundingBox!.getCenter(center);
        geom.translate(-center.x, -center.y, -center.z);
        return geom;
    }, [unit.footprint, width, height, depth]);
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
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleClick = useCallback(() => {
        if (dragJustEndedRef.current) {
            dragJustEndedRef.current = false;
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
    }, [unit.id, setSelectedUnit, setViewMode]);
    const canEdit = allowDrag && isAdmin && !!unitPositionHandler;
    const onPointerDown = useCallback((e: R3FPointerEvent) => {
        if (!canEdit) return;
        e.stopPropagation();
        const ne = e.nativeEvent;
        if (ne) {
            ne.preventDefault();
            ne.stopImmediatePropagation();
        }
        const hit = e.intersections[0]?.point;
        if (!hit || !groupRef.current) return;
        const el = gl.domElement;
        const pointerId = (e as unknown as { nativeEvent?: { pointerId: number } }).nativeEvent?.pointerId ?? 0;
        groupRef.current.getWorldPosition(groupWorldPosRef.current);
        offsetRef.current.copy(hit).sub(groupWorldPosRef.current);
        camera.getWorldDirection(cameraDirRef.current);
        planeRef.current.setFromNormalAndCoplanarPoint(cameraDirRef.current, hit);
        dragPositionRef.current = unit.position;
        setDragPosition(unit.position);
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
        el.setPointerCapture(pointerId);

        const onMove = (ev: PointerEvent) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
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
        const onUp = (ev: PointerEvent) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            el.removeEventListener('pointermove', onMove, true);
            el.removeEventListener('pointerup', onUp, true);
            el.releasePointerCapture(pointerId);
            document.body.style.cursor = 'auto';
            dragJustEndedRef.current = true;
            const finalPos = [...dragPositionRef.current] as [number, number, number];
            unitPositionHandler(unit.id, finalPos)
                .then(() => setIsDragging(false))
                .catch(() => setIsDragging(false));
        };
        el.addEventListener('pointermove', onMove, true);
        el.addEventListener('pointerup', onUp, true);
    }, [canEdit, gl.domElement, camera, unit.id, unit.position, unit.size, storeUnits, unitPositionHandler]);
    const showCornerHandles = (isHovered || isResizing || isIndicatorHovered) && allowDrag && isAdmin && !!unitSizeHandler && !isDragging;
    const wouldOverlapOtherUnits = useCallback((center: [number, number, number], size: [number, number, number]) => (
        storeUnits.some((u) => u.id !== unit.id && boxesOverlap(center, size, parseUnitPosition(u), parseUnitSize(u)))
    ), [storeUnits, unit.id]);
    const handleResizeEnd = useCallback(() => {
        if (!unitSizeHandler || !unitPositionHandler) return;
        const finalSize = [...resizeSize] as [number, number, number];
        const finalPos = [...resizePosition] as [number, number, number];
        Promise.all([
            unitSizeHandler(unit.id, finalSize),
            unitPositionHandler(unit.id, finalPos),
        ]).finally(() => setIsResizing(false));
    }, [unit.id, resizeSize, resizePosition, unitSizeHandler, unitPositionHandler]);

    const boxMeshForHandles: UnitMesh = useMemo(() => ({ id: unit.id, position: unit.position, size: unit.size }), [unit.id, unit.position, unit.size]);
    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;
    const rotationY = unit.rotation ?? 0;
    const showRotate = isSelected && allowDrag && isAdmin && !!unitRotationHandler && !isDragging && !isResizing;
    return (
        <group ref={groupRef} position={displayPos} rotation={[0, rotationY, 0]}>
            <mesh
                ref={meshRef}
                geometry={geometry}
                scale={[scale, scale, scale]}
                onClick={handleClick}
                onPointerDown={onPointerDown}
                onPointerOver={(e: R3FPointerEvent) => {
                    e.stopPropagation();
                    setHoveredUnit(unit.id);
                    if (!isDragging && !isResizing) document.body.style.cursor = canEdit ? 'grab' : 'pointer';
                }}
                onPointerOut={() => {
                    setHoveredUnit(null);
                    if (!isDragging && !isResizing) document.body.style.cursor = 'auto';
                }}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={isSelected ? '#FFFFFF' : baseColor}
                    emissive={emissiveColor}
                    emissiveIntensity={0.2}
                    roughness={0.3}
                    metalness={0.6}
                    transparent
                    opacity={isSelected ? 0.95 : 0.4}
                />
            </mesh>
            <UnitBoxCornerHandles
                unit={boxMeshForHandles}
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
            <UnitPrismRotateButtons visible={showRotate} height={displaySize[1]} onRotate={(d) => unitRotationHandler?.(unit.id, rotationY + d)} />
        </group>
    );
}
