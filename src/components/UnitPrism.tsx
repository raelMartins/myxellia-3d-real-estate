import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '../store/engine.store';
import { useAuthStore } from '../store/auth.store';

export interface UnitPrismMesh {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    footprint: [number, number][];
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

export default function UnitPrism({ unit }: { unit: UnitPrismMesh }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const { selectedUnit, hoveredUnit, unitStatuses, setSelectedUnit, setHoveredUnit, setViewMode } = useEngineStore();
    const isAdmin = useAuthStore((s) => s.profile?.role === 'admin');
    const status = unitStatuses[unit.id] ?? 'available';
    const isHovered = hoveredUnit === unit.id;
    const isSelected = selectedUnit === unit.id;

    const [width, height, depth] = unit.size;
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
        return geom;
    }, [unit.footprint, width, height, depth]);

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

    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleClick = useCallback(() => {
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

    const scale = isSelected ? 1.05 : isHovered ? 1.03 : 1;

    return (
        <group position={unit.position}>
            <mesh
                ref={meshRef}
                geometry={geometry}
                scale={[scale, scale, scale]}
                onClick={handleClick}
                onPointerOver={(e) => { e.stopPropagation(); setHoveredUnit(unit.id); document.body.style.cursor = isAdmin ? 'grab' : 'pointer'; }}
                onPointerOut={() => { setHoveredUnit(null); document.body.style.cursor = 'auto'; }}
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
        </group>
    );
}
