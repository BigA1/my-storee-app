'use client'

import { Database } from '../../types/supabase'

type Story = Database['public']['Tables']['stories']['Row']

interface TimelineProps {
  initialStories: Story[]
}

export default function Timeline({ initialStories }: TimelineProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Timeline</h1>
      <div className="space-y-6">
        {initialStories.map((story) => (
          <div key={story.id} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-2">{story.title}</h2>
            <p className="text-gray-600">{story.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
} 