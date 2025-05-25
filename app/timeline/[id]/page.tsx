'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import SpeechRecorderForm from '@/app/components/features/speech/SpeechRecorderForm';
import MediaDisplay from '@/app/components/features/media/MediaDisplay';

interface Story {
  id: number;
  title: string;
  content: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const response = await fetch(`http://localhost:8000/api/stories/${id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch story');
        }

        const data = await response.json();
        setStory(data);
      } catch (err) {
        console.error('Error fetching story:', err);
        setError(err instanceof Error ? err.message : 'Failed to load story');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStory();
  }, [id, router, supabase.auth]);

  const handleSave = async (data: { title: string; content: string; date: Date }) => {
    if (!story) return;

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`http://localhost:8000/api/stories/${story.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          date: data.date.toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update story');
      }

      const updatedStory = await response.json();
      setStory(updatedStory);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating story:', err);
      setError(err instanceof Error ? err.message : 'Failed to update story');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!story) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {isEditing ? (
        <SpeechRecorderForm
          initialTitle={story.title}
          initialContent={story.content}
          initialDate={new Date(story.date)}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          isSaving={isSaving}
          storyId={story.id}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{story.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {new Date(story.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              Edit Story
            </button>
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{story.content}</p>
          </div>
          <MediaDisplay storyId={story.id} />
        </div>
      )}
    </div>
  );
} 