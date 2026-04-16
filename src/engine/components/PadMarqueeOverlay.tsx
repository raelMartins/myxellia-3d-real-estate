'use client';

import { useEngineStore } from '@/engine/store/engine.store';

/**
 * Renders the placement-pad snip marquee in the DOM (outside R3F) so `<div>` is not passed to the Canvas reconciler.
 */
export default function PadMarqueeOverlay() {
    const editActive = useEngineStore((s) => s.placementPadEditActive);
    const marquee = useEngineStore((s) => s.padMarqueeScreen);
    if (!editActive || !marquee) return null;

    const l = Math.min(marquee.x0, marquee.x1);
    const t = Math.min(marquee.y0, marquee.y1);
    const w = Math.abs(marquee.x1 - marquee.x0);
    const h = Math.abs(marquee.y1 - marquee.y0);
    if (w < 1 && h < 1) return null;

    return (
        <div
            className="pointer-events-none fixed z-[200] box-border border-2 border-dashed border-[#C6A664] bg-[#C6A664]/12"
            style={{ left: l, top: t, width: w, height: h }}
            aria-hidden
        />
    );
}
