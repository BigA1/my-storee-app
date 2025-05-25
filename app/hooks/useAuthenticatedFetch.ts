import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../lib/supabase-client';

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

interface PostgRESTError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

export function useAuthenticatedFetch() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const supabase = getSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      if (!mounted) return;
      
      console.log('Checking session...');
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Session check result:', { hasSession: !!session, error: sessionError });
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }

        if (mounted) {
          setHasSession(!!session);
          setIsInitialized(true);
          setIsLoading(false);
          console.log('Auth initialized successfully', { hasSession: !!session });
        }
      } catch (err) {
        console.error('Session check error:', err);
        if (mounted) {
          setIsInitialized(true);
          setIsLoading(false);
          setHasSession(false);
        }
      }
    };

    // Initial session check
    checkSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', { event, hasSession: !!session });
      if (mounted) {
        setHasSession(!!session);
        setIsInitialized(true);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
    console.log('Fetching with auth:', { 
      url, 
      isInitialized, 
      hasSession,
      options: {
        method: options.method || 'GET',
        headers: options.headers
      }
    });
    
    if (!isInitialized) {
      console.log('Waiting for auth initialization...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!isInitialized) {
        throw new Error('Auth initialization timeout');
      }
    }

    if (!hasSession) {
      console.log('No session found');
      throw new Error('Please log in to continue');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get session');
      }

      if (!session) {
        throw new Error('Please log in to continue');
      }

      console.log('Making authenticated request with token:', {
        url,
        token: session.access_token ? 'present' : 'missing'
      });

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (response.status === 401 || response.status === 403) {
        console.log('Token expired, attempting to refresh...');
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error('Failed to refresh session:', refreshError);
          throw new Error('Session expired. Please log in again.');
        }

        console.log('Retrying request with new token');
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newSession.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          console.error('Retry request failed:', errorData);
          throw new Error(JSON.stringify(errorData));
        }

        return retryResponse;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Request failed:', errorData);
        throw new Error(JSON.stringify(errorData));
      }

      return response;
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err : new Error('An error occurred'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchWithAuth, isLoading, error, isInitialized, hasSession };
} 