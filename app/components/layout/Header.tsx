'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/hooks/useAuth';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, signOut } = useAuth();

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Personal History AI
            </Link>
          </div>

          {/* Desktop Menu */}
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400">
              Home
            </Link>
            <Link href="/speech" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400">
              Record Memory
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/memories" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400">
                  Memories
                </Link>
                <Link href="/interview" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400">
                  AI Interview
                </Link>
              </>
            )}
            {isAuthenticated ? (
              <button
                onClick={signOut}
                className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400"
              >
                Logout
              </button>
            ) : (
              <Link href="/login" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400">
                Login
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/"
              className="block px-3 py-2 rounded-md text-gray-600 hover:text-purple-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/speech"
              className="block px-3 py-2 rounded-md text-gray-600 hover:text-purple-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Record Memory
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/memories"
                  className="block px-3 py-2 rounded-md text-gray-600 hover:text-purple-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Memories
                </Link>
                <Link
                  href="/interview"
                  className="block px-3 py-2 rounded-md text-gray-600 hover:text-purple-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  AI Interview
                </Link>
              </>
            )}
            {isAuthenticated ? (
              <button
                onClick={() => {
                  signOut();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-gray-600 hover:text-purple-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-800"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="block px-3 py-2 rounded-md text-gray-600 hover:text-purple-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-800"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}