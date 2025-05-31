'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import Link from 'next/link';
import { format } from 'date-fns';

interface Memory {
  id: number;
  title: string;
  content: string;
  date: string;
  created_at: string;
  updated_at: string;
  media_attachments?: Array<{
    id: number;
    url: string;
    media_type: string;
    label?: string;
  }>;
}

export default function MemoryPage({ params }: { params: { id: string } }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          throw new Error('Please log in to view this memory');
        }

        const response = await fetch(`http://localhost:8000/api/memories/${params.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Memory not found');
          }
          const data = await response.json();
          throw new Error(data.detail || 'Failed to fetch memory');
        }

        const data = await response.json();
        setMemory(data);
      } catch (err) {
        console.error('Error fetching memory:', err);
        setError(err instanceof Error ? err.message : 'Failed to load memory');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemory();
  }, [params.id, supabase]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/memories"
            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            ← Back to Memories
          </Link>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/memories"
            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            ← Back to Memories
          </Link>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 p-4 rounded-lg">
          Memory not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/memories"
          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          ← Back to Memories
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-2">{memory.title}</h1>
        
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <p>Created on {format(new Date(memory.created_at), 'MMMM d, yyyy')}</p>
          <p>Last updated on {format(new Date(memory.updated_at), 'MMMM d, yyyy')}</p>
          <p>Memory date: {format(new Date(memory.date), 'MMMM d, yyyy')}</p>
        </div>

        <div className="prose dark:prose-invert max-w-none mb-8">
          {memory.content.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {memory.media_attachments && memory.media_attachments.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Media</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memory.media_attachments.map((media) => (
                <div key={media.id} className="relative">
                  {media.media_type === 'image' ? (
                    <img
                      src={media.url}
                      alt={media.label || 'Memory image'}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : media.media_type === 'audio' ? (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <audio controls className="w-full" src={media.url}>
                        Your browser does not support the audio element.
                      </audio>
                      {media.label && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{media.label}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 