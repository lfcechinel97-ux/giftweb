import type { SiteContentRow } from "@/contexts/SiteContentContext";

const DEFAULT_VERSION = "1";

export function getSiteContentVersionToken(updatedAt?: string | null, fallback = DEFAULT_VERSION) {
  if (!updatedAt) return fallback;
  const normalized = updatedAt.replace(/\D/g, "");
  return normalized || fallback;
}

export function buildVersionedCmsUrl(url?: string | null, updatedAt?: string | null, fallback = DEFAULT_VERSION) {
  if (!url) return null;
  if (url.startsWith("blob:")) return url;

  const token = getSiteContentVersionToken(updatedAt, fallback);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${token}`;
}

export function getVersionedRowValue(row?: Pick<SiteContentRow, "value" | "updated_at"> | null, fallback = DEFAULT_VERSION) {
  return buildVersionedCmsUrl(row?.value, row?.updated_at, fallback);
}