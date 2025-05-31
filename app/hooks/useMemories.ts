import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Database } from '../../types/supabase';

type Memory = Database['public']['Tables']['memories']['Row']

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Authentication error');
      }

      if (!session) {
        router.push('/login');
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/memories`;
      
      console.log('Fetching memories from:', apiUrl);
      console.log('Using session token:', session.access_token);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.detail || 'Failed to fetch memories');
      }

      const data = await response.json();
      console.log('Received memories:', data);
      setMemories(data);
    } catch (err) {
      console.error('Error fetching memories:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch memories'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  return { memories, isLoading, error, refetch: fetchMemories };
} 