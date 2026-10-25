'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, setCsrf } from '../lib/api.ts';
import type { User } from '../lib/api.ts';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const r = await api<{ user: User; csrfToken: string }>('/auth/me'); setCsrf(r.csrfToken); setUser(r.user); }
    catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { user, loading, refresh, setUser };
}
