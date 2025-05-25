'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/app/lib/supabase/client';

interface MediaUploadProps {
  storyId: number;
  onUploadComplete: () => void;
}

export default function MediaUpload({ storyId, onUploadComplete }: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      // Get session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication error. Please try logging in again.');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('story_id', storyId.toString());
      formData.append('media_type', file.type.startsWith('image/') ? 'image' : 'audio');

      // Upload to backend
      const response = await fetch('http://localhost:8000/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to upload media');
      }

      onUploadComplete();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading media:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload media');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,audio/*"
          disabled={isUploading}
          className="hidden"
          id="media-upload"
        />
        <label
          htmlFor="media-upload"
          className={`px-4 py-2 rounded-md cursor-pointer ${
            isUploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          {isUploading ? 'Uploading...' : 'Upload Media'}
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Supported formats: Images (JPG, PNG) and Audio (MP3, WAV)
        </span>
      </div>

      {isUploading && uploadProgress > 0 && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
} 