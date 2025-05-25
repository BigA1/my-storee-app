import StoryList from '../components/features/stories/StoryList';

export default function StoriesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Memories</h1>
      <StoryList />
    </div>
  );
} 