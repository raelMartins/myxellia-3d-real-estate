import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Center, Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import { Upload, Loader2, X, Box, Eye } from 'lucide-react';
import { ModelLoader } from './BuildingModel';
import { useAuthStore } from '../store/auth.store';

const ACCEPTED = ['.glb', '.gltf', '.fbx', '.obj'];

interface InteriorModelUploadProps {
    unitId: string;
    unitNumber: string;
    onUploaded: () => void;
    onError: (message: string) => void;
    /** Height in px for the 3D preview area (default 220). Ignored when previewFillsSpace is true. */
    previewHeight?: number;
    /** Called when the 3D preview is shown or hidden (e.g. for modal height transition) */
    onPreviewVisible?: (visible: boolean) => void;
    /** When true, use flex layout so the preview area fills remaining space (no scroll). */
    previewFillsSpace?: boolean;
}

export default function InteriorModelUpload({ unitId, unitNumber, onUploaded, onError, previewHeight = 220, onPreviewVisible, previewFillsSpace = false }: InteriorModelUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const validateAndSetFile = useCallback((f: File) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!ACCEPTED.includes(ext)) {
            setError(`Unsupported format. Use: ${ACCEPTED.join(', ')}`);
            return;
        }
        setError(null);
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(f);
        setPreviewUrl(url);
        onPreviewVisible?.(true);
    }, [previewUrl, onPreviewVisible]);

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    useEffect(() => {
        if (!onPreviewVisible) return;
        onPreviewVisible(!!previewUrl);
    }, [previewUrl, onPreviewVisible]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) validateAndSetFile(dropped);
    }, [validateAndSetFile]);

    const clearFile = useCallback(() => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setError(null);
        onPreviewVisible?.(false);
    }, [previewUrl, onPreviewVisible]);

    const handleUpload = async () => {
        if (!file) return;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!supabaseUrl || !supabaseKey || !token) {
            onError('Missing Supabase config or session. Please sign in.');
            return;
        }

        setUploading(true);
        setError(null);
        setUploadProgress(0);
        let progressInterval: ReturnType<typeof setInterval> | null = null;

        try {
            progressInterval = setInterval(() => setUploadProgress((p) => Math.min(p + 8, 80)), 120);
            const sanitized = file.name.replace(/\s+/g, '_');
            const objectPath = `interior/${unitId}_${Date.now()}_${sanitized}`;

            const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/models/${objectPath}`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': file.type || 'application/octet-stream',
                    'x-upsert': 'true',
                },
                body: file,
            });
            if (progressInterval) clearInterval(progressInterval);

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Upload failed: ${uploadRes.status} ${errText}`);
            }

            setUploadProgress(90);
            const modelPublicUrl = `${supabaseUrl}/storage/v1/object/public/models/${objectPath}`;

            const patchRes = await fetch(`${supabaseUrl}/rest/v1/units?id=eq.${unitId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ internal_model_url: modelPublicUrl }),
            });
            setUploadProgress(100);

            if (!patchRes.ok) throw new Error(await patchRes.text() || 'Failed to update unit');
            onUploaded();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Upload failed.';
            setError(msg);
            onError(msg);
        } finally {
            if (progressInterval) clearInterval(progressInterval);
            setUploading(false);
        }
    };

    const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null;
    const dropBorder = `2px dashed ${dragging ? '#C6A664' : file ? 'rgba(57,255,20,0.5)' : 'rgba(255,255,255,0.12)'}`;
    const dropBg = dragging ? 'rgba(198,166,100,0.06)' : file ? 'rgba(57,255,20,0.04)' : 'rgba(31,31,35,0.3)';

    return (
        <div className={previewFillsSpace ? 'flex flex-col flex-1 min-h-0 gap-4' : 'space-y-4'}>
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all px-6 text-center shrink-0 ${previewFillsSpace ? 'py-5' : 'py-10'}`}
                style={{ border: dropBorder, background: dropBg, backdropFilter: 'blur(8px)' }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,.gltf,.fbx,.obj"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }}
                />
                {file ? (
                    <>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid rgba(57,255,20,0.3)' }}>
                            <Box size={20} className="text-[#39FF14]" />
                        </div>
                        <div className="text-[#F5F7FA] font-medium text-sm">{file.name}</div>
                        <div className="text-[10px] text-[#94A3B8]">{fileSizeMB} MB · {file.name.split('.').pop()?.toUpperCase()}</div>
                        <div className="text-[9px] tracking-widest text-[#94A3B8]/60 uppercase mt-2">Click to change</div>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Upload size={20} className="text-[#94A3B8]" />
                        </div>
                        <div className="text-[#F5F7FA] text-sm font-light mb-1">Drag & drop or click</div>
                        <div className="text-[10px] text-[#94A3B8]">Unit {unitNumber} · {ACCEPTED.join(', ')}</div>
                    </>
                )}
            </div>

            {previewUrl && (
                <div
                    className={`relative w-full rounded-xl overflow-hidden glass border border-white/10 ${previewFillsSpace ? 'flex-1 min-h-[140px] flex flex-col' : ''}`}
                    style={previewFillsSpace ? undefined : { height: previewHeight }}
                >
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-[#C6A664] uppercase font-bold">
                        <Eye size={10} />
                        Preview
                    </div>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearFile(); }}
                        className="absolute top-3 right-3 z-20 p-1.5 rounded-full glass hover:bg-white/10"
                    >
                        <X size={12} className="text-[#94A3B8]" />
                    </button>
                    <div className={previewFillsSpace ? 'flex-1 min-h-0 w-full' : 'w-full h-full'}>
                        <Canvas camera={{ position: [4, 4, 4], fov: 45 }} shadows>
                            <color attach="background" args={['#0A0A0B']} />
                            <ambientLight intensity={0.5} />
                            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                            <Center top>
                                <ModelLoader url={previewUrl} extension={file?.name.split('.').pop()} />
                            </Center>
                            <Environment preset="city" />
                            <ContactShadows opacity={0.4} scale={20} blur={2.4} />
                            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.4} />
                        </Canvas>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-red-400 text-[10px] tracking-wider uppercase shrink-0">{error}</p>
            )}

            {uploading && (
                <div className="shrink-0">
                    <div className="flex justify-between text-[9px] tracking-widest uppercase text-[#94A3B8] mb-1.5">
                        <span>{uploadProgress >= 90 ? 'Saving unit...' : 'Uploading...'} {uploadProgress}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#39FF14] to-[#C6A664] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[10px] tracking-[0.2em] font-bold uppercase flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Uploading...' : 'Upload interior model'}
            </button>
        </div>
    );
}
