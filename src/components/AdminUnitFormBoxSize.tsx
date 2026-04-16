import NumberInput from './NumberInput';

interface AdminUnitFormBoxSizeProps {
    value: [number, number, number];
    onChange: (value: [number, number, number]) => void;
}

const inputClass = 'w-full rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-sm text-[#F5F7FA]';

const coerce = (n: number, fallback: number) => (n >= 0.5 ? n : fallback);

export default function AdminUnitFormBoxSize({ value: [w, h, d], onChange }: AdminUnitFormBoxSizeProps) {
    return (
        <div>
            <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Box size (3D engine)</label>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-[8px] text-[#94A3B8] mb-0.5">W</label>
                    <NumberInput
                        allowDecimal
                        value={w}
                        onChange={(n) => onChange([coerce(n, 3), h, d])}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-[#94A3B8] mb-0.5">H</label>
                    <NumberInput
                        allowDecimal
                        value={h}
                        onChange={(n) => onChange([w, coerce(n, 2), d])}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-[#94A3B8] mb-0.5">D</label>
                    <NumberInput
                        allowDecimal
                        value={d}
                        onChange={(n) => onChange([w, h, coerce(n, 3)])}
                        className={inputClass}
                    />
                </div>
            </div>
        </div>
    );
}
