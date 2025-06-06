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
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch memories');
      }

      const data = await response.json();
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