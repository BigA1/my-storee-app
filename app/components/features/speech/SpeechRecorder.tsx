'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useRouter } from 'next/navigation';

interface SpeechRecorderProps {
  onClose: () => void;
}

export default function SpeechRecorder({ onClose }: SpeechRecorderProps) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [memoryDate, setMemoryDate] = useState(new Date());
  const [showPreview, setShowPreview] = useState(false);
  const [saveAudio, setSaveAudio] = useState(false);
  const [audioLabel, setAudioLabel] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    content?: string;
    date?: string;
  }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    return () => {
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'  // Use webm format for better compatibility
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Request data every second
      mediaRecorder.start(1000);
      setIsListening(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please ensure you have granted microphone permissions.');
      setIsListening(false);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Request final data before stopping
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsListening(false);

    // Only check for audio chunks if we were actually recording
    if (isListening && audioChunksRef.current.length > 0) {
      console.log('Audio chunks collected:', audioChunksRef.current.length);
      
      // Create audio preview URL
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Check if the audio is too small (less than 1KB)
      if (audioBlob.size < 1024) {
        setError('No speech detected. Please try recording again.');
        return;
      }

      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      await transcribeAudio();
    } else if (isListening) {
      console.log('No audio chunks collected');
      setError('No audio data was recorded. Please try again.');
    }
  };

  const transcribeAudio = async () => {
    try {
      setIsTranscribing(true);
      setError(null);

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('Audio blob size:', audioBlob.size);
      
      // Double check size before sending
      if (audioBlob.size < 1024) {
        setError('No speech detected. Please try recording again.');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      // Get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication error. Please try logging in again.');
      }

      console.log('Sending transcription request...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('Transcription response:', data);
      
      // Check if the response is our "no speech" message
      if (data.text === "No speech detected. Please try recording again.") {
        setError(data.text);
        return;
      }
      
      setTranscript(prev => prev + ' ' + data.text);
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const validateMemory = () => {
    const errors: { [key: string]: string } = {};

    if (!title.trim()) {
      errors.title = 'Title is required';
    }

    if (!transcript.trim()) {
      errors.content = 'Content is required';
    } else if (transcript.length > 10000) {
      errors.content = 'Memory content must be less than 10,000 characters';
    }

    if (!memoryDate) {
      errors.date = 'Date is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveAudioAsMedia = async (audioBlob: Blob, memoryId: number) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication error');
      }

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('memory_id', memoryId.toString());
      formData.append('media_type', 'audio');
      formData.append('label', 'Voice Recording');

      const response = await fetch('http://localhost:8000/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to save audio');
      }
    } catch (error) {
      console.error('Error saving audio:', error);
      throw error;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    
    if (!validateMemory()) return;

    try {
      setIsSaving(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication error. Please try logging in again.');
      }

      if (!session) {
        console.error('No session found');
        throw new Error('Please log in to save your memory');
      }

      const response = await fetch('http://localhost:8000/api/memories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          content: transcript,
          date: memoryDate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save memory');
      }

      const data = await response.json();

      // Save audio if enabled
      if (saveAudio && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await saveAudioAsMedia(audioBlob, data.id);
      }

      router.push(`/memories?id=${data.id}`);
    } catch (err) {
      console.error('Error saving memory:', err);
      setError(err instanceof Error ? err.message : 'Failed to save memory. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            <p>{error}</p>
          </div>
        )}
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Memory Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your memory"
            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              validationErrors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {validationErrors.title && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.title}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            When did this memory occur?
          </label>
          <DatePicker
            id="date"
            selected={memoryDate}
            onChange={(date: Date | null) => date && setMemoryDate(date)}
            dateFormat="MMMM d, yyyy"
            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              validationErrors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            showYearDropdown
            scrollableYearDropdown
            yearDropdownItemNumber={100}
            maxDate={new Date()}
            placeholderText="Select a date"
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
                onClick={isListening ? stopRecording : startRecording}
                className={`px-4 py-2 rounded-md ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                } text-white transition-colors`}
              >
                {isListening ? 'Stop Recording' : 'Start Recording'}
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

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save Memory'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setTranscript('');
              setTitle('');
              setMemoryDate(new Date());
              setValidationErrors({});
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        </div>
      </form>

      {isListening && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Recording... Click "Stop Recording" when you're finished.
        </div>
      )}

      {isTranscribing && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Transcribing your recording...
        </div>
      )}
    </div>
  );
}