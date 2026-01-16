/**
 * Login page component with Google Sign-In
 */

import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { setAuth, setLoading } = useAuthStore();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      console.error('No credential received from Google');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.loginWithGoogle(credentialResponse.credential);
      setAuth(response.user, response.accessToken);
      onLoginSuccess();
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google Sign-In failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">K-Base</h1>
          <p className="text-gray-600">
            Branching brainstorming and learning
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-center mb-4">
            Sign in to access your conversations
          </p>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
              width={280}
            />
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>Your data is stored securely and isolated per user.</p>
        </div>
      </div>
    </div>
  );
}
