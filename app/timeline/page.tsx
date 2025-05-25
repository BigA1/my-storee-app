'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import Link from 'next/link';
import SearchBar from '@/app/components/features/search/SearchBar';

interface Story {
  id: number;
  title: string;
  content: string;
  date: string;
  created_at: string;
  media_attachments?: Array<{
    id: number;
    media_type: string;
    label: string | null;
  }>;
}

export default function TimelinePage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchStories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw new Error('Authentication error');
      if (!session) throw new Error('Please log in to view stories');

      const response = await fetch('http://localhost:8000/api/stories/', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to fetch stories');
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
    fetchStories();
  }, []);

  const handleSearch = (results: Story[]) => {
    setStories(results);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 bg-red-900/50 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 text-white">Timeline</h1>
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="grid gap-6">
        {stories.map((story) => (
          <Link 
            href={`/timeline/${story.id}`} 
            key={story.id}
            className="block p-6 bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-700"
          >
            <h2 className="text-xl font-semibold mb-2 text-white">{story.title}</h2>
            <p className="text-gray-300 mb-4">{story.content}</p>
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>{new Date(story.date).toLocaleDateString()}</span>
              {story.media_attachments && story.media_attachments.length > 0 && (
                <span>{story.media_attachments.length} media items</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {stories.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No stories found. Try adjusting your search or create a new story.
        </div>
      )}
    </div>
  );
} 