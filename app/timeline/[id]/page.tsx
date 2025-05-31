'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import SpeechRecorderForm from '@/app/components/features/speech/SpeechRecorderForm';
import MediaDisplay from '@/app/components/features/media/MediaDisplay';

interface Memory {
  id: string;
  title: string;
  content: string;
  date: string;
  user_id: string;
  created_at: string;
}

export default function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMemory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`http://localhost:8000/api/memories/${id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch memory');
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

  useEffect(() => {
    fetchMemory();
  }, [id]);

  const handleUpdate = async (data: { title: string; content: string; date: Date }) => {
    if (!memory) return;

    try {
      setIsSaving(true);
      setError(null);

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`http://localhost:8000/api/memories/${memory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          date: data.date.toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update memory');
      }

      const updatedMemory = await response.json();
      setMemory(updatedMemory);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating memory:', err);
      setError(err instanceof Error ? err.message : 'Failed to update memory');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
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

  if (!memory) {
    return (
      <div className="p-4 text-gray-400 bg-gray-900/50 rounded-lg">
        Memory not found
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {isEditing ? (
        <SpeechRecorderForm
          initialTitle={memory.title}
          initialContent={memory.content}
          initialDate={new Date(memory.date)}
          onSave={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isSaving={isSaving}
          memoryId={parseInt(memory.id, 10)}
        />
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{memory.title}</h1>
            <div className="text-gray-500 dark:text-gray-400 mt-2">
              {new Date(memory.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{memory.content}</p>
          </div>

          <MediaDisplay memoryId={parseInt(memory.id, 10)} />
        </div>
      )}
    </div>
  );
} 