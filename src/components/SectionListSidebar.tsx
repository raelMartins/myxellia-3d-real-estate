'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import NumberInput from '@/components/NumberInput';
import type { SectionPlanSection } from '@/lib/database.types';

interface SectionListSidebarProps {
    sections: SectionPlanSection[];
    selectedSectionId: string | null;
    onSelectSection: (id: string | null) => void;
    onUpdateLabel: (id: string, label: string) => void;
    onDeleteSection: (id: string) => void;
    onAddSection: (sides: number) => void;
}

export default function SectionListSidebar({
    sections,
    selectedSectionId,
    onSelectSection,
    onUpdateLabel,
    onDeleteSection,
    onAddSection,
}: SectionListSidebarProps) {
    const [adding, setAdding] = useState(false);
    const [sidesInput, setSidesInput] = useState(4);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');

    const handleAdd = () => {
        const n = Math.max(3, sidesInput >= 3 ? sidesInput : 4);
        onAddSection(n);
        setAdding(false);
        setSidesInput(4);
    };

    const startEdit = (s: SectionPlanSection) => {
        setEditingId(s.id);
        setEditLabel(s.label);
    };

    const saveEdit = () => {
        if (editingId && editLabel.trim()) {
            onUpdateLabel(editingId, editLabel.trim());
            setEditingId(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">Sections</div>
            <ul className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                {sections.map((s) => (
                    <li
                        key={s.id}
                        className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                            selectedSectionId === s.id ? 'border-[#C6A664]/50 bg-white/10' : 'border-white/10 bg-white/5'
                        }`}
                    >
                        {editingId === s.id ? (
                            <>
                                <input
                                    type="text"
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    onBlur={saveEdit}
                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                    className="flex-1 min-w-0 rounded bg-white/10 border border-white/10 px-2 py-1 text-xs text-[#F5F7FA]"
                                    autoFocus
                                />
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onSelectSection(s.id)}
                                    className="flex-1 min-w-0 text-left text-xs text-[#F5F7FA] truncate"
                                >
                                    {s.label}
                                </button>
                                <button type="button" onClick={() => startEdit(s)} className="p-1.5 rounded text-[#94A3B8] hover:text-[#C6A664]" aria-label="Edit label">
                                    <Pencil size={12} />
                                </button>
                                <button type="button" onClick={() => onDeleteSection(s.id)} className="p-1.5 rounded text-[#94A3B8] hover:text-red-400" aria-label="Delete">
                                    <Trash2 size={12} />
                                </button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            {adding ? (
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] tracking-[0.2em] text-[#C6A664] uppercase">Sides</label>
                    <NumberInput
                        value={sidesInput}
                        onChange={setSidesInput}
                        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F5F7FA]"
                    />
                    <div className="flex gap-2">
                        <button type="button" onClick={handleAdd} className="flex-1 py-2 rounded-lg bg-[#C6A664] text-[#0A0A0B] text-[10px] font-bold uppercase">
                            Add
                        </button>
                        <button type="button" onClick={() => setAdding(false)} className="py-2 px-3 rounded-lg border border-white/10 text-[#94A3B8] text-[10px] uppercase">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase hover:bg-[#C6A664]/10"
                >
                    <Plus size={12} />
                    Add section
                </button>
            )}
        </div>
    );
}
