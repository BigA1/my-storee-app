import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof window === 'undefined') {
            return undefined;
          }
          const cookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
          return cookie ? cookie.split('=')[1] : undefined
        },
        set(name: string, value: string, options: { path?: string; maxAge?: number }) {
          if (typeof window === 'undefined') {
            return;
          }
          document.cookie = `${name}=${value}; path=${options.path || '/'}; max-age=${options.maxAge || 3600}`
        },
        remove(name: string, options: { path?: string }) {
          if (typeof window === 'undefined') {
            return;
          }
          document.cookie = `${name}=; path=${options.path || '/'}; max-age=0`
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-auth-token',
      }
    }
  )
}