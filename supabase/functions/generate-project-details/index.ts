// Supabase Edge Function: Generate luxury real estate project details using Gemini 1.5 Flash
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are a world-class luxury real estate marketing expert and copywriter.
Your task is to generate compelling, high-end details for a 3D real estate project.
Given hints like a project name or location, you will generate:
- name: A sophisticated project name (keep existing if provided)
- tagline: A brief, poetic tagline (max 10 words)
- location: A specific, prestigious location (keep existing if provided)
- price_cents: A realistic luxury price in cents (integer). Standard range $5M - $50M.
- description: A rich, sensory description (max 100 words) focusing on architecture and lifestyle.
- env_context: A detailed visual description of the surrounding environment to be used by an AI image generator for the skybox.

Return ONLY a valid JSON object. No markdown, no explanation.
Example: {"name": "The Obsidian", "tagline": "Living at the edge of tomorrow", "location": "Dubai Marina, UAE", "price_cents": 1250000000, "description": "...", "env_context": "..."}`;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'GEMINI_API_KEY is not set.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const { name, location } = await req.json().catch(() => ({}));

        let prompt = "Generate a new luxury real estate project.";
        if (name || location) {
            prompt = `Generate a luxury real estate project based on these hints: ${name ? 'Name: ' + name : ''} ${location ? 'Location: ' + location : ''}`;
        }

        const payload = {
            contents: [{
                role: 'user',
                parts: [{ text: SYSTEM_PROMPT + '\n\n' + prompt }]
            }],
            generation_config: {
                temperature: 0.8,
                max_output_tokens: 1024,
            }
        };

        const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000),
        });

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            if (geminiRes.status === 429) {
                throw new Error('AI quota or rate limit reached. Please try again in a minute, or check your Gemini API plan at https://ai.google.dev/gemini-api/docs/rate-limits');
            }
            throw new Error(`Gemini API failed with status ${geminiRes.status}: ${errText}`);
        }

        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('No content returned from Gemini');

        // Strip markdown code fences if present (v1 API doesn't support response_mime_type)
        const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

        return new Response(
            cleaned,
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        const isQuota = message.includes('quota') || message.includes('rate limit');
        return new Response(
            JSON.stringify({ error: message }),
            { status: isQuota ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
