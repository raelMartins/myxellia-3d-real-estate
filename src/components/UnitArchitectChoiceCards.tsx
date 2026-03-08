import { motion } from 'framer-motion';
import { Box, Layers } from 'lucide-react';

export type UnitArchitectPath = 'custom' | 'section' | null;

interface UnitArchitectChoiceCardsProps {
    onSelect: (path: UnitArchitectPath) => void;
}

export default function UnitArchitectChoiceCards({ onSelect }: UnitArchitectChoiceCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <motion.button
                type="button"
                onClick={() => onSelect('custom')}
                className="group relative p-8 rounded-2xl text-left transition-all duration-300
                    bg-white/5 border border-white/10 hover:border-[#C6A664]/40 hover:bg-white/10
                    backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-[#C6A664]/50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="w-12 h-12 rounded-xl bg-[#C6A664]/20 border border-[#C6A664]/30 flex items-center justify-center mb-4 group-hover:bg-[#C6A664]/30 transition-colors">
                    <Box className="w-6 h-6 text-[#C6A664]" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif-display text-xl text-[#F5F7FA] mb-2">Add Custom Unit</h3>
                <p className="text-[11px] text-[#94A3B8] tracking-wide leading-relaxed">
                    Create a single unit with full control over identity and geometry.
                </p>
                <div className="absolute inset-0 rounded-2xl pointer-events-none border border-transparent group-hover:border-[#C6A664]/20 transition-colors" />
            </motion.button>

            <motion.button
                type="button"
                onClick={() => onSelect('section')}
                className="group relative p-8 rounded-2xl text-left transition-all duration-300
                    bg-white/5 border border-white/10 hover:border-[#C6A664]/40 hover:bg-white/10
                    backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-[#C6A664]/50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="w-12 h-12 rounded-xl bg-[#C6A664]/20 border border-[#C6A664]/30 flex items-center justify-center mb-4 group-hover:bg-[#C6A664]/30 transition-colors">
                    <Layers className="w-6 h-6 text-[#C6A664]" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif-display text-xl text-[#F5F7FA] mb-2">Add Units By Section</h3>
                <p className="text-[11px] text-[#94A3B8] tracking-wide leading-relaxed">
                    Define building sections on the plan and generate multiple units at once.
                </p>
                <div className="absolute inset-0 rounded-2xl pointer-events-none border border-transparent group-hover:border-[#C6A664]/20 transition-colors" />
            </motion.button>
        </div>
    );
}
