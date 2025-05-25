'use client'

import { useState, useEffect } from 'react'
import { Database } from '../../types/supabase'
import SpeechDialog from '../components/features/speech/SpeechDialog'
import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'

type Story = Database['public']['Tables']['stories']['Row']

export default function Timeline() {
  const [isSpeechDialogOpen, setIsSpeechDialogOpen] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchStories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/stories`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
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
      setError(err instanceof Error ? err.message : 'Failed to fetch stories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchStories();
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
        <p>{error}</p>
        <button 
          onClick={fetchStories}
          className="mt-2 px-4 py-2 bg-red-100 dark:bg-red-800/30 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Timeline</h1>
        <button
          onClick={() => setIsSpeechDialogOpen(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Record Memory
        </button>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No memories yet. Start recording your first memory!</p>
          <button
            onClick={() => setIsSpeechDialogOpen(true)}
            className="inline-block px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Record Memory
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {stories.map((story) => (
            <Link
              key={story.id}
              href={`/timeline/${story.id}`}
              className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-24 text-center">
                  <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    {new Date(story.date).toLocaleDateString('en-US', { 
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(story.date).toLocaleDateString('en-US', { 
                      year: 'numeric'
                    })}
                  </div>
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold mb-2">{story.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 line-clamp-2">
                    {story.content}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <SpeechDialog
        isOpen={isSpeechDialogOpen}
        onClose={() => setIsSpeechDialogOpen(false)}
      />
    </div>
  );
} 