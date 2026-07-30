import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getDriverIncidents } from '@/services/driver-incidents.service';
import type { DriverIncident } from '@/services/driver-incidents.service';
import { IncidentForm } from '@/features/driver/components/incident-form';

const SEVERITY_COLORS: Record<string, 'orange' | 'blue' | 'green' | 'gray'> = {
  minor: 'green',
  moderate: 'blue',
  severe: 'orange',
  critical: 'orange',
};

const SEVERITY_LABELS: Record<string, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  severe: 'Severe',
  critical: 'Critical',
};

const TYPE_LABELS: Record<string, string> = {
  tire: 'Tire Issue',
  engine: 'Engine / Mechanical',
  brake: 'Brakes',
  lights: 'Lights / Electrical',
  body_damage: 'Body Damage',
  accident: 'Accident',
  driver_illness: 'Driver Illness',
  cargo: 'Cargo Issue',
  fuel: 'Fuel / DEF',
  other: 'Other',
};

const TYPE_EMOJI: Record<string, string> = {
  tire: '🛞',
  engine: '⚙️',
  brake: '🛑',
  lights: '💡',
  body_damage: '🚛',
  accident: '⚠️',
  driver_illness: '🏥',
  cargo: '📦',
  fuel: '⛽',
  other: '📝',
};

export default function TireLogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<DriverIncident[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    getDriverIncidents(user.id)
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader greeting={false} name="Incident Log" />

      {/* Back button */}
      <div className="px-5 pb-3">
        <button
          onClick={() => navigate('/driver')}
          className="flex items-center gap-2 text-sm text-fx-text-dim hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3">
        {loading ? (
          <SkeletonList count={3} />
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={28} className="text-fx-orange" />}
            title="No incidents logged"
            subtitle="Tap the + button to log your first incident"
          />
        ) : (
          incidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-fx-surface border border-fx-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{TYPE_EMOJI[incident.incidentType] ?? '📝'}</span>
                    <span className="text-sm font-semibold text-white">
                      {TYPE_LABELS[incident.incidentType] ?? incident.incidentType}
                    </span>
                    <Badge variant={SEVERITY_COLORS[incident.severity] ?? 'gray'} size="sm">
                      {SEVERITY_LABELS[incident.severity] ?? incident.severity}
                    </Badge>
                    {incident.resolvedAt && (
                      <Badge variant="green" size="sm">
                        Resolved
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-fx-text-dim shrink-0">
                  {new Date(incident.incidentDate + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {incident.locationText && (
                <p className="text-xs text-fx-text-dim mb-1">{incident.locationText}</p>
              )}
              {incident.description && (
                <p className="text-xs text-fx-text-dim">{incident.description}</p>
              )}
              {incident.loadNumber && (
                <p className="text-xs text-fx-orange mt-1">Load: {incident.loadNumber}</p>
              )}

              {incident.photos.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {incident.photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-fx-border"
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setFormOpen(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-fx-orange flex items-center justify-center shadow-lg active-scale z-40"
        style={{ boxShadow: '0 6px 24px rgba(232,96,48,0.5)', maxWidth: 430 }}
      >
        <Plus size={24} className="text-white" />
      </button>

      <BottomNav role="driver" />

      <IncidentForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={fetchIncidents} />
    </div>
  );
}
