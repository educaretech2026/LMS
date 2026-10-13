import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'educare_access_token';
const USER_KEY = 'educare_user_profile';

// Fallback in-memory map for web development if running in browser
const webMemoryStore = new Map<string, string>();

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    } else {
      webMemoryStore.set(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return webMemoryStore.get(key) || null;
  }
  return await SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    } else {
      webMemoryStore.delete(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const Storage = {
  async saveToken(token: string): Promise<void> {
    await setItem(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await deleteItem(TOKEN_KEY);
  },

  async saveUser(user: any): Promise<void> {
    await setItem(USER_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<any | null> {
    const raw = await getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async clearAuth(): Promise<void> {
    await deleteItem(TOKEN_KEY);
    await deleteItem(USER_KEY);
  },
};
