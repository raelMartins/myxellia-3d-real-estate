import { motion } from 'framer-motion';

const STEPS = ['Unit Identity', 'Geometry Configuration'] as const;
export type UnitArchitectStepId = (typeof STEPS)[number];

interface UnitArchitectStepProgressProps {
    currentStep: number;
    steps?: readonly string[];
}

export default function UnitArchitectStepProgress({
    currentStep,
    steps = STEPS,
}: UnitArchitectStepProgressProps) {
    return (
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
            {steps.map((label, index) => {
                const isActive = index === currentStep;
                const isPast = index < currentStep;
                return (
                    <div key={label} className="flex items-center">
                        <div className="flex flex-col items-center">
                            <motion.div
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider
                                    ${isActive ? 'bg-[#C6A664] text-[#0A0A0B] ring-2 ring-[#C6A664]/50' : ''}
                                    ${isPast ? 'bg-[#C6A664]/80 text-[#0A0A0B]' : ''}
                                    ${!isActive && !isPast ? 'bg-white/10 text-[#94A3B8] border border-white/10' : ''}
                                `}
                                animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                                transition={{ duration: 0.3 }}
                            >
                                {isPast ? '✓' : index + 1}
                            </motion.div>
                            <span
                                className={`mt-1.5 text-[9px] tracking-[0.2em] uppercase ${
                                    isActive ? 'text-[#C6A664]' : isPast ? 'text-[#94A3B8]' : 'text-[#64748B]'
                                }`}
                            >
                                {label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={`w-8 sm:w-16 h-px mx-1 sm:mx-2 ${
                                    index < currentStep ? 'bg-[#C6A664]/60' : 'bg-white/10'
                                }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
