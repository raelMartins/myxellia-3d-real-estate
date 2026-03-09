import { useId } from 'react';

export type GeometryFormValues = {
    sides: number;
    width: number;
    height: number;
    depth: number;
};

interface GeometryConfigFormProps {
    sides: number;
    width: number;
    height: number;
    depth: number;
    onSidesChange: (n: number) => void;
    onWidthChange: (n: number) => void;
    onHeightChange: (n: number) => void;
    onDepthChange: (n: number) => void;
    errors?: Partial<Record<keyof GeometryFormValues, string>>;
}

export default function GeometryConfigForm({
    sides,
    width,
    height,
    depth,
    onSidesChange,
    onWidthChange,
    onHeightChange,
    onDepthChange,
    errors = {},
}: GeometryConfigFormProps) {
    const id = useId();
    const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50 focus:border-[#C6A664]/50 focus:outline-none';
    const labelCls = 'block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5';

    const parseNum = (s: string, min: number): number => {
        const n = Number(s);
        return Number.isFinite(n) && n >= min ? n : min;
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor={`${id}-sides`} className={labelCls}>
                    Number of sides (min 3)
                </label>
                <input
                    id={`${id}-sides`}
                    type="text"
                    inputMode="numeric"
                    value={sides < 3 ? '' : sides}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') {
                            onSidesChange(0);
                            return;
                        }
                        onSidesChange(parseNum(v, 3));
                    }}
                    placeholder="4"
                    className={inputCls}
                />
                {errors.sides && <p className="mt-1 text-[10px] text-red-400">{errors.sides}</p>}
            </div>
            <div>
                <label htmlFor={`${id}-height`} className={labelCls}>Height</label>
                <input
                    id={`${id}-height`}
                    type="text"
                    inputMode="decimal"
                    value={height <= 0 ? '' : height}
                    onChange={(e) => onHeightChange(parseNum(e.target.value, 0))}
                    placeholder="e.g. 2.5"
                    className={inputCls}
                />
                {errors.height && <p className="mt-1 text-[10px] text-red-400">{errors.height}</p>}
            </div>
            <div>
                <label htmlFor={`${id}-width`} className={labelCls}>Width</label>
                <input
                    id={`${id}-width`}
                    type="text"
                    inputMode="decimal"
                    value={width <= 0 ? '' : width}
                    onChange={(e) => onWidthChange(parseNum(e.target.value, 0))}
                    placeholder="e.g. 3"
                    className={inputCls}
                />
                {errors.width && <p className="mt-1 text-[10px] text-red-400">{errors.width}</p>}
            </div>
            <div>
                <label htmlFor={`${id}-depth`} className={labelCls}>Depth</label>
                <input
                    id={`${id}-depth`}
                    type="text"
                    inputMode="decimal"
                    value={depth <= 0 ? '' : depth}
                    onChange={(e) => onDepthChange(parseNum(e.target.value, 0))}
                    placeholder="e.g. 3"
                    className={inputCls}
                />
                {errors.depth && <p className="mt-1 text-[10px] text-red-400">{errors.depth}</p>}
            </div>
        </div>
    );
}
