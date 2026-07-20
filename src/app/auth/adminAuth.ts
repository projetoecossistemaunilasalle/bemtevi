export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AdminAccount {
  id: string;
  email: string;
}

interface BackendResult<T> {
  error: Error | null;
  session?: T;
}

export interface AdminAuthBackend {
  getSession(): Promise<BackendResult<AuthSession | null>>;
  signInWithPassword(email: string, password: string): Promise<BackendResult<AuthSession | null>>;
  signOut(): Promise<{ error: Error | null }>;
  isAdmin(userId: string): Promise<{ isAdmin: boolean; error: Error | null }>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
}

export type AdminAuthErrorCode = 'invalid_credentials' | 'not_admin' | 'not_configured' | 'unavailable';

export class AdminAuthError extends Error {
  constructor(
    public readonly code: AdminAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

export interface AdminAuthService {
  restore(): Promise<AdminAccount | null>;
  login(email: string, password: string): Promise<AdminAccount>;
  logout(): Promise<void>;
  subscribe(listener: (account: AdminAccount | null) => void): () => void;
}

function accountFromSession(session: AuthSession): AdminAccount {
  return {
    id: session.user.id,
    email: session.user.email ?? 'Administrador',
  };
}

const MOCK_ADMIN_ACCOUNT: AdminAccount = {
  id: 'mock-admin',
  email: 'dev@bemtevi.test',
};

export function createMockAdminAuthService(): AdminAuthService {
  return {
    async restore() {
      return MOCK_ADMIN_ACCOUNT;
    },
    async login() {
      return MOCK_ADMIN_ACCOUNT;
    },
    async logout() {
      return undefined;
    },
    subscribe() {
      return () => undefined;
    },
  };
}

export function createAdminAuthService(backend: AdminAuthBackend | null): AdminAuthService {
  let sessionGeneration = 0;

  function requireBackend() {
    if (!backend) {
      throw new AdminAuthError('not_configured', 'A autenticação administrativa não está configurada.');
    }

    return backend;
  }

  async function authorize(session: AuthSession) {
    const currentBackend = requireBackend();
    const result = await currentBackend.isAdmin(session.user.id);

    if (result.error) {
      throw new AdminAuthError('unavailable', 'Não foi possível verificar a autorização administrativa.');
    }

    if (!result.isAdmin) {
      return null;
    }

    return accountFromSession(session);
  }

  return {
    async restore() {
      const currentBackend = requireBackend();
      const generation = sessionGeneration;
      const result = await currentBackend.getSession();

      if (result.error) {
        throw new AdminAuthError('unavailable', 'Não foi possível restaurar a sessão administrativa.');
      }

      if (!result.session) return null;
      const account = await authorize(result.session);
      if (generation !== sessionGeneration) return null;
      if (!account) await currentBackend.signOut();
      return account;
    },

    async login(email, password) {
      const currentBackend = requireBackend();
      const result = await currentBackend.signInWithPassword(email, password);

      if (result.error || !result.session) {
        throw new AdminAuthError('invalid_credentials', 'E-mail ou senha inválidos.');
      }

      const account = await authorize(result.session);
      if (!account) {
        sessionGeneration++;
        await currentBackend.signOut();
        throw new AdminAuthError('not_admin', 'Esta conta não possui acesso administrativo.');
      }

      return account;
    },

    async logout() {
      sessionGeneration++;
      const result = await requireBackend().signOut();
      if (result.error) {
        throw new AdminAuthError('unavailable', 'Não foi possível encerrar a sessão administrativa.');
      }
    },

    subscribe(listener) {
      const currentBackend = requireBackend();
      return currentBackend.subscribe((session) => {
        const generation = ++sessionGeneration;
        if (!session) {
          listener(null);
          return;
        }

        queueMicrotask(() => {
          void authorize(session)
            .then(async (account) => {
              if (generation !== sessionGeneration) return;
              if (!account) {
                listener(null);
                sessionGeneration++;
                await currentBackend.signOut();
                return;
              }
              listener(account);
            })
            .catch(() => {
              if (generation === sessionGeneration) listener(null);
            });
        });
      });
    },
  };
}
