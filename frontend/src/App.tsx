import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            K-Base
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Branching Brainstorming & Learning App
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Welcome to K-Base
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              K-Base is a brainstorming and learning application that treats conversations as trees rather than linear logs.
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Key Features:</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Branch conversations at any point</li>
                <li>Collapse tangents with AI-generated summaries</li>
                <li>Shared memory across related sessions</li>
                <li>Navigate complex discussion trees</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
