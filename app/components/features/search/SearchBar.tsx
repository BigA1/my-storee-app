'use client';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';

const API_BASE_URL = 'http://localhost:8000';

interface SearchBarProps {
  onSearch: (results: any[]) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/memories/search?` + new URLSearchParams({
        ...(query && { query }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate })
      }), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search memories');
      }

      const results = await response.json();
      onSearch(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      onSearch([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = async () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/memories`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch memories');
      }

      const results = await response.json();
      onSearch(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      onSearch([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="searchQuery" className="block text-sm text-gray-400 mb-1">
              Search
            </label>
            <input
              id="searchQuery"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <label htmlFor="startDate" className="block text-sm text-gray-400 mb-1">
                From
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:hover:cursor-pointer"
              />
            </div>
            <div className="relative">
              <label htmlFor="endDate" className="block text-sm text-gray-400 mb-1">
                To
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:hover:cursor-pointer"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={handleClearSearch}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Clear Search
            </button>
          </div>
          {error && (
            <div className="text-red-400 bg-red-900/50 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  );
} 