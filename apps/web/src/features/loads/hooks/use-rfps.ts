import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRfps,
  getOpenRfps,
  getRfpLanes,
  getRfpProposals,
  createRfp,
  addRfpLane,
  submitRfpProposal,
  awardRfpLane,
  publishRfp,
  type Rfp,
  type RfpLane,
  type RfpProposal,
} from '@/services/rfp.service';

export function useMyRfps(companyId: string | undefined) {
  const { data, isLoading, error } = useQuery<Rfp[]>({
    queryKey: ['rfps', companyId],
    queryFn: () => (companyId ? getRfps(companyId) : []),
    enabled: !!companyId,
    staleTime: 30_000,
  });
  return { rfps: data ?? [], loading: isLoading, error: error ? (error as Error).message : null };
}

export function useOpenRfps() {
  const { data, isLoading, error } = useQuery<Rfp[]>({
    queryKey: ['rfps-open'],
    queryFn: getOpenRfps,
    staleTime: 30_000,
  });
  return { rfps: data ?? [], loading: isLoading, error: error ? (error as Error).message : null };
}

export function useRfpLanes(rfpId: string | undefined) {
  const { data, isLoading, error } = useQuery<RfpLane[]>({
    queryKey: ['rfp-lanes', rfpId],
    queryFn: () => (rfpId ? getRfpLanes(rfpId) : []),
    enabled: !!rfpId,
    staleTime: 30_000,
  });
  return { lanes: data ?? [], loading: isLoading, error: error ? (error as Error).message : null };
}

export function useRfpProposals(rfpId: string | undefined) {
  const { data, isLoading, error } = useQuery<RfpProposal[]>({
    queryKey: ['rfp-proposals', rfpId],
    queryFn: () => (rfpId ? getRfpProposals(rfpId) : []),
    enabled: !!rfpId,
    staleTime: 30_000,
  });
  return {
    proposals: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useCreateRfp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRfp,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rfps'] }),
  });
}

export function useAddRfpLane() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addRfpLane,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rfp-lanes'] }),
  });
}

export function useSubmitProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitRfpProposal,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rfp-proposals'] }),
  });
}

export function useAwardLane() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: awardRfpLane,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rfp-proposals'] }),
  });
}

export function usePublishRfp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishRfp,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rfps'] }),
  });
}
