'use client';

import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useEngineStore } from '@/engine/store/engine.store';
import { useAuthStore } from '@/store/auth.store';
import { boxesOverlap, parseUnitPosition, parseUnitSize } from '@/engine/lib/unitBoxOverlap';
import { isUnitAllocatedToOtherClient } from '@/engine/lib/unitClientAccess';
import UnitPrismRotateButtons from './UnitPrismRotateButtons';

export interface UnitPrismMesh {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    footprint: [number, number][];
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
/** Default prism tint vs hover (matches prior look on hover). */
const PRISM_COLOR_BRIGHTNESS_IDLE = 0.4;
/**
 * Drei `Html` (transform=false): `screenScale ∝ distanceFactor / cameraDistance`.
 * - Scale `distanceFactor` with camera distance so orbit zoom does not dominate.
 * - Scale with this unit's max extent (scene units) so the card tracks the prism mesh
 *   when imports / worlds use different world scales — not a fixed meter-only baseline.
 * - `UNIT_TOOLTIP_SIZE_GLOBAL` shrinks the whole card vs the prior tuned baseline (~1%: 5% then 20%).
 */
const UNIT_TOOLTIP_SIZE_GLOBAL = 0.05 * 0.2;
const UNIT_TOOLTIP_BASE_FACTOR = (10 / 9) * 5 * UNIT_TOOLTIP_SIZE_GLOBAL;
/** Camera distance (scene units) paired with the reference extent below. */
const UNIT_TOOLTIP_REF_DISTANCE = 5.5;
/** Typical unit box max(width,depth,height) in scene units for a “1×” tooltip model scale. */
const UNIT_TOOLTIP_REF_EXTENT = 2.6;
const UNIT_TOOLTIP_EXTENT_MUL_MIN = 0.22;
const UNIT_TOOLTIP_EXTENT_MUL_MAX = 6.5;
const UNIT_TOOLTIP_FACTOR_MIN = 0.35 * UNIT_TOOLTIP_SIZE_GLOBAL;
const UNIT_TOOLTIP_FACTOR_MAX = 42 * UNIT_TOOLTIP_SIZE_GLOBAL;
/** Pixels of pointer movement before a press counts as a drag (preserves double-click for interior). */
const DRAG_THRESHOLD_PX = 6;
type R3FPointerEvent = { stopPropagation: () => void; intersections: Array<{ point: THREE.Vector3 }>; nativeEvent?: PointerEvent & { pointerId?: number } };

export default function UnitPrism({ unit, allowDrag = true }: { unit: UnitPrismMesh; allowDrag?: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const groupRef = useRef<THREE.Group>(null!);
    const {
        units: storeUnits,
        selectedUnit,
        hoveredUnit,
        unitStatuses,
        unitAllocationNames,
        unitAllocationUserIds,
        setSelectedUnit,
        setHoveredUnit,
        setViewMode,
        setNotification,
        unitPositionHandler,
        unitRotationHandler,
    } = useEngineStore();
    const isAdmin = useAuthStore((s) => s.profile?.role === 'admin');
    const currentUserId = useAuthStore((s) => s.user?.id);
    const status = unitStatuses[unit.id] ?? 'available';
    const isHovered = hoveredUnit === unit.id;
    const isSelected = selectedUnit === unit.id;

    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<[number, number, number]>(unit.position);
    const dragPositionRef = useRef<[number, number, number]>(unit.position);
    const dragJustEndedRef = useRef(false);
    const offsetRef = useRef(new THREE.Vector3());
    const cameraDirRef = useRef(new THREE.Vector3());
    const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const intersectRef = useRef(new THREE.Vector3());
    const groupWorldPosRef = useRef(new THREE.Vector3());
    const { camera, gl } = useThree();
    const tooltipCardWorldRef = useRef(new THREE.Vector3());
    const [tooltipDistanceFactor, setTooltipDistanceFactor] = useState(UNIT_TOOLTIP_BASE_FACTOR);
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());

    const displayPos = isDragging ? dragPosition : unit.position;
    const displaySize = unit.size;
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

    const brighten = isHovered && !isDragging;
    const meshColor = useMemo(() => {
        const c = new THREE.Color(isSelected ? '#FFFFFF' : STATUS_COLOR[status]);
        if (!brighten) c.multiplyScalar(PRISM_COLOR_BRIGHTNESS_IDLE);
        return c;
    }, [isSelected, status, brighten]);
    const meshEmissive = useMemo(() => {
        const c = new THREE.Color(STATUS_EMISSIVE[status]);
        if (!brighten) c.multiplyScalar(PRISM_COLOR_BRIGHTNESS_IDLE);
        return c;
    }, [status, brighten]);

    const storeUnit = storeUnits.find((u) => u.id === unit.id);
    const unitTitle = storeUnit?.display_name?.trim() || `Unit ${storeUnit?.unit_number ?? unit.id}`;
    const allocatedToOther = isUnitAllocatedToOtherClient({
        unitId: unit.id,
        currentUserId,
        isAdmin,
        unitAllocationUserIds,
    });
    const otherClientName = unitAllocationNames[unit.id]?.trim();
    const allocationLine = allocatedToOther
        ? otherClientName
            ? `Allocated · ${otherClientName}`
            : 'Allocated'
        : status === 'available'
          ? 'Available'
          : status === 'sold'
            ? unitAllocationNames[unit.id]
                ? `Allocated to ${unitAllocationNames[unit.id]}`
                : 'Allocated'
            : unitAllocationNames[unit.id]
              ? `Pending · ${unitAllocationNames[unit.id]}`
              : 'Allocation pending';

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        if (isDragging) {
            setDragPosition([...dragPositionRef.current]);
        } else {
            const mat = meshRef.current.material as THREE.MeshStandardMaterial;
            if (status === 'pending') {
                const pulse = Math.sin(clock.elapsedTime * 3) * 0.5 + 0.5;
                const hi = 0.3 + pulse * 0.5;
                mat.emissiveIntensity = brighten ? hi : hi * PRISM_COLOR_BRIGHTNESS_IDLE;
            } else if (brighten) {
                mat.emissiveIntensity = 0.6;
            } else if (isSelected) {
                mat.emissiveIntensity = 0.6 * PRISM_COLOR_BRIGHTNESS_IDLE;
            } else {
                mat.emissiveIntensity = 0.18 * PRISM_COLOR_BRIGHTNESS_IDLE;
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
    }, [
        unit.id,
        currentUserId,
        isAdmin,
        unitAllocationUserIds,
        unitAllocationNames,
        setSelectedUnit,
        setViewMode,
        setNotification,
    ]);
    const canEdit = allowDrag && isAdmin && !!unitPositionHandler;
    const onPointerDown = useCallback((e: R3FPointerEvent) => {
        if (!canEdit) return;
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
        const pointerId = (e as unknown as { nativeEvent?: { pointerId: number } }).nativeEvent?.pointerId ?? 0;
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
    }, [canEdit, isSelected, gl.domElement, camera, unit.id, unit.position, unit.size, storeUnits, unitPositionHandler]);
    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;
    const rotationY = unit.rotation ?? 0;
    const showRotate = isSelected && allowDrag && isAdmin && !!unitRotationHandler && !isDragging;
    const prismTopY = (displaySize[1] * scale) / 2 + 0.06;
    const connector = useMemo(() => {
        const basis = Math.max(width, depth, 0.32);
        const gap = Math.max(0.025, basis * 0.0275);
        const footY = prismTopY + gap;
        const vertLen = Math.max(basis * 0.09, 0.08);
        const elbowY = footY + vertLen;
        const horizLen = Math.max(basis * 0.1, 0.085);
        const goRight = unit.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 2 === 0;
        const sign = goRight ? 1 : -1;
        const hDir = new THREE.Vector3(sign, 0, 0);
        const cardFace = new THREE.Vector3(sign * horizLen, elbowY, 0);
        const tubeR = Math.max(0.026, Math.min(0.048, basis * 0.062));
        const vMid = new THREE.Vector3(0, (footY + elbowY) * 0.5, 0);
        const hMid = new THREE.Vector3(sign * horizLen * 0.5, elbowY, 0);
        const hQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), hDir);
        const torMajor = Math.max(tubeR * 3.2, 0.09);
        const torTube = Math.max(tubeR * 0.42, 0.014);
        const halfCardWorld = Math.max(0.08, basis * 0.13);
        const cardPosition = cardFace.clone().add(hDir.clone().multiplyScalar(halfCardWorld));
        return {
            footY,
            vertLen,
            horizLen,
            sign,
            tubeR,
            vMid,
            cardFace,
            hMid,
            hQuat,
            torMajor,
            torTube,
            cardPosition,
        };
    }, [width, depth, prismTopY, unit.id]);

    useFrame(() => {
        if (!brighten || !groupRef.current) return;
        tooltipCardWorldRef.current.set(
            connector.cardPosition.x,
            connector.cardPosition.y,
            connector.cardPosition.z,
        );
        tooltipCardWorldRef.current.applyMatrix4(groupRef.current.matrixWorld);
        const dist = camera.position.distanceTo(tooltipCardWorldRef.current);
        const extent = Math.max(width, depth, height, 0.12) * scale;
        const extentMul = THREE.MathUtils.clamp(
            extent / UNIT_TOOLTIP_REF_EXTENT,
            UNIT_TOOLTIP_EXTENT_MUL_MIN,
            UNIT_TOOLTIP_EXTENT_MUL_MAX,
        );
        const next = THREE.MathUtils.clamp(
            UNIT_TOOLTIP_BASE_FACTOR * (dist / UNIT_TOOLTIP_REF_DISTANCE) * extentMul,
            UNIT_TOOLTIP_FACTOR_MIN,
            UNIT_TOOLTIP_FACTOR_MAX,
        );
        setTooltipDistanceFactor((prev) => (Math.abs(prev - next) > 0.008 ? next : prev));
    });

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
                    if (!isDragging) {
                        const blocked =
                            !isAdmin &&
                            isUnitAllocatedToOtherClient({
                                unitId: unit.id,
                                currentUserId,
                                isAdmin,
                                unitAllocationUserIds,
                            });
                        document.body.style.cursor =
                            blocked ? 'not-allowed' : canEdit && isSelected ? 'grab' : 'pointer';
                    }
                }}
                onPointerOut={() => {
                    setHoveredUnit(null);
                    if (!isDragging) document.body.style.cursor = 'auto';
                }}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={meshColor}
                    emissive={meshEmissive}
                    emissiveIntensity={0.2}
                    roughness={0.3}
                    metalness={0.6}
                    transparent
                    opacity={isSelected ? 0.55 : 0.4}
                />
            </mesh>
            {brighten && (
                <>
                    <group raycast={() => null}>
                        <mesh position={[0, connector.footY, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
                            <torusGeometry args={[connector.torMajor, connector.torTube, 20, 48]} />
                            <meshBasicMaterial color="#C6A664" transparent opacity={0.94} depthWrite={false} />
                        </mesh>
                        <mesh position={[connector.vMid.x, connector.vMid.y, connector.vMid.z]} renderOrder={1}>
                            <cylinderGeometry args={[connector.tubeR, connector.tubeR, connector.vertLen, 16]} />
                            <meshBasicMaterial color="#C6A664" transparent opacity={0.92} depthWrite={false} />
                        </mesh>
                        <mesh
                            position={[connector.hMid.x, connector.hMid.y, connector.hMid.z]}
                            quaternion={connector.hQuat}
                            renderOrder={1}
                        >
                            <cylinderGeometry args={[connector.tubeR, connector.tubeR, connector.horizLen, 16]} />
                            <meshBasicMaterial color="#C6A664" transparent opacity={0.92} depthWrite={false} />
                        </mesh>
                    </group>
                    <Html
                        position={[connector.cardPosition.x, connector.cardPosition.y, connector.cardPosition.z]}
                        center
                        distanceFactor={tooltipDistanceFactor}
                        style={{ pointerEvents: 'none' }}
                        zIndexRange={[100, 0]}
                    >
                        <div className="min-w-[min(90rem,96vw)] max-w-[min(96rem,98vw)] rounded-2xl border border-[#C6A664]/45 bg-[#0A0A0B]/38 px-[4.5rem] py-12 shadow-2xl shadow-black/40 backdrop-blur-xl">
                            <div className="text-[6rem] font-medium font-serif-display tracking-wide text-[#F5F7FA]/95 leading-[1.05]">
                                {unitTitle}
                            </div>
                            <div
                                className={`mt-10 text-[3.15rem] tracking-[0.1em] uppercase font-medium ${
                                    allocatedToOther || status === 'sold'
                                        ? 'text-red-300/90'
                                        : status === 'available'
                                          ? 'text-[#94F59A]/90'
                                          : 'text-orange-200/90'
                                }`}
                            >
                                {allocationLine}
                            </div>
                        </div>
                    </Html>
                </>
            )}
            <UnitPrismRotateButtons visible={showRotate} height={displaySize[1]} onRotate={(d) => unitRotationHandler?.(unit.id, rotationY + d)} />
        </group>
    );
}
