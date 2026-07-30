import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  MapPin,
  Navigation,
  Radio,
  Loader2,
  Truck,
  Plus,
  Trash2,
  Crown,
  Shield,
  Calculator,
  Eye,
  Mail,
  UserCheck,
  Copy,
  Check,
} from 'lucide-react';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { Badge } from '@/shared/components/ui/badge';
import { MapView } from '@/shared/components/map-view';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMyActiveLoads, getCompanyDrivers } from '@/services/loads.service';
import { useLiveTracking } from '@/features/loads/hooks/use-live-tracking';
import {
  getCompanyMembers,
  getCompanyInvites,
  inviteMember,
  removeMember,
  updateMemberRole,
  revokeInvite,
  type CompanyMember,
  type CompanyInvite,
  type MemberRole,
} from '@/services/company-members.service';
import type { Load } from '@freightx/shared';

/* ── Types ─────────────────────────────────────────────────────── */

interface DriverProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/* ── Driver cards — powered by company_members + loads ── */

function DriverCard({
  driver,
  loads,
  onTap,
}: {
  driver: DriverProfile;
  loads: Load[];
  onTap: () => void;
}) {
  const driverLoads = loads.filter(
    (l) => l.assignedDriverId === driver.id || l.secondDriverId === driver.id,
  );
  const activeLoad = driverLoads.find((l) => l.status === 'in_transit');
  const name = driver.full_name ?? driver.email ?? 'Unknown';

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-fx-surface border border-fx-border rounded-2xl p-4 transition-colors active:bg-fx-surface-2"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
          <span className="text-sm font-extrabold text-fx-orange">
            {name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-fx-text truncate">{name}</p>
          <p className="text-[11px] text-fx-text-dim">
            {driverLoads.length} load{driverLoads.length !== 1 ? 's' : ''} assigned
          </p>
        </div>
        <Badge variant={activeLoad ? 'orange' : 'green'}>
          {activeLoad ? 'In Transit' : 'Available'}
        </Badge>
      </div>
      {activeLoad && <ActiveLoadRow load={activeLoad} />}
    </button>
  );
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'orange' | 'blue' | 'green' | 'gray' }
> = {
  in_transit: { label: 'In Transit', variant: 'orange' },
  dispatched: { label: 'Dispatched', variant: 'blue' },
  awarded: { label: 'Awarded', variant: 'blue' },
  delivered: { label: 'Delivered', variant: 'green' },
  completed: { label: 'Completed', variant: 'gray' },
};

const DONE_STATUSES = new Set(['delivered', 'completed']);

