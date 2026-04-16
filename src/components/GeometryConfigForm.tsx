import { useId } from 'react';
import NumberInput from './NumberInput';

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
    /** When true, polygon vertex count is driven by tracing; clear the plan to change sides. */
    sidesDisabled?: boolean;
}

function parseNum(n: number, min: number): number {
    return Number.isFinite(n) && n >= min ? n : min;
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
    sidesDisabled = false,
}: GeometryConfigFormProps) {
    const id = useId();
    const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50 focus:border-[#C6A664]/50 focus:outline-none';
    const labelCls = 'block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5';

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor={`${id}-sides`} className={labelCls}>
                    Number of sides (min 3)
                </label>
                <NumberInput
                    id={`${id}-sides`}
                    hideWhenBelow={3}
                    value={sides}
                    onChange={onSidesChange}
                    placeholder="4"
                    disabled={sidesDisabled}
                    className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {errors.sides && <p className="mt-1 text-[10px] text-red-400">{errors.sides}</p>}
                {sidesDisabled && (
                    <p className="mt-1 text-[10px] text-[#94A3B8] leading-snug">
                        Remove the floor plan underlay to change the number of sides.
                    </p>
                )}
            </div>
            <div>
                <label htmlFor={`${id}-height`} className={labelCls}>Height</label>
                <NumberInput
                    id={`${id}-height`}
                    allowDecimal
                    hideZeroAsEmpty
                    value={height}
                    onChange={(n) => onHeightChange(parseNum(n, 0))}
                    placeholder="e.g. 2.5"
                    className={inputCls}
                />
                {errors.height && <p className="mt-1 text-[10px] text-red-400">{errors.height}</p>}
            </div>
            <div>
                <label htmlFor={`${id}-width`} className={labelCls}>Width</label>
                <NumberInput
                    id={`${id}-width`}
                    allowDecimal
                    hideZeroAsEmpty
                    value={width}
                    onChange={(n) => onWidthChange(parseNum(n, 0))}
                    placeholder="e.g. 3"
                    className={inputCls}
                />
                {errors.width && <p className="mt-1 text-[10px] text-red-400">{errors.width}</p>}
            </div>
            <div>
                <label htmlFor={`${id}-depth`} className={labelCls}>Depth</label>
                <NumberInput
                    id={`${id}-depth`}
                    allowDecimal
                    hideZeroAsEmpty
                    value={depth}
                    onChange={(n) => onDepthChange(parseNum(n, 0))}
                    placeholder="e.g. 3"
                    className={inputCls}
                />
                {errors.depth && <p className="mt-1 text-[10px] text-red-400">{errors.depth}</p>}
            </div>
        </div>
    );
}
