'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import AIInterviewer from '../components/features/interview/AIInterviewer';

export default function InterviewPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTests, setShowTests] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testMicrophone = async () => {
    try {
      addTestResult('🧪 Testing microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addTestResult('✅ Microphone access granted');
      
      const tracks = stream.getAudioTracks();
      addTestResult(`📱 Found ${tracks.length} audio track(s)`);
      
      tracks.forEach((track, index) => {
        addTestResult(`   Track ${index + 1}: ${track.label || 'Unknown'} (enabled: ${track.enabled}, muted: ${track.muted})`);
      });
      
      // Test recording for 3 seconds
      addTestResult('🎵 Testing audio recording...');
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          addTestResult(`📦 Audio chunk: ${event.data.size} bytes`);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        addTestResult(`✅ Recording complete: ${blob.size} bytes total`);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start(1000);
      setTimeout(() => {
        recorder.stop();
      }, 3000);
      
    } catch (err) {
      addTestResult(`❌ Microphone test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const testAudioAnalysis = async () => {
    try {
      addTestResult('🧪 Testing Web Audio API...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      addTestResult('✅ Web Audio API setup complete');
      addTestResult('🎤 Speak now - testing audio levels for 5 seconds...');
      
      // Test audio analysis for 5 seconds
      let testCount = 0;
      const testInterval = setInterval(() => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const level = Math.min(100, (average / 128) * 100);
        
        addTestResult(`🎤 Test ${testCount + 1}: Audio level = ${level.toFixed(1)}%`);
        testCount++;
        
        if (testCount >= 5) {
          clearInterval(testInterval);
          audioContext.close();
          stream.getTracks().forEach(track => track.stop());
          addTestResult('✅ Web Audio API test complete');
        }
      }, 1000);
      
    } catch (err) {
      addTestResult(`❌ Web Audio API test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          router.push('/auth/login');
          return;
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Memory Interviewer</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Have a conversation with our AI to capture your memories in detail. 
            The AI will ask thoughtful questions to help you share the specific facts and details of your experiences.
          </p>
        </div>
        
        {/* Microphone Test Section */}
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">🎤 Microphone Test</h2>
            <button
              onClick={() => setShowTests(!showTests)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showTests ? 'Hide Tests' : 'Show Tests'}
            </button>
          </div>
          
          {showTests && (
            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  onClick={testMicrophone}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Test Microphone
                </button>
                <button
                  onClick={testAudioAnalysis}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Test Audio Analysis
                </button>
                <button
                  onClick={clearTestResults}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Clear Results
                </button>
              </div>
              
              {testResults.length > 0 && (
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border max-h-64 overflow-y-auto">
                  <h3 className="font-semibold mb-2">Test Results:</h3>
                  {testResults.map((result, index) => (
                    <div key={index} className="text-sm font-mono mb-1">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <AIInterviewer />
      </div>
    </div>
  );
} 