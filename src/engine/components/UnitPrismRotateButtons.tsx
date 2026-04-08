'use client';

import { Html } from '@react-three/drei';

interface UnitPrismRotateButtonsProps {
    visible: boolean;
    height: number;
    onRotate: (deltaRad: number) => void;
}

export default function UnitPrismRotateButtons({ visible, height, onRotate }: UnitPrismRotateButtonsProps) {
    if (!visible) return null;
    return (
        <Html position={[0, height / 2 + 0.35, 0]} center style={{ pointerEvents: 'auto' }}>
            <div className="flex gap-1 rounded-lg bg-black/70 backdrop-blur border border-[#C6A664]/40 p-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); onRotate(-Math.PI / 2); }} className="w-8 h-8 flex items-center justify-center rounded text-[#C6A664] hover:bg-[#C6A664]/20 text-sm font-bold" title="Rotate left">⟲</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onRotate(Math.PI / 2); }} className="w-8 h-8 flex items-center justify-center rounded text-[#C6A664] hover:bg-[#C6A664]/20 text-sm font-bold" title="Rotate right">⟳</button>
            </div>
        </Html>
    );
}
