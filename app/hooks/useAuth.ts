import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    console.log('useAuth: Initializing auth state');
    
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('useAuth: Initial session check:', { 
        hasSession: !!session, 
        error: error ? error.message : null 
      });
      
      setIsAuthenticated(!!session);
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('useAuth: Auth state changed:', { 
        event, 
        hasSession: !!session 
      });
      
      setIsAuthenticated(!!session);
      setSession(session);
    });

    return () => {
      console.log('useAuth: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('useAuth: Signing out');
    await supabase.auth.signOut();
    router.push('/login');
  };

  return { 
    isAuthenticated, 
    isLoading, 
    session,
    signOut,
    supabase 
  };
} 