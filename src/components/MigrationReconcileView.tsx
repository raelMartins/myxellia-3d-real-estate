import type { UnitRow } from '../lib/database.types';
import type { NewUnitSlot } from './SectionFloorsConfig';
import { formatCentsToCurrency } from '../lib/currency';

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
                    {newSlots.map((slot, i) => (
                        <li key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                            <span className="text-xs text-[#F5F7FA]">
                                {slot.sectionLabel} · Floor {slot.floorIndex + 1}
                            </span>
                            <select
                                value={mapping[i] ?? ''}
                                onChange={(e) => onMappingChange(i, e.target.value || null)}
                                className="rounded bg-white/10 border border-white/10 px-2 py-1.5 text-[11px] text-[#F5F7FA] focus:border-[#C6A664]/50 focus:outline-none"
                            >
                                <option value="">— None —</option>
                                {oldUnits.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.unit_number} ({u.status})
                                    </option>
                                ))}
                            </select>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
