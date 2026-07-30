import { useState } from 'react';
import {
  User,
  Building2,
  Star,
  ChevronRight,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  FileText,
  Truck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getNavRole } from '@/shared/lib/utils';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { EditProfileSheet } from '@/features/profile/components/edit-profile-sheet';
import { EditCompanySheet } from '@/features/profile/components/edit-company-sheet';
import { CompanyReviewsList } from '@/features/companies/components/company-reviews-list';
import { ThemeToggle } from '@/features/profile/components/theme-toggle';
import { DeviceManager } from '@/features/profile/components/device-manager';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, company, signOut } = useAuth();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);

  const name = profile?.full_name ?? 'User';
  const email = profile?.email ?? '';
  const role = getNavRole(profile?.role);
  const avatarUrl = profile?.avatar_url;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  const MENU_SECTIONS: Array<{
    title: string;
    items: Array<{
      icon: React.ElementType;
      label: string;
      description: string;
      danger?: boolean;
      onPress?: () => void;
    }>;
  }> = [
    {
      title: 'Account',
      items: [
        {
          icon: User,
          label: 'Personal Info',
          description: 'Name, email, phone',
          onPress: () => setEditProfileOpen(true),
        },
        {
          icon: Building2,
          label: 'Company Profile',
          description: company?.name ?? 'Add company',
          onPress: () => setEditCompanyOpen(true),
        },
        {
          icon: FileText,
          label: 'Documents',
          description: 'MC, DOT, insurance',
          onPress: () => navigate('/profile/documents'),
        },
        ...(role !== 'driver' && role !== 'broker'
          ? [
              {
                icon: Truck,
                label: 'Equipment',
                description: 'Trucks & trailers',
                onPress: () => navigate('/carrier/fleet'),
              },
            ]
          : []),
        {
          icon: Users,
          label: 'Team Members',
          description: role === 'driver' ? 'View your team' : 'Invite & manage team',
          onPress: () => navigate(role === 'driver' ? '/driver/team' : '/carrier/team?tab=members'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Bell,
          label: 'Notifications',
          description: 'Alerts & push settings',
          onPress: () => navigate('/profile/notifications'),
        },
        {
          icon: Shield,
          label: 'Privacy & Security',
          description: 'Password, 2FA',
          onPress: () => navigate('/forgot-password'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: HelpCircle,
          label: 'Help Center',
          description: 'FAQs & guides',
          onPress: () => navigate('/profile/help'),
        },
        { icon: LogOut, label: 'Sign Out', description: '', danger: true },
      ],
    },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Profile" />

      <div className="flex-1 overflow-y-auto">
        {/* Profile hero */}
        <div className="px-5 py-6 flex flex-col items-center text-center">
          <button
            onClick={() => setEditProfileOpen(true)}
            className="w-20 h-20 rounded-3xl bg-fx-orange/10 border-2 border-fx-orange/30 flex items-center justify-center mb-4 overflow-hidden hover:opacity-90 transition-opacity"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-extrabold text-fx-orange">{initials}</span>
            )}
          </button>
          <h2 className="text-xl font-extrabold text-fx-text">{name}</h2>
          <p className="text-sm text-fx-text-muted mt-0.5">{email}</p>

          <div className="flex items-center gap-3 mt-3">
            <Badge variant="orange">{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>
            {company?.rating && (
              <div className="flex items-center gap-1">
                <Star size={13} className="text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-bold text-fx-text">{company.rating}</span>
                <span className="text-xs text-fx-text-muted">/ 5.0</span>
              </div>
            )}
          </div>
        </div>

        {/* Company Logo Section */}
        {company && (
          <div className="px-5 mb-6">
            <button
              onClick={() => setEditCompanyOpen(true)}
              className="w-full bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-4 hover:bg-fx-surface-2 transition-colors"
            >
              <div className="w-16 h-16 rounded-lg bg-fx-orange/10 border-2 border-fx-orange/30 flex items-center justify-center overflow-hidden shrink-0">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-extrabold text-fx-orange">
                    {company.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-fx-text">{company.name}</p>
                <p className="text-xs text-fx-text-muted mt-0.5">Tap to edit company profile</p>
              </div>
              <ChevronRight size={18} className="text-fx-text-dim" />
            </button>
          </div>
        )}

        {/* Stats strip */}
        <div className="mx-5 mb-6 bg-fx-surface border border-fx-border rounded-2xl grid grid-cols-3 divide-x divide-fx-border">
          <div className="p-4 text-center">
            <p className="text-lg font-extrabold text-fx-orange">{company?.total_loads ?? 0}</p>
            <p className="text-[10px] font-semibold text-fx-text-muted uppercase tracking-wider mt-0.5">
              Loads
            </p>
          </div>
          <div className="p-4 text-center">
            <p className="text-lg font-extrabold text-fx-orange">
              {company?.on_time_percent != null ? `${company.on_time_percent}%` : '—'}
            </p>
            <p className="text-[10px] font-semibold text-fx-text-muted uppercase tracking-wider mt-0.5">
              On-Time
            </p>
          </div>
          <div className="p-4 text-center">
            <p className="text-lg font-extrabold text-fx-orange">
              {profile?.created_at
                ? `${new Date().getFullYear() - new Date(profile.created_at).getFullYear() || '<1'} yr`
                : '—'}
            </p>
            <p className="text-[10px] font-semibold text-fx-text-muted uppercase tracking-wider mt-0.5">
              Member
            </p>
          </div>
        </div>

        {/* Reviews Section */}
        {company?.id && (
          <div className="mx-5 mb-6">
            <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3 px-1">
              Company Reviews
            </p>
            <CompanyReviewsList companyId={company.id} />
          </div>
        )}

        {/* Theme toggle */}
        <div className="mx-5 mb-6">
          <ThemeToggle />
        </div>

        {/* Registered devices */}
        <div className="mx-5 mb-6">
          <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3 px-1">
            Registered Devices
          </p>
          <DeviceManager />
        </div>

        {/* Menu sections */}
        <div className="px-5 space-y-6 pb-4">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 px-1">
                {section.title}
              </p>
              <div className="bg-fx-surface border border-fx-border rounded-2xl divide-y divide-fx-border overflow-hidden">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.danger ? handleSignOut : item.onPress}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-fx-surface-2 transition-colors text-left ${item.danger ? 'hover:bg-red-500/5' : ''}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.danger
                          ? 'bg-red-500/10 border border-red-500/20'
                          : 'bg-fx-surface-2 border border-fx-border'
                      }`}
                    >
                      <item.icon
                        size={16}
                        className={item.danger ? 'text-red-400' : 'text-fx-text-muted'}
                      />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold ${item.danger ? 'text-red-400' : 'text-fx-text'}`}
                      >
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-fx-text-dim mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {!item.danger && (
                      <ChevronRight size={16} className="text-fx-text-dim shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-fx-text-dim pb-6">FreightX v2.0.0 · Phase 13</p>
      </div>

      <BottomNav role={role} />

      <EditProfileSheet open={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
      <EditCompanySheet open={editCompanyOpen} onClose={() => setEditCompanyOpen(false)} />
    </div>
  );
}
