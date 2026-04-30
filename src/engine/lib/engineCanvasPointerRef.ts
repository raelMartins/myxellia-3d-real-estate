/** Last pointer position over the WebGL canvas — used to re-run R3F hover after camera moves. */
export const engineCanvasPointerRef = {
    clientX: 0,
    clientY: 0,
    pointerId: 0,
    pointerType: 'mouse' as string,
    overCanvas: false,
};
