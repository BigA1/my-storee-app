'use client';

import { useEffect, useState } from 'react';
import api from './lib/api';
import Image from "next/image";

interface ApiResponse {
  message: string;
}

export default function Home() {
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get<ApiResponse>('/');
        setMessage(response.data.message);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center text-center max-w-2xl">
        <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          MyStoree
        </h1>
        <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300">
          Let AI help you write your life story, one conversation at a time
        </p>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <p className="text-lg text-purple-600 dark:text-purple-400">
            Server message: {message}
          </p>
        )}
        <div className="flex gap-4 items-center flex-col sm:flex-row mt-8">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 text-white gap-2 hover:opacity-90 text-sm sm:text-base h-10 sm:h-12 px-6 sm:px-8"
            href="/speech"
          >
            Start Your Story
          </a>
          <a
            className="rounded-full border border-solid border-purple-600/20 dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-purple-50 dark:hover:bg-[#1a1a1a] text-sm sm:text-base h-10 sm:h-12 px-6 sm:px-8"
            href="/how-it-works"
          >
            How It Works
          </a>
        </div>
        
        <div className="mt-12 space-y-6 text-left">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Image
                src="/chat.svg"
                alt="Chat icon"
                width={24}
                height={24}
                className="dark:invert"
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Natural Conversations</h3>
              <p className="text-gray-600 dark:text-gray-300">Have meaningful discussions with our AI interviewer about your life experiences</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Image
                src="/pen.svg"
                alt="Pen icon"
                width={24}
                height={24}
                className="dark:invert"
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Guided Writing</h3>
              <p className="text-gray-600 dark:text-gray-300">Transform your conversations into beautifully written stories</p>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
