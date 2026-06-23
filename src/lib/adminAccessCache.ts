const ADMIN_CACHE_TTL = 30 * 60 * 1000;

let adminAccessCache: { userId: string; expiresAt: number } | null = null;

export const hasFreshAdminAccess = (userId: string) =>
  adminAccessCache?.userId === userId && adminAccessCache.expiresAt > Date.now();

export const rememberAdminAccess = (userId: string) => {
  adminAccessCache = { userId, expiresAt: Date.now() + ADMIN_CACHE_TTL };
};

export const clearAdminAccess = () => {
  adminAccessCache = null;
};