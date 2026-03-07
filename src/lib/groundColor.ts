/**
 * Map env_context keywords to a ground color that matches typical skybox "floor" tones.
 * Used for the hero ground circle so it blends with the environment.
 */
export function getGroundColor(envContext: string | null | undefined): string {
    if (!envContext || typeof envContext !== 'string') return '#1A1A1A';
    const ctx = envContext.toLowerCase();
    if (ctx.includes('beach') || ctx.includes('ocean') || ctx.includes('sand') || ctx.includes('tropical') || ctx.includes('coast'))
        return '#C4A574';
    if (ctx.includes('forest') || ctx.includes('lush') || ctx.includes('jungle') || ctx.includes('garden') || ctx.includes('park'))
        return '#2D3B2A';
    if (ctx.includes('mountain') || ctx.includes('hillside') || ctx.includes('rock') || ctx.includes('alpine'))
        return '#4A4845';
    if (ctx.includes('city') || ctx.includes('urban') || ctx.includes('street') || ctx.includes('downtown'))
        return '#3A3A3A';
    if (ctx.includes('desert') || ctx.includes('arid') || ctx.includes('dune'))
        return '#B8956B';
    if (ctx.includes('snow') || ctx.includes('winter') || ctx.includes('ice'))
        return '#E8E8E8';
    return '#1A1A1A';
}
