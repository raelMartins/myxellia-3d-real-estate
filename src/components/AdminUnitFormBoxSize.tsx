interface AdminUnitFormBoxSizeProps {
    value: [number, number, number];
    onChange: (value: [number, number, number]) => void;
}

const inputClass = 'w-full rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-sm text-[#F5F7FA]';

export default function AdminUnitFormBoxSize({ value: [w, h, d], onChange }: AdminUnitFormBoxSizeProps) {
    return (
        <div>
            <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Box size (3D engine)</label>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-[8px] text-[#94A3B8] mb-0.5">W</label>
                    <input
                        type="number"
                        min={0.5}
                        step={0.1}
                        value={w}
                        onChange={(e) => onChange([Number(e.target.value) || 3, h, d])}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-[#94A3B8] mb-0.5">H</label>
                    <input
                        type="number"
                        min={0.5}
                        step={0.1}
                        value={h}
                        onChange={(e) => onChange([w, Number(e.target.value) || 2, d])}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-[#94A3B8] mb-0.5">D</label>
                    <input
                        type="number"
                        min={0.5}
                        step={0.1}
                        value={d}
                        onChange={(e) => onChange([w, h, Number(e.target.value) || 3])}
                        className={inputClass}
                    />
                </div>
            </div>
        </div>
    );
}
