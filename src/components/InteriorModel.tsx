import { useEngineStore } from '../store/engine.store';
import { Html } from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

const HOTSPOTS = [
    {
        id: 'hs-1',
        title: 'Countertops',
        material: 'Carrara Marble',
        desc: 'Heat & scratch resistant. Bookmatched slab from Carrara quarry.',
        position: [1.5, -0.4, 1] as [number, number, number],
    },
    {
        id: 'hs-2',
        title: 'Glass Façade',
        material: 'Low-E Smart Glass',
        desc: 'Electrochromic tinting. UV-blocking, triple-pane insulation.',
        position: [0, 0.8, 3.5] as [number, number, number],
    },
    {
        id: 'hs-3',
        title: 'Flooring',
        material: 'White Oak Wide-Plank',
        desc: 'Engineered hardwood · 8" planks · Lifetime warranty.',
        position: [-2, -0.85, -1] as [number, number, number],
    },
];

/* Floating "+" hotspot button with pulse ring */
function Hotspot({ spot }: { spot: typeof HOTSPOTS[0] }) {
    const [open, setOpen] = useState(false);
    const ringRef = useRef<THREE.Mesh>(null!);

    useFrame(({ clock }) => {
        if (!ringRef.current) return;
        const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.12;
        ringRef.current.scale.set(s, s, s);
        (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 - Math.sin(clock.elapsedTime * 2) * 0.25;
    });

    return (
        <group position={spot.position}>
            {/* Pulse ring in 3D */}
            <mesh ref={ringRef}>
                <ringGeometry args={[0.18, 0.22, 32]} />
                <meshBasicMaterial color="#C6A664" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>

            <Html center zIndexRange={[200, 0]}>
                <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
                    {/* Hotspot Button */}
                    <button
                        onClick={() => setOpen(!open)}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer"
                        style={{
                            background: open ? '#C6A664' : 'rgba(198,166,100,0.25)',
                            border: '1.5px solid rgba(198,166,100,0.7)',
                            boxShadow: '0 0 16px rgba(198,166,100,0.5)',
                            transform: open ? 'rotate(45deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                        }}
                    >
                        {open
                            ? <X size={13} color="#0A0A0B" />
                            : <Plus size={13} color="#C6A664" />
                        }
                    </button>

                    {/* Info Card */}
                    {open && (
                        <div
                            className="absolute left-10 top-0 w-52 rounded-xl p-4 pointer-events-none"
                            style={{
                                background: 'rgba(15,15,18,0.88)',
                                backdropFilter: 'saturate(180%) blur(20px)',
                                WebkitBackdropFilter: 'saturate(180%) blur(20px)',
                                border: '1px solid rgba(198,166,100,0.25)',
                                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05), 0 16px 32px rgba(0,0,0,0.6)',
                            }}
                        >
                            <div className="text-[9px] tracking-[0.25em] uppercase mb-1" style={{ color: '#C6A664' }}>
                                {spot.title}
                            </div>
                            <div className="text-[13px] font-light mb-1.5" style={{ color: '#F5F7FA' }}>
                                {spot.material}
                            </div>
                            <p className="text-[11px] leading-relaxed" style={{ color: '#94A3B8' }}>
                                {spot.desc}
                            </p>
                        </div>
                    )}
                </div>
            </Html>
        </group>
    );
}

export default function InteriorModel() {
    const { selectedUnit } = useEngineStore();
    if (!selectedUnit) return null;

    return (
        <group>
            {/* Floor — polished concrete look */}
            <mesh position={[0, -1, 0]} receiveShadow>
                <boxGeometry args={[9, 0.15, 9]} />
                <meshStandardMaterial color="#18181A" roughness={0.08} metalness={0.1} />
            </mesh>

            {/* Back wall */}
            <mesh position={[0, 1, -4.5]} receiveShadow>
                <boxGeometry args={[9, 5, 0.15]} />
                <meshStandardMaterial color="#1F1F23" roughness={0.5} />
            </mesh>

            {/* Left wall */}
            <mesh position={[-4.5, 1, 0]} receiveShadow>
                <boxGeometry args={[0.15, 5, 9]} />
                <meshStandardMaterial color="#1A1A1E" roughness={0.5} />
            </mesh>

            {/* Abstract kitchen island */}
            <mesh position={[1.5, -0.5, 0.8]} castShadow receiveShadow>
                <boxGeometry args={[3.2, 0.9, 1.6]} />
                <meshStandardMaterial color="#0E0E10" roughness={0.05} metalness={0.3} />
            </mesh>
            {/* Island countertop — marble white */}
            <mesh position={[1.5, -0.03, 0.8]} castShadow>
                <boxGeometry args={[3.2, 0.06, 1.6]} />
                <meshStandardMaterial color="#EFEFEF" roughness={0.1} metalness={0.05} />
            </mesh>

            {/* Sofa abstract */}
            <mesh position={[-2.5, -0.6, -1.5]} castShadow receiveShadow>
                <boxGeometry args={[3.5, 0.8, 1.5]} />
                <meshStandardMaterial color="#28282E" roughness={0.8} />
            </mesh>

            {/* Full-height smart glass front wall */}
            <mesh position={[0, 1, 4.5]}>
                <boxGeometry args={[9, 5, 0.06]} />
                <meshPhysicalMaterial
                    color="#AACCFF"
                    transmission={0.92}
                    opacity={1}
                    roughness={0}
                    thickness={0.3}
                    transparent
                />
            </mesh>

            {/* Ceiling */}
            <mesh position={[0, 3.5, 0]}>
                <boxGeometry args={[9, 0.1, 9]} />
                <meshStandardMaterial color="#141416" roughness={1} />
            </mesh>

            {/* Accent ceiling light strip */}
            <mesh position={[0, 3.4, 0]}>
                <boxGeometry args={[7, 0.04, 7]} />
                <meshStandardMaterial color="#C6A664" emissive="#C6A664" emissiveIntensity={0.6} />
            </mesh>

            {/* Hotspots */}
            {HOTSPOTS.map(spot => (
                <Hotspot key={spot.id} spot={spot} />
            ))}
        </group>
    );
}
