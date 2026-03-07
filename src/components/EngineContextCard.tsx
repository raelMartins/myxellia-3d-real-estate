interface EngineContextCardProps {
    location: string | null | undefined;
}

export default function EngineContextCard({ location }: EngineContextCardProps) {
    return (
        <div className="absolute bottom-8 right-8 z-30 pointer-events-none">
            <div className="glass px-6 py-5 rounded-2xl border border-white/5 text-right">
                <div className="text-[9px] tracking-[0.3em] text-[#C6A664] uppercase mb-1.5">Project Context</div>
                <div className="text-lg font-light text-[#F5F7FA]">{location || 'Downtown District'}</div>
                <div className="text-[10px] tracking-widest text-[#94A3B8] uppercase mt-1">Lat 40.7128° N · Lon 74.0060° W</div>
            </div>
        </div>
    );
}
