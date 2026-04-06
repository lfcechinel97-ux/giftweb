import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ozkbfxvouxgsdthnweyr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96a2JmeHZvdXhnc2R0aG53ZXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTk3NjYsImV4cCI6MjA4ODc3NTc2Nn0.q5jj32Iq4pc0-0El0_vBvyTBHtgAZ9rWxqv91kJBV0c";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('products_cache')
    .select('codigo_amigavel, is_variante, produto_pai, codigo_prefixo')
    .ilike('codigo_amigavel', '%18645L%')
    .limit(10);

  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

run();
