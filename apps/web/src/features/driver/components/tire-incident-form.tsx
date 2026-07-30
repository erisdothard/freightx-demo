import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload } from 'lucide-react';
import { TirePositionSelector } from './tire-position-selector';
import { TIRE_POSITION_LABELS } from '../lib/tire-constants';
import { createTireIncident, uploadTirePhoto } from '@/services/tire-incidents.service';
import { getDriverLoads } from '@/services/loads.service';
import { useAuth } from '@/contexts/AuthContext';
import type { TirePosition, TireSeverity, TireResolution, Load } from '@freightx/shared';

interface TireIncidentFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SEVERITIES: { value: TireSeverity; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'blowout', label: 'Blowout' },
  { value: 'low_pressure', label: 'Low Pressure' },
  { value: 'damage', label: 'Damage' },
];

const RESOLUTIONS: { value: TireResolution; label: string }[] = [
  { value: 'changed_spare', label: 'Changed Spare' },
  { value: 'roadside_service', label: 'Roadside Service' },
  { value: 'patched', label: 'Patched' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'other', label: 'Other' },
];

export function TireIncidentForm({ open, onClose, onCreated }: TireIncidentFormProps) {
  const { user } = useAuth();
  const [tirePosition, setTirePosition] = useState<TirePosition | null>(null);
  const [severity, setSeverity] = useState<TireSeverity>('flat');
  const [resolution, setResolution] = useState<TireResolution | undefined>();
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadNumber, setLoadNumber] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLoads, setActiveLoads] = useState<Load[]>([]);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Auto-fill GPS location on open (locationText intentionally excluded to avoid re-triggering)
  useEffect(() => {
    if (open && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setLocationText((prev) =>
            prev ? prev : `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          );
        },
        () => undefined,
        { enableHighAccuracy: false, timeout: 5000 },
      );
    }
  }, [open]);

  // Fetch active loads for dropdown
  useEffect(() => {
    if (open && user?.id) {
      getDriverLoads(user.id)
        .then(setActiveLoads)
        .catch(() => undefined);
    }
  }, [open, user?.id]);

  async function handlePhoto(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadTirePhoto(file, user.id);
      setPhotos((prev) => [...prev, url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!user || !tirePosition) return;
    setSaving(true);
    setError(null);
    try {
      await createTireIncident({
        driverId: user.id,
        loadNumber: loadNumber || undefined,
        incidentDate,
        locationText,
        lat,
        lng,
        tirePosition,
        severity,
        description: description || undefined,
        resolution,
        photos,
      });
      onCreated();
      onClose();
      // Reset form
      setTirePosition(null);
      setSeverity('flat');
      setResolution(undefined);
      setDescription('');
      setLocationText('');
      setPhotos([]);
      setLoadNumber('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        style={{ maxWidth: 430, margin: '0 auto' }}
      >
        <div className="bg-fx-surface rounded-t-[24px] pb-safe overflow-hidden max-h-[85dvh] flex flex-col">
          {/* Handle + header */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-fx-border" />
          </div>
          <div className="flex items-center justify-between px-5 pb-3 shrink-0">
            <h2 className="text-lg font-bold text-white">Log Tire Incident</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
            >
              <X size={16} className="text-fx-text-dim" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            {/* Tire position selector */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Tire Position
              </p>
              <div className="flex justify-center">
                <TirePositionSelector selected={tirePosition} onSelect={setTirePosition} />
              </div>
              {tirePosition && (
                <p className="text-center text-sm text-fx-orange font-semibold mt-1">
                  {TIRE_POSITION_LABELS[tirePosition]}
                </p>
              )}
            </div>

            {/* Severity */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Severity
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSeverity(s.value)}
                    className={`h-10 rounded-xl text-xs font-semibold transition-all ${
                      severity === s.value
                        ? 'bg-fx-orange text-white'
                        : 'bg-fx-surface-2 border border-fx-border text-fx-text-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Date
              </p>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl px-4 text-sm text-white"
              />
            </div>

            {/* Location */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Location
              </p>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Auto-filled from GPS..."
                className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl px-4 text-sm text-white placeholder:text-fx-text-dim"
              />
            </div>

            {/* Load # dropdown */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Load # (Optional)
              </p>
              <select
                value={loadNumber}
                onChange={(e) => setLoadNumber(e.target.value)}
                className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl px-4 text-sm text-white"
              >
                <option value="">None</option>
                {activeLoads.map((l) => (
                  <option key={l.loadNumber} value={l.loadNumber}>
                    {l.loadNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Description
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the incident..."
                className="w-full bg-fx-surface-2 border border-fx-border rounded-xl p-3 text-sm text-white placeholder:text-fx-text-dim resize-none"
              />
            </div>

            {/* Resolution */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Resolution (Optional)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setResolution(resolution === r.value ? undefined : r.value)}
                    className={`h-10 rounded-xl text-xs font-semibold transition-all ${
                      resolution === r.value
                        ? 'bg-fx-orange text-white'
                        : 'bg-fx-surface-2 border border-fx-border text-fx-text-muted'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Photos
              </p>
              {photos.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto">
                  {photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Tire photo ${i + 1}`}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-fx-border"
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 h-11 rounded-xl border border-dashed border-fx-orange/40 text-xs font-semibold text-fx-orange flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="w-4 h-4 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={14} /> Choose File
                    </>
                  )}
                </button>
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  className="w-11 h-11 rounded-xl border border-dashed border-fx-orange/40 text-fx-orange flex items-center justify-center disabled:opacity-50"
                >
                  <Camera size={16} />
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!tirePosition || saving}
              className="w-full h-12 rounded-2xl bg-fx-orange text-white font-semibold text-sm active-scale disabled:opacity-50"
              style={{ boxShadow: '0 4px 16px rgba(232,96,48,0.4)' }}
            >
              {saving ? 'Saving...' : 'Log Incident'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
