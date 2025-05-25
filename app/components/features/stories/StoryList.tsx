'use client';

import Link from 'next/link';
import { useStories } from '@/app/hooks/useStories';

export default function StoryList() {
  const { stories, isLoading, error, refetch } = useStories();

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
        <p>{error?.message || 'An error occurred'}</p>
        <button 
          onClick={refetch}
          className="mt-2 px-4 py-2 bg-red-100 dark:bg-red-800/30 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 mb-4">No memories yet. Start recording your first memory!</p>
        <Link
          href="/speech"
          className="inline-block px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Record Memory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {stories.map((story) => (
        <Link
          key={story.id}
          href={`/stories/${story.id}`}
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
  );
} 