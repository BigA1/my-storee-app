'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import Link from 'next/link';
import MediaUpload from '@/app/components/features/media/MediaUpload';
import MediaDisplay from '@/app/components/features/media/MediaDisplay';

interface Story {
  id: number;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  date?: string;
}

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchStory();
  }, [id]);

  const fetchStory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication error. Please try logging in again.');
      }

      if (!session) {
        console.error('No session found');
        throw new Error('Please log in to view this story');
      }

      const response = await fetch(`http://localhost:8000/api/stories/${id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Error response:', data);
        throw new Error(data.detail || 'Failed to fetch story');
      }

      const data = await response.json();
      setStory(data);
      setIsOwner(data.user_id === session.user.id);
    } catch (err) {
      console.error('Error fetching story:', err);
      setError(err instanceof Error ? err.message : 'Failed to load story. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaUpload = () => {
    fetchStory();
  };

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
        <div className="mt-4 flex gap-4">
          <button 
            onClick={fetchStory}
            className="px-4 py-2 bg-red-100 dark:bg-red-800/30 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/stories"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800/30 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors"
          >
            Back to Stories
          </Link>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Story not found</p>
        <Link
          href="/stories"
          className="inline-block px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Back to Stories
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/stories"
          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          ← Back to Stories
        </Link>
      </div>
      
      <article className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-4">{story.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {new Date(story.created_at).toLocaleDateString()}
        </p>
        
        {/* Media Display */}
        <div className="mb-6">
          <MediaDisplay storyId={story.id} />
        </div>
        
        {/* Media Upload (only for story owner) */}
        {isOwner && (
          <div className="mb-6">
            <MediaUpload storyId={story.id} onUploadComplete={handleMediaUpload} />
          </div>
        )}
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{story.content}</p>
        </div>
      </article>
    </div>
  );
} 