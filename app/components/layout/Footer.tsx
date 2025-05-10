'use client';

export default function Footer() {
  return (
    <footer className="py-6 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 flex-wrap items-center justify-center text-sm text-gray-600 dark:text-gray-300">
          <a
            className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            href="/privacy"
          >
            Privacy Policy
          </a>
          <a
            className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            href="/terms"
          >
            Terms of Service
          </a>
          <a
            className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            href="/contact"
          >
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
}