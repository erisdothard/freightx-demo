import { useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TrustProfileCard } from '@/features/ratings/components/trust-profile-card';
import { useTrustProfile } from '@/features/ratings/hooks/use-trust-profile';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';

export default function TrustProfilePage() {
  const { companyId } = useParams<{ companyId?: string }>();
  const { profile: userProfile, company } = useAuth();
  const role = getNavRole(userProfile?.role);

  const targetId = companyId ?? company?.id;
  const { profile, loading, error } = useTrustProfile(targetId);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Trust Profile" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <SkeletonList count={3} />}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && !profile && (
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title="No trust profile found"
            subtitle="Reviews will appear here after completed loads."
          />
        )}

        {profile && <TrustProfileCard profile={profile} />}
      </div>

      <BottomNav role={role} />
    </div>
  );
}
