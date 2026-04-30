'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { PanelLeftClose } from 'lucide-react';

import EngineNoMeshFilterControls, {
    type StudioFilterBounds,
    type StudioFilterState,
} from '@/components/EngineNoMeshFilterControls';
import {
    ENGINE_SCENE_SIDE_INSET,
    ENGINE_SCENE_SIDE_PANEL_COLLAPSED,
    ENGINE_SCENE_SIDE_PANEL_TOP,
    ENGINE_SCENE_SIDE_PANEL_WIDTH_EXPANDED,
} from '@/components/EngineRightPanel';

const STORAGE_KEY = 'engineNoMeshFilterPanelCollapsed';

function PanelLeftOpenIcon({ size = 22 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
        </svg>
    );
}

export default function EngineNoMeshLeftFilterPanel({
    bounds,
    state,
    onPatch,
}: {
    bounds: StudioFilterBounds;
    state: StudioFilterState;
    onPatch: (patch: Partial<StudioFilterState>) => void;
}) {
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    });
    const [expandedHeight, setExpandedHeight] = useState(
        typeof window !== 'undefined'
            ? window.innerHeight - ENGINE_SCENE_SIDE_PANEL_TOP - ENGINE_SCENE_SIDE_INSET
            : 500
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
        } catch {
            /* ignore */
        }
    }, [collapsed]);

    useEffect(() => {
        const onResize = () =>
            setExpandedHeight(window.innerHeight - ENGINE_SCENE_SIDE_PANEL_TOP - ENGINE_SCENE_SIDE_INSET);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const shell: CSSProperties = {
        background: '#E4DCD5CC',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(113, 88, 82, 0.28)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    };

    return (
        <motion.div
            className="absolute z-20 overflow-hidden flex flex-col pointer-events-auto min-w-0"
            style={{ left: ENGINE_SCENE_SIDE_INSET, top: ENGINE_SCENE_SIDE_PANEL_TOP }}
            initial={{ x: -60, opacity: 0 }}
            animate={{
                x: 0,
                opacity: 1,
                width: collapsed ? ENGINE_SCENE_SIDE_PANEL_COLLAPSED : ENGINE_SCENE_SIDE_PANEL_WIDTH_EXPANDED,
                height: collapsed ? ENGINE_SCENE_SIDE_PANEL_COLLAPSED : expandedHeight,
                borderRadius: collapsed ? ENGINE_SCENE_SIDE_PANEL_COLLAPSED / 2 : 12,
            }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
            {collapsed ? (
                <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="w-full h-full flex items-center justify-center rounded-full text-[#6B534E] hover:text-[#4a3a36] transition-colors"
                    style={{ background: '#E4DCD5CC' }}
                    aria-label="Open filters"
                >
                    <PanelLeftOpenIcon size={22} />
                </button>
            ) : (
                <div className="flex flex-col min-h-0 flex-1 overflow-hidden rounded-xl" style={shell}>
                    <div className="shrink-0 px-3 py-2 flex items-center justify-between gap-2 border-b border-[rgba(113,88,82,0.2)]">
                        <span className="text-[10px] tracking-[0.25em] uppercase font-bold truncate" style={{ color: '#6B534E' }}>
                            Filters
                        </span>
                        <button
                            type="button"
                            onClick={() => setCollapsed(true)}
                            className="p-1.5 rounded-lg transition-colors shrink-0 hover:bg-[rgba(113,88,82,0.1)]"
                            style={{ color: '#6B534E' }}
                            aria-label="Collapse filters"
                        >
                            <PanelLeftClose size={18} strokeWidth={1.5} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto engine-units-scroll px-3 pb-3 pt-2">
                        <EngineNoMeshFilterControls bounds={bounds} state={state} onChange={onPatch} />
                    </div>
                </div>
            )}
        </motion.div>
    );
}
