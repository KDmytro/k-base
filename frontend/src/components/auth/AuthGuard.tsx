/**
 * Auth guard component - shows login page or children based on auth state
 */

import { useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/client';
import { LoginPage } from './LoginPage';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, token, setAuth, clearAuth, setLoading, isLoading } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if we have a stored token and validate it
    const validateToken = async () => {
      if (token) {
        try {
          const user = await apiClient.getCurrentUser();
          setAuth(user, token);
        } catch {
          // Token is invalid, clear auth
          clearAuth();
        }
      } else {
        setLoading(false);
      }
      setIsInitialized(true);
    };

    validateToken();
  }, []);

  // Show loading spinner while initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  // Show children if authenticated
  return <>{children}</>;
}
