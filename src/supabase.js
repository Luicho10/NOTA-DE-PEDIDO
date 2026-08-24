import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://layqqdkatatutmexoqrl.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_mob6Bya5CJ5AyzBNJd_TvA_VFIGyWc8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function normalizeKey(value) {
  return String(value || "").trim().replace(/\s/g, "");
}

export async function ensureVendedor() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase.rpc("provisionar_vendedor");
  if (error) throw error;
  return data;
}
