'use client';

import { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SpeechRecorderFormProps {
  initialTitle?: string;
  initialContent?: string;
  initialDate?: Date;
  onSave: (data: { title: string; content: string; date: Date }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  storyId?: number;
}

export default function SpeechRecorderForm({
  initialTitle = '',
  initialContent = '',
  initialDate = new Date(),
  onSave,
  onCancel,
  isSaving,
  storyId
}: SpeechRecorderFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [transcript, setTranscript] = useState(initialContent);
  const [memoryDate, setMemoryDate] = useState<Date>(initialDate);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAudio, setSaveAudio] = useState(false);
  const [audioLabel, setAudioLabel] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    content?: string;
    date?: string;
  }>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Initialize audio chunks
    audioChunksRef.current = [];
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'  // Use webm format for better compatibility
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Request data every second
      mediaRecorder.start(1000);
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Request final data before stopping
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);

      // Create audio preview URL
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      transcribeAudio();
    }
  };

  const transcribeAudio = async () => {
    try {
      setIsTranscribing(true);
      setError(null);

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('Audio blob size:', audioBlob.size);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      console.log('Sending transcription request...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      console.log('Transcription response:', data);
      setTranscript(prev => prev + ' ' + data.text);
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const saveAudioAsMedia = async (audioBlob: Blob) => {
    if (!storyId) return;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication error');
      }

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('story_id', storyId.toString());
      formData.append('media_type', 'audio');
      if (audioLabel.trim()) {
        formData.append('label', audioLabel.trim());
      }

      const response = await fetch('http://localhost:8000/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to upload audio');
      }
    } catch (err) {
      console.error('Error saving audio:', err);
      // Don't throw error here, just log it
    }
  };

  const validateForm = () => {
    const errors: { title?: string; content?: string; date?: string } = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }
    
    if (!transcript.trim()) {
      errors.content = 'Content is required';
    } else if (transcript.length > 10000) {
      errors.content = 'Story content must be less than 10,000 characters';
    }

    if (!memoryDate) {
      errors.date = 'Date is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      // Save the story first
      await onSave({ title, content: transcript, date: memoryDate });

      // Then save the audio if enabled and we have a storyId
      if (saveAudio && storyId && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await saveAudioAsMedia(audioBlob);
      }
    } catch (err) {
      console.error('Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    }
  };

  // Clean up audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
            validationErrors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {validationErrors.title && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.title}</p>
        )}
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date
        </label>
        <DatePicker
          id="date"
          selected={memoryDate}
          onChange={(date: Date | null) => date && setMemoryDate(date)}
          dateFormat="MMMM d, yyyy"
          className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
            validationErrors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
          showYearDropdown
          scrollableYearDropdown
          yearDropdownItemNumber={100}
          maxDate={new Date()}
        />
        {validationErrors.date && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.date}</p>
        )}
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Content
        </label>
        <div className="space-y-2">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-4 py-2 rounded-md ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white transition-colors`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            {isTranscribing && (
              <div className="flex items-center gap-2 text-purple-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                Transcribing...
              </div>
            )}
          </div>

          {/* Audio Label and Preview Section */}
          {audioUrl && (
            <div className="space-y-4">
              {storyId && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveAudio"
                      checked={saveAudio}
                      onChange={(e) => setSaveAudio(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="saveAudio" className="text-sm text-gray-600 dark:text-gray-400">
                      Save audio recording
                    </label>
                  </div>
                  {saveAudio && (
                    <>
                      <div>
                        <label htmlFor="audio-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Audio Label (optional)
                        </label>
                        <input
                          type="text"
                          id="audio-label"
                          value={audioLabel}
                          onChange={(e) => setAudioLabel(e.target.value)}
                          placeholder="Add a label for this recording"
                          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                        />
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Audio Preview</h3>
                        <audio controls className="w-full" src={audioUrl}>
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <textarea
            id="content"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            required
            rows={10}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
              validationErrors.content ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {validationErrors.content && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.content}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-4">
        {storyId && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </div>
          ) : (
            'Save Story'
          )}
        </button>
      </div>
    </form>
  );
} 