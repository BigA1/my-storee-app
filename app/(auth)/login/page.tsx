'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get('redirectedFrom');
  const supabase = createClient();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Login page: Session check:', { hasSession: !!session, error: sessionError });
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          return;
        }

        if (session) {
          console.log('Login page: User already logged in, redirecting');
          router.push(redirectedFrom || '/');
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    };
    checkSession();
  }, [router, redirectedFrom, supabase.auth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Login page: Attempting login');
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });

      if (error) {
        console.error('Login error:', error);
        setError(error.message);
      } else if (data.session) {
        console.log('Login page: Login successful, redirecting');
        router.push(redirectedFrom || '/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 border rounded font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      {redirectedFrom && (
        <p className="text-sm text-gray-600 mb-4">
          Please log in to access this page
        </p>
      )}
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded text-gray-900"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        <input
          type="password"
          placeholder="Password"
          className="border p-2 rounded text-gray-900"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="bg-purple-600 text-white rounded p-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
      
      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link href="/signup" className="text-purple-600 hover:text-purple-500">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
