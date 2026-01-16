/**
 * API client for K-Base backend
 */

import type {
  Topic,
  TopicCreate,
  Session,
  SessionCreate,
  Node,
  ChatRequest,
  ChatResponse,
  SideChatThread,
  User,
  AuthResponse,
  UserPreferences,
  UserPreferencesUpdate,
  ModelsResponse,
} from '@/types/models';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert camelCase to snake_case
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Recursively transform object keys
function transformKeys<T>(obj: unknown, transformer: (key: string) => string): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, transformer)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = transformer(key);
      result[newKey] = transformKeys(value, transformer);
    }
    return result as T;
  }

  return obj as T;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = useAuthStore.getState().token;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Transform request body keys to snake_case
    let body = options.body;
    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        body = JSON.stringify(transformKeys(parsed, camelToSnake));
      } catch {
        // Not JSON, leave as is
      }
    }

    const response = await fetch(url, {
      ...options,
      body,
      headers: {
        'Content-Type': 'application/json',
        ...(skipAuth ? {} : this.getAuthHeaders()),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    // Handle empty responses (like DELETE)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return undefined as T;
    }

    const data = await response.json();
    // Transform response keys to camelCase
    return transformKeys<T>(data, snakeToCamel);
  }

  // Auth methods
  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      },
      true // Skip auth header for login
    );
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // User Preferences
  async getPreferences(): Promise<UserPreferences | null> {
    return this.request<UserPreferences | null>('/users/me/preferences');
  }

  async updatePreferences(data: UserPreferencesUpdate): Promise<UserPreferences> {
    return this.request<UserPreferences>('/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Models
  async getModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('/chat/models');
  }

  // Topics
  async getTopics(): Promise<Topic[]> {
    return this.request<Topic[]>('/topics');
  }

  async getTopic(id: string): Promise<Topic> {
    return this.request<Topic>(`/topics/${id}`);
  }

  async createTopic(data: TopicCreate): Promise<Topic> {
    return this.request<Topic>('/topics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTopic(id: string, data: Partial<TopicCreate>): Promise<Topic> {
    return this.request<Topic>(`/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTopic(id: string): Promise<void> {
    await this.request<void>(`/topics/${id}`, {
      method: 'DELETE',
    });
  }

  // Sessions
  async getSessions(topicId: string): Promise<Session[]> {
    return this.request<Session[]>(`/topics/${topicId}/sessions`);
  }

  async getSession(id: string): Promise<Session> {
    return this.request<Session>(`/sessions/${id}`);
  }

  async createSession(data: SessionCreate): Promise<Session> {
    return this.request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSession(id: string, data: { name?: string; description?: string }): Promise<Session> {
    return this.request<Session>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.request<void>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  async getSessionTree(sessionId: string): Promise<Node[]> {
    return this.request<Node[]>(`/sessions/${sessionId}/tree`);
  }

  async getSessionSideChatThreads(sessionId: string): Promise<SideChatThread[]> {
    return this.request<SideChatThread[]>(`/sessions/${sessionId}/side-chat-threads`);
  }

  // Nodes
  async getNode(id: string): Promise<Node> {
    return this.request<Node>(`/nodes/${id}`);
  }

  async getNodePath(id: string): Promise<Node[]> {
    return this.request<Node[]>(`/nodes/${id}/path`);
  }

  async getNodeChildren(id: string): Promise<Node[]> {
    return this.request<Node[]>(`/nodes/${id}/children`);
  }

  async getNodeSiblings(id: string): Promise<Node[]> {
    return this.request<Node[]>(`/nodes/${id}/siblings`);
  }

  async selectBranch(nodeId: string): Promise<Node> {
    return this.request<Node>(`/nodes/${nodeId}/select`, {
      method: 'POST',
    });
  }

  // Notes
  async addNote(nodeId: string, content: string): Promise<Node> {
    return this.request<Node>(`/nodes/${nodeId}/note`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getNote(nodeId: string): Promise<Node | null> {
    try {
      return await this.request<Node>(`/nodes/${nodeId}/note`);
    } catch {
      return null; // Note not found
    }
  }

  async deleteNote(nodeId: string): Promise<void> {
    await this.request<void>(`/nodes/${nodeId}/note`, {
      method: 'DELETE',
    });
  }

  // Side Chats
  async getSideChatThreads(nodeId: string): Promise<{
    selectedText: string | null;
    selectionStart: number | null;
    selectionEnd: number | null;
    count: number;
  }[]> {
    return this.request<{
      selectedText: string | null;
      selectionStart: number | null;
      selectionEnd: number | null;
      count: number;
    }[]>(`/nodes/${nodeId}/side-chat-threads`);
  }

  async getSideChats(nodeId: string, selectedText?: string): Promise<Node[]> {
    const params = selectedText !== undefined
      ? `?selected_text=${encodeURIComponent(selectedText)}`
      : '';
    return this.request<Node[]>(`/nodes/${nodeId}/side-chats${params}`);
  }

  async sendSideChatStream(
    parentNodeId: string,
    content: string,
    selectedText: string | undefined,
    selectionStart: number | undefined,
    selectionEnd: number | undefined,
    includeMainContext: boolean,
    callbacks: {
      onUserNode: (node: Node) => void;
      onToken: (token: string) => void;
      onComplete: (node: Node) => void;
      onError: (error: Error) => void;
    },
    model?: string
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/side-chat/stream`;
    const body = JSON.stringify(transformKeys({ parentNodeId, content, selectedText, selectionStart, selectionEnd, includeMainContext, model }, camelToSnake));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (line: string) => {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) return;

          try {
            const event = JSON.parse(jsonStr);
            const transformed = transformKeys<{
              type: string;
              node?: Node;
              token?: string;
            }>(event, snakeToCamel);

            switch (transformed.type) {
              case 'user_node':
                if (transformed.node) {
                  callbacks.onUserNode(transformed.node);
                }
                break;
              case 'token':
                if (transformed.token !== undefined) {
                  callbacks.onToken(transformed.token);
                }
                break;
              case 'complete':
                if (transformed.node) {
                  callbacks.onComplete(transformed.node);
                }
                break;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', parseError);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        const lines = buffer.split('\n');
        buffer = done ? '' : (lines.pop() || '');

        for (const line of lines) {
          processLine(line);
        }

        if (done) break;
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Chat
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Streaming chat
  async sendMessageStream(
    request: ChatRequest,
    callbacks: {
      onUserNode: (node: Node) => void;
      onToken: (token: string) => void;
      onComplete: (node: Node) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/stream`;
    const body = JSON.stringify(transformKeys(request, camelToSnake));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (line: string) => {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) return;

          try {
            const event = JSON.parse(jsonStr);
            const transformed = transformKeys<{
              type: string;
              node?: Node;
              token?: string;
            }>(event, snakeToCamel);

            switch (transformed.type) {
              case 'user_node':
                if (transformed.node) {
                  callbacks.onUserNode(transformed.node);
                }
                break;
              case 'token':
                if (transformed.token !== undefined) {
                  callbacks.onToken(transformed.token);
                }
                break;
              case 'complete':
                if (transformed.node) {
                  callbacks.onComplete(transformed.node);
                }
                break;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', parseError);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        const lines = buffer.split('\n');
        buffer = done ? '' : (lines.pop() || '');

        for (const line of lines) {
          processLine(line);
        }

        if (done) break;
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
