'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import Link from 'next/link';
import MediaUpload from '@/app/components/features/media/MediaUpload';

// Memory date interface for flexible date input
interface MemoryDate {
  type: 'exact' | 'month' | 'year' | 'age' | 'period';
  value: string;
  description?: string; // For age ("when I was 12") or period ("summer of 2010")
}

export default function NewMemoryPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memoryDate, setMemoryDate] = useState<MemoryDate>({ type: 'exact', value: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryId, setMemoryId] = useState<number | null>(null);
  const supabase = createClient();

  // Render different input types based on date type
  const renderDateInput = () => {
    switch (memoryDate.type) {
      case 'exact':
        return (
          <input
            type="date"
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        );
      case 'month':
        return (
          <input
            type="month"
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        );
      case 'year':
        return (
          <input
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            placeholder="e.g., 2020"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        );
      case 'age':
        return (
          <div className="space-y-2">
            <input
              type="number"
              min="1"
              max="120"
              value={memoryDate.value}
              onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
              placeholder="e.g., 12"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              value={memoryDate.description || ''}
              onChange={(e) => setMemoryDate({ ...memoryDate, description: e.target.value })}
              placeholder="e.g., when I was 12 years old"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        );
      case 'period':
        return (
          <input
            type="text"
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            placeholder="e.g., summer of 2010, during college, early 2000s"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        );
      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication error. Please try logging in again.');
      }

      if (!session) {
        console.error('No session found');
        throw new Error('Please log in to create a memory');
      }

      // Format date based on type
      let formattedDate: string;
      switch (memoryDate.type) {
        case 'exact':
          formattedDate = memoryDate.value;
          break;
        case 'month':
          formattedDate = `${memoryDate.value}-01`; // Use first day of month
          break;
        case 'year':
          formattedDate = `${memoryDate.value}-01-01`; // Use January 1st of year
          break;
        case 'age':
        case 'period':
          formattedDate = memoryDate.description || memoryDate.value;
          break;
        default:
          formattedDate = memoryDate.value;
      }

      const response = await fetch('http://localhost:8000/api/memories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          content,
          date: formattedDate || undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Error response:', data);
        throw new Error(data.detail || 'Failed to create memory');
      }

      const data = await response.json();
      setMemoryId(data.id);
      router.push(`/memories/${data.id}`);
    } catch (err) {
      console.error('Error creating memory:', err);
      setError(err instanceof Error ? err.message : 'Failed to create memory. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h1 className="text-3xl font-bold mb-6">Create New Memory</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              When did this happen?
            </label>
            <div className="space-y-2">
              <select
                value={memoryDate.type}
                onChange={(e) => setMemoryDate({ type: e.target.value as MemoryDate['type'], value: '', description: '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="exact">Exact Date</option>
                <option value="month">Month and Year</option>
                <option value="year">Year Only</option>
                <option value="age">Age (e.g., when I was 12)</option>
                <option value="period">Time Period (e.g., summer of 2010)</option>
              </select>
              {renderDateInput()}
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !memoryDate.value}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </div>
              ) : (
                'Create Memory'
              )}
            </button>
          </div>
        </form>

        {/* Media Upload (only shown after memory is created) */}
        {memoryId && (
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Add Media</h2>
            <MediaUpload memoryId={memoryId} onUploadComplete={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
} 