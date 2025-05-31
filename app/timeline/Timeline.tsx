'use client'

import { useState } from 'react'
import { Database } from '../../types/supabase'
import SpeechDialog from '../components/features/speech/SpeechDialog'
import Link from 'next/link'

type Memory = Database['public']['Tables']['memories']['Row']

interface TimelineProps {
  memories: Memory[];
}

export default function Timeline({ memories }: TimelineProps) {
  const [isSpeechDialogOpen, setIsSpeechDialogOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Timeline</h1>
        <button
          onClick={() => setIsSpeechDialogOpen(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Record Memory
        </button>
      </div>

      {memories.length === 0 ? (
        <div className="text-center text-gray-500">
          <p className="text-xl mb-4">No memories yet</p>
          <p>Start by adding your first memory!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memories.map((memory) => (
            <Link
              key={memory.id}
              href={`/timeline/${memory.id}`}
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
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {new Date(memory.date).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
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