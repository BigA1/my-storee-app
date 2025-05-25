import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Database } from '../../types/supabase';

type Story = Database['public']['Tables']['stories']['Row']

export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const fetchStories = async () => {
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
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/stories`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch stories');
      }

      const data = await response.json();
      setStories(data);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch stories'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  return { stories, isLoading, error, refetch: fetchStories };
} 