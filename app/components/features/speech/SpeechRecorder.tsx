'use client';

import { useState, useRef } from 'react';

export default function SpeechRecorder() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const recentPhrasesRef = useRef<string[]>([]);

  const startListening = () => {
    setError(null);
    
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new (window as any).webkitSpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        recentPhrasesRef.current = [];
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        const result = event.results;

        finalTranscript = result[result.length - 1][0].transcript.trim();
            
        setTranscript(prev => {
          return prev + ' ' + finalTranscript;
        });

      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        console.error('Speech recognition error:', event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
      } catch (err) {
        setError('Failed to start speech recognition');
        setIsListening(false);
      }
    } else {
      setError('Speech recognition is not supported in this browser. Please use Chrome.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
            onClick={startListening}
            className="rounded-full border border-solid transition-colors flex items-center justify-center gap-2 text-sm sm:text-base h-12 px-8 w-full bg-purple-600 text-white hover:bg-purple-700"
          >
            Start Speaking
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="rounded-full border border-solid transition-colors flex items-center justify-center gap-2 text-sm sm:text-base h-12 px-8 w-full bg-red-500 text-white hover:bg-red-600"
          >
            Stop Recording
          </button>
        )}
      </div>
      
      {transcript && (
        <div className="mt-4">
          {isEditing ? (
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Your speech text..."
            />
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-left whitespace-pre-wrap">{transcript}</p>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-4">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200"
            >
              {isEditing ? 'Save Changes' : 'Edit Text'}
            </button>
            <button
              onClick={() => {
                setTranscript('');
                setIsEditing(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear Text
            </button>
          </div>
        </div>
      )}

      {isListening && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Speak now... Click "Stop Recording" when you're finished.
        </div>
      )}
    </div>
  );
}