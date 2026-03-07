import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import type { Database } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

interface EngineInteriorViewProps {
    unit: UnitRow | undefined;
    isAdmin: boolean;
    onBackToExterior: () => void;
}

export default function EngineInteriorView({ unit, isAdmin, onBackToExterior }: EngineInteriorViewProps) {
    return (
        <div className="absolute inset-0 bg-gradient-to-br from-[#141416] to-[#0A0A0B] flex flex-col items-center justify-center">
            <div className="text-center p-12 glass rounded-3xl border border-white/5 max-w-lg">
                <div className="w-16 h-16 rounded-full glass shrink-0 flex items-center justify-center mx-auto mb-8 animate-float">
                    <Layers size={24} className="text-[#C6A664]" />
                </div>
                <h4 className="font-serif-display text-4xl text-[#F5F7FA] mb-4">Unit {unit?.unit_number} Interior</h4>
                <p className="text-[#94A3B8] font-light text-[15px] mb-6 leading-relaxed">
                    {unit?.internal_model_url
                        ? 'Interior 3D model will load here.'
                        : 'Entering the immersive interior view. Experience the materiality and light of your future sanctuary.'}
                </p>
                {isAdmin && !unit?.internal_model_url && (
                    <p className="text-[#C6A664]/90 text-xs tracking-wider uppercase mb-6">
                        Add the interior 3D model URL in the unit form on the left.
                    </p>
                )}
                <button
                    onClick={onBackToExterior}
                    className="px-8 py-4 rounded-full glass border-white/10 text-[11px] tracking-[0.2em] uppercase hover:border-[#C6A664]/40 hover:text-[#C6A664] transition-all"
                >
                    Return to Exterior
                </button>
            </div>
        </div>
    );
}
