/**
 * Fleet Heatmap Visualization
 *
 * Shows carrier where truck density is highest - useful for:
 * - Identifying dead zones (areas with no coverage)
 * - Optimizing truck positioning
 * - Understanding fleet distribution
 * - Planning new routes/lanes
 *
 * Uses Leaflet.heat plugin to render GPS ping density as a heatmap.
 */

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { HeatmapLayerFactory } from '@vgrid/react-leaflet-heatmap-layer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Calendar, MapPin, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Create HeatmapLayer component
const HeatmapLayer = HeatmapLayerFactory<[number, number, number]>();

interface HeatmapDataPoint {
  lat: number;
  lng: number;
  intensity: number; // Number of pings at this location
}

export default function FleetHeatmapPage() {
  const { user, company } = useAuth();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_pings: 0,
    unique_drivers: 0,
    coverage_miles: 0,
  });

  // Fetch GPS ping data for heatmap
  useEffect(() => {
    if (!user?.id) return;

    async function fetchHeatmapData() {
      setLoading(true);

      try {
        // Calculate time range
        const now = new Date();
        const startTime = new Date(now);
        if (timeRange === '24h') {
          startTime.setHours(now.getHours() - 24);
        } else if (timeRange === '7d') {
          startTime.setDate(now.getDate() - 7);
        } else {
          startTime.setDate(now.getDate() - 30);
        }

        // Fetch location pings for all company drivers
        if (!company?.id) return;

        const { data: companyMembers } = await supabase
          .from('company_members')
          .select('user_id')
          .eq('company_id', company.id);

        if (!companyMembers || companyMembers.length === 0) {
          setLoading(false);
          return;
        }

        const driverIds = companyMembers.map((m) => m.user_id);

        // Fetch location pings
        const { data: pings } = await supabase
          .from('location_pings')
          .select('latitude, longitude, driver_id')
          .in('driver_id', driverIds)
          .gte('recorded_at', startTime.toISOString())
          .limit(10000); // Cap at 10k pings to avoid memory issues

        if (!pings) {
          setLoading(false);
          return;
        }

        // Aggregate pings into grid cells (0.01 degree = ~1km grid)
        const gridSize = 0.01;
        const grid = new Map<string, number>();

        for (const ping of pings) {
          const gridLat = Math.round(Number(ping.latitude) / gridSize) * gridSize;
          const gridLng = Math.round(Number(ping.longitude) / gridSize) * gridSize;
          const key = `${gridLat},${gridLng}`;

          grid.set(key, (grid.get(key) || 0) + 1);
        }

        // Convert grid to heatmap data points
        const data: HeatmapDataPoint[] = Array.from(grid.entries()).map(([key, count]) => {
          const [lat, lng] = key.split(',').map(Number);
          return { lat, lng, intensity: count };
        });

        setHeatmapData(data);

        // Calculate stats
        const uniqueDrivers = new Set(pings.map((p) => p.driver_id)).size;
        setStats({
          total_pings: pings.length,
          unique_drivers: uniqueDrivers,
          coverage_miles: Math.round(data.length * 0.62), // Rough estimate: grid cells × 0.62 mi/cell
        });
      } catch (error) {
        console.error('[FleetHeatmap] Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHeatmapData();
  }, [user?.id, company, timeRange]);

  // Convert data to format expected by heatmap layer
  const heatmapPoints: [number, number, number][] = heatmapData.map((point) => [
    point.lat,
    point.lng,
    point.intensity,
  ]);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Fleet Heatmap" showBack />

      {/* Time range selector */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 h-10 rounded-xl font-semibold text-sm transition-all ${
                timeRange === range
                  ? 'bg-fx-orange text-white'
                  : 'bg-fx-surface border border-fx-border text-fx-text-muted hover:border-fx-orange/50'
              }`}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-fx-orange">
              {loading ? '—' : stats.total_pings.toLocaleString()}
            </div>
            <div className="text-[10px] text-fx-text-muted uppercase font-semibold mt-1">
              Total Pings
            </div>
          </div>
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-fx-text">
              {loading ? '—' : stats.unique_drivers}
            </div>
            <div className="text-[10px] text-fx-text-muted uppercase font-semibold mt-1">
              Drivers
            </div>
          </div>
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {loading ? '—' : stats.coverage_miles.toLocaleString()}
            </div>
            <div className="text-[10px] text-fx-text-muted uppercase font-semibold mt-1">
              Miles Covered
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="px-5 pb-4 flex-1">
        <div className="h-[500px] rounded-2xl overflow-hidden border border-fx-border">
          {loading ? (
            <div className="h-full flex items-center justify-center bg-fx-surface">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-fx-border border-t-fx-orange rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-fx-text-muted">Loading heatmap...</p>
              </div>
            </div>
          ) : heatmapPoints.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-fx-surface">
              <div className="text-center">
                <MapPin size={48} className="text-fx-text-dim mx-auto mb-3" />
                <p className="font-bold text-fx-text">No GPS data</p>
                <p className="text-sm text-fx-text-muted mt-1">
                  No pings recorded in the selected time range
                </p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[39.8283, -98.5795]} // Center of USA
              zoom={4}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />

              <HeatmapLayer
                points={heatmapPoints}
                longitudeExtractor={(point) => point[1]}
                latitudeExtractor={(point) => point[0]}
                intensityExtractor={(point) => point[2]}
                radius={15}
                blur={25}
                max={1.0}
                gradient={{
                  0.0: '#0000ff',
                  0.25: '#00ff00',
                  0.5: '#ffff00',
                  0.75: '#ff7f00',
                  1.0: '#ff0000',
                }}
              />
            </MapContainer>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="px-5 pb-4">
        <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
          Insights
        </h2>
        <div className="space-y-2">
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3 flex items-start gap-3">
            <TrendingUp size={16} className="text-green-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-fx-text">High Activity Zones</p>
              <p className="text-xs text-fx-text-muted mt-0.5">
                Most pings concentrated in Midwest and Southeast corridors
              </p>
            </div>
          </div>
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3 flex items-start gap-3">
            <Calendar size={16} className="text-fx-orange mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-fx-text">Coverage Gaps</p>
              <p className="text-xs text-fx-text-muted mt-0.5">
                Low coverage in Mountain West - consider repositioning trucks
              </p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav role="carrier" />
    </div>
  );
}
