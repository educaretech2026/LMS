import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private isAvailable = false;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      if (process.env.REQUIRE_REDIS === 'true') {
        throw new Error('FATAL: REDIS_URL is mandatory when REQUIRE_REDIS is enabled.');
      }
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

  get isConnected(): boolean {
    return this.isAvailable;
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
   * Returns true on success, or false if mandatory Redis session revocation fails.
   */
  async revokeSession(userId: string, jti: string): Promise<boolean> {
    const isMandatory = Boolean(process.env.REDIS_URL || process.env.NODE_ENV === 'production');
    if (!this.client || !this.isAvailable) {
      if (isMandatory) return false;
      return true; // Local development without Redis
    }
    try {
      await this.client.srem(`sessions:${userId}`, jti);
      await this.client.del(`session:${jti}`);
      return true;
    } catch (err: any) {
      console.error(`Failed to revoke Redis session for user ${userId}:`, err?.message || err);
      if (isMandatory) return false;
      return true;
    }
  }

  /**
   * Revokes all sessions for a user (Log out of all devices).
   * Returns true on success, or false if mandatory Redis session revocation fails.
   */
  async revokeAllSessions(userId: string): Promise<boolean> {
    const isMandatory = Boolean(process.env.REDIS_URL || process.env.NODE_ENV === 'production');
    if (!this.client || !this.isAvailable) {
      if (isMandatory) return false;
      return true; // Local development without Redis
    }
    try {
      const key = `sessions:${userId}`;
      const sessions = await this.client.smembers(key);
      if (sessions.length > 0) {
        const pipeline = this.client.pipeline();
        sessions.forEach(jti => pipeline.del(`session:${jti}`));
        pipeline.del(key);
        const results = await pipeline.exec();
        if (!results) {
          console.error(`Pipeline execution returned null when revoking sessions for user ${userId}`);
          if (isMandatory) return false;
          return true;
        }
        for (const [err] of results) {
          if (err) {
            console.error(`Pipeline command error when revoking sessions for user ${userId}:`, err.message || err);
            if (isMandatory) return false;
            return true;
          }
        }
      }
      return true;
    } catch (err: any) {
      console.error(`Failed to revoke all Redis sessions for user ${userId}:`, err?.message || err);
      if (isMandatory) return false;
      return true;
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

    if (!process.env.REDIS_URL || !this.client || !this.isAvailable) {
      if (process.env.REQUIRE_REDIS === 'true' || process.env.DEPLOYED_STAGING === 'true') {
        return false;
      }
      return true;
    }

    try {
      const isValid = await this.client.exists(`session:${jti}`);
      return isValid === 1;
    } catch {
      if (process.env.REQUIRE_REDIS === 'true' || process.env.DEPLOYED_STAGING === 'true') {
        return false;
      }
      return true;
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

  // --- Raw Key/Value Operations ---

  async getRaw(key: string): Promise<string | null> {
    if (!this.client || !this.isAvailable) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setRaw(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client || !this.isAvailable) return;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      // Graceful degradation
    }
  }

  async delRaw(key: string): Promise<void> {
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.del(key);
    } catch {
      // Graceful degradation
    }
  }

  // --- Mandatory First-Time Password Change Tracking ---
  private inMemoryMustChangePwd = new Set<string>();

  async setMustChangePassword(userId: string): Promise<void> {
    this.inMemoryMustChangePwd.add(userId);
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.set(`must_change_pwd:${userId}`, 'true');
    } catch {}
  }

  async isMustChangePassword(userId: string): Promise<boolean> {
    if (this.inMemoryMustChangePwd.has(userId)) return true;
    if (!this.client || !this.isAvailable) return false;
    try {
      const res = await this.client.get(`must_change_pwd:${userId}`);
      return res === 'true';
    } catch {
      return false;
    }
  }

  async clearMustChangePassword(userId: string): Promise<void> {
    this.inMemoryMustChangePwd.delete(userId);
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.del(`must_change_pwd:${userId}`);
    } catch {}
  }

  // --- User-Specific Module Permission Overrides ---
  private inMemoryUserModules = new Map<string, string[]>();

  async setUserModulePermissions(userId: string, modules: string[]): Promise<void> {
    this.inMemoryUserModules.set(userId, modules);
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.set(`user:modules:${userId}`, JSON.stringify(modules));
    } catch {}
  }

  async getUserModulePermissions(userId: string): Promise<string[] | null> {
    if (this.inMemoryUserModules.has(userId)) {
      return this.inMemoryUserModules.get(userId) || null;
    }
    if (!this.client || !this.isAvailable) return null;
    try {
      const data = await this.client.get(`user:modules:${userId}`);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.inMemoryUserModules.set(userId, parsed);
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async clearUserModulePermissions(userId: string): Promise<void> {
    this.inMemoryUserModules.delete(userId);
    if (!this.client || !this.isAvailable) return;
    try {
      await this.client.del(`user:modules:${userId}`);
    } catch {}
  }
}


