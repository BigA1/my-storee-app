'use client';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';

interface MediaUploadProps {
  storyId: number;
  onUploadComplete: () => void;
}

export default function MediaUpload({ storyId, onUploadComplete }: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw new Error('Authentication error');
      if (!session) throw new Error('Please log in to upload media');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`http://localhost:8000/api/media/upload/${storyId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Upload failed');
      }

      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <label className="block">
        <span className="sr-only">Choose media file</span>
        <input
          type="file"
          accept="image/*,audio/*"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-purple-50 file:text-purple-700
            hover:file:bg-purple-100
            dark:file:bg-purple-900/20 dark:file:text-purple-400
            dark:hover:file:bg-purple-900/30"
        />
      </label>
      
      {isUploading && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Uploading...
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-sm text-red-500 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
} 