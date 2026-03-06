import { Html, useProgress } from '@react-three/drei';
import { useAuthStore } from '../store/auth.store';
import { Box } from 'lucide-react';

const LOADING_STAGES = [
    { threshold: 30, label: 'DOWNLOADING .GLB MESH' },
    { threshold: 60, label: 'COMPILING MATERIALS' },
    { threshold: 90, label: 'GENERATING ANTI-VOID LIGHTING' },
    { threshold: 100, label: 'FINALIZING SCENE' },
] as const;

function getLoadingStage(progress: number): string {
    for (let i = LOADING_STAGES.length - 1; i >= 0; i--) {
        if (progress >= (i === 0 ? 0 : LOADING_STAGES[i - 1].threshold)) return LOADING_STAGES[i].label;
    }
    return 'FETCHING CLOUD ASSETS';
}

export default function AssetLoader() {
    const { progress } = useProgress();
    const { profile } = useAuthStore();
    const loadingStage = getLoadingStage(progress);

    return (
        <Html center>
            <div className="flex flex-col items-center justify-center p-8 glass-card border-white/10 w-80 shadow-[0_0_50px_rgba(255,255,255,0.05)] bg-[#050505]/90 backdrop-blur-2xl">
                <Box size={32} className="text-white/40 mb-6 animate-[spin_4s_linear_infinite]" strokeWidth={1} />

                <div className="text-[10px] tracking-[0.3em] font-light text-white/50 uppercase mb-4 text-center">
                    {loadingStage}
                </div>

                <div className="w-full h-[2px] bg-white/10 relative overflow-hidden rounded-full mb-4">
                    {/* Smooth Animated Progress Bar */}
                    <div
                        className="absolute top-0 left-0 h-full bg-white transition-all duration-300 ease-out shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>

                <div className="flex justify-between w-full text-xs text-white/40 font-light tracking-widest mt-2">
                    <span>{Math.round(progress)}%</span>
                    <span className="uppercase text-[10px]">{profile?.role || 'CLIENT'} ACCESS</span>
                </div>
            </div>
        </Html>
    );
}
