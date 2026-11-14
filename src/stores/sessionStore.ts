import { onAuthStateChanged, type User } from 'firebase/auth';
import { create } from 'zustand';

import { auth } from '@/lib/firebase/auth';

type SessionState = {
  user: User | null;
  /** True until Firebase restores (or fails to restore) the persisted session. */
  initializing: boolean;
};

export const useSession = create<SessionState>(() => ({ user: null, initializing: true }));

onAuthStateChanged(auth, (user) => useSession.setState({ user, initializing: false }));

export const useUid = (): string => {
  const uid = useSession((s) => s.user?.uid);
  if (!uid) throw new Error('useUid called outside the authenticated area');
  return uid;
};
