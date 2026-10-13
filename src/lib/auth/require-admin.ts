import 'server-only';
import { redirect } from 'next/navigation';
import { authorizeAdmin } from './authorization';
import { createPageAuth } from './supabase';

export async function requireAdminPage() {
  const gateway = await createPageAuth();
  if (!gateway) redirect('/login?error=disabled');
  const access = await authorizeAdmin(gateway);
  if (!access.allowed) {
    if (access.reason === 'unauthenticated') redirect('/login?error=session');
    if (access.reason === 'forbidden') redirect('/access-denied');
    redirect('/login?error=unavailable');
  }
  return access;
}
