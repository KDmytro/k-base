import { useState, useEffect, useRef } from 'react';
import { X, Settings, Save, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiClient } from '@/api/client';
import type { UserPreferencesUpdate } from '@/types/models';

export function SettingsPanel() {
  const { preferences, isOpen, setOpen, setPreferences, setLoading, isLoading } = useSettingsStore();
  const [background, setBackground] = useState('');
  const [interests, setInterests] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load preferences when panel opens (only once)
  useEffect(() => {
    if (isOpen && !hasLoaded && !isLoading) {
      loadPreferences();
    }
  }, [isOpen, hasLoaded, isLoading]);

  // Populate form when preferences load
  useEffect(() => {
    if (preferences) {
      setBackground(preferences.background || '');
      setInterests(preferences.interests || '');
      setCustomInstructions(preferences.customInstructions || '');
    }
  }, [preferences]);

  // Reset hasLoaded when panel closes (to allow refresh on next open)
  useEffect(() => {
    if (!isOpen) {
      setHasLoaded(false);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, setOpen]);

  const loadPreferences = async () => {
    setLoading(true);
    setError(null);
    try {
      const prefs = await apiClient.getPreferences();
      setPreferences(prefs);
      setHasLoaded(true);
    } catch (err) {
      setError('Failed to load preferences');
      console.error('Error loading preferences:', err);
      setHasLoaded(true); // Mark as loaded even on error to prevent infinite retry
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const data: UserPreferencesUpdate = {
        background: background.trim() || null,
        interests: interests.trim() || null,
        customInstructions: customInstructions.trim() || null,
      };
      const updated = await apiClient.updatePreferences(data);
      setPreferences(updated);
      setOpen(false);
    } catch (err) {
      setError('Failed to save preferences');
      console.error('Error saving preferences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => setOpen(false)}
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-xl z-50 flex flex-col animate-slide-in"
        style={{
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-blue-600" />
            <span className="font-medium text-blue-800">User Preferences</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Background */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Background
                </label>
                <textarea
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell the AI about yourself (e.g., Software engineer with 10 years experience, PhD in physics...)"
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400">
                  {background.length}/2000 characters
                </p>
              </div>

              {/* Interests */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Interests
                </label>
                <textarea
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your domains of interest (e.g., distributed systems, machine learning, functional programming...)"
                  rows={2}
                  maxLength={1000}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400">
                  {interests.length}/1000 characters
                </p>
              </div>

              {/* Custom Instructions */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Custom Instructions
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Custom instructions for the AI (e.g., Be concise, use code examples, explain like I'm a beginner...)"
                  rows={4}
                  maxLength={4000}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400">
                  {customInstructions.length}/4000 characters
                </p>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                These preferences will be included in all your conversations to personalize AI responses.
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Cmd/Ctrl + Enter to save
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
