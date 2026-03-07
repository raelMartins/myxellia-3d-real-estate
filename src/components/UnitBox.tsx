import { useRef, useMemo, useState, useEffect } from 'react';
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

export default function UnitBox({ unit }: { unit: UnitMesh }) {
    const meshRef = useRef<THREE.Mesh>(null!);
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
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        if (status === 'pending') {
            const pulse = Math.sin(clock.elapsedTime * 3) * 0.5 + 0.5;
            mat.emissiveIntensity = 0.3 + pulse * 0.5;
        } else if (isHovered || isSelected) {
            mat.emissiveIntensity = 0.6;
        } else {
            mat.emissiveIntensity = 0.18;
        }
    });

    useEffect(() => {
        if (!isDragging || !gl.domElement) return;
        const el = gl.domElement;
        const onMove = (e: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const hit = raycasterRef.current.ray.intersectPlane(planeRef.current, intersectRef.current);
            if (hit) {
                const x = hit.x - offsetRef.current.x;
                const y = hit.y - offsetRef.current.y;
                const z = hit.z - offsetRef.current.z;
                const pos: [number, number, number] = [x, y, z];
                dragPositionRef.current = pos;
                setDragPosition(pos);
            }
        };
        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            document.body.style.cursor = 'auto';
            dragJustEndedRef.current = true;
            if (unitPositionHandler) {
                unitPositionHandler(unit.id, [...dragPositionRef.current]).catch(() => {});
            }
            setIsDragging(false);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
        };
    }, [isDragging, camera, gl.domElement, unit.id, unitPositionHandler]);

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
        const hit = e.intersections[0]?.point;
        if (!hit || !meshRef.current) return;
        offsetRef.current.copy(hit).sub(meshRef.current.position);
        planeRef.current.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, unit.position[1], 0)
        );
        dragPositionRef.current = unit.position;
        setDragPosition(unit.position);
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
        const pid = (e as unknown as { nativeEvent?: { pointerId: number } }).nativeEvent?.pointerId;
        if (pid !== undefined && gl.domElement.setPointerCapture) gl.domElement.setPointerCapture(pid);
    };

    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;

    return (
        <mesh
            ref={meshRef}
            position={displayPos}
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
    );
}
