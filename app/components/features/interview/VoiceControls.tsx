'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';

interface VoiceControlsProps {
  onSpeechTranscribed: (text: string) => void;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  aiIsSpeaking?: boolean; // AI speaking state
}

export default function VoiceControls({ onSpeechTranscribed, isEnabled, onToggle, aiIsSpeaking = false }: VoiceControlsProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [listeningDuration, setListeningDuration] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isDetectingAudio, setIsDetectingAudio] = useState(false);
  const [silenceTimerCountdown, setSilenceTimerCountdown] = useState<number | null>(null);
  const [silenceStartTime, setSilenceStartTime] = useState<number | null>(null);
  const [useSimpleRecording, setUseSimpleRecording] = useState(false);
  
  // Refs for managing state across renders
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastProcessedTextRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  const processingAudioHashRef = useRef<string>('');
  const silenceTimerActiveRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const lastAudioTimeRef = useRef<number>(0);
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const silenceStartTimeRef = useRef<number | null>(null);
  const selectedMimeTypeRef = useRef<string>('');
  const skippedChunksCountRef = useRef<number>(0);
  const mediaRecorderReadyRef = useRef<boolean>(false);
  
  const supabase = createClient();

  // Set mounted ref on mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  // Effect to handle AI speaking state
  useEffect(() => {
    if (isListening) {
      if (aiIsSpeaking) {
        console.log('🤖 AI speaking - pausing MediaRecorder and analysis');
        
        // Stop audio analysis
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        // Clear any audio chunks to prevent processing AI audio
        setAudioChunks([]);
        audioChunksRef.current = [];
        
        // Reset audio detection state
        setIsDetectingAudio(false);
        setAudioLevel(0);
        
        // Stop silence timer
        if (silenceStartTimeRef.current) {
          console.log('🤖 AI started speaking - stopping silence timer');
          silenceStartTimeRef.current = null;
        }
        
        // Pause MediaRecorder if it's recording
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
          console.log('⏸️ Pausing MediaRecorder');
          mediaRecorder.current.pause();
        }
      } else {
        console.log('🤖 AI stopped speaking - resuming MediaRecorder');
        
        // Resume the MediaRecorder if it was paused
        if (mediaRecorder.current && mediaRecorder.current.state === 'paused') {
          console.log('▶️ Resuming MediaRecorder');
          mediaRecorder.current.resume();
          
          // Restart audio analysis
          try {
            if (audioStream.current && !analyserRef.current) {
              audioContextRef.current = new AudioContext();
              const source = audioContextRef.current.createMediaStreamSource(audioStream.current);
              analyserRef.current = audioContextRef.current.createAnalyser();
              analyserRef.current.fftSize = 256;
              source.connect(analyserRef.current);
              
              isListeningRef.current = true;
              analyzeAudioLevel();
            }
          } catch (err) {
            console.warn('Could not restart audio analysis:', err);
          }
        }
      }
    }
  }, [aiIsSpeaking, isListening]);

  const cleanup = () => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    if (audioStream.current) {
      audioStream.current.getTracks().forEach(track => track.stop());
      audioStream.current = null;
    }
    setIsListening(false);
    setIsProcessing(false);
    setListeningDuration(0);
    setAudioChunks([]);
    setAudioLevel(0);
    setIsDetectingAudio(false);
    setSilenceTimerCountdown(null);
    setSilenceStartTime(null);
    audioChunksRef.current = [];
    processingAudioHashRef.current = '';
    silenceTimerActiveRef.current = false;
    lastAudioTimeRef.current = 0;
    analyserRef.current = null;
    isListeningRef.current = false;
    silenceStartTimeRef.current = null;
    selectedMimeTypeRef.current = '';
  };

  // Create a simple hash of audio chunks
  const createAudioHash = (chunks: Blob[]): string => {
    return chunks.map(chunk => chunk.size).join('-');
  };

  // Check if text is duplicate or too recent
  const isDuplicateSubmission = (text: string): boolean => {
    const now = Date.now();
    const timeSinceLastProcessed = now - lastProcessedTimeRef.current;
    const isSameText = text.trim().toLowerCase() === lastProcessedTextRef.current.trim().toLowerCase();
    const isTooRecent = timeSinceLastProcessed < 3000; // 3 second cooldown (reduced from 5)
    
    return isSameText || isTooRecent;
  };

  // Check if audio chunks are duplicate
  const isDuplicateAudio = (chunks: Blob[]): boolean => {
    const audioHash = createAudioHash(chunks);
    return audioHash === processingAudioHashRef.current;
  };

  // Analyze audio levels to detect speaking
  const analyzeAudioLevel = () => {
    if (!analyserRef.current || !isListeningRef.current) {
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = (average / 255) * 100;
    
    setAudioLevel(normalizedLevel);
    const isSpeakingNow = normalizedLevel > 15;
    setIsDetectingAudio(isSpeakingNow);

    // Silence detection
    if (!isSpeakingNow) {
      // Not speaking - start or continue silence timer
      if (!silenceStartTimeRef.current) {
        silenceStartTimeRef.current = Date.now();
        console.log('⏰ Started silence timer');
      } else {
        const silenceDuration = (Date.now() - silenceStartTimeRef.current) / 1000;
        if (silenceDuration >= 4) {
          console.log('⏰ 4 seconds of silence - processing speech');
          processCurrentSpeech();
          silenceStartTimeRef.current = null;
        }
      }
    } else {
      // Speaking - reset silence timer
      if (silenceStartTimeRef.current) {
        console.log('⏰ Reset silence timer (speaking detected)');
        silenceStartTimeRef.current = null;
      }
    }

    // Continue analysis
    animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
  };

  const startListening = async () => {
    if (!isMountedRef.current) {
      console.log('Cannot start listening: component not mounted');
      return;
    }

    try {
      console.log('🎤 Starting voice listening...');
      setIsListening(true);
      setError(null);

      // Get microphone access - ensure we only get microphone, not system audio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      audioStream.current = stream;

      // Debug: Log audio track details
      console.log('🔍 Audio stream details:');
      console.log(`   Stream ID: ${stream.id}`);
      console.log(`   Tracks: ${stream.getTracks().length}`);
      stream.getTracks().forEach((track, index) => {
        console.log(`   Track ${index}: ${track.kind}, enabled: ${track.enabled}, muted: ${track.muted}`);
        console.log(`   Track settings:`, track.getSettings());
      });

      // Check supported MIME types
      const supportedTypes = [
        'audio/webm',
        'audio/mp4',
        'audio/wav',
        'audio/ogg'
      ];
      
      console.log('🔍 Checking supported MIME types:');
      supportedTypes.forEach(type => {
        const supported = MediaRecorder.isTypeSupported(type);
        console.log(`   ${type}: ${supported ? '✅' : '❌'}`);
      });

      let selectedMimeType = null;
      for (const mimeType of supportedTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`✅ Using MIME type: ${mimeType}`);
          break;
        }
      }

      if (!selectedMimeType) {
        console.warn('⚠️ No supported MIME type found, using default');
        selectedMimeType = '';
      }
      selectedMimeTypeRef.current = selectedMimeType;
      console.log(`🎵 Selected MIME type: ${selectedMimeType}`);

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });

      // Set up audio analysis
      try {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        console.log('🎵 Audio analysis setup complete');
      } catch (err) {
        console.warn('Could not set up audio analysis:', err);
      }

      // Set up MediaRecorder event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`🎤 Audio chunk: ${event.data.size} bytes`);
          setAudioChunks(prev => {
            const newChunks = [...prev, event.data];
            audioChunksRef.current = newChunks;
            return newChunks;
          });
        }
      };

      recorder.onstop = () => {
        console.log('✅ MediaRecorder stopped');
      };

      recorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Start recording
      mediaRecorder.current = recorder;
      recorder.start(1000); // Collect data every second
      console.log('🎤 MediaRecorder started');

      // Start audio analysis
      isListeningRef.current = true;
      analyzeAudioLevel();

    } catch (error) {
      console.error('Failed to start listening:', error);
      setError('Failed to access microphone');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    console.log('Stopping voice listening...');
    
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    
    if (audioStream.current) {
      audioStream.current.getTracks().forEach(track => track.stop());
      audioStream.current = null;
    }
    
    setIsListening(false);
    setListeningDuration(0);
  };

  const processCurrentSpeech = async () => {
    const currentChunks = audioChunksRef.current;
    console.log('🔍 Processing speech...');
    
    if (currentChunks.length === 0 || isProcessing) {
      console.log('❌ Cannot process - no audio chunks or already processing');
      return;
    }

    // Basic validation - just check if we have some audio
    if (currentChunks.length < 2) {
      console.log('❌ Not enough audio chunks');
      return;
    }

    console.log('✅ Starting transcription...');
    setIsProcessing(true);
    stopListening();
    
    try {
      const audioBlob = new Blob(currentChunks, { type: selectedMimeTypeRef.current || 'audio/webm' });
      console.log(`📦 Audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      // Basic size validation
      if (audioBlob.size < 1024) {
        console.log('❌ Audio too small');
        setAudioChunks([]);
        audioChunksRef.current = [];
        setIsProcessing(false);
        return;
      }
      
      const formData = new FormData();
      const filename = `recording.webm`;
      formData.append('file', audioBlob, filename);

      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        throw new Error('Not authenticated');
      }

      console.log('📤 Sending to Whisper...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('📥 Whisper response:', data.text ? `"${data.text}"` : 'No speech detected');
      
      if (data.text && data.text.trim()) {
        // Basic validation - check if the text makes sense
        const cleanText = data.text.trim().toLowerCase();
        const suspiciousPhrases = [
          'thank you for watching',
          'subscribe',
          'like and subscribe',
          'click the bell',
          'notification',
          'system',
          'error',
          'loading'
        ];
        
        const isSuspicious = suspiciousPhrases.some(phrase => cleanText.includes(phrase));
        
        if (isSuspicious) {
          console.log('⚠️ Suspicious transcription detected, ignoring:', data.text);
          setError('Detected system audio, please try again');
        } else {
          console.log('✅ Valid speech detected - submitting');
          onSpeechTranscribed(data.text);
        }
      } else {
        console.log('❌ No valid speech detected');
      }
    } catch (error) {
      console.log('❌ Transcription error:', error);
      setError('Transcription failed');
    } finally {
      setAudioChunks([]);
      audioChunksRef.current = [];
      setIsProcessing(false);
    }
  };

  // Auto-start listening when enabled
  useEffect(() => {
    if (isEnabled && !isListening && !isProcessing && !isSpeaking && isMountedRef.current) {
      startListening();
    } else if (!isEnabled && isListening) {
      stopListening();
    }
  }, [isEnabled, isListening, isProcessing, isSpeaking]);

  // Cleanup when disabled
  useEffect(() => {
    if (!isEnabled) {
      cleanup();
    }
  }, [isEnabled]);

  // Function to convert audio to WAV format for better compatibility
  const convertToWav = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async () => {
        try {
          const arrayBuffer = fileReader.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Create WAV file from audio buffer
          const wavBlob = audioBufferToWav(audioBuffer);
          console.log(`🔄 Converted to WAV: ${blob.size} -> ${wavBlob.size} bytes`);
          resolve(wavBlob);
        } catch (error) {
          console.log('⚠️ Audio conversion failed, using original blob');
          resolve(blob);
        }
      };
      
      fileReader.readAsArrayBuffer(blob);
    });
  };

  // Helper function to convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Function to clean audio blob by checking for valid headers
  const cleanAudioBlob = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Check for valid WebM header (starts with 1a 45 df a3)
        const webmSignature = [0x1a, 0x45, 0xdf, 0xa3];
        let validStartIndex = -1;
        
        // Find the first occurrence of valid WebM signature
        for (let i = 0; i <= uint8Array.length - 4; i++) {
          if (uint8Array[i] === webmSignature[0] &&
              uint8Array[i + 1] === webmSignature[1] &&
              uint8Array[i + 2] === webmSignature[2] &&
              uint8Array[i + 3] === webmSignature[3]) {
            validStartIndex = i;
            console.log(`🔧 Found valid WebM header at position ${i}`);
            break;
          }
        }
        
        if (validStartIndex >= 0) {
          // Create new blob starting from valid header
          const cleanData = uint8Array.slice(validStartIndex);
          const cleanBlob = new Blob([cleanData], { type: blob.type });
          console.log(`🔧 Cleaned audio: ${blob.size} -> ${cleanBlob.size} bytes`);
          resolve(cleanBlob);
        } else {
          console.log('⚠️ No valid WebM header found, using original blob');
          resolve(blob);
        }
      };
      reader.readAsArrayBuffer(blob);
    });
  };

  // Function to download audio blob for debugging
  const downloadAudioBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Test function to create a simple audio recording
  const testAudioRecording = async () => {
    try {
      console.log('🧪 Testing audio recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeTypeRef.current || 'audio/webm'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log(`🧪 Test chunk: ${event.data.size} bytes, type: ${event.data.type}`);
        }
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: selectedMimeTypeRef.current || 'audio/webm' });
        console.log(`🧪 Test recording: ${blob.size} bytes, type: ${blob.type}`);
        
        // Test the blob with a simple file reader
        const reader = new FileReader();
        reader.onload = () => {
          console.log('🧪 File reader result:', reader.result ? 'Success' : 'Failed');
        };
        reader.readAsArrayBuffer(blob);
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start(1000);
      setTimeout(() => {
        recorder.stop();
      }, 3000);
      
    } catch (err) {
      console.error('❌ Test recording failed:', err);
    }
  };

  if (!isEnabled) {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onToggle(true)}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Enable Voice
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => onToggle(false)}
        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Disable Voice
      </button>
      
      {isListening && (
        <div className="flex items-center space-x-2 text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">
            Listening... ({listeningDuration}s) - {audioChunks.length} chunks
          </span>
        </div>
      )}
      
      {/* Audio Level Meter and Speaking Indicator */}
      {isListening && (
        <div className="flex items-center space-x-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Audio Level:</span>
            <div className="w-32 h-4 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${
                  audioLevel > 50 ? 'bg-red-500' : 
                  audioLevel > 25 ? 'bg-yellow-500' : 
                  audioLevel > 10 ? 'bg-green-500' : 'bg-gray-400'
                }`}
                style={{ width: `${audioLevel}%` }}
              ></div>
            </div>
            <span className="text-sm w-12">{audioLevel.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              isDetectingAudio ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
            }`}></div>
            <span className={`text-sm font-medium ${
              isDetectingAudio ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isDetectingAudio ? 'SPEAKING' : 'Silent'}
            </span>
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="flex items-center space-x-2 text-purple-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
          <span className="text-sm">Processing speech...</span>
        </div>
      )}
      
      {/* AI Generating Indicator */}
      {aiIsSpeaking && (
        <div className="flex items-center space-x-2 text-orange-600">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <span className="text-sm">AI is generating - voice input disabled</span>
        </div>
      )}
      
      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {/* Emergency stop button for debugging */}
      {isListening && (
        <button
          onClick={() => {
            console.log('Emergency stop clicked');
            cleanup();
          }}
          className="px-3 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors"
          title="Emergency stop - clears all voice processing"
        >
          Emergency Stop
        </button>
      )}
      
      {/* Test microphone button */}
      {!isListening && (
        <button
          onClick={async () => {
            try {
              console.log('🧪 Testing microphone...');
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              console.log('✅ Microphone access granted');
              console.log('Audio tracks:', stream.getAudioTracks().map(track => ({
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
              })));
              
              // Test audio recording for 3 seconds
              const recorder = new MediaRecorder(stream);
              const chunks: Blob[] = [];
              
              recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  chunks.push(event.data);
                  console.log(`📦 Test chunk: ${event.data.size} bytes`);
                }
              };
              
              recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                console.log(`🎵 Test recording complete: ${blob.size} bytes total`);
                stream.getTracks().forEach(track => track.stop());
              };
              
              recorder.start(1000);
              setTimeout(() => {
                recorder.stop();
              }, 3000);
              
            } catch (err) {
              console.error('❌ Microphone test failed:', err);
            }
          }}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Test microphone access and recording"
        >
          Test Mic
        </button>
      )}
      
      {/* Test audio recording button */}
      {!isListening && (
        <button
          onClick={testAudioRecording}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          title="Test audio recording with current MIME type"
        >
          Test Recording
        </button>
      )}
      
      {/* Download current audio button */}
      {isListening && audioChunksRef.current.length > 0 && (
        <button
          onClick={() => {
            const blob = new Blob(audioChunksRef.current, { type: selectedMimeTypeRef.current || 'audio/webm' });
            const filename = `debug_${Date.now()}.${selectedMimeTypeRef.current?.includes('mp4') ? 'mp4' : 'webm'}`;
            downloadAudioBlob(blob, filename);
            console.log('📥 Downloaded current audio for debugging');
          }}
          className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          title="Download current audio for debugging"
        >
          Download Audio
        </button>
      )}
      
      {/* Test Web Audio API button */}
      {!isListening && (
        <button
          onClick={async () => {
            try {
              console.log('🧪 Testing Web Audio API...');
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              
              const audioContext = new AudioContext();
              const source = audioContext.createMediaStreamSource(stream);
              const analyser = audioContext.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              
              console.log('✅ Web Audio API setup complete');
              
              // Test audio analysis for 5 seconds
              let testCount = 0;
              const testInterval = setInterval(() => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                
                const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
                const level = Math.min(100, (average / 128) * 100);
                
                console.log(`🎤 Test ${testCount + 1}: Audio level = ${level.toFixed(1)}%`);
                testCount++;
                
                if (testCount >= 5) {
                  clearInterval(testInterval);
                  audioContext.close();
                  stream.getTracks().forEach(track => track.stop());
                  console.log('✅ Web Audio API test complete');
                }
              }, 1000);
              
            } catch (err) {
              console.error('❌ Web Audio API test failed:', err);
            }
          }}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          title="Test Web Audio API analysis"
        >
          Test Audio Analysis
        </button>
      )}
      
      {/* Manual reset button for stuck silence timer */}
      {isListening && silenceTimerActiveRef.current && !silenceTimer.current && (
        <button
          onClick={() => {
            console.log('Manual reset clicked - clearing stuck silenceTimerActive flag');
            silenceTimerActiveRef.current = false;
            setAudioChunks([]);
            audioChunksRef.current = [];
          }}
          className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          title="Reset stuck silence timer"
        >
          Reset Timer
        </button>
      )}
    </div>
  );
} 