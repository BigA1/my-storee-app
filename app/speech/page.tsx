import SpeechRecorder from '@/app/components/features/speech/SpeechRecorder';

export default function SpeechPage() {
  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Tell your storee</h1>
        <SpeechRecorder />
      </main>
    </div>
  );
}