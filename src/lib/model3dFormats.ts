/** Same 3D formats as building uploads (`DeployProject`, `InteriorModelUpload`, …). */
export const MODEL_3D_FILE_EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj'] as const;

/** `accept` attribute for `<input type="file">` */
export const MODEL_3D_INPUT_ACCEPT = MODEL_3D_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');

export function isAcceptedModel3dExtension(ext: string): boolean {
    const e = ext.trim().toLowerCase().replace(/^\./, '');
    return (MODEL_3D_FILE_EXTENSIONS as readonly string[]).includes(e);
}

/** Extension from a file name or path (last segment, after final `.`). */
export function extensionFromFileName(fileName: string): string {
    const base = fileName.trim().split(/[/\\]/).pop() || '';
    const i = base.lastIndexOf('.');
    return i >= 0 ? base.slice(i + 1).toLowerCase() : '';
}

/**
 * Extension from a model URL (e.g. Supabase public object URL). Strips query/hash; uses last path segment.
 * Needed because `url.split('.').pop()` breaks on hostnames with dots.
 */
export function extensionFromModelUrl(url: string): string {
    const path = url.trim().split(/[?#]/)[0];
    return extensionFromFileName(path);
}
