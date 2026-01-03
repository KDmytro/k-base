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
} from '@/types/models';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
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

  async deleteSession(id: string): Promise<void> {
    await this.request<void>(`/sessions/${id}`, {
      method: 'DELETE',
    });
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

  // Chat
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // TODO: Implement streaming chat with WebSocket or SSE
  async *streamMessage(request: ChatRequest): AsyncGenerator<string> {
    // Placeholder for streaming implementation
    const response = await this.sendMessage(request);
    yield response.assistantNode.content;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
