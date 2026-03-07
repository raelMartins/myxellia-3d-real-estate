export default function EngineViewControls() {
    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none hidden md:block">
            <div className="glass px-8 py-3 rounded-full border border-white/5 flex items-center gap-8">
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px] text-[#94A3B8]">L</div>
                    <span className="text-[9px] tracking-widest text-[#94A3B8] uppercase">Orbit</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px] text-[#94A3B8]">R</div>
                    <span className="text-[9px] tracking-widest text-[#94A3B8] uppercase">Pan</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px] text-[#94A3B8]">SC</div>
                    <span className="text-[9px] tracking-widest text-[#94A3B8] uppercase">Zoom</span>
                </div>
            </div>
        </div>
    );
}
