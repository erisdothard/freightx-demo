import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TopHeader } from '@/shared/components/top-header';
import { StatCard } from '@/shared/components/stat-card';
import { Badge } from '@/shared/components/ui/badge';
import { Spinner } from '@/shared/components/spinner';
import {
  Users,
  Package,
  Truck,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Building2,
  FileText,
  LogOut,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalCompanies: number;
  totalLoads: number;
  totalTrucks: number;
  pendingVerifications: number;
  activeLoads: number;
  completedLoads: number;
}

interface RecentUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

interface VerificationItem {
  id: string;
  company_name: string;
  mc_number: string | null;
  verification_status: string;
  created_at: string;
}

interface SupabaseVerif {
  id: string;
  status: string;
  created_at: string;
  companies: { name: string; mc_number: string | null } | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [pendingVerifs, setPendingVerifs] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [
          { count: totalUsers },
          { count: totalCompanies },
          { count: totalLoads },
          { count: totalTrucks },
          { count: activeLoads },
          { count: completedLoads },
          { data: usersData },
          { data: verifData },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('companies').select('*', { count: 'exact', head: true }),
          supabase.from('loads').select('*', { count: 'exact', head: true }),
          supabase.from('trucks').select('*', { count: 'exact', head: true }),
          supabase
            .from('loads')
            .select('*', { count: 'exact', head: true })
            .in('status', ['posted', 'bid_received', 'awarded', 'dispatched', 'in_transit']),
          supabase
            .from('loads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed'),
          supabase
            .from('profiles')
            .select('id, full_name, email, role, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('carrier_verifications')
            .select('id, status, created_at, companies(name, mc_number)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        setStats({
          totalUsers: totalUsers ?? 0,
          totalCompanies: totalCompanies ?? 0,
          totalLoads: totalLoads ?? 0,
          totalTrucks: totalTrucks ?? 0,
          pendingVerifications: verifData?.length ?? 0,
          activeLoads: activeLoads ?? 0,
          completedLoads: completedLoads ?? 0,
        });

        setRecentUsers((usersData as RecentUser[]) ?? []);

        const mappedVerifs: VerificationItem[] = (
          (verifData as unknown as SupabaseVerif[]) ?? []
        ).map((v: SupabaseVerif) => ({
          id: v.id,
          company_name: v.companies?.name ?? '—',
          mc_number: v.companies?.mc_number ?? null,
          verification_status: v.status,
          created_at: v.created_at,
        }));
        setPendingVerifs(mappedVerifs);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const roleColor: Record<string, string> = {
    carrier: 'text-fx-orange',
    broker: 'text-blue-400',
    shipper: 'text-emerald-400',
    admin: 'text-purple-400',
  };

  return (
    <div className="min-h-dvh bg-fx-bg pb-8">
      <TopHeader title="Admin — Platform Overview" />

      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="px-4 space-y-6 mt-4">
          {/* Platform Stats */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-fx-text-dim mb-3">
              Platform Stats
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Users"
                value={stats?.totalUsers ?? 0}
                trend="up"
                trendValue=""
                icon={<Users size={18} className="text-fx-orange" />}
              />
              <StatCard
                label="Companies"
                value={stats?.totalCompanies ?? 0}
                trend="up"
                trendValue=""
                icon={<Building2 size={18} className="text-blue-400" />}
              />
              <StatCard
                label="Total Loads"
                value={stats?.totalLoads ?? 0}
                trend="up"
                trendValue=""
                icon={<Package size={18} className="text-emerald-400" />}
              />
              <StatCard
                label="Trucks Posted"
                value={stats?.totalTrucks ?? 0}
                trend="up"
                trendValue=""
                icon={<Truck size={18} className="text-amber-400" />}
              />
            </div>
          </section>

          {/* Load Health */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-fx-text-dim mb-3">
              Load Health
            </p>
            <div className="bg-fx-surface rounded-2xl divide-y divide-fx-border">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <span className="text-sm text-fx-text">Active Loads</span>
                </div>
                <span className="text-sm font-semibold text-fx-text">{stats?.activeLoads}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle size={16} className="text-blue-400" />
                  <span className="text-sm text-fx-text">Completed</span>
                </div>
                <span className="text-sm font-semibold text-fx-text">{stats?.completedLoads}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Clock size={16} className="text-amber-400" />
                  <span className="text-sm text-fx-text">Pending Verifications</span>
                </div>
                <span className="text-sm font-semibold text-fx-text">
                  {stats?.pendingVerifications}
                </span>
              </div>
            </div>
          </section>

          {/* Pending Verifications */}
          {pendingVerifs.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-fx-text-dim mb-3">
                Pending Verifications
              </p>
              <div className="bg-fx-surface rounded-2xl divide-y divide-fx-border">
                {pendingVerifs.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fx-text truncate">{v.company_name}</p>
                      {v.mc_number && <p className="text-xs text-fx-text-dim">MC# {v.mc_number}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AlertCircle size={14} className="text-amber-400" />
                      <Badge variant="orange" size="sm">
                        Pending
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Users */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-fx-text-dim mb-3">
              Recent Signups
            </p>
            <div className="bg-fx-surface rounded-2xl divide-y divide-fx-border">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-fx-text-dim text-center py-6">No users yet</p>
              ) : (
                recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fx-text truncate">
                        {u.full_name ?? 'Unnamed'}
                      </p>
                      <p className="text-xs text-fx-text-dim truncate">{u.email}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold capitalize ${roleColor[u.role] ?? 'text-fx-text-dim'}`}
                    >
                      {u.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Admin Actions */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-fx-text-dim mb-3">
              Admin Actions
            </p>
            <div className="bg-fx-surface rounded-2xl divide-y divide-fx-border">
              <button className="flex items-center gap-3 px-4 py-3.5 w-full text-left">
                <ShieldCheck size={16} className="text-fx-orange" />
                <span className="text-sm text-fx-text">Review Verifications</span>
              </button>
              <button
                onClick={() => navigate('/admin/audit-log')}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
              >
                <FileText size={16} className="text-purple-400" />
                <span className="text-sm text-fx-text">Audit Log</span>
              </button>
              <button
                onClick={() => navigate('/admin/factoring-risk')}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
              >
                <AlertCircle size={16} className="text-amber-400" />
                <span className="text-sm text-fx-text">Factoring Risk</span>
              </button>
              <button
                onClick={() => navigate('/admin/notifications')}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
              >
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-sm text-fx-text">Notification Health</span>
              </button>
              <button
                onClick={() => void signOut()}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
              >
                <LogOut size={16} className="text-red-400" />
                <span className="text-sm text-red-400">Sign Out</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
