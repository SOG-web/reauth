import { randomBytes } from 'crypto';
import type { SessionServiceV2, SessionV2 } from './types.v2';

export class SessionServiceV2Impl implements SessionServiceV2 {
  private sessions = new Map<string, SessionV2>(); // In-memory for demo, use DB in production

  async createSession(subject_id: string, ttlSeconds: number): Promise<SessionV2> {
    // Enforce minimum session TTL of 30 seconds
    if (ttlSeconds < 30) {
      throw new Error('Session TTL must be at least 30 seconds');
    }

    const session: SessionV2 = {
      id: this.generateId(),
      subject_id,
      token: this.generateToken(),
      expires_at: new Date(Date.now() + ttlSeconds * 1000),
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.sessions.set(session.token, session);
    return session;
  }

  async getSession(token: string): Promise<SessionV2 | null> {
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    // Check expiry
    if (session.expires_at < new Date()) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async refreshSession(token: string, ttlSeconds: number): Promise<SessionV2> {
    const session = await this.getSession(token);
    if (!session) {
      throw new Error('Session not found');
    }

    // Enforce minimum session TTL of 30 seconds
    if (ttlSeconds < 30) {
      throw new Error('Session TTL must be at least 30 seconds');
    }

    session.expires_at = new Date(Date.now() + ttlSeconds * 1000);
    session.updated_at = new Date();

    this.sessions.set(token, session);
    return session;
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}