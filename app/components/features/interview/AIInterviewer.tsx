'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { format } from 'date-fns';
import VoiceControls from './VoiceControls';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
}

interface InterviewSession {
  session_id: string;
  conversation: Message[];
  current_question: string;
  summary?: string;
  status: string;
  created_at: string;
  last_updated?: string;
  ended_at?: string;
}

interface MemoryDate {
  type: 'exact' | 'month' | 'year' | 'age' | 'period';
  value: string;
  description?: string; // For age ("when I was 12") or period ("summer of 2010")
}

export default function AIInterviewer() {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showCreateMemoryDialog, setShowCreateMemoryDialog] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryDate, setMemoryDate] = useState<MemoryDate>({
    type: 'exact',
    value: new Date().toISOString().split('T')[0]
  });
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);
  
  // Voice features
  const [isVoiceInputEnabled, setIsVoiceInputEnabled] = useState(false);
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.conversation]);

  // Auto-speak AI responses when voice output is enabled
  useEffect(() => {
    if (session?.conversation && isVoiceOutputEnabled) {
      const lastMessage = session.conversation[session.conversation.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        speakText(lastMessage.content);
      }
    }
  }, [session?.conversation, isVoiceOutputEnabled]);

  // Auto-focus input after AI finishes speaking
  useEffect(() => {
    if (!isSpeaking && session?.conversation && inputRef.current) {
      // Small delay to ensure the speaking state has fully updated
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, session?.conversation]);

  // Handle speech transcription from voice controls
  const handleSpeechTranscribed = (text: string) => {
    console.log('Speech transcribed from voice controls:', text);
    
    // Don't submit if AI is currently generating a response
    if (isLoading || isSpeaking) {
      console.log('⚠️ Ignoring voice input - AI is currently generating');
      return;
    }
    
    // Auto-submit the transcribed speech
    continueInterview(text);
  };

  const startInterview = async (initialContext?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('http://localhost:8000/api/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          initial_context: initialContext
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start interview');
      }

      const sessionData = await response.json();
      setSession(sessionData);
      
      // Focus input after interview starts
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } catch (err) {
      console.error('Error starting interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
    } finally {
      setIsLoading(false);
    }
  };

  const continueInterview = async (userResponse: string) => {
    if (!session || isLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Set speaking state to true when AI starts generating
      setIsSpeaking(true);
      
      const response = await fetch('http://localhost:8000/api/interview/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          session_id: session.session_id,
          user_response: userResponse
        })
      });

      if (!response.ok) {
        throw new Error('Failed to continue interview');
      }

      const data = await response.json();
      setSession(data);
      setUserInput('');
      
      // Set speaking state to false when AI finishes generating
      setIsSpeaking(false);
      
    } catch (error) {
      console.error('Error continuing interview:', error);
      setError('Failed to continue interview');
      // Make sure to reset speaking state on error
      setIsSpeaking(false);
    } finally {
      setIsLoading(false);
    }
  };

  const endInterview = async () => {
    if (!session) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('http://localhost:8000/api/interview/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          session_id: session.session_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to end interview');
      }

      const endedSession = await response.json();
      setSession(endedSession);
      
      // Auto-populate memory creation fields
      if (endedSession.summary) {
        setMemoryContent(endedSession.summary);
        // Reset date to empty for user to choose
        setMemoryDate({
          type: 'exact',
          value: ''
        });
        
        // Get suggested title
        try {
          const titleResponse = await fetch(`http://localhost:8000/api/interview/suggest-title/${endedSession.session_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authSession.access_token}`
            }
          });
          
          if (titleResponse.ok) {
            const titleData = await titleResponse.json();
            setMemoryTitle(titleData.suggested_title);
          }
        } catch (err) {
          console.error('Error getting suggested title:', err);
          // Set a default title if suggestion fails
          setMemoryTitle('My Memory');
        }
      }
      
      setShowEndDialog(true);
    } catch (err) {
      console.error('Error ending interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to end interview');
    } finally {
      setIsLoading(false);
    }
  };

  const createMemoryFromInterview = async () => {
    if (!session?.summary) return;

    try {
      setIsCreatingMemory(true);
      setError(null);

      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        throw new Error('Not authenticated');
      }

      // Format the date based on type
      let formattedDate: string;
      switch (memoryDate.type) {
        case 'exact':
          formattedDate = memoryDate.value;
          break;
        case 'month':
          formattedDate = `${memoryDate.value}-01`; // Use first day of month
          break;
        case 'year':
          formattedDate = `${memoryDate.value}-01-01`; // Use January 1st of year
          break;
        case 'age':
        case 'period':
          formattedDate = memoryDate.description || memoryDate.value;
          break;
        default:
          formattedDate = memoryDate.value;
      }

      const response = await fetch('http://localhost:8000/api/interview/create-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          session_id: session.session_id,
          title: memoryTitle,
          content: memoryContent,
          date: formattedDate,
          date_type: memoryDate.type,
          date_description: memoryDate.description
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create memory');
      }

      setShowCreateMemoryDialog(false);
      setMemoryTitle('');
      setMemoryContent('');
      setMemoryDate({
        type: 'exact',
        value: new Date().toISOString().split('T')[0]
      });
      
      // Navigate to memories page
      router.push('/memories');
    } catch (err) {
      console.error('Error creating memory:', err);
      setError(err instanceof Error ? err.message : 'Failed to create memory');
    } finally {
      setIsCreatingMemory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;
    
    await continueInterview(userInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // Voice controls integration
  const handleVoiceToggle = (enabled: boolean) => {
    setIsVoiceInputEnabled(enabled);
  };

  const speakText = (text: string) => {
    if (!isVoiceOutputEnabled || typeof window === 'undefined') return;
    
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const renderDateInput = () => {
    switch (memoryDate.type) {
      case 'exact':
        return (
          <input
            type="date"
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
        );
      case 'month':
        return (
          <input
            type="month"
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
        );
      case 'year':
        return (
          <input
            type="number"
            value={memoryDate.value}
            onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
            placeholder="e.g., 2010"
            min="1900"
            max="2100"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
        );
      case 'age':
        return (
          <div className="space-y-2">
            <input
              type="number"
              value={memoryDate.value}
              onChange={(e) => setMemoryDate({ ...memoryDate, value: e.target.value })}
              placeholder="Age (e.g., 12)"
              min="1"
              max="120"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              value={memoryDate.description || ''}
              onChange={(e) => setMemoryDate({ ...memoryDate, description: e.target.value })}
              placeholder="Description (e.g., when I was 12, during my childhood)"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        );
      case 'period':
        return (
          <input
            type="text"
            value={memoryDate.description || ''}
            onChange={(e) => setMemoryDate({ ...memoryDate, description: e.target.value })}
            placeholder="e.g., summer of 2010, Christmas 2015, during college"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
        );
      default:
        return null;
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">AI Memory Interviewer</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Have a conversation with our AI to capture your memories in detail. 
            The AI will ask thoughtful questions to help you share the specific facts and details of your experiences.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => startInterview()}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Starting...' : 'Start New Interview'}
            </button>
            
            <div className="text-sm text-gray-500">
              <p>Or start with a specific topic:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Childhood memories', 'Family stories', 'Travel experiences', 'Career highlights'].map((topic) => (
                  <button
                    key={topic}
                    onClick={() => startInterview(topic)}
                    disabled={isLoading}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Interview Session</h1>
        <div className="flex items-center space-x-4">
          {/* Voice Controls */}
          <VoiceControls
            onSpeechTranscribed={handleSpeechTranscribed}
            isEnabled={isVoiceInputEnabled}
            onToggle={handleVoiceToggle}
            aiIsSpeaking={isSpeaking}
          />
          
          {/* Voice Output Toggle */}
          <button
            onClick={() => setIsVoiceOutputEnabled(!isVoiceOutputEnabled)}
            className={`px-3 py-2 rounded-lg transition-colors ${
              isVoiceOutputEnabled 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
            }`}
          >
            {isVoiceOutputEnabled ? 'Voice On' : 'Voice Off'}
          </button>
          
          <button
            onClick={endInterview}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            End Interview
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {session.conversation.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {typeof message.timestamp === 'string' 
                    ? format(new Date(message.timestamp), 'HH:mm')
                    : format(message.timestamp, 'HH:mm')
                  }
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* AI Generating Indicator */}
        {isLoading && (
          <div className="flex justify-start mt-4">
            <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-4">
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response here..."
            className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            rows={3}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!userInput.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* End Interview Dialog */}
      {showEndDialog && session.summary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Interview Complete</h2>
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Your Memory:</h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {session.summary}
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowEndDialog(false);
                  setShowCreateMemoryDialog(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save as Memory
              </button>
              <button
                onClick={() => setShowEndDialog(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Memory Dialog */}
      {showCreateMemoryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Save Memory</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={memoryTitle}
                  onChange={(e) => setMemoryTitle(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Give your memory a descriptive title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={memoryContent}
                  onChange={(e) => setMemoryContent(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none dark:bg-gray-700 dark:text-white"
                  rows={4}
                  placeholder="Based on our conversation, here's a factual summary of what you shared:"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">When did this happen?</label>
                <div className="space-y-2">
                  <select
                    value={memoryDate.type}
                    onChange={(e) => setMemoryDate({ 
                      type: e.target.value as any, 
                      value: '', 
                      description: '' 
                    })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="exact">Exact date</option>
                    <option value="month">Month and year</option>
                    <option value="year">Year only</option>
                    <option value="age">When I was a certain age</option>
                    <option value="period">Time period (e.g., summer of 2010)</option>
                  </select>
                  {renderDateInput()}
                </div>
              </div>
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={createMemoryFromInterview}
                disabled={isCreatingMemory || !memoryTitle.trim() || !memoryContent.trim() || !memoryDate.value}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreatingMemory ? 'Saving...' : 'Save Memory'}
              </button>
              <button
                onClick={() => setShowCreateMemoryDialog(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 