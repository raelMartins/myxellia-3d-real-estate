import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '../store/engine.store';
import { useAuthStore } from '../store/auth.store';

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

/** Match BuildingModel: hero ground at y = -0.9; box center must be above ground + half height */
const GROUND_Y = -0.9;

export default function UnitBox({ unit }: { unit: UnitMesh }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const groupRef = useRef<THREE.Group>(null!);
    const { selectedUnit, hoveredUnit, unitStatuses, setSelectedUnit, setHoveredUnit, setViewMode, unitPositionHandler } = useEngineStore();
    const isAdmin = useAuthStore((s) => s.profile?.role === 'admin');
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragJustEndedRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<[number, number, number]>(unit.position);
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
    const displayPos = isDragging ? dragPosition : unit.position;

    const baseColor = useMemo(() => new THREE.Color(STATUS_COLOR[status]), [status]);
    const emissiveColor = useMemo(() => new THREE.Color(STATUS_EMISSIVE[status]), [status]);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        if (isDragging) {
            setDragPosition([...dragPositionRef.current]);
        } else {
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

    const onPointerDown = (e: THREE.Event) => {
        if (!isAdmin || !unitPositionHandler) return;
        e.stopPropagation();
        const ne = (e as unknown as { nativeEvent?: PointerEvent }).nativeEvent;
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
                dragPositionRef.current = [
                    planeHit.x - offsetRef.current.x,
                    y,
                    planeHit.z - offsetRef.current.z,
                ];
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
            const finalPos = [...dragPositionRef.current];
            unitPositionHandler(unit.id, finalPos)
                .then(() => setIsDragging(false))
                .catch(() => setIsDragging(false));
        };
        el.addEventListener('pointermove', onMove, true);
        el.addEventListener('pointerup', onUp, true);
    };

    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;

    return (
        <group ref={groupRef} position={displayPos}>
            <mesh
                ref={meshRef}
                position={[0, 0, 0]}
                scale={[scale, scale, scale]}
                onClick={handleClick}
                onPointerDown={onPointerDown}
                onPointerOver={(e) => { e.stopPropagation(); setHoveredUnit(unit.id); if (!isDragging) document.body.style.cursor = isAdmin ? 'grab' : 'pointer'; }}
                onPointerOut={() => { setHoveredUnit(null); if (!isDragging) document.body.style.cursor = 'auto'; }}
                castShadow
                receiveShadow
            >
                <boxGeometry args={unit.size} />
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
        </group>
    );
}
