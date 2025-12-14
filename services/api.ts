import { User, Post } from '../types';

// Points to your backend API. 
// In production, this would be an environment variable.
const API_URL = 'http://74.208.158.126:3000'; 

export const ApiService = {
  // Helper for requests
  request: async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API Request failed');
    }
    return data;
  },

  login: async (username: string, password: string): Promise<User> => {
    const data = await ApiService.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('token', data.token);
    return data.user;
  },

  register: async (userData: any): Promise<User> => {
    const data = await ApiService.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
    localStorage.setItem('token', data.token);
    return data.user;
  },

  getFeed: async (): Promise<Post[]> => {
    return ApiService.request('/feed');
  },

  getPostsByUser: async (userId: string): Promise<Post[]> => {
     // For MVP, we filter on client or assume feed returns all. 
     // Ideally backend endpoint needed: /users/:id/posts
     const posts = await ApiService.getFeed();
     return posts.filter(p => p.authorId === userId);
  },

  createPost: async (postData: Partial<Post>): Promise<void> => {
    await ApiService.request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  },

  // Uploads video to MinIO via Backend Presigned URL
  uploadMedia: async (file: File): Promise<string> => {
    // 1. Get Presigned URL
    const { uploadUrl, publicUrl } = await ApiService.request('/upload/presigned', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name })
    });

    // 2. Upload directly to Object Storage
    await fetch(uploadUrl, {
        method: 'PUT',
        body: file
    });

    return publicUrl;
  }
};