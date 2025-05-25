'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function SpeechRecorder() {
  const router = useRouter();
  const supabase = createClient();
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [memoryDate, setMemoryDate] = useState(new Date());
  const [showPreview, setShowPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    content?: string;
    date?: string;
  }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
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

  const validateStory = () => {
    const errors: { title?: string; content?: string; date?: string } = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }
    
    if (!transcript.trim()) {
      errors.content = 'Please record some audio before saving';
    } else if (transcript.length > 10000) {
      errors.content = 'Story content must be less than 10,000 characters';
    }

    if (!memoryDate) {
      errors.date = 'Date is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveStory = async () => {
    if (!validateStory()) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication error. Please try logging in again.');
      }

      if (!session) {
        console.error('No session found');
        throw new Error('Please log in to save your story');
      }

      console.log('Session found:', { userId: session.user.id });

      // Add authorization header with the session token
      const response = await fetch('http://localhost:8000/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          content: transcript,
          date: memoryDate.toISOString().split('T')[0],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Error response:', data);
        throw new Error(data.detail || 'Failed to save story');
      }

      const data = await response.json();
      router.push(`/stories/${data.id}`);
    } catch (err) {
      console.error('Error saving story:', err);
      setError(err instanceof Error ? err.message : 'Failed to save story. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg">
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          <p>{error}</p>
        </div>
      )}
      
      <div className="flex gap-4">
        {!isListening ? (
          <button
            onClick={startRecording}
            disabled={isTranscribing || isSaving}
            className="rounded-full border border-solid transition-colors flex items-center justify-center gap-2 text-sm sm:text-base h-12 px-8 w-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTranscribing ? 'Transcribing...' : 'Start Recording'}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="rounded-full border border-solid transition-colors flex items-center justify-center gap-2 text-sm sm:text-base h-12 px-8 w-full bg-red-500 text-white hover:bg-red-600"
          >
            Stop Recording
          </button>
        )}
      </div>
      
      {transcript && (
        <div className="mt-4">
          <div className="mb-4 space-y-4">
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
                onChange={(date: Date) => setMemoryDate(date)}
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
          </div>
          
          <div className="mt-4">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Memory Content
            </label>
            {isEditing ? (
              <textarea
                id="content"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className={`w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 border ${
                  validationErrors.content ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="Your memory text..."
              />
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                <p className="text-left whitespace-pre-wrap text-gray-900 dark:text-gray-100">{transcript}</p>
              </div>
            )}
            {validationErrors.content && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.content}</p>
            )}
          </div>
          
          <div className="mt-4 flex justify-end gap-4">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200"
            >
              {isEditing ? 'Save Changes' : 'Edit Text'}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="text-sm bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Preview
            </button>
            <button
              onClick={saveStory}
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
              onClick={() => {
                setTranscript('');
                setTitle('');
                setMemoryDate(new Date());
                setIsEditing(false);
                setValidationErrors({});
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {memoryDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{transcript}</p>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setShowPreview(false)}
                className="text-sm bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  saveStory();
                }}
                className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Save Memory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}