import { useState, useEffect } from 'react';
import {
  Plus,
  Truck,
  MapPin,
  Calendar,
  Pencil,
  Trash2,
  WifiOff,
  Radio,
  Navigation,
} from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { FleetMap } from '@/shared/components/fleet-map';
import type { TruckPin } from '@/shared/components/fleet-map';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { PostTruckSheet } from '@/features/trucks/components/post-truck-sheet';
import { useTrucks } from '@/features/trucks/hooks/use-trucks';
import { useAuth } from '@/contexts/AuthContext';
import { deleteTruck } from '@/services/trucks.service';
import { getMyActiveLoads } from '@/services/loads.service';
import { useLiveTracking } from '@/features/loads/hooks/use-live-tracking';
import { EQUIPMENT_LABELS } from '@freightx/shared';
import type { Truck as TruckType, Load } from '@freightx/shared';

/** Shows live GPS status for a single in-transit load */
function DriverGpsRow({ load }: { load: Load }) {
  const ping = useLiveTracking(load.loadNumber);
  const speedKmh = ping?.speed_ms != null ? Math.round(ping.speed_ms * 3.6) : null;
  const lastPing = ping?.recorded_at
    ? new Date(ping.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
        {ping ? (
          <span className="text-xs text-green-400 font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Live
          </span>
        ) : (
          <span className="text-xs text-fx-text-dim font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-fx-text-dim rounded-full" />
            Awaiting GPS
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-fx-text mb-1">
        {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
      </p>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-fx-orange bg-fx-orange/15 px-1.5 py-0.5 rounded-full">
          {EQUIPMENT_LABELS[load.equipment] ?? load.equipment}
        </span>
        {load.weightLbs > 0 && (
          <span className="text-[10px] text-fx-text-dim">
            {load.weightLbs.toLocaleString()} lbs
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-fx-text-muted">
        {speedKmh != null && (
          <span className="flex items-center gap-1">
            <Navigation size={11} className="text-fx-orange" />
            {speedKmh} km/h
          </span>
        )}
        {lastPing && <span>Last ping: {lastPing}</span>}
        {ping && (
          <span className="ml-auto text-green-400 font-semibold flex items-center gap-1">
            <Radio size={11} /> GPS
          </span>
        )}
      </div>
    </div>
  );
}

export default function CarrierFleetPage() {
  const { user } = useAuth();
  const [showPost, setShowPost] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckType | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeLoads, setActiveLoads] = useState<Load[]>([]);

  const { trucks, loading, error, refresh } = useTrucks(user ? { postedBy: user.id } : {});

  // Fetch in-transit loads with assigned drivers for GPS tracking
  useEffect(() => {
    if (user?.id) {
      getMyActiveLoads(user.id)
        .then((loads) =>
          setActiveLoads(loads.filter((l) => l.status === 'in_transit' && l.assignedDriverId)),
        )
        .catch(console.error);
    }
  }, [user?.id]);

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    setDeleting(true);
    try {
      await deleteTruck(id);
      refresh();
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="My Fleet" showBack />

      {/* Summary */}
      <div className="px-5 py-4">
        <div className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-fx-text-muted font-semibold uppercase tracking-widest">
              Posted Trucks
            </p>
            <p className="text-3xl font-extrabold text-fx-orange mt-1">
              {loading ? '—' : trucks.length}
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center">
            <Truck size={28} className="text-fx-orange" />
          </div>
        </div>
      </div>

      {/* Fleet map — shows origin pins for all posted trucks */}
      {!loading && trucks.length > 0 && (
        <div className="px-5 pb-4">
          <FleetMap
            trucks={trucks.map(
              (t): TruckPin => ({
                id: t.id,
                city: t.originCity,
                state: t.originState,
                equipment: t.equipment,
                status: t.status,
              }),
            )}
          />
        </div>
      )}

      {/* Active Driver GPS section */}
      {activeLoads.length > 0 && (
        <div className="px-5 pb-4">
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            Driver GPS Tracking
          </h2>
          <div className="space-y-3">
            {activeLoads.map((load) => (
              <DriverGpsRow key={load.id} load={load} />
            ))}
          </div>
        </div>
      )}

      {/* Truck list */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3">
        {loading ? (
          <SkeletonList count={4} />
        ) : error ? (
          <EmptyState
            icon={<WifiOff size={28} className="text-fx-text-dim" />}
            title="Couldn't load your fleet"
            subtitle={error}
            action={
              <button
                onClick={refresh}
                className="text-sm font-semibold text-fx-orange border border-fx-orange/30 px-5 py-2 rounded-xl hover:bg-fx-orange/10 transition-colors"
              >
                Try Again
              </button>
            }
          />
        ) : trucks.length === 0 ? (
          <EmptyState
            icon={<Truck size={28} className="text-fx-text-dim" />}
            title="No trucks posted"
            subtitle="Post your first truck to get matched with loads"
          />
        ) : (
          trucks.map((truck) => (
            <div key={truck.id} className="bg-fx-surface border border-fx-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge
                    variant={
                      truck.status === 'available'
                        ? 'green'
                        : truck.status === 'booked'
                          ? 'orange'
                          : 'gray'
                    }
                  >
                    {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
                  </Badge>
                  <p className="text-base font-bold text-fx-text mt-1.5">
                    {EQUIPMENT_LABELS[truck.equipment] ?? truck.equipment}
                    {truck.lengthFt && ` · ${truck.lengthFt}ft`}
                  </p>
                </div>
                <div className="text-2xl">🚛</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-fx-orange" />
                  <span className="text-sm text-fx-text-muted font-medium">
                    {truck.originCity}, {truck.originState}
                    {truck.destCity && ` → ${truck.destCity}, ${truck.destState}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-fx-text-dim" />
                  <span className="text-sm text-fx-text-muted font-medium">
                    Available{' '}
                    {new Date(truck.availableDate + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {truck.driverName && (
                <div className="mt-3 pt-3 border-t border-fx-border flex items-center justify-between">
                  <span className="text-xs text-fx-text-muted font-medium">
                    Driver: {truck.driverName}
                  </span>
                  <span className="text-xs text-fx-text-dim">{truck.driverPhone}</span>
                </div>
              )}

              {/* Edit / Delete actions */}
              <div className="mt-3 pt-3 border-t border-fx-border flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingTruck(truck);
                    setShowPost(true);
                  }}
                  className="flex-1 h-9 rounded-xl bg-fx-surface-2 border border-fx-border flex items-center justify-center gap-1.5 text-xs font-semibold text-fx-text-muted hover:border-fx-orange/40 hover:text-fx-orange transition-colors"
                >
                  <Pencil size={13} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(truck.id)}
                  disabled={deleting && confirmDeleteId === truck.id}
                  className={`flex-1 h-9 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                    confirmDeleteId === truck.id
                      ? 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'bg-fx-surface-2 border-fx-border text-fx-text-muted hover:border-red-500/30 hover:text-red-400'
                  }`}
                >
                  <Trash2 size={13} />
                  {confirmDeleteId === truck.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="px-5 py-4">
        <Button
          size="lg"
          fullWidth
          className="rounded-2xl font-bold"
          onClick={() => {
            setEditingTruck(null);
            setShowPost(true);
          }}
        >
          <Plus size={18} />
          Post New Truck
        </Button>
      </div>

      <BottomNav role="carrier" />

      <PostTruckSheet
        open={showPost}
        onClose={() => {
          setShowPost(false);
          setEditingTruck(null);
        }}
        onCreated={refresh}
        truck={editingTruck ?? undefined}
      />
    </div>
  );
}
