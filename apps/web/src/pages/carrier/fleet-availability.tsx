/**
 * Fleet Availability Map
 *
 * Shows carrier where all their drivers are in real-time:
 * - 🟢 Green pins: On-duty drivers (available for assignment)
 * - 🔵 Blue pins: Dispatched drivers (assigned but not yet in transit)
 * - 🟠 Orange pins: In-transit drivers (actively hauling)
 * - ⚪ Gray pins: Off-duty drivers (last known location)
 *
 * Enables deadhead optimization by showing which drivers are closest
 * to new pickup locations.
 */

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Users } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { DutyStatus } from '@/features/loads/hooks/use-continuous-gps';
import { useFleetDutyStatus } from '@/features/loads/hooks/use-continuous-gps';

interface FleetDriver {
  driver_id: string;
  driver_name: string;
  duty_status: DutyStatus;
  coords_lat: number;
  coords_lng: number;
  last_update: string;
  current_load_number: string | null;
}

const DUTY_STATUS_CONFIG = {
  on_duty: {
    color: '#22c55e',
    label: 'On Duty',
    icon: '🟢',
  },
  driving: {
    color: '#f97316',
    label: 'In Transit',
    icon: '🟠',
  },
  off_duty: {
    color: '#9ca3af',
    label: 'Off Duty',
    icon: '⚪',
  },
  sleeper: {
    color: '#6366f1',
    label: 'Sleeper',
    icon: '🔵',
  },
} as const;

export default function FleetAvailabilityPage() {
  const { user, company } = useAuth();
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<DutyStatus | 'all'>('all');

  const { summary: dutySummary } = useFleetDutyStatus(company?.id);

  // Fetch on-duty drivers
  useEffect(() => {
    if (!user?.id) return;

    async function fetchDrivers() {
      try {
        const { data, error } = await supabase.rpc('get_onduty_drivers_for_carrier', {
          p_carrier_id: user!.id,
        });

        if (error) throw error;

        setDrivers((data as FleetDriver[]) ?? []);
      } catch (error) {
        console.error('[FleetAvailability] Failed to fetch drivers:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDrivers();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDrivers, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Filter drivers by selected status
  const filteredDrivers =
    selectedStatus === 'all' ? drivers : drivers.filter((d) => d.duty_status === selectedStatus);

  // Calculate map center (average of all driver positions)
  const mapCenter: [number, number] =
    drivers.length > 0
      ? [
          drivers.reduce((sum, d) => sum + d.coords_lat, 0) / drivers.length,
          drivers.reduce((sum, d) => sum + d.coords_lng, 0) / drivers.length,
        ]
      : [36.1627, -86.7816]; // Nashville default

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Fleet Availability" showBack />

      {/* Duty status summary */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-2">
          {(['on_duty', 'driving', 'sleeper', 'off_duty'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
              className={`p-3 rounded-xl border transition-all ${
                selectedStatus === status || selectedStatus === 'all'
                  ? 'bg-fx-surface border-fx-border'
                  : 'bg-fx-surface/50 border-fx-border/50 opacity-50'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">{DUTY_STATUS_CONFIG[status].icon}</div>
                <p className="text-xl font-bold text-fx-text">{dutySummary[status] || 0}</p>
                <p className="text-[10px] text-fx-text-dim uppercase font-semibold mt-0.5">
                  {DUTY_STATUS_CONFIG[status].label}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="px-5 pb-4">
        <div className="h-[400px] rounded-2xl overflow-hidden border border-fx-border">
          {filteredDrivers.length > 0 ? (
            <MapContainer
              center={mapCenter}
              zoom={8}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {filteredDrivers.map((driver) => (
                <Marker
                  key={driver.driver_id}
                  position={[driver.coords_lat, driver.coords_lng]}
                  icon={
                    new Icon({
                      iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${encodeURIComponent(DUTY_STATUS_CONFIG[driver.duty_status].color)}" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
                      iconSize: [32, 32],
                      iconAnchor: [16, 32],
                      popupAnchor: [0, -32],
                    })
                  }
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-bold text-sm mb-1">{driver.driver_name}</p>
                      <p className="text-xs text-gray-600 mb-0.5">
                        <strong>Status:</strong> {DUTY_STATUS_CONFIG[driver.duty_status].label}
                      </p>
                      {driver.current_load_number && (
                        <p className="text-xs text-gray-600 mb-0.5">
                          <strong>Load:</strong> {driver.current_load_number}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        <strong>Last update:</strong>{' '}
                        {new Date(driver.last_update).toLocaleTimeString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-fx-surface">
              <div className="text-center">
                <Users size={48} className="text-fx-text-dim mx-auto mb-3" />
                <p className="font-bold text-fx-text">No active drivers</p>
                <p className="text-sm text-fx-text-muted mt-1">
                  {loading ? 'Loading...' : 'No drivers are currently on-duty'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Driver list */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
            Active Drivers ({filteredDrivers.length})
          </h2>
          {selectedStatus !== 'all' && (
            <button
              onClick={() => setSelectedStatus('all')}
              className="text-xs font-semibold text-fx-orange hover:underline"
            >
              Show All
            </button>
          )}
        </div>

        {filteredDrivers.length === 0 ? (
          <div className="bg-fx-surface border border-fx-border rounded-2xl p-6 text-center">
            <p className="text-sm text-fx-text-muted">
              {loading ? 'Loading drivers...' : 'No drivers found'}
            </p>
          </div>
        ) : (
          filteredDrivers.map((driver) => (
            <div
              key={driver.driver_id}
              className="bg-fx-surface border border-fx-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{DUTY_STATUS_CONFIG[driver.duty_status].icon}</span>
                  <div>
                    <p className="text-sm font-bold text-fx-text">{driver.driver_name}</p>
                    <Badge
                      variant={
                        driver.duty_status === 'on_duty'
                          ? 'green'
                          : driver.duty_status === 'driving'
                            ? 'orange'
                            : 'gray'
                      }
                      size="sm"
                    >
                      {DUTY_STATUS_CONFIG[driver.duty_status].label}
                    </Badge>
                  </div>
                </div>
                {driver.current_load_number && (
                  <span className="text-xs font-bold text-fx-orange px-2 py-1 bg-fx-orange/10 rounded">
                    {driver.current_load_number}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-xs text-fx-text-muted">
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} className="text-fx-orange" />
                  <span>
                    {driver.coords_lat.toFixed(4)}, {driver.coords_lng.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-fx-text-dim" />
                  <span>
                    Last update:{' '}
                    {new Date(driver.last_update).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav role="carrier" />
    </div>
  );
}
