import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { InvitationsList } from '@/features/loads/components/invitations-list';
import { useInvitations } from '@/features/loads/hooks/use-invitations';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';

export default function CarrierInvitationsPage() {
  const { profile, company } = useAuth();
  const role = getNavRole(profile?.role);
  const { invitations, loading, error } = useInvitations(company?.id);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Load Invitations" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <SkeletonList count={3} />}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && <InvitationsList invitations={invitations} />}
      </div>

      <BottomNav role={role} />
    </div>
  );
}
