import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

interface SetDefaultSkyboxButtonProps {
    buildingId: string;
    url: string;
    onSaved: () => void;
}

export default function SetDefaultSkyboxButton({ buildingId, url, onSaved }: SetDefaultSkyboxButtonProps) {
    const [saving, setSaving] = useState(false);

    const handleClick = async () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!supabaseUrl || !key || !token) return;
        setSaving(true);
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/buildings?id=eq.${buildingId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ generated_env_url: url }),
            });
            if (res.ok) onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={saving}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] tracking-widest uppercase font-bold text-[#C6A664] hover:bg-[#C6A664]/10 disabled:opacity-50 transition-colors"
            title="Set as default skybox for this project"
        >
            <Check size={10} />
            {saving ? 'Saving…' : 'Set default'}
        </button>
    );
}
