import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SiteContentRow {
  id: string;
  type: string;
  label: string | null;
  section: string | null;
  value: string | null;
  width_desk: number | null;
  height_desk: number | null;
  width_mob: number | null;
  height_mob: number | null;
  updated_at: string | null;
}

export function useSiteContent(section?: string) {
  const [rows, setRows] = useState<SiteContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    let query = supabase.from('site_content').select('*');
    if (section) query = query.eq('section', section);
    const { data } = await query;
    setRows((data as SiteContentRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [section]);

  const updateValue = async (id: string, value: string) => {
    await supabase
      .from('site_content')
      .update({ value, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
  };

  const upsertValue = async (id: string, value: string, section?: string) => {
    await supabase
      .from('site_content')
      .upsert({
        id,
        value,
        type: 'image',
        section: section || null,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'id' });
  };

  const uploadImage = async (id: string, file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `banners/${id}.${ext}`;

    // Remove old file if exists
    await supabase.storage.from('site-images').remove([path]);

    const { error } = await supabase.storage
      .from('site-images')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('site-images')
      .getPublicUrl(path);

    return urlData.publicUrl + '?t=' + Date.now();
  };

  return { rows, loading, refetch: fetch, updateValue, uploadImage };
}
