import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFacilities,
  getDockSlots,
  getAvailableDockSlots,
  getAppointments,
  bookDockAppointment,
  createFacility,
  createDockSlot,
  dockCheckIn,
  dockCheckOut,
  type Facility,
  type DockSlot,
  type AvailableSlot,
  type DockAppointment,
} from '@/services/dock-scheduling.service';

export function useFacilities(companyId: string | undefined) {
  const { data, isLoading, error } = useQuery<Facility[]>({
    queryKey: ['facilities', companyId],
    queryFn: () => (companyId ? getFacilities(companyId) : []),
    enabled: !!companyId,
    staleTime: 60_000,
  });
  return {
    facilities: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useDockSlots(facilityId: string | undefined) {
  const { data, isLoading, error } = useQuery<DockSlot[]>({
    queryKey: ['dock-slots', facilityId],
    queryFn: () => (facilityId ? getDockSlots(facilityId) : []),
    enabled: !!facilityId,
    staleTime: 60_000,
  });
  return { slots: data ?? [], loading: isLoading, error: error ? (error as Error).message : null };
}

export function useAvailableSlots(facilityId: string | undefined, date: string | undefined) {
  const { data, isLoading, error } = useQuery<AvailableSlot[]>({
    queryKey: ['available-slots', facilityId, date],
    queryFn: () => (facilityId && date ? getAvailableDockSlots(facilityId, date) : []),
    enabled: !!facilityId && !!date,
    staleTime: 30_000,
  });
  return {
    available: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useAppointments(facilityId: string | undefined, date?: string) {
  const { data, isLoading, error } = useQuery<DockAppointment[]>({
    queryKey: ['appointments', facilityId, date],
    queryFn: () => (facilityId ? getAppointments(facilityId, date) : []),
    enabled: !!facilityId,
    staleTime: 30_000,
  });
  return {
    appointments: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bookDockAppointment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['available-slots'] });
    },
  });
}

export function useCreateFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFacility,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
}

export function useCreateDockSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDockSlot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dock-slots'] });
    },
  });
}

export function useDockActions() {
  const queryClient = useQueryClient();

  const checkIn = useMutation({
    mutationFn: dockCheckIn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const checkOut = useMutation({
    mutationFn: dockCheckOut,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  return { checkIn, checkOut };
}
