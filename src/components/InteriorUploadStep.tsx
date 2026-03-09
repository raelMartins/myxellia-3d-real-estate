import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Center, Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import { Upload, Box, Eye, X } from 'lucide-react';
import { ModelLoader } from './BuildingModel';

const ACCEPTED = ['.glb', '.gltf', '.fbx', '.obj'];

interface InteriorUploadStepProps {
    unitNumber: string;
    file: File | null;
    onFileChange: (file: File | null) => void;
}

export default function InteriorUploadStep({ unitNumber, file, onFileChange }: InteriorUploadStepProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);

    const validateAndSetFile = useCallback((f: File) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!ACCEPTED.includes(ext)) return;
        onFileChange(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(f));
    }, [onFileChange, previewUrl]);

    useEffect(() => {
        if (!file && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    }, [file, previewUrl]);

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) validateAndSetFile(dropped);
    }, [validateAndSetFile]);

    const clearFile = useCallback(() => {
        onFileChange(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    }, [onFileChange, previewUrl]);

    const dropBorder = `2px dashed ${dragging ? '#C6A664' : file ? 'rgba(57,255,20,0.5)' : 'rgba(255,255,255,0.12)'}`;
    const dropBg = dragging ? 'rgba(198,166,100,0.06)' : file ? 'rgba(57,255,20,0.04)' : 'rgba(31,31,35,0.3)';

    return (
        <div className="space-y-4">
            <p className="text-[#94A3B8] text-sm">Optionally add an interior 3D model. You can skip and add it later.</p>
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all px-6 py-10 text-center"
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
                        <div className="text-[10px] text-[#94A3B8]">{(file.size / 1024 / 1024).toFixed(1)} MB · {file.name.split('.').pop()?.toUpperCase()}</div>
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
                <div className="relative w-full rounded-xl overflow-hidden glass border border-white/10" style={{ height: 240 }}>
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
                    <div className="w-full h-full">
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
        </div>
    );
}
