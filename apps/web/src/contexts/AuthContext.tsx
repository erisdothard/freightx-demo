import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, CompanyRow, UserRole } from '@/lib/database.types';

interface AuthState {
  user: User | null;
  profile: ProfileRow | null;
  company: CompanyRow | null;
  session: Session | null;
  loading: boolean;
}

interface CompanyInput {
  name: string;
  mc_number?: string;
  dot_number?: string;
  broker_authority?: string;
  phone?: string;
  email?: string;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: (role?: UserRole, inviteToken?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  createCompany: (data: CompanyInput) => Promise<{ error: string | null }>;
  updateProfile: (data: Partial<ProfileRow>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  /** Demo mode — bypass auth with a mock profile for the given role */
  enterDemoMode: (role: UserRole) => void;
  isDemo: boolean;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

const DEMO_PROFILES: Record<string, { name: string; email: string; company: string }> = {
  carrier: {
    name: 'Marcus Rivera',
    email: 'carrier@freightx.com',
    company: 'Rivera Transport Inc',
  },
  broker: { name: 'Sarah Chen', email: 'broker@freightx.com', company: 'Apex Freight Solutions' },
  shipper: { name: 'James Park', email: 'shipper@freightx.com', company: 'Park Manufacturing Co' },
  driver: { name: 'Carlos Mendez', email: 'driver@freightx.com', company: 'Rivera Transport Inc' },
  admin: { name: 'Admin User', email: 'admin@freightx.com', company: 'FreightX Platform' },
};

/**
 * Demo role is persisted for the tab's lifetime so refreshes and shared deep
 * links keep working. sessionStorage (not localStorage) on purpose — a demo
 * should not outlive the tab it was started in.
 */
const DEMO_STORAGE_KEY = 'fx_demo_role';

function readStoredDemoRole(): UserRole | null {
  try {
    const role = sessionStorage.getItem(DEMO_STORAGE_KEY);
    return role && role in DEMO_PROFILES ? (role as UserRole) : null;
  } catch {
    // sessionStorage can throw in private-mode / sandboxed contexts
    return null;
  }
}

/**
 * Builds the mock auth state for a demo role. The `demo-` id prefix is the
 * signal every service uses to serve mock data instead of calling Supabase.
 */
function buildDemoState(role: UserRole) {
  const demo = DEMO_PROFILES[role] ?? DEMO_PROFILES.carrier;
  const fakeId = `demo-${role}-${Date.now()}`;

  return {
    user: { id: fakeId, email: demo.email } as User,
    session: { access_token: 'demo' } as Session,
    profile: {
      id: fakeId,
      email: demo.email,
      full_name: demo.name,
      role,
      status: 'active',
      onboarding_complete: true,
      avatar_url: null,
      phone: null,
      phone_verified_at: null,
      phone_carrier_type: null,
      carrier_id: null,
      theme: 'dark',
      last_known_location: null,
      last_location_update: null,
      last_synced_at: null,
      current_duty_status: null,
      duty_status_updated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ProfileRow,
    company: {
      id: `demo-company-${role}`,
      owner_id: fakeId,
      name: demo.company,
      type: role === 'driver' ? 'carrier' : role,
      mc_number: 'MC-123456',
      dot_number: 'DOT-789012',
      status: 'active',
    } as unknown as CompanyRow,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Rehydrate demo mode synchronously so a refresh never flashes the login
  // screen or redirects away from a shared deep link.
  const restored = useState(() => {
    const role = readStoredDemoRole();
    return role ? buildDemoState(role) : null;
  })[0];

  const [user, setUser] = useState<User | null>(restored?.user ?? null);
  const [profile, setProfile] = useState<ProfileRow | null>(restored?.profile ?? null);
  const [company, setCompany] = useState<CompanyRow | null>(restored?.company ?? null);
  const [session, setSession] = useState<Session | null>(restored?.session ?? null);
  const [loading, setLoading] = useState(!restored);
  const [isDemo, setIsDemo] = useState(!!restored);

  // Mirrors isDemo for the async auth callbacks below. Those close over state
  // from the render that registered them, so they need a ref to see a demo
  // session that started after they were kicked off.
  const demoRef = useRef(!!restored);

  const fetchCompany = useCallback(async (profileId: string, role?: string) => {
    // 1. For non-drivers, check owned company first
    if (role !== 'driver') {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', profileId)
        .maybeSingle();
      if (data) {
        setCompany(data);
        return;
      }
    }

    // 2. Fallback: find company via company_members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('company_members')
      .select('company_id')
      .eq('user_id', profileId)
      .limit(1)
      .maybeSingle();
    if (membership) {
      const { data: co } = await supabase
        .from('companies')
        .select('*')
        .eq('id', membership.company_id)
        .single();
      setCompany(co ?? null);
      return;
    }

    // 3. Last resort for drivers: check owned company
    if (role === 'driver') {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', profileId)
        .maybeSingle();
      setCompany(data ?? null);
      return;
    }

    setCompany(null);
  }, []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      setProfile(data ?? null);
      if (data) await fetchCompany(data.id, data.role);
    },
    [fetchCompany],
  );

  useEffect(() => {
    // In demo mode there is no real session to restore, and onAuthStateChange
    // would fire with a null session and wipe the mock profile.
    if (restored) return;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        // Demo mode may have started while this was in flight (e.g. landing
        // straight on /demo). Applying a null session here would wipe it.
        if (demoRef.current) return;

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (demoRef.current) return;
        console.error('Auth initialization error:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (demoRef.current) return;

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setCompany(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, restored]);

  /** Sign in with email + password */
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  /**
   * Sign up — passes full_name + role as metadata so the DB trigger
   * creates the profile row automatically. No manual insert needed.
   */
  const signUp = useCallback(
    async (email: string, password: string, fullName: string, role: UserRole) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  /**
   * Sign in with Google OAuth. Persists role + invite token to localStorage
   * before the redirect so auth-callback.tsx can pick them up.
   */
  const signInWithGoogle = useCallback(async (role?: UserRole, inviteToken?: string) => {
    if (role) localStorage.setItem('fx_oauth_role', role);
    else localStorage.removeItem('fx_oauth_role');
    if (inviteToken) localStorage.setItem('fx_oauth_invite_token', inviteToken);
    else localStorage.removeItem('fx_oauth_invite_token');

    const redirectTo = `${import.meta.env.VITE_APP_URL ?? window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isDemo) await supabase.auth.signOut();
    demoRef.current = false;
    try {
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // Ignore — nothing to clear if storage is unavailable.
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setCompany(null);
    setIsDemo(false);
  }, [isDemo]);

  const enterDemoMode = useCallback((role: UserRole) => {
    const demo = buildDemoState(role);
    demoRef.current = true;

    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, role);
    } catch {
      // Non-fatal: demo still works, it just won't survive a refresh.
    }

    setUser(demo.user);
    setSession(demo.session);
    setProfile(demo.profile);
    setCompany(demo.company);
    setIsDemo(true);
    setLoading(false);
  }, []);

  /**
   * Create the company for the current user (called in onboarding Step 3).
   * Also marks profile.onboarding_complete = true.
   */
  const createCompany = useCallback(
    async (data: CompanyInput) => {
      if (!user || !profile) return { error: 'Not authenticated' };

      const { error: companyErr } = await supabase.from('companies').insert({
        owner_id: user.id,
        type: profile.role === 'admin' || profile.role === 'driver' ? 'carrier' : profile.role,
        name: data.name,
        mc_number: data.mc_number ?? null,
        dot_number: data.dot_number ?? null,
        broker_authority: data.broker_authority ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
      });
      if (companyErr) return { error: companyErr.message };

      // Mark onboarding complete
      await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);

      // Refresh local state
      await fetchProfile(user.id);
      return { error: null };
    },
    [user, profile, fetchProfile],
  );

  const updateProfile = useCallback(
    async (data: Partial<ProfileRow>) => {
      if (!user) return { error: 'Not authenticated' };
      const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
      if (!error) await fetchProfile(user.id);
      return { error: error?.message ?? null };
    },
    [user, fetchProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        company,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        createCompany,
        updateProfile,
        refreshProfile,
        enterDemoMode,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
