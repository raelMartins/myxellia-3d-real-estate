import NumberInput from './NumberInput';

interface AdminUnitFormBoxSizeProps {
    value: [number, number, number];
    onChange: (value: [number, number, number]) => void;
    studioListingStyle?: boolean;
}

const coerce = (n: number, fallback: number) => (n >= 0.5 ? n : fallback);

export default function AdminUnitFormBoxSize({
    value: [w, h, d],
    onChange,
    studioListingStyle = false,
}: AdminUnitFormBoxSizeProps) {
    const S = studioListingStyle;
    const inputClass = S
        ? 'w-full rounded-lg bg-white/45 border border-[rgba(113,88,82,0.28)] px-2 py-2 text-sm text-[#715852]'
        : 'w-full rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-sm text-[#F5F7FA]';
    const mainLbl = S
        ? 'block text-[10px] tracking-[0.2em] text-[#715852]/75 uppercase mb-1.5'
        : 'block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5';
    const subLbl = S ? 'block text-[8px] text-[#715852]/65 mb-0.5' : 'block text-[8px] text-[#94A3B8] mb-0.5';

    return (
        <div>
            <label className={mainLbl}>Box size (3D engine)</label>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className={subLbl}>W</label>
                    <NumberInput allowDecimal value={w} onChange={(n) => onChange([coerce(n, 3), h, d])} className={inputClass} />
                </div>
                <div>
                    <label className={subLbl}>H</label>
                    <NumberInput allowDecimal value={h} onChange={(n) => onChange([w, coerce(n, 2), d])} className={inputClass} />
                </div>
                <div>
                    <label className={subLbl}>D</label>
                    <NumberInput allowDecimal value={d} onChange={(n) => onChange([w, h, coerce(n, 3)])} className={inputClass} />
                </div>
            </div>
        </div>
    );
}
