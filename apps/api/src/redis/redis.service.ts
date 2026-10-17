import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private isAvailable = false;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('REDIS_URL not configured. Redis features running in fallback mode.');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });

      this.client.on('error', (err) => {
        this.isAvailable = false;
      });

      this.client.on('connect', () => {
        this.isAvailable = true;
      });

      this.client.connect().catch(() => {
        this.isAvailable = false;
      });
    } catch {
      this.isAvailable = false;
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  /**
   * Whitelists a session by storing its JTI in a set for the user.
   * Returns true on success, or false if mandatory Redis session creation fails.
   */
  async whitelistSession(userId: string, jti: string, expiresInSeconds: number): Promise<boolean> {
    const isMandatory = Boolean(process.env.REDIS_URL || process.env.NODE_ENV === 'production');
    if (!this.client || !this.isAvailable) {
      if (isMandatory) return false;
      return true; // Standalone development without Redis
    }
    try {
      const key = `sessions:${userId}`;
      await this.client.sadd(key, jti);
      await this.client.set(`session:${jti}`, userId, 'EX', expiresInSeconds);
      return true;
    } catch {
      if (isMandatory) return false;
      return true;
    }
  }

  /**
   * Revokes a specific session.
   */
  async revokeSession(userId: string, jti: string): Promise<void> {
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.srem(`sessions:${userId}`, jti);
      await this.client.del(`session:${jti}`);
    } catch {
      // Graceful degradation
    }
  }

  /**
   * Revokes all sessions for a user (Log out of all devices).
   */
  async revokeAllSessions(userId: string): Promise<void> {
    if (!this.client || !this.isAvailable) return;
    try {
      const key = `sessions:${userId}`;
      const sessions = await this.client.smembers(key);
      if (sessions.length > 0) {
        const pipeline = this.client.pipeline();
        sessions.forEach(jti => pipeline.del(`session:${jti}`));
        pipeline.del(key);
        await pipeline.exec();
      }
    } catch {
      // Graceful degradation
    }
  }

  /**
   * Checks if a session is valid. Fail closed when Redis is configured.
   */
  async isSessionValid(userId: string, jti?: string): Promise<boolean> {
    if (!jti) {
      // All valid issued tokens must contain a JTI
      return false;
    }

    if (!process.env.REDIS_URL) {
      // Standalone development without Redis configured
      return true;
    }

    if (!this.client || !this.isAvailable) {
      // Redis configured but unavailable: fail closed to prevent revoked session reuse
      return false;
    }

    try {
      const isValid = await this.client.exists(`session:${jti}`);
      return isValid === 1;
    } catch {
      return false;
    }
  }

  // --- Active Users Tracking ---

  /**
   * Marks a user as active/online (TTL 5 minutes).
   */
  async trackOnlineUser(userId: string): Promise<void> {
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.set(`online:${userId}`, 'active', 'EX', 300);
    } catch {
      // Graceful degradation
    }
  }

  /**
   * Retrieves a list of all currently online user IDs.
   */
  async getOnlineUsers(): Promise<string[]> {
    if (!this.client || !this.isAvailable) return [];
    try {
      const keys = await this.client.keys('online:*');
      return keys.map(k => k.replace('online:', ''));
    } catch {
      return [];
    }
  }

  // --- Login Attempts Limiting ---

  async incrementLoginAttempts(email: string): Promise<number> {
    if (!this.client || !this.isAvailable) return 0;
    try {
      const key = `login_attempts:${email.toLowerCase().trim()}`;
      const attempts = await this.client.incr(key);
      if (attempts === 1) {
        await this.client.expire(key, 900); // 15 minute temporary block window
      }
      return attempts;
    } catch {
      return 0;
    }
  }

  async isLoginLocked(email: string): Promise<boolean> {
    if (!this.client || !this.isAvailable) return false;
    try {
      const key = `login_attempts:${email.toLowerCase().trim()}`;
      const attempts = await this.client.get(key);
      return attempts ? Number(attempts) >= 5 : false;
    } catch {
      return false;
    }
  }

  async resetLoginAttempts(email: string): Promise<void> {
    if (!this.client || !this.isAvailable) return;
    try {
      const key = `login_attempts:${email.toLowerCase().trim()}`;
      await this.client.del(key);
    } catch {
      // Graceful degradation
    }
  }
}


