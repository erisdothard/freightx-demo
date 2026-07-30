import { useState, useEffect } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { updateLoad } from '@/services/loads.service';
import { useAuth } from '@/contexts/AuthContext';
import { EQUIPMENT_LABELS } from '@freightx/shared';
import type { EquipmentType } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { titleCase } from '@/lib/utils';
import type { Load } from '@freightx/shared';

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

interface CompanyMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface EditLoadSheetProps {
  load: Load | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditLoadSheet({ load, onClose, onUpdated }: EditLoadSheetProps) {
  const { user, company } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);

  // Form state
  const [originAddress, setOriginAddress] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originZip, setOriginZip] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [destZip, setDestZip] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [equipment, setEquipment] = useState<EquipmentType>('van');
  const [commodity, setCommodity] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [rateUsd, setRateUsd] = useState('');
  const [totalMiles, setTotalMiles] = useState('');
  const [hazmat, setHazmat] = useState(false);
  const [tempControlled, setTempControlled] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [freightClass, setFreightClass] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [shipperReference, setShipperReference] = useState('');

  // Populate form when load changes
  useEffect(() => {
    if (!load) return;
    setOriginAddress(load.originAddress ?? '');
    setOriginCity(load.originCity);
    setOriginState(load.originState);
    setOriginZip(load.originZip ?? '');
    setDestAddress(load.destAddress ?? '');
    setDestCity(load.destCity);
    setDestState(load.destState);
    setDestZip(load.destZip ?? '');
    setPickupDate(load.pickupDate);
    setDeliveryDate(load.deliveryDate ?? '');
    setEquipment(load.equipment as EquipmentType);
    setCommodity(load.commodity ?? '');
    setWeightLbs(load.weightLbs?.toString() ?? '');
    setRateUsd(load.rateUsd.toString());
    setTotalMiles(load.totalMiles?.toString() ?? '');
    setHazmat(load.hazmat ?? false);
    setTempControlled(load.tempControlled ?? false);
    setAssigneeId(load.assigneeId ?? null);
    setFreightClass(load.freight_class ?? '');
    setPackagingType(load.packaging_type ?? '');
    setPoNumber(load.po_number ?? '');
    setShipperReference(load.shipper_reference ?? '');
  }, [load]);

  // Fetch company members for assignee picker
  useEffect(() => {
    if (!load || !company?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('company_members')
      .select('user_id, profiles!company_members_user_id_fkey(full_name, email)')
      .eq('company_id', company.id)
      .then(
        ({
          data,
        }: {
          data: Array<{
            user_id: string;
            profiles?: { full_name: string | null; email: string };
          }> | null;
        }) => {
          if (!data) return;
          setMembers(
            data.map((m) => ({
              user_id: m.user_id,
              full_name: m.profiles?.full_name ?? null,
              email: m.profiles?.email ?? '',
            })),
          );
        },
      );
  }, [load, company?.id]);

  // Permission check
  const canEdit =
    load &&
    user &&
    (load.postedBy === user.id || user.role === 'admin') &&
    load.status === 'posted';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!load || !canEdit) return;

    setSaving(true);
    setError(null);
    try {
      const parsedMiles = totalMiles ? parseInt(totalMiles) : null;
      const parsedRate = parseFloat(rateUsd);
      const ratePerMile =
        parsedMiles && parsedMiles > 0 ? +(parsedRate / parsedMiles).toFixed(2) : null;

      await updateLoad(load.id, {
        origin_city: titleCase(originCity),
        origin_state: originState.trim().toUpperCase().slice(0, 2),
        origin_address: originAddress.trim() || null,
        origin_zip: originZip.trim() || null,
        dest_city: titleCase(destCity),
        dest_state: destState.trim().toUpperCase().slice(0, 2),
        dest_address: destAddress.trim() || null,
        dest_zip: destZip.trim() || null,
        pickup_date: pickupDate,
        delivery_date: deliveryDate.trim() || undefined,
        equipment,
        commodity: titleCase(commodity),
        weight_lbs: parseInt(weightLbs),
        rate_usd: parsedRate,
        rate_per_mile: ratePerMile,
        total_miles: parsedMiles,
        hazmat,
        temp_controlled: tempControlled,
        assignee_id: assigneeId,
        freight_class: freightClass || null,
        packaging_type: packagingType || null,
        po_number: poNumber.trim() || null,
        shipper_reference: shipperReference.trim() || null,
      });

      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update load');
    } finally {
      setSaving(false);
    }
  }

  if (!load || !canEdit) return null;

  const fieldClass =
    'w-full h-12 bg-[#111] border border-fx-border rounded-xl text-fx-text text-sm font-medium px-4 focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all duration-200';

  return (
    <BottomSheet open={!!load} onClose={onClose} title="Edit Load">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Origin */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Origin
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Street Address"
              value={originAddress}
              onChange={(e) => setOriginAddress(e.target.value)}
            />
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <Input
                  placeholder="City"
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  required
                />
              </div>
              <Input
                placeholder="ST"
                maxLength={2}
                value={originState}
                onChange={(e) => setOriginState(e.target.value)}
                required
              />
              <div className="col-span-2">
                <Input
                  placeholder="ZIP"
                  maxLength={10}
                  value={originZip}
                  onChange={(e) => setOriginZip(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Destination */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Destination
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Street Address"
              value={destAddress}
              onChange={(e) => setDestAddress(e.target.value)}
            />
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <Input
                  placeholder="City"
                  value={destCity}
                  onChange={(e) => setDestCity(e.target.value)}
                  required
                />
              </div>
              <Input
                placeholder="ST"
                maxLength={2}
                value={destState}
                onChange={(e) => setDestState(e.target.value)}
                required
              />
              <div className="col-span-2">
                <Input
                  placeholder="ZIP"
                  maxLength={10}
                  value={destZip}
                  onChange={(e) => setDestZip(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Pickup Date
            </p>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              required
              className={fieldClass}
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Delivery Date
            </p>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className={fieldClass}
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Equipment */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Equipment
          </p>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map((eq) => {
              const selected = equipment === eq;
              return (
                <button
                  key={eq}
                  type="button"
                  onClick={() => setEquipment(eq)}
                  className="px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={
                    selected
                      ? {
                          background: 'rgba(232,96,48,0.18)',
                          border: '1px solid rgba(232,96,48,0.6)',
                          color: '#E86030',
                        }
                      : {
                          background: '#111',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.5)',
                        }
                  }
                >
                  {EQUIPMENT_LABELS[eq] ?? eq}
                </button>
              );
            })}
          </div>
        </div>

        {/* Commodity */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Commodity
          </p>
          <Input
            placeholder="e.g. General Freight, Steel Coils"
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            required
          />
        </div>

        {/* Freight Class + Packaging */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Freight Class (NMFC)
            </p>
            <Select value={freightClass} onValueChange={setFreightClass}>
              <SelectTrigger className={fieldClass}>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">Class 50</SelectItem>
                <SelectItem value="55">Class 55</SelectItem>
                <SelectItem value="60">Class 60</SelectItem>
                <SelectItem value="65">Class 65</SelectItem>
                <SelectItem value="70">Class 70</SelectItem>
                <SelectItem value="77.5">Class 77.5</SelectItem>
                <SelectItem value="85">Class 85</SelectItem>
                <SelectItem value="92.5">Class 92.5</SelectItem>
                <SelectItem value="100">Class 100</SelectItem>
                <SelectItem value="110">Class 110</SelectItem>
                <SelectItem value="125">Class 125</SelectItem>
                <SelectItem value="150">Class 150</SelectItem>
                <SelectItem value="175">Class 175</SelectItem>
                <SelectItem value="200">Class 200</SelectItem>
                <SelectItem value="250">Class 250</SelectItem>
                <SelectItem value="300">Class 300</SelectItem>
                <SelectItem value="400">Class 400</SelectItem>
                <SelectItem value="500">Class 500</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Packaging
            </p>
            <Select value={packagingType} onValueChange={setPackagingType}>
              <SelectTrigger className={fieldClass}>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pallets">Pallets</SelectItem>
                <SelectItem value="crates">Crates</SelectItem>
                <SelectItem value="boxes">Boxes</SelectItem>
                <SelectItem value="drums">Drums</SelectItem>
                <SelectItem value="bags">Bags</SelectItem>
                <SelectItem value="rolls">Rolls</SelectItem>
                <SelectItem value="loose">Loose</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reference Numbers */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              PO Number
            </p>
            <Input
              placeholder="Optional"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Shipper Reference
            </p>
            <Input
              placeholder="Optional"
              value={shipperReference}
              onChange={(e) => setShipperReference(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        {/* Weight + Miles */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Weight (lbs)
            </p>
            <Input
              type="number"
              placeholder="42000"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              required
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Total Miles
            </p>
            <Input
              type="number"
              placeholder="Optional"
              value={totalMiles}
              onChange={(e) => setTotalMiles(e.target.value)}
            />
          </div>
        </div>

        {/* Rate */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Rate (USD)
          </p>
          <Input
            type="number"
            placeholder="3200"
            value={rateUsd}
            onChange={(e) => setRateUsd(e.target.value)}
            required
          />
          {rateUsd && totalMiles && (
            <p className="text-xs text-fx-text-dim mt-1 pl-1">
              ≈ ${(parseFloat(rateUsd) / parseInt(totalMiles)).toFixed(2)}/mi
            </p>
          )}
        </div>

        {/* Special flags */}
        <div
          className="flex gap-6 rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hazmat}
              onChange={(e) => setHazmat(e.target.checked)}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            <span className="text-sm font-semibold text-fx-text-muted">HAZMAT</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={tempControlled}
              onChange={(e) => setTempControlled(e.target.checked)}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            <span className="text-sm font-semibold text-fx-text-muted">Temp Controlled</span>
          </label>
        </div>

        {/* Assignee (team member) */}
        {members.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Assign To (Optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = assigneeId === m.user_id;
                const label = m.full_name ?? m.email;
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => setAssigneeId(selected ? null : m.user_id)}
                    className="px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={
                      selected
                        ? {
                            background: 'rgba(232,96,48,0.18)',
                            border: '1px solid rgba(232,96,48,0.6)',
                            color: '#E86030',
                          }
                        : {
                            background: '#111',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.5)',
                          }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Pencil size={16} className="mr-2" />
              Update Load
            </>
          )}
        </Button>
      </form>
    </BottomSheet>
  );
}
