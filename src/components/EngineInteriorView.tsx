import { Layers } from 'lucide-react';
import type { Database } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

interface EngineInteriorViewProps {
    unit: UnitRow | undefined;
    isAdmin: boolean;
    onBackToExterior: () => void;
}

export default function EngineInteriorView({ unit, isAdmin, onBackToExterior }: EngineInteriorViewProps) {
    const hasModel = !!unit?.internal_model_url;

    if (hasModel) {
        return (
            <div className="absolute inset-0 pointer-events-none flex items-start justify-end pt-6 pr-6">
                <button
                    onClick={onBackToExterior}
                    className="pointer-events-auto px-6 py-3 rounded-full glass border border-white/10 text-[11px] tracking-[0.2em] uppercase hover:border-[#C6A664]/40 hover:text-[#C6A664] transition-all"
                >
                    Return to Exterior
                </button>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="pointer-events-auto text-center p-12 glass rounded-3xl border border-white/5 max-w-lg">
                <div className="w-16 h-16 rounded-full glass shrink-0 flex items-center justify-center mx-auto mb-8 animate-float">
                    <Layers size={24} className="text-[#C6A664]" />
                </div>
                <h4 className="font-serif-display text-4xl text-[#F5F7FA] mb-4">Unit {unit?.unit_number} Interior</h4>
                <p className="text-[#94A3B8] font-light text-[15px] mb-6 leading-relaxed">
                    Entering the immersive interior view. Add a 3D model to explore the space.
                </p>
                {isAdmin && (
                    <p className="text-[#C6A664]/90 text-xs tracking-wider uppercase mb-6">
                        Select this unit in the sidebar and click &quot;Add interior view&quot; to upload a model.
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
