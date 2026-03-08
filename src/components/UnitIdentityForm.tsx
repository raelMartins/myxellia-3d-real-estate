import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { CurrencyInput } from './CurrencyInput';

const VIEW_OPTIONS = ['City', 'Garden', 'Pool', 'Sea', 'Skyline', 'Park', 'Other'];
const AMENITY_OPTIONS = ['Balcony', 'Smart Home', 'Walk-in Closet', 'Gym', 'Pool', 'Concierge', 'Parking', 'Storage'];

export type UnitIdentityValues = {
    unit_number: string;
    display_name?: string;
    floor: number;
    price: number | null;
    area_sqm?: number;
    bathrooms?: number;
    bedrooms?: number;
    view_type?: string;
    amenities?: string;
};

const unitIdentitySchema = z.object({
    unit_number: z.string().min(1, 'Unit number is required'),
    display_name: z.string().optional(),
    floor: z.coerce.number().min(1, 'Floor must be at least 1'),
    price: z.number().min(0).nullable(),
    area_sqm: z.optional(z.coerce.number()),
    bathrooms: z.optional(z.coerce.number()),
    bedrooms: z.optional(z.coerce.number()),
    view_type: z.string().optional(),
    amenities: z.string().optional(),
});

interface UnitIdentityFormProps {
    defaultValues?: Partial<UnitIdentityValues>;
    onNext: (data: UnitIdentityValues) => void;
    onBack: () => void;
}

export default function UnitIdentityForm({ defaultValues, onNext, onBack }: UnitIdentityFormProps) {
    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        setError,
        formState: { errors },
    } = useForm<UnitIdentityValues>({
        defaultValues: {
            unit_number: '',
            display_name: '',
            floor: 1,
            price: null,
            area_sqm: undefined,
            bathrooms: undefined,
            bedrooms: undefined,
            view_type: '',
            amenities: '',
            ...defaultValues,
        },
    });

    const validateAndNext = (data: UnitIdentityValues) => {
        const result = unitIdentitySchema.safeParse(data);
        if (!result.success) {
            const first = result.error.flatten().fieldErrors;
            Object.entries(first).forEach(([key, messages]) => {
                const msg = Array.isArray(messages) ? messages[0] : messages;
                if (msg) setError(key as keyof UnitIdentityValues, { message: msg });
            });
            return;
        }
        onNext(result.data);
    };

    const amenityWatch = watch('amenities');
    const selectedAmenities = amenityWatch ? amenityWatch.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const toggleAmenity = (option: string) => {
        const next = selectedAmenities.includes(option)
            ? selectedAmenities.filter((a) => a !== option)
            : [...selectedAmenities, option];
        setValue('amenities', next.join(', '), { shouldValidate: true });
    };

    const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50 focus:border-[#C6A664]/50 focus:outline-none';
    const labelCls = 'block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5';

    return (
        <form onSubmit={handleSubmit(validateAndNext)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Unit number</label>
                        <input type="text" placeholder="e.g. 101" className={inputCls} {...register('unit_number')} />
                        {errors.unit_number && <p className="mt-1 text-[10px] text-red-400">{errors.unit_number.message}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Display name (optional)</label>
                        <input type="text" placeholder="e.g. Skyline Penthouse" className={inputCls} {...register('display_name')} />
                    </div>
                    <div>
                        <label className={labelCls}>Unit floor</label>
                        <input type="text" inputMode="numeric" placeholder="1" className={inputCls} {...register('floor')} />
                        {errors.floor && <p className="mt-1 text-[10px] text-red-400">{errors.floor.message}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Price</label>
                        <Controller
                            name="price"
                            control={control}
                            render={({ field }) => (
                                <CurrencyInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    className={inputCls}
                                />
                            )}
                        />
                        {errors.price && <p className="mt-1 text-[10px] text-red-400">{errors.price.message}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Area (ft²)</label>
                        <input type="text" inputMode="decimal" placeholder="e.g. 1200" className={inputCls} {...register('area_sqm')} />
                        {errors.area_sqm && <p className="mt-1 text-[10px] text-red-400">{errors.area_sqm.message}</p>}
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Bathrooms</label>
                        <input type="text" inputMode="numeric" placeholder="e.g. 2" className={inputCls} {...register('bathrooms')} />
                        {errors.bathrooms && <p className="mt-1 text-[10px] text-red-400">{errors.bathrooms.message}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Bedrooms</label>
                        <input type="text" inputMode="numeric" placeholder="e.g. 3" className={inputCls} {...register('bedrooms')} />
                        {errors.bedrooms && <p className="mt-1 text-[10px] text-red-400">{errors.bedrooms.message}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>View</label>
                        <select className={inputCls} {...register('view_type')}>
                            <option value="">Select view</option>
                            {VIEW_OPTIONS.map((v) => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Amenities</label>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {AMENITY_OPTIONS.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => toggleAmenity(opt)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] tracking-wider uppercase transition-colors ${
                                        selectedAmenities.includes(opt)
                                            ? 'bg-[#C6A664]/30 border border-[#C6A664]/50 text-[#C6A664]'
                                            : 'bg-white/5 border border-white/10 text-[#94A3B8] hover:border-white/20'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-between pt-4 border-t border-white/10">
                <button type="button" onClick={onBack} className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">
                    Back
                </button>
                <button type="submit" className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase hover:opacity-90 transition-opacity">
                    Next
                </button>
            </div>
        </form>
    );
}
