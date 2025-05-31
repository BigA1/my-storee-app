'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabase-client'
import { Database } from '../../types/supabase'

type Memory = Database['public']['Tables']['memories']['Row']

interface MemoryCardProps {
  memory: Memory
  onUpdate?: () => void
}

export default function MemoryCard({ memory, onUpdate }: MemoryCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(memory.title)
  const [content, setContent] = useState(memory.content)
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = getSupabaseClient()

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('memories')
      .update({ title, content })
      .eq('id', memory.id)

    if (error) {
      console.error('Error updating memory:', error)
      return
    }

    setIsEditing(false)
    onUpdate?.()
  }

  const handleDelete = async () => {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memory.id)

    if (error) {
      console.error('Error deleting memory:', error)
      return
    }

    onUpdate?.()
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {isEditing ? (
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2 border rounded h-32"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-2">{memory.title}</h2>
          <p className="text-gray-600 mb-4">{memory.content}</p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-blue-500 hover:text-blue-600"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 