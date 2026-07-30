import { useState, useEffect } from 'react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { createTruck, updateTruck } from '@/services/trucks.service';
import { useAuth } from '@/contexts/AuthContext';
import { EQUIPMENT_LABELS } from '@freightx/shared';
import type { Truck } from '@freightx/shared';
import type { EquipmentType } from '@/lib/database.types';

const EQUIPMENT_OPTIONS: EquipmentType[] = [
  'van',
  'reefer',
  'flatbed',
  'step_deck',
  'lowboy',
  'tanker',
  'box_truck',
  'sprinter',
];

const EMPTY_FORM = {
  originCity: '',
  originState: '',
  destCity: '',
  destState: '',
  availableDate: '',
  equipment: 'van' as EquipmentType,
  lengthFt: '',
  weightCapacityLbs: '',
  driverName: '',
  driverPhone: '',
};

interface PostTruckSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  truck?: Truck; // when provided, sheet is in edit mode
}

export function PostTruckSheet({ open, onClose, onCreated, truck }: PostTruckSheetProps) {
  const { user, company } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Pre-populate form when editing an existing truck
  useEffect(() => {
    if (open && truck) {
      setForm({
        originCity: truck.originCity,
        originState: truck.originState,
        destCity: truck.destCity ?? '',
        destState: truck.destState ?? '',
        availableDate: truck.availableDate,
        equipment: truck.equipment,
        lengthFt: truck.lengthFt ? String(truck.lengthFt) : '',
        weightCapacityLbs: truck.weightCapacityLbs ? String(truck.weightCapacityLbs) : '',
        driverName: truck.driverName ?? '',
        driverPhone: truck.driverPhone ?? '',
      });
    } else if (open && !truck) {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [open, truck]);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError('Not authenticated');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fields = {
        origin_city: form.originCity.trim(),
        origin_state: form.originState.trim().toUpperCase().slice(0, 2),
        dest_city: form.destCity.trim() || null,
        dest_state: form.destState.trim().toUpperCase().slice(0, 2) || null,
        available_date: form.availableDate,
        equipment: form.equipment,
        length_ft: form.lengthFt ? parseInt(form.lengthFt) : null,
        weight_capacity_lbs: form.weightCapacityLbs ? parseInt(form.weightCapacityLbs) : null,
        driver_name: form.driverName.trim() || null,
        driver_phone: form.driverPhone.trim() || null,
      };

      if (truck) {
        await updateTruck(truck.id, fields);
      } else {
        await createTruck({
          ...fields,
          posted_by: user.id,
          company_id: company?.id ?? null,
          company_name: company?.name ?? 'Independent Carrier',
          status: 'available',
          driver_id: null,
        });
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : truck
            ? 'Failed to update truck'
            : 'Failed to post truck',
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'w-full h-12 bg-[#111] border border-fx-border rounded-xl text-fx-text text-sm font-medium px-4 focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all duration-200';

  return (
    <BottomSheet open={open} onClose={onClose} title={truck ? 'Edit Truck' : 'Post Truck'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Current Location */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Current Location
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input
                placeholder="City"
                value={form.originCity}
                onChange={(e) => set('originCity', e.target.value)}
                required
              />
            </div>
            <Input
              placeholder="ST"
              maxLength={2}
              value={form.originState}
              onChange={(e) => set('originState', e.target.value)}
              required
            />
          </div>
        </div>

        {/* Preferred Destination */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Preferred Destination{' '}
            <span className="text-fx-text-dim normal-case tracking-normal font-normal">
              (optional)
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input
                placeholder="City"
                value={form.destCity}
                onChange={(e) => set('destCity', e.target.value)}
              />
            </div>
            <Input
              placeholder="ST"
              maxLength={2}
              value={form.destState}
              onChange={(e) => set('destState', e.target.value)}
            />
          </div>
        </div>

        {/* Available Date */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Available Date
          </p>
          <input
            type="date"
            value={form.availableDate}
            onChange={(e) => set('availableDate', e.target.value)}
            required
            className={fieldClass}
            style={{ colorScheme: 'dark' }}
          />
        </div>

        {/* Equipment */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Equipment Type
          </p>
          <select
            value={form.equipment}
            onChange={(e) => set('equipment', e.target.value as EquipmentType)}
            className={fieldClass}
            style={{ colorScheme: 'dark' }}
          >
            {EQUIPMENT_OPTIONS.map((eq) => (
              <option key={eq} value={eq} style={{ background: '#111' }}>
                {EQUIPMENT_LABELS[eq] ?? eq}
              </option>
            ))}
          </select>
        </div>

        {/* Trailer specs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Length (ft)
            </p>
            <Input
              type="number"
              placeholder="53"
              value={form.lengthFt}
              onChange={(e) => set('lengthFt', e.target.value)}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Capacity (lbs)
            </p>
            <Input
              type="number"
              placeholder="45000"
              value={form.weightCapacityLbs}
              onChange={(e) => set('weightCapacityLbs', e.target.value)}
            />
          </div>
        </div>

        {/* Driver info */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Driver Info{' '}
            <span className="text-fx-text-dim normal-case tracking-normal font-normal">
              (optional)
            </span>
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Driver Name"
              value={form.driverName}
              onChange={(e) => set('driverName', e.target.value)}
            />
            <Input
              type="tel"
              placeholder="Driver Phone"
              value={form.driverPhone}
              onChange={(e) => set('driverPhone', e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-xl px-4 py-3">{error}</p>
        )}

        <Button
          type="submit"
          disabled={saving}
          size="lg"
          fullWidth
          className="rounded-2xl font-bold"
          style={{
            background: 'linear-gradient(145deg, #F07040, #C03A12)',
            boxShadow: '0 4px 20px rgba(232,96,48,0.4)',
          }}
        >
          {saving ? (truck ? 'Saving…' : 'Posting…') : truck ? 'Save Changes' : 'Post Truck'}
        </Button>
      </form>
    </BottomSheet>
  );
}
