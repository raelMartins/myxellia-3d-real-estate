import type { NextConfig } from "next";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnon,
  },
  // Do not set `output: "export"` for this app unless you add a host-specific SPA fallback:
  // dynamic App Router URLs (/detail/..., /engine/..., etc.) have no prebuilt HTML per id,
  // so reloads 404 on static hosts unless every path is pre-rendered or rewritten to /.
};

export default nextConfig;
