import { useState, useEffect } from 'react';

interface VoiceState {
  isSupported: boolean;
  hasPermission: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  error: string | null;
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>({
    isSupported: false,
    hasPermission: false,
    isRecording: false,
    isSpeaking: false,
    error: null,
  });

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition && !!window.speechSynthesis;
    
    setState(prev => ({ ...prev, isSupported }));

    if (isSupported) {
      // Request microphone permission
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          setState(prev => ({ ...prev, hasPermission: true }));
        })
        .catch((error) => {
          console.error('Microphone permission denied:', error);
          setState(prev => ({ 
            ...prev, 
            hasPermission: false, 
            error: 'Microphone permission is required for voice input' 
          }));
        });
    } else {
      setState(prev => ({ 
        ...prev, 
        error: 'Voice features are not supported in this browser' 
      }));
    }
  }, []);

  const requestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setState(prev => ({ ...prev, hasPermission: true, error: null }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        error: 'Microphone permission denied' 
      }));
    }
  };

  return {
    ...state,
    requestPermission,
  };
} 