// Supabase Edge Function: Generate environment skybox image via Pollinations.ai
// and store in Supabase Storage, then set building.generated_env_url
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { building_id, env_context } = await req.json();
    if (!building_id || !env_context?.trim()) {
      return new Response(
        JSON.stringify({ error: 'building_id and env_context are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `360 degree equirectangular skybox, photorealistic, seamless, no people, no text: ${env_context.trim()}`;
    const encodedPrompt = encodeURIComponent(prompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=512&model=flux`;

    const imageRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(90000) });
    if (!imageRes.ok) {
      throw new Error(`Pollinations failed: ${imageRes.status}`);
    }
    const imageBytes = await imageRes.arrayBuffer();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const ext = (imageRes.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
    const path = `env/${building_id}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('models')
      .upload(path, imageBytes, { contentType: imageRes.headers.get('content-type') || 'image/jpeg', upsert: true });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image: ' + uploadErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: urlData } = supabase.storage.from('models').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: updateErr } = await supabase
      .from('buildings')
      .update({ generated_env_url: publicUrl })
      .eq('id', building_id);

    if (updateErr) {
      console.error('DB update error:', updateErr);
      return new Response(
        JSON.stringify({ error: 'Failed to update building: ' + updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ url: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
