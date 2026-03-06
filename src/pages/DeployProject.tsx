import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, ArrowRight, Building2,
    MapPin, FileText, ShieldCheck, Zap, Box, Loader2, Sparkles, CheckCircle, Eye, X
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Environment, ContactShadows } from '@react-three/drei';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { ModelLoader } from '../components/BuildingModel';
import { generateEnvImage } from '../lib/ai';
import { useEffect } from 'react';

type BuildingInsert = Database['public']['Tables']['buildings']['Insert'];
type UnitInsert = Database['public']['Tables']['units']['Insert'];

const ease = [0.2, 0.8, 0.2, 1] as const;
const ACCEPTED = ['.glb', '.gltf', '.fbx', '.obj'];
type Step = 'meta' | 'upload' | 'done';

export default function DeployProject() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('meta');
    const [name, setName] = useState('');
    const [tagline, setTagline] = useState('');
    const [location, setLocation] = useState('');
    const [price, setPrice] = useState('');
    const [heroUrl, setHeroUrl] = useState('');
    const [storeUrl, setStoreUrl] = useState('');
    const [description, setDescription] = useState('');
    const [envContext, setEnvContext] = useState('');
    const [useBypass, setUseBypass] = useState(true);
    const [diagLogs, setDiagLogs] = useState<string[]>([]);
    const [isDiagRunning, setIsDiagRunning] = useState(false);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [newBuildingId, setNewBuildingId] = useState<string | null>(null);

    const validateAndSetFile = useCallback((f: File) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!ACCEPTED.includes(ext)) {
            setError(`Unsupported format. Please upload: ${ACCEPTED.join(', ')}`);
            return;
        }
        setError(null);
        setFile(f);

        // Create local preview URL
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(f);
        setPreviewUrl(url);
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) validateAndSetFile(dropped);
    }, [validateAndSetFile]);

    const handleMetaSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !location) return;
        setStep('upload');
    };

    const addLog = (msg: string) => {
        console.log(`[DIAG] ${msg}`);
        setDiagLogs(prev => [...prev.slice(-4), msg]);
    };

    const runConnectionDiag = async () => {
        setIsDiagRunning(true);
        setDiagLogs([]);
        addLog('Starting Connection Diagnostics...');

        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        addLog(`Env URL: ${url ? 'FOUND' : 'MISSING'}`);
        addLog(`Env Key: ${key ? 'FOUND' : 'MISSING'}`);

        // Test 1: SDK Simple Query
        try {
            addLog('Test 1: SDK Simple Query...');
            const { error: err } = await supabase.from('buildings').select('id').limit(1);
            if (err) throw err;
            addLog('✅ SDK Query: Success');
        } catch (err: unknown) {
            addLog(`❌ SDK Query: Fail (${err instanceof Error ? err.message : String(err)})`);
        }

        // Test 2: Direct Fetch REST
        try {
            addLog('Test 2: Direct Fetch REST...');
            const res = await fetch(`${url}/rest/v1/buildings?select=id&limit=1`, {
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            addLog('✅ Direct REST: Success');
        } catch (err: unknown) {
            addLog(`❌ Direct REST: Fail (${err instanceof Error ? err.message : String(err)})`);
        }

        setIsDiagRunning(false);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);
        setUploadProgress(0);

        console.log('[DEBUG] Starting upload process...');
        console.log('[DEBUG] File info:', { name: file.name, size: file.size, type: file.type });

        let progressInterval: ReturnType<typeof setInterval> | null = null;
        try {
            console.log('[DEBUG] 1. Starting handleUpload...');

            // Check session with a short timeout. We proceed even if it fails 
            // since the bucket policies we are setting allow public access.
            console.log('[DEBUG] 3. Attempting to fetch session (1s timeout)...');
            let session: { user: { id: string }; access_token: string } | null = null;
            try {
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Session fetch timed out')), 1000)
                );
                const result = await Promise.race([sessionPromise, timeoutPromise]);
                const data = result && typeof result === 'object' && 'data' in result ? (result as { data: { session: { user: { id: string }; access_token: string } | null } }).data : null;
                session = data?.session ?? null;
                console.log('[DEBUG] 4. Session result:', session ? `User UID: ${session.user.id}` : 'NO SESSION');
            } catch (sErr) {
                console.warn('[DEBUG] 4. Session check failed or timed out:', sErr);
            }

            console.log('[DEBUG] 5. Setting progress interval...');
            progressInterval = setInterval(() => {
                setUploadProgress(p => Math.min(p + 5, 85));
            }, 150);

            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            console.log('[DEBUG] 6. Target fileName:', fileName);

            // ACTUAL UPLOAD CALL
            console.log(`[DEBUG] 7a. Starting upload (${useBypass ? 'BYPASS' : 'SDK'})...`);

            const token = session?.access_token ?? null;
            let insertToken: string | null = token;

            let uploadPromise;

            if (useBypass) {
                const url = import.meta.env.VITE_SUPABASE_URL;
                const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
                uploadPromise = fetch(`${url}/storage/v1/object/models/${fileName}`, {
                    method: 'POST',
                    headers: {
                        'apikey': key,
                        'Authorization': `Bearer ${token || key}`,
                        'Content-Type': file.type || 'application/octet-stream',
                        'x-upsert': 'false'
                    },
                    body: file
                }).then(async res => {
                    if (!res.ok) {
                        const errText = await res.text();
                        console.error('[DEBUG] Bypass upload raw error:', { status: res.status, body: errText });
                        throw new Error(`Bypass upload failed: ${res.status} ${errText}`);
                    }
                    return { data: { path: fileName }, error: null };
                });
            } else {
                // SDK upload with 30s timeout
                const sdkUpload = supabase.storage
                    .from('models')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                const uploadTimeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('SDK upload timed out after 30s')), 30000)
                );

                uploadPromise = Promise.race([sdkUpload, uploadTimeout]);
            }

            const { data, error: storageErr } = await uploadPromise;

            console.log('[DEBUG] 8. Storage response received:', { data, storageErr });
            if (progressInterval) clearInterval(progressInterval);

            if (storageErr) {
                console.error('[DEBUG] Storage error:', storageErr);
                throw storageErr;
            }

            console.log('[DEBUG] Upload successful:', data);
            setUploadProgress(92);

            const { data: urlData } = supabase.storage.from('models').getPublicUrl(fileName);
            console.log('[DEBUG] Public URL:', urlData.publicUrl);
            setUploadProgress(95);

            console.log('[DEBUG] Inserting building record...');

            // RLS requires an authenticated user (admin). Anon key has no auth.uid() and will be rejected.
            if (useBypass) {
                if (!insertToken) {
                    try {
                        const sessionTimeout = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Sign-in check timed out')), 5000)
                        );
                        const { data: sessionData } = await Promise.race([
                            supabase.auth.getSession(),
                            sessionTimeout
                        ]) as { data: { session: { access_token: string } | null } };
                        insertToken = sessionData?.session?.access_token ?? null;
                    } catch {
                        insertToken = null;
                    }
                }
                if (!insertToken) {
                    throw new Error(
                        'Please sign in to add a building. Row-level security requires an authenticated admin account.'
                    );
                }
            }

            let building: { id: string };
            if (useBypass) {
                const url = import.meta.env.VITE_SUPABASE_URL;
                const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const controller = new AbortController();
                const insertTimeout = setTimeout(() => controller.abort(), 15000); // 15s timeout so insert doesn't hang
                const res = await fetch(`${url}/rest/v1/buildings?select=*`, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'apikey': key,
                        'Authorization': `Bearer ${insertToken}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        name,
                        tagline,
                        location,
                        starting_price: price,
                        hero_url: heroUrl,
                        description,
                        env_context: envContext,
                        store_url: storeUrl,
                        model_url: urlData.publicUrl,
                        total_units: 5
                    })
                });
                clearTimeout(insertTimeout);

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`DB Insert bypass failed: ${res.status} ${errText}`);
                }
                const results = await res.json();
                building = results[0];
            } else {
                const insertPayload: BuildingInsert = {
                    name,
                    tagline: tagline || undefined,
                    location,
                    starting_price: price || undefined,
                    hero_url: heroUrl || undefined,
                    description: description ?? undefined,
                    env_context: envContext || undefined,
                    store_url: storeUrl || undefined,
                    model_url: urlData.publicUrl,
                    total_units: 5
                };
                const { data: b, error: dbErr } = await supabase
                    .from('buildings')
                    // @ts-expect-error - Supabase client inferrence with extended Database types
                    .insert(insertPayload)
                    .select()
                    .single();

                if (dbErr) {
                    console.error('[DEBUG] DB error:', dbErr);
                    throw dbErr;
                }
                building = b;
            }

            console.log('[DEBUG] Building record inserted successfully.');
            setUploadProgress(98);

            // AUTO GENERATE DEFAULT UNITS
            console.log('[DEBUG] Auto-generating default units...');
            const defaultUnits: UnitInsert[] = [
                { building_id: building.id, unit_number: '101', floor: 1, price: price || '$1.2M', status: 'available', mesh_id: 'u-101' },
                { building_id: building.id, unit_number: '102', floor: 1, price: price || '$1.4M', status: 'available', mesh_id: 'u-102' },
                { building_id: building.id, unit_number: '201', floor: 2, price: price || '$1.8M', status: 'available', mesh_id: 'u-201' },
                { building_id: building.id, unit_number: '202', floor: 2, price: price || '$2.1M', status: 'available', mesh_id: 'u-202' },
                { building_id: building.id, unit_number: 'PH1', floor: 3, price: price || '$4.5M', status: 'available', mesh_id: 'u-PH1' },
            ];

            if (useBypass) {
                const url = import.meta.env.VITE_SUPABASE_URL;
                const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

                // Use same token as building insert (RLS requires authenticated admin)
                const cols = 'columns="building_id","unit_number","floor","price","status","mesh_id"';
                const res = await fetch(`${url}/rest/v1/units?${cols}`, {
                    method: 'POST',
                    headers: {
                        'apikey': key,
                        'Authorization': `Bearer ${insertToken}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(defaultUnits)
                });

                if (!res.ok) {
                    const errText = await res.text();
                    console.error('[DEBUG] Units bypass failed:', { status: res.status, body: errText });
                } else {
                    console.log('[DEBUG] Units auto-generated successfully via bypass.');
                }
            } else {
                // @ts-expect-error - Supabase client inferrence with extended Database types
                const { error: unitsErr } = await supabase.from('units').insert(defaultUnits);
                if (unitsErr) console.warn('[DEBUG] Failed to auto-generate units:', unitsErr);
            }

            console.log('[DEBUG] All steps successfully completed.');
            setUploadProgress(100);
            setNewBuildingId(building.id);
            setStep('done');

            // AI: Generate environment skybox from env_context (Pollinations) in background
            if (envContext?.trim()) {
                generateEnvImage(building.id, envContext).then(() => {
                    console.log('[DEBUG] Generated env image saved.');
                }).catch((e) => {
                    console.warn('[DEBUG] Env image generation failed:', e);
                });
            }
        } catch (err: unknown) {
            console.error('[DEBUG] CRITICAL ERROR in handleUpload:', err);
            setError(err instanceof Error ? err.message : 'Upload failed. See console for details.');
            if (progressInterval) clearInterval(progressInterval);
        } finally {
            setUploading(false);
        }
    };

    const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null;
    const dropBorder = `2px dashed ${dragging ? '#C6A664' : file ? 'rgba(57,255,20,0.5)' : 'rgba(255,255,255,0.12)'}`;
    const dropBg = dragging ? 'rgba(198,166,100,0.06)' : file ? 'rgba(57,255,20,0.04)' : 'rgba(31,31,35,0.3)';

    const inputCls = 'w-full glass rounded-xl px-5 py-4 text-[14px] text-[#F5F7FA] placeholder:text-[#94A3B8]/40 focus:outline-none transition-all';
    const labelCls = 'block text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase mb-2';

    const STEPS: { key: Step; label: string }[] = [
        { key: 'meta', label: 'Project Info' },
        { key: 'upload', label: 'Upload Model' },
        { key: 'done', label: 'Published' },
    ];

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA] flex flex-col" style={{ overflowY: 'auto' }}>

            {/* Top bar */}
            <div
                className="sticky top-0 z-40 flex items-center justify-between px-8"
                style={{ height: '64px', background: 'rgba(10,10,11,0.9)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-[#94A3B8] hover:text-[#C6A664] text-[10px] tracking-widest uppercase transition-colors group"
                >
                    <ArrowRight size={13} className="group-hover:-translate-x-1 transition-transform rotate-180" />
                    Back to Command Center
                </button>
                <div className="font-serif-display text-sm tracking-[0.25em] text-[#F5F7FA]">MYXELLIA</div>
            </div>

            {/* Main */}
            <div className="flex-1 flex justify-center px-6 py-16">
                <div className="w-full max-w-2xl">

                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="mb-12">
                        <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[#C6A664] uppercase mb-3">
                            <ShieldCheck size={11} /> Admin — Deploy
                        </div>
                        <h1 className="font-serif-display text-5xl text-[#F5F7FA] leading-tight mb-3">Deploy New Project</h1>
                        <p className="text-[#94A3B8] text-[14px] leading-relaxed">
                            Define your building's context, then upload the 3D model. It will be published to the Marketplace once processed.
                        </p>
                    </motion.div>

                    {/* Step Indicator */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-3 mb-10">
                        {STEPS.map(({ key, label }, i) => {
                            const isActive = step === key;
                            const isCompleted = (step === 'upload' && i === 0) || step === 'done';
                            return (
                                <div key={key} className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all duration-300"
                                            style={{
                                                background: isActive ? '#C6A664' : isCompleted ? 'rgba(198,166,100,0.2)' : 'rgba(255,255,255,0.06)',
                                                color: isActive ? '#0A0A0B' : '#94A3B8',
                                                border: `1px solid ${isActive ? '#C6A664' : 'rgba(255,255,255,0.1)'}`,
                                            }}
                                        >{i + 1}</div>
                                        <span className="text-[11px] tracking-wider uppercase" style={{ color: isActive ? '#F5F7FA' : '#94A3B8' }}>{label}</span>
                                    </div>
                                    {i < 2 && <div className="w-8 h-px bg-white/10" />}
                                </div>
                            );
                        })}
                    </motion.div>

                    <AnimatePresence mode="wait">

                        {/* STEP 1 — Project Info */}
                        {step === 'meta' && (
                            <motion.form key="meta" onSubmit={handleMetaSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4, ease }} className="space-y-5">
                                <div>
                                    <label className={labelCls}><Building2 size={10} className="inline mr-1.5" />Project Name</label>
                                    <input required value={name} onChange={e => setName(e.target.value)} placeholder='e.g. "THE MERIDIAN"' className={inputCls} style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Tagline</label>
                                        <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder='e.g. "Beachfront Sanctuary"' className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Starting Price</label>
                                        <input value={price} onChange={e => setPrice(e.target.value)} placeholder='e.g. "$1.8M"' className={inputCls} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}><MapPin size={10} className="inline mr-1.5" />Location</label>
                                    <input required value={location} onChange={e => setLocation(e.target.value)} placeholder='e.g. "Beachfront, Ibiza"' className={inputCls} style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                </div>

                                {/* Debug Diagnostics Section */}
                                <div className="mt-8 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-[10px] tracking-widest text-[#94A3B8] uppercase font-bold flex items-center gap-2">
                                            <Zap size={12} className="text-[#C6A664]" />
                                            Connection Diagnostics
                                        </div>
                                        <button
                                            type="button"
                                            onClick={runConnectionDiag}
                                            disabled={isDiagRunning}
                                            className="text-[9px] px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-[#C6A664] transition-colors disabled:opacity-50"
                                        >
                                            {isDiagRunning ? 'Running...' : 'Run Health Check'}
                                        </button>
                                    </div>

                                    {diagLogs.length > 0 && (
                                        <div className="space-y-1 mb-4">
                                            {diagLogs.map((log, i) => (
                                                <div key={i} className={`text-[10px] font-mono ${log.includes('✅') ? 'text-[#39FF14]' : log.includes('❌') ? 'text-[#FF4B4B]' : 'text-[#94A3B8]'}`}>
                                                    {log}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={useBypass}
                                                onChange={e => setUseBypass(e.target.checked)}
                                            />
                                            <div className={`w-8 h-4 rounded-full transition-colors ${useBypass ? 'bg-[#C6A664]' : 'bg-white/10'}`} />
                                            <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useBypass ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] text-[#F5F7FA]">Bypass SDK Mode</span>
                                            <span className="text-[9px] text-[#94A3B8]">Use direct fetch if upload hangs</span>
                                        </div>
                                    </label>
                                </div>

                                <div>
                                    <label className={labelCls}>Hero Image URL <span className="text-[#94A3B8]/40 normal-case">(Optional)</span></label>
                                    <input value={heroUrl} onChange={e => setHeroUrl(e.target.value)} placeholder='https://images.unsplash.com/...' className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Property Store URL <span className="text-[#94A3B8]/40 normal-case">(e.g. Shopify, External Portal)</span></label>
                                    <input value={storeUrl} onChange={e => setStoreUrl(e.target.value)} placeholder='https://store.example.com/...' className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}><FileText size={10} className="inline mr-1.5" />Project Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description for the Marketplace listing..." rows={2} className={`${inputCls} resize-none`} style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                </div>
                                <div>
                                    <label className={labelCls}>
                                        <Sparkles size={10} className="inline mr-1.5" />
                                        Environment Context <span className="text-[#C6A664]">(AI will generate a matching skybox)</span>
                                    </label>
                                    <textarea value={envContext} onChange={e => setEnvContext(e.target.value)} placeholder='e.g. "A lush tropical hillside overlooking the ocean in Ibiza at golden hour..."' rows={3} className={`${inputCls} resize-none`} style={{ borderColor: 'rgba(198,166,100,0.2)' }} />
                                </div>
                                <button type="submit" className="w-full py-4 rounded-xl font-semibold text-[12px] tracking-[0.2em] uppercase hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #C6A664, #D4BA82)', color: '#0A0A0B' }}>
                                    Continue → Upload Model
                                </button>
                            </motion.form>
                        )}

                        {/* STEP 2 — Upload */}
                        {step === 'upload' && (
                            <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4, ease }} className="space-y-6">

                                {/* Drop Zone */}
                                <div
                                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="relative rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 py-16 px-8 text-center"
                                    style={{ border: dropBorder, background: dropBg, backdropFilter: 'blur(8px)' }}
                                >
                                    <input ref={fileInputRef} type="file" accept=".glb,.gltf,.fbx,.obj" className="hidden" onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) validateAndSetFile(f);
                                    }} />

                                    {file ? (
                                        <>
                                            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid rgba(57,255,20,0.3)' }}>
                                                <Box size={24} style={{ color: '#39FF14' }} />
                                            </div>
                                            <div className="text-[#F5F7FA] font-medium mb-1">{file.name}</div>
                                            <div className="text-[11px] text-[#94A3B8]">{fileSizeMB} MB · {file.name.split('.').pop()?.toUpperCase()}</div>
                                            <div className="text-[10px] tracking-widest text-[#94A3B8]/60 uppercase mt-3">Click to change file</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <Upload size={22} className="text-[#94A3B8]" />
                                            </div>
                                            <div className="text-[#F5F7FA] font-light mb-2">Drag & drop your 3D model here</div>
                                            <div className="text-[11px] text-[#94A3B8] mb-4">or click to browse</div>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {ACCEPTED.map(ext => (
                                                    <span key={ext} className="text-[9px] tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ background: 'rgba(198,166,100,0.08)', border: '1px solid rgba(198,166,100,0.2)', color: '#C6A664' }}>{ext}</span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* PREVIEW 3D MODEL */}
                                {previewUrl && (
                                    <div className="relative h-[300px] w-full rounded-2xl overflow-hidden glass border border-white/10 group">
                                        <div className="absolute top-4 left-5 z-20 flex items-center gap-2 text-[10px] tracking-[0.2em] text-[#C6A664] uppercase font-bold">
                                            <Eye size={12} />
                                            3D Model Preview
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                                setPreviewUrl(null);
                                            }}
                                            className="absolute top-4 right-4 z-20 p-2 rounded-full glass hover:bg-white/10 transition-colors"
                                        >
                                            <X size={14} className="text-[#94A3B8]" />
                                        </button>
                                        <Canvas camera={{ position: [5, 5, 5], fov: 45 }} shadows>
                                            <color attach="background" args={['#0A0A0B']} />
                                            <ambientLight intensity={0.5} />
                                            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                                            <Center top>
                                                <ModelLoader url={previewUrl} extension={file?.name.split('.').pop()} />
                                            </Center>
                                            <Environment preset="city" />
                                            <ContactShadows opacity={0.4} scale={20} blur={2.4} />
                                            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
                                        </Canvas>
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] tracking-widest text-[#94A3B8]/60 uppercase pointer-events-none">
                                            Drag to rotate · Scroll to zoom
                                        </div>
                                    </div>
                                )}

                                {error && <p className="text-red-400 text-[11px] tracking-wider uppercase">{error}</p>}

                                {uploading && (
                                    <div>
                                        <div className="flex justify-between text-[10px] tracking-widest uppercase text-[#94A3B8] mb-2">
                                            <span>{uploadProgress >= 90 ? 'Saving project...' : 'Uploading to Supabase Storage...'} {uploadProgress}%</span>
                                        </div>
                                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                            <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #39FF14, #C6A664)' }} animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }} />
                                        </div>
                                    </div>
                                )}

                                <div className="glass rounded-xl p-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                    <div className="text-[9px] tracking-[0.25em] text-[#94A3B8] uppercase mb-3">Project Summary</div>
                                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                                        <div><span className="text-[#94A3B8]">Name: </span><span className="text-[#F5F7FA]">{name}</span></div>
                                        <div><span className="text-[#94A3B8]">Price: </span><span className="text-[#F5F7FA]">{price || 'N/A'}</span></div>
                                        <div className="col-span-2"><span className="text-[#94A3B8]">Location: </span><span className="text-[#F5F7FA]">{location}</span></div>
                                        {storeUrl && <div className="col-span-2 truncate"><span className="text-[#94A3B8]">Store: </span><span className="text-[#C6A664]">{storeUrl}</span></div>}
                                        {envContext && <div className="col-span-2"><span className="text-[#94A3B8]">Environment: </span><span className="text-[#C6A664]">{envContext}</span></div>}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep('meta')} className="px-6 py-3.5 rounded-xl text-[11px] tracking-widest uppercase transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>← Back</button>
                                    <button onClick={handleUpload} disabled={!file || uploading} className="flex-1 py-3.5 rounded-xl font-semibold text-[12px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 disabled:opacity-40 transition-all" style={{ background: 'linear-gradient(135deg, #C6A664, #D4BA82)', color: '#0A0A0B' }}>
                                        {uploading ? <><Loader2 size={15} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Deploy to Marketplace</>}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3 — Done */}
                        {step === 'done' && (
                            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} className="text-center py-8">
                                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid rgba(57,255,20,0.3)' }}>
                                    <CheckCircle size={36} style={{ color: '#39FF14' }} />
                                </div>
                                <h2 className="font-serif-display text-3xl text-[#F5F7FA] mb-3">Project Deployed</h2>
                                <p className="text-[#94A3B8] text-[14px] mb-8 max-w-sm mx-auto">
                                    <strong className="text-[#C6A664]">{name}</strong> has been uploaded and is now live in the Marketplace.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button onClick={() => navigate(`/engine/${newBuildingId ?? 'bldg-1'}`)} className="px-8 py-4 rounded-xl font-semibold text-[12px] tracking-[0.2em] uppercase" style={{ background: 'linear-gradient(135deg, #C6A664, #D4BA82)', color: '#0A0A0B' }}>Open 3D Engine →</button>
                                    <button onClick={() => navigate('/')} className="px-8 py-4 rounded-xl text-[12px] tracking-widest uppercase" style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>Back to Marketplace</button>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
