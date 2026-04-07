import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ozkbfxvouxgsdthnweyr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96a2JmeHZvdXhnc2R0aG53ZXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTk3NjYsImV4cCI6MjA4ODc3NTc2Nn0.q5jj32Iq4pc0-0El0_vBvyTBHtgAZ9rWxqv91kJBV0c";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('products_cache')
    .select('codigo_amigavel, codigo_prefixo, produto_pai, is_variante, variantes_count, ativo')
    .or('codigo_amigavel.ilike.%14726B%,codigo_amigavel.ilike.%14726L%')
    .order('codigo_amigavel');

  if (error) {
    console.error("Erro na consulta:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
