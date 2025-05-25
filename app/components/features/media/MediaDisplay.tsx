'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/lib/supabase/client';

interface Media {
  id: number;
  story_id: number;
  media_type: 'image' | 'audio';
  file_path: string;
  created_at: string;
  url?: string;
  urlExpiry?: number;  // Add expiry timestamp
  label?: string | null;  // Add label field
}

interface MediaDisplayProps {
  storyId: number;
}

export default function MediaDisplay({ storyId }: MediaDisplayProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const supabase = createClient();

  // Function to get a signed URL for a media item
  const getSignedUrl = useCallback(async (item: Media): Promise<Media> => {
    if (!session) return item;

    try {
      const urlResponse = await fetch(`http://localhost:8000/api/media/${item.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!urlResponse.ok) {
        throw new Error('Failed to get media URL');
      }
      
      const { url } = await urlResponse.json();
      // Set expiry to 50 minutes (giving 10-minute buffer before the 1-hour expiry)
      const expiry = Date.now() + (50 * 60 * 1000);
      return { ...item, url, urlExpiry: expiry };
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return item;
    }
  }, [session]);

  // Function to refresh URLs that are about to expire
  const refreshExpiredUrls = useCallback(async () => {
    const now = Date.now();
    const needsRefresh = media.some(item => 
      item.urlExpiry && item.urlExpiry - now < 5 * 60 * 1000 // Refresh if less than 5 minutes until expiry
    );

    if (needsRefresh) {
      const updatedMedia = await Promise.all(
        media.map(async (item) => {
          if (item.urlExpiry && item.urlExpiry - now < 5 * 60 * 1000) {
            return getSignedUrl(item);
          }
          return item;
        })
      );
      setMedia(updatedMedia);
    }
  }, [media, getSignedUrl]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  useEffect(() => {
    const fetchMedia = async () => {
      if (!session) return;

      try {
        const response = await fetch(`http://localhost:8000/api/stories/${storyId}/media`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch media');
        }

        const data = await response.json();
        
        // Get signed URLs for each media item
        const mediaWithUrls = await Promise.all(
          data.map(getSignedUrl)
        );
        
        setMedia(mediaWithUrls);
      } catch (err) {
        console.error('Error fetching media:', err);
        setError(err instanceof Error ? err.message : 'Failed to load media');
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchMedia();
    }
  }, [storyId, session, getSignedUrl]);

  // Set up periodic URL refresh
  useEffect(() => {
    const refreshInterval = setInterval(refreshExpiredUrls, 60 * 1000); // Check every minute
    return () => clearInterval(refreshInterval);
  }, [refreshExpiredUrls]);

  const handleEditLabel = (item: Media) => {
    setEditingLabel(item.id);
    setNewLabel(item.label || '');
  };

  const handleSaveLabel = async (item: Media) => {
    if (!session) return;

    try {
      const response = await fetch(`http://localhost:8000/api/media/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ label: newLabel.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to update label');
      }

      // Update the media item in the state
      setMedia(prev => prev.map(m => 
        m.id === item.id ? { ...m, label: newLabel.trim() } : m
      ));
      setEditingLabel(null);
    } catch (err) {
      console.error('Error updating label:', err);
      setError(err instanceof Error ? err.message : 'Failed to update label');
    }
  };

  const handleCancelEdit = () => {
    setEditingLabel(null);
    setNewLabel('');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
        {error}
      </div>
    );
  }

  if (media.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Media Attachments</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {media.map((item) => (
          <div key={item.id} className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {item.media_type === 'image' ? (
              <div>
                <div className="relative">
                  <img
                    src={item.url}
                    alt={item.label || "Story attachment"}
                    className="w-auto h-auto max-w-full max-h-[500px] object-contain rounded-t-lg"
                    crossOrigin="anonymous"
                    onError={async () => {
                      // If image fails to load, try to refresh the URL
                      const updatedItem = await getSignedUrl(item);
                      setMedia(prev => prev.map(m => 
                        m.id === item.id ? updatedItem : m
                      ));
                    }}
                  />
                </div>
                <div className="p-2">
                  {editingLabel === item.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Enter label"
                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                      />
                      <button
                        onClick={() => handleSaveLabel(item)}
                        className="px-2 py-1 text-sm text-white bg-purple-600 rounded hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 text-sm text-gray-600 bg-gray-200 rounded hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.label || 'No label'}
                      </span>
                      <button
                        onClick={() => handleEditLabel(item)}
                        className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <audio
                  controls
                  className="w-full"
                  src={item.url}
                  crossOrigin="anonymous"
                  onError={async () => {
                    // If audio fails to load, try to refresh the URL
                    const updatedItem = await getSignedUrl(item);
                    setMedia(prev => prev.map(m => 
                      m.id === item.id ? updatedItem : m
                    ));
                  }}
                >
                  Your browser does not support the audio element.
                </audio>
                <div className="mt-2">
                  {editingLabel === item.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Enter label"
                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                      />
                      <button
                        onClick={() => handleSaveLabel(item)}
                        className="px-2 py-1 text-sm text-white bg-purple-600 rounded hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 text-sm text-gray-600 bg-gray-200 rounded hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.label || 'No label'}
                      </span>
                      <button
                        onClick={() => handleEditLabel(item)}
                        className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 