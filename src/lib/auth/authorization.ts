export type VerifiedUser = { id: string; isAnonymous: boolean };
export type AuthGateway = {
  getVerifiedUser(): Promise<VerifiedUser | null>;
  getProfileRole(userId: string): Promise<string | null>;
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): Promise<boolean>;
};

export type AdminAccess =
  | { allowed: true; userId: string }
  | { allowed: false; reason: 'unauthenticated' | 'forbidden' | 'unavailable' };

/** No cached role, client claims, user_metadata or production permissions. */
export async function authorizeAdmin(
  gateway: AuthGateway,
): Promise<AdminAccess> {
  try {
    const user = await gateway.getVerifiedUser();
    if (!user) return { allowed: false, reason: 'unauthenticated' };
    if (user.isAnonymous) return { allowed: false, reason: 'forbidden' };
    const role = await gateway.getProfileRole(user.id);
    if (role !== 'admin') return { allowed: false, reason: 'forbidden' };
    return { allowed: true, userId: user.id };
  } catch {
    return { allowed: false, reason: 'unavailable' };
  }
}

export type LoginResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid' | 'credentials' | 'forbidden' | 'unavailable';
    };

export async function loginAdmin(
  gateway: AuthGateway,
  email: unknown,
  password: unknown,
): Promise<LoginResult> {
  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 1024
  )
    return { ok: false, reason: 'invalid' };
  try {
    if (!(await gateway.signIn(email.trim(), password))) {
      return { ok: false, reason: 'credentials' };
    }
    const access = await authorizeAdmin(gateway);
    if (access.allowed) return { ok: true };
    if (!(await gateway.signOut())) return { ok: false, reason: 'unavailable' };
    return {
      ok: false,
      reason: access.reason === 'forbidden' ? 'forbidden' : 'unavailable',
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