function ActiveLoadRow({ load }: { load: Load }) {
  const isDone = DONE_STATUSES.has(load.status);
  // Skip realtime subscription for completed loads
  const ping = useLiveTracking(isDone ? null : load.loadNumber);
  const speedMph = ping?.speed_ms != null ? Math.round(ping.speed_ms * 2.237) : null;
  const lastPing = ping?.recorded_at
    ? new Date(ping.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const badge = STATUS_BADGE[load.status];

  return (
    <div
      className={`bg-fx-surface-2 border border-fx-border rounded-xl p-3 space-y-2${isDone ? ' opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
          {badge && (
            <Badge variant={badge.variant} className="text-[9px] px-1.5 py-0">
              {badge.label}
            </Badge>
          )}
        </div>
        {!isDone &&
          (ping ? (
            <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live GPS
            </span>
          ) : (
            <span className="text-[10px] text-fx-text-dim flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-fx-text-dim rounded-full" />
              No GPS
            </span>
          ))}
      </div>
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-fx-orange shrink-0" />
        <p className="text-xs text-fx-text-muted truncate">
          {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
        </p>
      </div>
      {!isDone && ping && (
        <div className="flex items-center gap-3 text-[11px] text-fx-text-dim">
          {speedMph != null && (
            <span className="flex items-center gap-1">
              <Navigation size={10} className="text-fx-orange" />
              {speedMph} mph
            </span>
          )}
          {lastPing && <span>Last: {lastPing}</span>}
          <span className="ml-auto text-green-400 flex items-center gap-1">
            <Radio size={10} /> Tracking
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Driver detail bottom sheet ────────────────────────────────── */

function DriverDetailSheet({
  driver,
  loads,
  open,
  onClose,
}: {
  driver: DriverProfile | null;
  loads: Load[];
  open: boolean;
  onClose: () => void;
}) {
  if (!driver) return null;

  const name = driver.full_name ?? driver.email ?? 'Unknown';
  const driverLoads = loads.filter(
    (l) => l.assignedDriverId === driver.id || l.secondDriverId === driver.id,
  );
  const activeLoad = driverLoads.find((l) => l.status === 'in_transit');

  return (
    <BottomSheet open={open} onClose={onClose} title="Driver Details">
      <div className="space-y-4 pb-4">
        {/* Driver info header */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
            <span className="text-lg font-extrabold text-fx-orange">
              {name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-fx-text">{name}</p>
            {driver.email && <p className="text-xs text-fx-text-dim">{driver.email}</p>}
          </div>
          <Badge variant={activeLoad ? 'orange' : 'green'}>
            {activeLoad ? 'In Transit' : 'Available'}
          </Badge>
        </div>

        {/* Live GPS map for active load */}
        {activeLoad && <DriverGpsMap load={activeLoad} />}

        {/* Assigned loads */}
        {driverLoads.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Assigned Loads ({driverLoads.length})
            </p>
            <div className="space-y-2">
              {[...driverLoads]
                .sort((a, b) => {
                  const p: Record<string, number> = {
                    in_transit: 0,
                    dispatched: 1,
                    awarded: 2,
                    delivered: 3,
                    completed: 4,
                  };
                  return (p[a.status] ?? 5) - (p[b.status] ?? 5);
                })
                .map((load) => (
                  <ActiveLoadRow key={load.id} load={load} />
                ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Truck size={28} className="text-fx-text-dim mx-auto mb-2" />
            <p className="text-sm text-fx-text-muted">No loads assigned</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function DriverGpsMap({ load }: { load: Load }) {
  const ping = useLiveTracking(load.loadNumber);
  const speedMph = ping?.speed_ms != null ? Math.round(ping.speed_ms * 2.237) : null;
  const lastPing = ping?.recorded_at
    ? new Date(ping.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;
  const livePos: [number, number] | undefined = ping ? [ping.latitude, ping.longitude] : undefined;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest">
        Live Location — {load.loadNumber}
      </p>
      <MapView
        origin={{ city: load.originCity ?? '', state: load.originState ?? '' }}
        destination={{ city: load.destCity ?? '', state: load.destState ?? '' }}
        inTransit
        livePosition={livePos}
        heading={ping?.heading_deg}
        className="h-52 rounded-2xl"
      />
      {ping && (
        <div className="flex items-center gap-4 text-xs text-fx-text-dim">
          {speedMph != null && (
            <span className="flex items-center gap-1">
              <Navigation size={12} className="text-fx-orange" />
              {speedMph} mph
            </span>
          )}
          {lastPing && <span>Last ping: {lastPing}</span>}
          <span className="ml-auto text-green-400 flex items-center gap-1">
            <Radio size={12} /> Live
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Members tab role constants ──────────────────────────────── */

const ROLE_META: Record<
  MemberRole,
  { label: string; desc: string; icon: React.ElementType; color: string }
> = {
  owner: {
    label: 'Owner',
    desc: 'Full control, billing, and member management',
    icon: Crown,
    color: 'text-yellow-400',
  },
  admin: {
    label: 'Admin',
    desc: 'Manage team, loads, and settings',
    icon: Shield,
    color: 'text-blue-400',
  },
  dispatcher: {
    label: 'Dispatcher',
    desc: 'Assign drivers, dispatch loads, update status',
    icon: Truck,
    color: 'text-fx-orange',
  },
  accounting: {
    label: 'Accounting',
    desc: 'View rates, invoices, and financials',
    icon: Calculator,
    color: 'text-green-400',
  },
  viewer: {
    label: 'Viewer',
    desc: 'Read-only access to loads and team',
    icon: Eye,
    color: 'text-fx-text-dim',
  },
  driver: {
    label: 'Driver',
    desc: 'View assigned loads, GPS tracking, and document uploads',
    icon: UserCheck,
    color: 'text-green-300',
  },
};

const INVITE_ROLES: MemberRole[] = ['driver', 'dispatcher', 'admin', 'accounting', 'viewer'];

/* ── Members Tab Content ───────────────────────────────────────── */

function MembersTabContent() {
  const { profile, company } = useAuth();

  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('driver');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const companyId = company?.id;
  const myRole = members.find((m) => m.user_id === profile?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    Promise.all([getCompanyMembers(companyId), getCompanyInvites(companyId)])
      .then(([m, i]) => {
        setMembers(m);
        setInvites(i);
      })
      .catch((err) => console.error('Failed to load team settings:', err))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    setLastInviteLink(null);
    setCopied(false);
    try {
      if (inviteRole === 'driver') {
        // Admin-provisioned driver flow via edge function
        const { data, error } = await supabase.functions.invoke('invite-driver', {
          body: {
            email: inviteEmail.trim(),
            full_name: inviteFullName.trim() || undefined,
            phone: invitePhone.trim() || undefined,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setInviteSuccess(`Driver invite sent to ${inviteEmail}`);
        setLastInviteLink(data.signup_link);
        setInviteEmail('');
        setInviteFullName('');
        setInvitePhone('');
      } else {
        // Existing flow for non-driver roles
        const invite = await inviteMember({
          companyId,
          email: inviteEmail.trim(),
          role: inviteRole,
          inviterName: profile?.full_name ?? undefined,
          companyName: company?.name ?? undefined,
        });
        setInviteSuccess(`Invite sent to ${inviteEmail}`);
        const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin;
        setLastInviteLink(`${appUrl}/invite/${invite.token}`);
        setInviteEmail('');
        const updated = await getCompanyInvites(companyId);
        setInvites(updated);
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    await removeMember(memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  async function handleRoleChange(memberId: string, role: MemberRole) {
    await updateMemberRole(memberId, role);
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
  }

  async function handleRevokeInvite(inviteId: string) {
    await revokeInvite(inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="text-fx-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Company header */}
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-fx-orange/10 border-2 border-fx-orange/30 flex items-center justify-center overflow-hidden">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
          ) : (
            <Users size={24} className="text-fx-orange" />
          )}
        </div>
        <h1 className="text-xl font-bold text-fx-text">{company?.name ?? 'Your Company'}</h1>
        <p className="text-sm text-fx-text-muted">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Invite Form */}
      {canManage && (
        <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            Invite Team Member
          </p>
          <form onSubmit={handleInvite} className="space-y-3">
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
            />
            {inviteRole === 'driver' && (
              <>
                <input
                  type="text"
                  placeholder="Driver's full name (optional)"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
                />
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
                />
              </>
            )}
            <div className="flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                className="min-w-0 flex-1 h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
                style={{ colorScheme: 'dark' }}
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r} value={r} style={{ background: '#141414' }}>
                    {ROLE_META[r].label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="shrink-0 px-4 h-10 rounded-xl text-sm font-bold bg-fx-orange text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {inviting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Invite
              </button>
            </div>
            <p className="text-[11px] text-fx-text-dim mt-1 leading-snug">
              <span className="font-semibold text-fx-text-muted">
                {ROLE_META[inviteRole].label}:
              </span>{' '}
              {ROLE_META[inviteRole].desc}
            </p>
            {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-400">{inviteSuccess}</p>}
            {lastInviteLink && (
              <div className="bg-fx-surface-2 border border-fx-border rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest">
                  Share this link with your driver
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-fx-text-muted flex-1 truncate font-mono select-all">
                    {lastInviteLink}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(lastInviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 px-3 h-8 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-fx-orange/20 text-fx-orange transition-colors"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Members List */}
      <div>
        <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-3">
          Members
        </p>
        <div className="space-y-2">
          {members.map((member) => {
            const meta = ROLE_META[member.role];
            const Icon = meta?.icon ?? Eye;
            const isMe = member.user_id === profile?.id;
            const isOwner = member.role === 'owner';
            return (
              <div
                key={member.id}
                className="bg-fx-surface border border-fx-border rounded-2xl p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
                  <Icon size={16} className={meta?.color ?? 'text-fx-text-dim'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fx-text truncate">
                    {member.full_name ?? member.email ?? 'Unknown'}
                    {isMe && <span className="ml-1.5 text-[10px] text-fx-text-dim">(you)</span>}
                  </p>
                  <p className="text-[11px] text-fx-text-dim">{member.email ?? ''}</p>
                </div>
                {canManage && !isOwner && !isMe ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                      className="h-8 bg-fx-surface-2 border border-fx-border rounded-lg text-fx-text text-xs px-2 focus:border-fx-orange outline-none"
                      style={{ colorScheme: 'dark' }}
                    >
                      {INVITE_ROLES.map((r) => (
                        <option key={r} value={r} style={{ background: '#141414' }}>
                          {ROLE_META[r].label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <span className={`text-[11px] font-bold ${meta?.color ?? 'text-fx-text-dim'}`}>
                    {meta?.label ?? member.role}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            Pending Invites
          </p>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="bg-fx-surface border border-fx-border rounded-2xl p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
                  <Mail size={16} className="text-fx-text-dim" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fx-text truncate">{invite.email}</p>
                  <p className="text-[11px] text-fx-text-dim">
                    {ROLE_META[invite.role]?.label ?? invite.role} · Expires{' '}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRevokeInvite(invite.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page — tabbed: Drivers / Members ──────────────────────── */

type TeamTab = 'drivers' | 'members';

export default function CarrierTeamPage() {
  const { company, user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'members' ? 'members' : 'drivers';
  const [activeTab, setActiveTab] = useState<TeamTab>(initialTab);

  const [loads, setLoads] = useState<Load[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const companyId = company?.id;
  const inTransitCount = loads.filter((l) => l.status === 'in_transit').length;

  function switchTab(tab: TeamTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'members' ? { tab: 'members' } : {});
  }

  useEffect(() => {
    if (!companyId || !user?.id) {
      setLoading(false);
      return;
    }

    const loadsPromise = getMyActiveLoads(user.id).catch((err) => {
      console.error('Failed to load active loads:', err);
      return [] as Load[];
    });

    const driversPromise = getCompanyDrivers(companyId).catch((err) => {
      console.error('Failed to load company drivers:', err);
      return [] as Array<{ id: string; fullName: string; email: string }>;
    });

    Promise.all([loadsPromise, driversPromise])
      .then(async ([l, companyDrivers]) => {
        setLoads(l);

        const driverMap = new Map<string, DriverProfile>();
        for (const d of companyDrivers) {
          driverMap.set(d.id, {
            id: d.id,
            full_name: d.fullName,
            email: d.email,
            avatar_url: null,
          });
        }

        // Also include drivers from load assignments (assigned_driver_id + second_driver_id)
        const assignedIds = [
          ...new Set([
            ...(l.map((load) => load.assignedDriverId).filter(Boolean) as string[]),
            ...(l.map((load) => load.secondDriverId).filter(Boolean) as string[]),
          ]),
        ].filter((id) => !driverMap.has(id));

        if (assignedIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', assignedIds);
          for (const p of (profiles as DriverProfile[]) ?? []) {
            driverMap.set(p.id, p);
          }
        }

        setDriverProfiles([...driverMap.values()]);
      })
      .catch((err) => console.error('Failed to load team:', err))
      .finally(() => setLoading(false));
  }, [companyId, user?.id]);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Team" />

      {/* Tab bar */}
      <div className="px-5 pt-2 pb-1 flex gap-2">
        {(['drivers', 'members'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`flex-1 h-10 rounded-xl text-sm font-bold transition-colors ${
              activeTab === tab
                ? 'bg-fx-orange text-white'
                : 'bg-fx-surface border border-fx-border text-fx-text-muted hover:text-fx-text'
            }`}
          >
            {tab === 'drivers' ? 'Drivers' : 'Members'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {activeTab === 'members' ? (
          <MembersTabContent />
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="text-fx-orange animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="bg-fx-surface border border-fx-border rounded-2xl p-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-fx-orange">{driverProfiles.length}</p>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mt-0.5">
                  Drivers
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-fx-orange">{inTransitCount}</p>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mt-0.5">
                  In Transit
                </p>
              </div>
            </div>

            {/* Unassigned load banner */}
            {loads.filter((l) => l.status === 'in_transit' && !l.assignedDriverId).length > 0 && (
              <div className="bg-fx-orange/10 border border-fx-orange/20 rounded-2xl p-3 flex items-center gap-3">
                <Truck size={18} className="text-fx-orange shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-fx-orange">
                    {loads.filter((l) => l.status === 'in_transit' && !l.assignedDriverId).length}{' '}
                    load(s) in transit without a driver assigned
                  </p>
                  <p className="text-[11px] text-fx-text-dim mt-0.5">
                    Assign a driver from load details to enable GPS tracking
                  </p>
                </div>
              </div>
            )}

            {/* Driver cards */}
            {driverProfiles.length === 0 ? (
              <EmptyState
                icon={<Users size={28} className="text-fx-text-dim" />}
                title="No drivers on your team"
                subtitle="Switch to the Members tab to invite drivers"
              />
            ) : (
              <div className="space-y-3">
                {driverProfiles.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    loads={loads}
                    onTap={() => setSelectedDriver(driver)}
                  />
                ))}
              </div>
            )}

            <DriverDetailSheet
              driver={selectedDriver}
              loads={loads}
              open={!!selectedDriver}
              onClose={() => setSelectedDriver(null)}
            />
          </>
        )}
      </div>

      <BottomNav role={profile?.role === 'broker' ? 'broker' : 'carrier'} />
    </div>
  );
}
