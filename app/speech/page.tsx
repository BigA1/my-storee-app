'use client';

import SpeechRecorder from '@/app/components/features/speech/SpeechRecorder';
import { useRouter } from 'next/navigation';

export default function SpeechPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Save a Memory</h1>
        <SpeechRecorder onClose={() => router.push('/timeline')} />
      </main>
    </div>
  );
}