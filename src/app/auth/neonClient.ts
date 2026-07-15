import type { AdminAuthBackend, AuthSession } from './adminAuth';
import { defaultNeonClient } from '../neon/client';

interface NeonUser {
  id: string;
  email?: string;
}

interface NeonSessionData {
  session?: { id?: string; user?: NeonUser };
  user?: NeonUser;
}

interface NeonError {
  message: string;
}

export interface NeonAuthClient {
  auth: {
    getSession(): Promise<{ data: NeonSessionData | null; error: NeonError | null }>;
    signIn: {
      email(credentials: {
        email: string;
        password: string;
      }): Promise<{ data: NeonSessionData | null; error: NeonError | null }>;
    };
    signOut(): Promise<{ error: NeonError | null }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): Promise<{ data: Array<{ user_id: string }> | null; error: NeonError | null }>;
    };
  };
}

function toError(error: NeonError | null) {
  return error ? new Error(error.message) : null;
}

function toSession(data: NeonSessionData | null): AuthSession | null {
  const user = data?.user ?? data?.session?.user;
  if (!user) return null;
  return { user: { id: user.id, email: user.email } };
}

export function createNeonAdminAuthBackend(
  client: NeonAuthClient | null = defaultNeonClient as unknown as NeonAuthClient | null,
): AdminAuthBackend | null {
  if (client === null) return null;

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    return { session: toSession(data), error: toError(error) };
  }

  return {
    getSession,

    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signIn.email({ email, password });
      return { session: toSession(data), error: toError(error) };
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      return { error: toError(error) };
    },

    async isAdmin(userId) {
      const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', userId);
      return { isAdmin: data?.some((row) => row.user_id === userId) ?? false, error: toError(error) };
    },

    subscribe(listener) {
      const syncSession = () => {
        void getSession().then((result) => listener(result.session ?? null));
      };
      const syncCrossTabSession = (event: StorageEvent) => {
        if (event.key === 'better-auth.message') syncSession();
      };
      window.addEventListener('focus', syncSession);
      window.addEventListener('storage', syncCrossTabSession);
      return () => {
        window.removeEventListener('focus', syncSession);
        window.removeEventListener('storage', syncCrossTabSession);
      };
    },
  };
}
