export const isSpeechRecognitionSupported = () => {
    return 'webkitSpeechRecognition' in window;
  };