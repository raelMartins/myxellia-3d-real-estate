'use client';

import type { UnitRow } from '@/lib/database.types';
import type { NewUnitSlot } from '@/lib/sectionPlanSlots';
import { slotYExtent } from '@/lib/sectionPlanUnits';
import { formatCentsToCurrency } from '@/lib/currency';
import CustomSelect from '@/components/CustomSelect';

interface MigrationReconcileViewProps {
    oldUnits: UnitRow[];
    newSlots: NewUnitSlot[];
    mapping: Record<number, string | null>;
    onMappingChange: (newSlotIndex: number, oldUnitId: string | null) => void;
}

export default function MigrationReconcileView({ oldUnits, newSlots, mapping, onMappingChange }: MigrationReconcileViewProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <div className="text-[9px] tracking-[0.2em] text-[#C6A664] uppercase mb-3">Old units (map to new)</div>
                <ul className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                    {oldUnits.map((u) => (
                        <li key={u.id} className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                            <div className="font-medium text-[#F5F7FA]">{u.unit_number}</div>
                            <div className="text-[#94A3B8] mt-1">
                                {u.price != null ? formatCentsToCurrency(Number(u.price)) : '—'} · {u.status}
                            </div>
                            <div className="text-[9px] text-[#94A3B8] mt-0.5">
                                Interior: {u.internal_model_url ? 'Yes' : 'No'}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <div className="text-[9px] tracking-[0.2em] text-[#C6A664] uppercase mb-3">New units (copy data from)</div>
                <ul className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                    {newSlots.map((slot, i) => {
                        const { yLo, yHi } = slotYExtent(slot);
                        return (
                            <li key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                                <span className="text-xs text-[#F5F7FA]">
                                    {slot.sectionLabel} · Y {yLo.toFixed(1)}–{yHi.toFixed(1)} m · floor {slot.floorAnnotation}
                                </span>
                                <CustomSelect
                                    value={mapping[i] ?? ''}
                                    onChange={(v) => onMappingChange(i, v || null)}
                                    fullWidth={false}
                                    className="min-w-[140px] max-w-[200px]"
                                    frame="inline"
                                    variant="compact"
                                    buttonClassName="text-[11px] font-medium normal-case tracking-normal px-1 py-0.5"
                                    options={[
                                        { value: '', label: '— None —' },
                                        ...oldUnits.map((u) => ({
                                            value: u.id,
                                            label: `${u.unit_number} (${u.status})`,
                                        })),
                                    ]}
                                />
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
