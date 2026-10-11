import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  // --- Session Management (Denylist/Whitelist) ---

  /**
   * Whitelists a session by storing its JTI in a set for the user.
   */
  async whitelistSession(userId: string, jti: string, expiresInSeconds: number): Promise<void> {
    const key = `sessions:${userId}`;
    // Add jti to the set of valid sessions
    await this.client.sadd(key, jti);
    // Optional: expire the entire set if no activity, but since sessions have varied expirations, 
    // it's better to just periodically clean up or let individual lookups handle it.
    // For a strict TTL per session, we can also store a simple key:
    await this.client.set(\`session:\${jti}\`, userId, 'EX', expiresInSeconds);
  }

  /**
   * Revokes a specific session.
   */
  async revokeSession(userId: string, jti: string): Promise<void> {
    await this.client.srem(`sessions:${userId}`, jti);
    await this.client.del(\`session:\${jti}\`);
  }

  /**
   * Revokes all sessions for a user (Log out of all devices).
   */
  async revokeAllSessions(userId: string): Promise<void> {
    const key = `sessions:${userId}`;
    const sessions = await this.client.smembers(key);
    if (sessions.length > 0) {
      const pipeline = this.client.pipeline();
      sessions.forEach(jti => pipeline.del(\`session:\${jti}\`));
      pipeline.del(key);
      await pipeline.exec();
    }
  }

  /**
   * Checks if a session is valid.
   */
  async isSessionValid(userId: string, jti: string): Promise<boolean> {
    const isValid = await this.client.exists(\`session:\${jti}\`);
    return isValid === 1;
  }

  // --- Active Users Tracking ---

  /**
   * Marks a user as active/online (TTL 5 minutes).
   */
  async trackOnlineUser(userId: string): Promise<void> {
    await this.client.set(\`online:\${userId}\`, 'active', 'EX', 300);
  }

  /**
   * Retrieves a list of all currently online user IDs.
   */
  async getOnlineUsers(): Promise<string[]> {
    const keys = await this.client.keys('online:*');
    return keys.map(k => k.replace('online:', ''));
  }
}
