import { Smartphone, Monitor, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyDevices,
  deregisterDevice,
  type MobileDevice,
} from '@/services/mobile-devices.service';

const TYPE_ICONS: Record<string, React.ElementType> = {
  ios: Smartphone,
  android: Smartphone,
  web: Monitor,
};

export function DeviceManager() {
  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery<MobileDevice[]>({
    queryKey: ['my-devices'],
    queryFn: getMyDevices,
    staleTime: 60_000,
  });

  const removeMutation = useMutation({
    mutationFn: deregisterDevice,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['my-devices'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="w-4 h-4 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (devices.length === 0) {
    return <p className="text-center text-fx-text-dim text-xs py-4">No registered devices</p>;
  }

  return (
    <div className="bg-fx-surface border border-fx-border rounded-2xl divide-y divide-fx-border overflow-hidden">
      {devices.map((device) => {
        const Icon = TYPE_ICONS[device.platform] ?? Monitor;
        return (
          <div key={device.id} className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
              <Icon size={14} className="text-fx-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fx-text truncate">
                {device.device_model ?? device.device_id}
              </p>
              <p className="text-[10px] text-fx-text-dim">
                {device.platform.toUpperCase()} · Last active{' '}
                {new Date(device.last_active_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => removeMutation.mutate(device.id)}
              disabled={removeMutation.isPending}
              className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
