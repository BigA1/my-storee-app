'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import Link from 'next/link';
import { format } from 'date-fns';
import SearchBar from '../components/features/search/SearchBar';
import { useMemories } from '../hooks/useMemories';
import { Database } from '@/types/supabase';
import SpeechDialog from '../components/features/speech/SpeechDialog';

type Memory = Database['public']['Tables']['memories']['Row'] & {
  updated_at: string;
  media_attachments?: Array<{
    id: number;
    url: string;
    media_type: string;
    label?: string;
  }>;
};

export default function MemoriesPage() {
  const [isSpeechDialogOpen, setIsSpeechDialogOpen] = useState(false);
  const { memories, isLoading, error: memoriesError, refetch } = useMemories();
  const searchParams = useSearchParams();
  const memoryId = searchParams.get('id');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const supabase = createClient();

  const handleSearch = (results: Memory[]) => {
    setSearchResults(results);
  };

  // Fetch individual memory when ID is provided
  useEffect(() => {
    const fetchMemory = async () => {
      if (!memoryId) {
        setSelectedMemory(null);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          throw new Error('Please log in to view this memory');
        }

        const response = await fetch(`http://localhost:8000/api/memories/${memoryId}`, {
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
        setSelectedMemory(data);
      } catch (err) {
        console.error('Error fetching memory:', err);
        setError(err instanceof Error ? err.message : 'Failed to load memory');
      }
    };

    fetchMemory();
  }, [memoryId, supabase]);

  if (error || memoriesError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error || memoriesError?.message}
        </div>
      </div>
    );
  }

  if (selectedMemory) {
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
          <h1 className="text-3xl font-bold mb-2">{selectedMemory.title}</h1>
          
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            <p>Created on {format(new Date(selectedMemory.created_at), 'MMMM d, yyyy')}</p>
            <p>Last updated on {format(new Date(selectedMemory.updated_at), 'MMMM d, yyyy')}</p>
            <p>Memory date: {format(new Date(selectedMemory.date), 'MMMM d, yyyy')}</p>
          </div>

          <div className="prose dark:prose-invert max-w-none mb-8">
            {selectedMemory.content.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {selectedMemory.media_attachments && selectedMemory.media_attachments.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Media</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedMemory.media_attachments.map((media) => (
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

  // Show memories list if no memory is selected
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Memories</h1>
        <button
          onClick={() => setIsSpeechDialogOpen(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Record Memory
        </button>
      </div>

      <SearchBar onSearch={handleSearch} />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : searchResults ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Search Results</h2>
            <button
              onClick={() => setSearchResults(null)}
              className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            >
              Clear Search
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div className="text-center text-gray-500">
              <p className="text-xl mb-4">No memories found</p>
              <p>Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((memory) => (
                <Link
                  key={memory.id}
                  href={`/memories?id=${memory.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="p-6">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {new Date(memory.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{memory.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {memory.content}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center text-gray-500">
          <p className="text-xl mb-4">No memories yet</p>
          <p>Start by adding your first memory!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memories.map((memory) => (
            <Link
              key={memory.id}
              href={`/memories?id=${memory.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {new Date(memory.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <h3 className="text-lg font-semibold mb-2">{memory.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {memory.content}
                </p>
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