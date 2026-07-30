import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyInvitations,
  updateInvitationStatus,
  inviteCarriersToLoad,
  type LoadInvitation,
} from '@/services/invitations.service';

export function useInvitations(companyId: string | undefined) {
  const { data, isLoading, error } = useQuery<LoadInvitation[]>({
    queryKey: ['invitations', companyId],
    queryFn: () => (companyId ? getMyInvitations(companyId) : []),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  return {
    invitations: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invitationId,
      status,
    }: {
      invitationId: string;
      status: 'accepted' | 'declined';
    }) => updateInvitationStatus(invitationId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

export function useInviteCarriers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ loadId, carrierCompanyIds }: { loadId: string; carrierCompanyIds: string[] }) =>
      inviteCarriersToLoad(loadId, carrierCompanyIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}
