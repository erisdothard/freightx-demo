import { useState, useEffect, useCallback } from 'react';
import {
  BookmarkPlus,
  Bookmark,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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
import { createLoad } from '@/services/loads.service';
import { useAuth } from '@/contexts/AuthContext';
import { EQUIPMENT_LABELS } from '@freightx/shared';
import type { EquipmentType } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { getLaneStats, suggestRate } from '@/services/rate-intelligence.service';
import type { RateSuggestion, LaneStats } from '@/services/rate-intelligence.service';
import { titleCase } from '@/lib/utils';
import { HazmatFields } from './hazmat-fields';

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

function genLoadNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `FX-${date}-${seq}`;
}

const EMPTY_FORM = {
  originAddress: '',
  originCity: '',
  originState: '',
  originZip: '',
  destAddress: '',
  destCity: '',
  destState: '',
  destZip: '',
  pickupDate: '',
  deliveryDate: '',
  equipment: 'van' as EquipmentType,
  commodity: '',
  weightLbs: '',
  rateUsd: '',
  totalMiles: '',
  fullPartial: 'full' as 'full' | 'partial',
  hazmat: false,
  tempControlled: false,
  visibility: 'public' as 'public' | 'preferred_only' | 'invited_only',
  // Hazmat PHMSA fields
  properShippingName: '',
  hazmatClass: '',
  unNumber: '',
  packingGroup: '',
  hazmatQuantity: '',
  emergencyPhone: '',
  placardRequired: false,
  reportableQuantity: false,
  assigneeId: null as string | null,
  freightClass: '' as string,
  packagingType: '' as string,
  poNumber: '',
  shipperReference: '',
  // Contact Information
  shipperName: '',
  shipperContactName: '',
  shipperContactPhone: '',
  shipperContactEmail: '',
  receiverName: '',
  receiverContactName: '',
  receiverContactPhone: '',
  receiverContactEmail: '',
  // Appointment Times
  pickupApptStart: '',
  pickupApptEnd: '',
  deliveryApptStart: '',
  deliveryApptEnd: '',
  // Freight Details
  piecesCount: '',
  palletsCount: '',
  lengthIn: '',
  widthIn: '',
  heightIn: '',
  stackable: true as boolean,
  specialInstructions: '',
  loadingNotes: '',
  deliveryNotes: '',
};

interface LoadTemplate {
  id: string;
  name: string;
  template_data: typeof EMPTY_FORM;
}

interface CompanyMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface PostLoadSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function PostLoadSheet({ open, onClose, onCreated }: PostLoadSheetProps) {
  const { user, company } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Templates
  const [templates, setTemplates] = useState<LoadTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Team members
  const [members, setMembers] = useState<CompanyMember[]>([]);

  // Rate suggestion
  const [rateSuggestion, setRateSuggestion] = useState<RateSuggestion | null>(null);
  const [laneStats, setLaneStats] = useState<LaneStats | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Collapsible enterprise detail sections
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showApptTimes, setShowApptTimes] = useState(false);
  const [showFreightDetails, setShowFreightDetails] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // Load templates when sheet opens
  useEffect(() => {
    if (!open || !user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('load_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: LoadTemplate[] | null }) => setTemplates(data ?? []));
  }, [open, user?.id]);

  // Fetch company members for assignee picker
  useEffect(() => {
    if (!open || !company?.id) return;
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
  }, [open, company?.id]);

  // Fetch lane stats + rate suggestion when origin/dest/equipment/miles are filled
  const fetchRateSuggestion = useCallback(async () => {
    const { originState, destState, equipment, totalMiles } = form;
    if (!originState || !destState || !equipment || !totalMiles) return;

    const miles = parseInt(totalMiles);
    if (isNaN(miles) || miles < 1) return;

    setFetchingRate(true);
    try {
      const stats = await getLaneStats({ originState, destState, equipment });
      setLaneStats(stats);

      const suggestion = await suggestRate({
        originState,
        destState,
        equipment,
        totalMiles: miles,
        laneStats: stats,
      });
      setRateSuggestion(suggestion);
    } catch {
      // Non-fatal
    } finally {
      setFetchingRate(false);
    }
  }, [form]);

  // Debounce rate suggestion fetch
  useEffect(() => {
    const timer = setTimeout(fetchRateSuggestion, 800);
    return () => clearTimeout(timer);
  }, [fetchRateSuggestion]);

  function applyTemplate(t: LoadTemplate) {
    setForm(t.template_data);
    setShowTemplates(false);
    setRateSuggestion(null);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || !user?.id) return;
    setSavingTemplate(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('load_templates')
        .insert({
          user_id: user.id,
          company_id: company?.id ?? null,
          name: templateName.trim(),
          template_data: form,
        })
        .select()
        .single();
      if (data) setTemplates((prev) => [data as LoadTemplate, ...prev]);
      setTemplateName('');
      setShowSaveTemplate(false);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !company) {
      setError('Not authenticated');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const totalMiles = form.totalMiles ? parseInt(form.totalMiles) : null;
      const rateUsd = parseFloat(form.rateUsd);
      const ratePerMile = totalMiles && totalMiles > 0 ? +(rateUsd / totalMiles).toFixed(2) : null;

      await createLoad({
        load_number: genLoadNumber(),
        posted_by: user.id,
        company_id: company.id,
        company_name: company.name,
        origin_city: titleCase(form.originCity),
        origin_state: form.originState.trim().toUpperCase().slice(0, 2),
        origin_address: form.originAddress.trim() || null,
        origin_zip: form.originZip.trim() || null,
        origin_address_raw: null,
        origin_address_normalized: null,
        origin_place_id: null,
        origin_geocode_confidence: null,
        dest_city: titleCase(form.destCity),
        dest_state: form.destState.trim().toUpperCase().slice(0, 2),
        dest_address: form.destAddress.trim() || null,
        dest_zip: form.destZip.trim() || null,
        dest_address_raw: null,
        dest_address_normalized: null,
        dest_place_id: null,
        dest_geocode_confidence: null,
        pickup_date: form.pickupDate,
        delivery_date: form.deliveryDate,
        equipment: form.equipment,
        commodity: titleCase(form.commodity),
        weight_lbs: parseInt(form.weightLbs),
        rate_usd: rateUsd,
        rate_per_mile: ratePerMile,
        total_miles: totalMiles,
        status: 'posted',
        bid_count: 0,
        hazmat: form.hazmat,
        temp_controlled: form.tempControlled,
        posted_at: new Date().toISOString(),
        broker_credit_score: null,
        assigned_driver_id: null,
        second_driver_id: null,
        assignee_id: form.assigneeId ?? null,
        freight_class: form.freightClass || null,
        packaging_type: form.packagingType || null,
        po_number: form.poNumber.trim() || null,
        shipper_reference: form.shipperReference.trim() || null,
        preferred_carriers_only: form.visibility === 'preferred_only',
        ...(form.visibility !== 'public' ? ({ visibility: form.visibility } as any) : {}),
        // Contact Information
        shipper_name: form.shipperName.trim() || null,
        shipper_contact_name: form.shipperContactName.trim() || null,
        shipper_contact_phone: form.shipperContactPhone.trim() || null,
        shipper_contact_email: form.shipperContactEmail.trim() || null,
        receiver_name: form.receiverName.trim() || null,
        receiver_contact_name: form.receiverContactName.trim() || null,
        receiver_contact_phone: form.receiverContactPhone.trim() || null,
        receiver_contact_email: form.receiverContactEmail.trim() || null,
        // Appointment Times
        pickup_appt_start: form.pickupApptStart || null,
        pickup_appt_end: form.pickupApptEnd || null,
        delivery_appt_start: form.deliveryApptStart || null,
        delivery_appt_end: form.deliveryApptEnd || null,
        // Freight Details
        pieces_count: form.piecesCount ? parseInt(form.piecesCount) : null,
        pallets_count: form.palletsCount ? parseInt(form.palletsCount) : null,
        length_in: form.lengthIn ? parseInt(form.lengthIn) : null,
        width_in: form.widthIn ? parseInt(form.widthIn) : null,
        height_in: form.heightIn ? parseInt(form.heightIn) : null,
        stackable: form.stackable,
        full_partial: form.fullPartial,
        special_instructions: form.specialInstructions.trim() || null,
        loading_notes: form.loadingNotes.trim() || null,
        delivery_notes: form.deliveryNotes.trim() || null,
        // Hazmat PHMSA fields
        ...(form.hazmat
          ? {
              proper_shipping_name: form.properShippingName.trim() || null,
              hazmat_class: form.hazmatClass || null,
              un_number: form.unNumber.trim() || null,
              packing_group: form.packingGroup || null,
              hazmat_quantity: form.hazmatQuantity.trim() || null,
              emergency_phone: form.emergencyPhone.trim() || null,
              placard_required: form.placardRequired,
              reportable_quantity: form.reportableQuantity,
            }
          : {}),
      });

      setForm(EMPTY_FORM);
      setRateSuggestion(null);
      setLaneStats(null);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post load');
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'w-full h-12 bg-[#111] border border-fx-border rounded-xl text-fx-text text-sm font-medium px-4 focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all duration-200';

  return (
    <BottomSheet open={open} onClose={onClose} title="Post New Load">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Templates Bar */}
        {templates.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-fx-orange"
            >
              <Bookmark size={14} />
              Use Template
              <ChevronDown
                size={12}
                className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`}
              />
            </button>
            {showTemplates && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-fx-border p-2 bg-fx-surface">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-fx-text hover:bg-fx-surface-2 transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Origin */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Origin
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Street Address"
              value={form.originAddress}
              onChange={(e) => set('originAddress', e.target.value)}
            />
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
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
              <div className="col-span-2">
                <Input
                  placeholder="ZIP"
                  maxLength={10}
                  value={form.originZip}
                  onChange={(e) => set('originZip', e.target.value)}
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
              value={form.destAddress}
              onChange={(e) => set('destAddress', e.target.value)}
            />
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <Input
                  placeholder="City"
                  value={form.destCity}
                  onChange={(e) => set('destCity', e.target.value)}
                  required
                />
              </div>
              <Input
                placeholder="ST"
                maxLength={2}
                value={form.destState}
                onChange={(e) => set('destState', e.target.value)}
                required
              />
              <div className="col-span-2">
                <Input
                  placeholder="ZIP"
                  maxLength={10}
                  value={form.destZip}
                  onChange={(e) => set('destZip', e.target.value)}
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
              value={form.pickupDate}
              onChange={(e) => set('pickupDate', e.target.value)}
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
              value={form.deliveryDate}
              onChange={(e) => set('deliveryDate', e.target.value)}
              required
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
              const selected = form.equipment === eq;
              return (
                <button
                  key={eq}
                  type="button"
                  onClick={() => set('equipment', eq)}
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

        {/* Full / Partial toggle */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Load Type
          </p>
          <div className="flex gap-2">
            {(['full', 'partial'] as const).map((opt) => {
              const selected = form.fullPartial === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('fullPartial', opt)}
                  className="flex-1 h-10 rounded-xl text-[12px] font-semibold transition-all"
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
                  {opt === 'full' ? 'Full Truckload' : 'Partial'}
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
            value={form.commodity}
            onChange={(e) => set('commodity', e.target.value)}
            required
          />
        </div>

        {/* Freight Class + Packaging */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Freight Class (NMFC)
            </p>
            <Select value={form.freightClass} onValueChange={(val) => set('freightClass', val)}>
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
            <Select value={form.packagingType} onValueChange={(val) => set('packagingType', val)}>
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
              value={form.poNumber}
              onChange={(e) => set('poNumber', e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Shipper Reference
            </p>
            <Input
              placeholder="Optional"
              value={form.shipperReference}
              onChange={(e) => set('shipperReference', e.target.value)}
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
              value={form.weightLbs}
              onChange={(e) => set('weightLbs', e.target.value)}
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
              value={form.totalMiles}
              onChange={(e) => set('totalMiles', e.target.value)}
            />
          </div>
        </div>

        {/* Rate Intelligence Chip */}
        {(fetchingRate || rateSuggestion) && form.totalMiles && (
          <div
            className="rounded-xl p-3 flex items-start gap-3"
            style={{ background: 'rgba(232,96,48,0.08)', border: '1px solid rgba(232,96,48,0.2)' }}
          >
            <TrendingUp size={16} className="text-fx-orange shrink-0 mt-0.5" />
            {fetchingRate ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-fx-orange animate-spin" />
                <span className="text-xs text-fx-text-muted">Fetching market data…</span>
              </div>
            ) : rateSuggestion ? (
              <div className="flex-1">
                <p className="text-[10px] font-bold text-fx-orange uppercase tracking-widest mb-1">
                  AI Rate Suggestion
                  {rateSuggestion.confidence === 'high' && (
                    <span className="ml-1 text-green-400">● High Confidence</span>
                  )}
                  {rateSuggestion.confidence === 'medium' && (
                    <span className="ml-1 text-yellow-400">● Medium</span>
                  )}
                  {rateSuggestion.confidence === 'low' && (
                    <span className="ml-1 text-fx-text-dim">● Low Data</span>
                  )}
                </p>
                <p className="text-sm font-bold text-fx-text">
                  ${rateSuggestion.suggested_low}/mi – ${rateSuggestion.suggested_mid}/mi – $
                  {rateSuggestion.suggested_high}/mi
                </p>
                <p className="text-[11px] text-fx-text-muted mt-1">{rateSuggestion.reasoning}</p>
                {laneStats && laneStats.sample_count > 0 && (
                  <p className="text-[10px] text-fx-text-dim mt-1">
                    Based on {laneStats.sample_count} transaction
                    {laneStats.sample_count !== 1 ? 's' : ''} · avg ${laneStats.avg_rate_per_mile}
                    /mi
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  {(
                    [
                      rateSuggestion.suggested_low,
                      rateSuggestion.suggested_mid,
                      rateSuggestion.suggested_high,
                    ] as number[]
                  ).map((rpm, i) => {
                    const miles = parseInt(form.totalMiles);
                    const total = Math.round(rpm * miles);
                    const label = i === 0 ? 'Low' : i === 1 ? 'Mid' : 'High';
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => set('rateUsd', String(total))}
                        className="flex-1 text-[10px] font-bold rounded-lg py-1.5 transition-colors"
                        style={{
                          background: 'rgba(232,96,48,0.12)',
                          border: '1px solid rgba(232,96,48,0.25)',
                          color: '#E86030',
                        }}
                      >
                        {label} · ${total.toLocaleString()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Rate */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Rate (USD)
          </p>
          <Input
            type="number"
            placeholder="3200"
            value={form.rateUsd}
            onChange={(e) => set('rateUsd', e.target.value)}
            required
          />
          {form.rateUsd && form.totalMiles && (
            <p className="text-xs text-fx-text-dim mt-1 pl-1">
              ≈ ${(parseFloat(form.rateUsd) / parseInt(form.totalMiles)).toFixed(2)}/mi
            </p>
          )}
          {/* Profitability indicator — compares rate to market */}
          {form.rateUsd && laneStats && laneStats.avg_rate_per_mile && laneStats.sample_count >= 3 && form.totalMiles && (() => {
            const enteredRpm = parseFloat(form.rateUsd) / parseInt(form.totalMiles);
            const marketAvg = laneStats.avg_rate_per_mile;
            const delta = ((enteredRpm - marketAvg) / marketAvg) * 100;
            const isLow = delta < -15;
            const isFair = delta >= -15 && delta <= 5;
            const isGood = delta > 5;
            const borderColor = isLow ? 'border-fx-danger' : isFair ? 'border-fx-warning' : 'border-fx-success';
            const textColor = isLow ? 'text-fx-danger' : isFair ? 'text-fx-warning' : 'text-fx-success';
            return (
              <div className={`mt-2 px-3 py-2 rounded-ios-xs border ${borderColor} bg-fx-surface-2`}>
                <p className={`text-[11px] font-semibold ${textColor}`}>
                  {isLow && '⚠ Low Rate Alert — '}
                  {isGood ? 'Above' : isFair ? 'At' : 'Below'} market avg (${marketAvg.toFixed(2)}/mi)
                  {' · '}{delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                </p>
              </div>
            );
          })()}
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
              checked={form.hazmat}
              onChange={(e) => set('hazmat', e.target.checked)}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            <span className="text-sm font-semibold text-fx-text-muted">HAZMAT</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tempControlled}
              onChange={(e) => set('tempControlled', e.target.checked)}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            <span className="text-sm font-semibold text-fx-text-muted">Temp Controlled</span>
          </label>
        </div>

        {/* Hazmat PHMSA fields (49 CFR 172) */}
        {form.hazmat && (
          <HazmatFields
            data={{
              properShippingName: form.properShippingName,
              hazmatClass: form.hazmatClass,
              unNumber: form.unNumber,
              packingGroup: form.packingGroup,
              quantity: form.hazmatQuantity,
              emergencyPhone: form.emergencyPhone,
              placardRequired: form.placardRequired,
              reportableQuantity: form.reportableQuantity,
            }}
            onChange={(key, val) => {
              if (key === 'quantity') set('hazmatQuantity', val as string);
              else set(key as keyof typeof EMPTY_FORM, val as never);
            }}
          />
        )}

        {/* Load Visibility */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Visibility
          </p>
          <div className="flex gap-2">
            {(['public', 'preferred_only', 'invited_only'] as const).map((opt) => {
              const labels: Record<string, string> = {
                public: 'Public',
                preferred_only: 'Preferred Only',
                invited_only: 'Invite Only',
              };
              const selected = form.visibility === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('visibility', opt)}
                  className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors ${
                    selected
                      ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
                      : 'bg-zinc-800 border-zinc-700 text-fx-text-dim hover:border-zinc-600'
                  }`}
                >
                  {labels[opt]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assignee (team member) */}
        {members.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Assign To (Optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = form.assigneeId === m.user_id;
                const label = m.full_name ?? m.email;
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => set('assigneeId', selected ? null : m.user_id)}
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

        {/* Enterprise Load Details (Collapsible) */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-fx-text-muted uppercase tracking-widest">
            Enterprise Load Details (Optional)
          </p>

          {/* Contact Information */}
          <div>
            <button
              type="button"
              onClick={() => setShowContactInfo((v) => !v)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl border border-fx-border hover:border-fx-orange/30 transition-colors"
            >
              <span className="text-xs font-semibold text-fx-text">Contact Information</span>
              <ChevronRight
                size={14}
                className={`text-fx-text-muted transition-transform ${showContactInfo ? 'rotate-90' : ''}`}
              />
            </button>
            {showContactInfo && (
              <div className="mt-3 space-y-3 pl-3">
                {/* Shipper Contact */}
                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Shipper/Pickup Location
                  </p>
                  <Input
                    placeholder="Shipper Company Name"
                    value={form.shipperName}
                    onChange={(e) => set('shipperName', e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <Input
                      placeholder="Contact Name"
                      value={form.shipperContactName}
                      onChange={(e) => set('shipperContactName', e.target.value)}
                    />
                    <Input
                      placeholder="Contact Phone"
                      type="tel"
                      value={form.shipperContactPhone}
                      onChange={(e) => set('shipperContactPhone', e.target.value)}
                    />
                    <Input
                      placeholder="Contact Email"
                      type="email"
                      value={form.shipperContactEmail}
                      onChange={(e) => set('shipperContactEmail', e.target.value)}
                    />
                  </div>
                </div>

                {/* Receiver Contact */}
                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Receiver/Delivery Location
                  </p>
                  <Input
                    placeholder="Receiver Company Name"
                    value={form.receiverName}
                    onChange={(e) => set('receiverName', e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <Input
                      placeholder="Contact Name"
                      value={form.receiverContactName}
                      onChange={(e) => set('receiverContactName', e.target.value)}
                    />
                    <Input
                      placeholder="Contact Phone"
                      type="tel"
                      value={form.receiverContactPhone}
                      onChange={(e) => set('receiverContactPhone', e.target.value)}
                    />
                    <Input
                      placeholder="Contact Email"
                      type="email"
                      value={form.receiverContactEmail}
                      onChange={(e) => set('receiverContactEmail', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Appointment Times */}
          <div>
            <button
              type="button"
              onClick={() => setShowApptTimes((v) => !v)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl border border-fx-border hover:border-fx-orange/30 transition-colors"
            >
              <span className="text-xs font-semibold text-fx-text">Appointment Windows</span>
              <ChevronRight
                size={14}
                className={`text-fx-text-muted transition-transform ${showApptTimes ? 'rotate-90' : ''}`}
              />
            </button>
            {showApptTimes && (
              <div className="mt-3 space-y-3 pl-3">
                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Pickup Appointment
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="datetime-local"
                      placeholder="Start"
                      value={form.pickupApptStart}
                      onChange={(e) => set('pickupApptStart', e.target.value)}
                      className={fieldClass}
                      style={{ colorScheme: 'dark' }}
                    />
                    <input
                      type="datetime-local"
                      placeholder="End"
                      value={form.pickupApptEnd}
                      onChange={(e) => set('pickupApptEnd', e.target.value)}
                      className={fieldClass}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Delivery Appointment
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="datetime-local"
                      placeholder="Start"
                      value={form.deliveryApptStart}
                      onChange={(e) => set('deliveryApptStart', e.target.value)}
                      className={fieldClass}
                      style={{ colorScheme: 'dark' }}
                    />
                    <input
                      type="datetime-local"
                      placeholder="End"
                      value={form.deliveryApptEnd}
                      onChange={(e) => set('deliveryApptEnd', e.target.value)}
                      className={fieldClass}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Freight Info */}
          <div>
            <button
              type="button"
              onClick={() => setShowFreightDetails((v) => !v)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl border border-fx-border hover:border-fx-orange/30 transition-colors"
            >
              <span className="text-xs font-semibold text-fx-text">Detailed Freight Info</span>
              <ChevronRight
                size={14}
                className={`text-fx-text-muted transition-transform ${showFreightDetails ? 'rotate-90' : ''}`}
              />
            </button>
            {showFreightDetails && (
              <div className="mt-3 space-y-3 pl-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                      Pieces Count
                    </p>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.piecesCount}
                      onChange={(e) => set('piecesCount', e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                      Pallets Count
                    </p>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.palletsCount}
                      onChange={(e) => set('palletsCount', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Dimensions (inches)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      placeholder="Length"
                      value={form.lengthIn}
                      onChange={(e) => set('lengthIn', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Width"
                      value={form.widthIn}
                      onChange={(e) => set('widthIn', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Height"
                      value={form.heightIn}
                      onChange={(e) => set('heightIn', e.target.value)}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.stackable}
                    onChange={(e) => set('stackable', e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded"
                  />
                  <span className="text-sm font-semibold text-fx-text-muted">Stackable</span>
                </label>
              </div>
            )}
          </div>

          {/* Special Instructions & Notes */}
          <div>
            <button
              type="button"
              onClick={() => setShowInstructions((v) => !v)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl border border-fx-border hover:border-fx-orange/30 transition-colors"
            >
              <span className="text-xs font-semibold text-fx-text">Instructions & Notes</span>
              <ChevronRight
                size={14}
                className={`text-fx-text-muted transition-transform ${showInstructions ? 'rotate-90' : ''}`}
              />
            </button>
            {showInstructions && (
              <div className="mt-3 space-y-3 pl-3">
                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Special Instructions
                  </p>
                  <textarea
                    placeholder="Any special handling or routing requirements..."
                    value={form.specialInstructions}
                    onChange={(e) => set('specialInstructions', e.target.value)}
                    rows={3}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Pickup Location Notes
                  </p>
                  <textarea
                    placeholder="Dock info, gate codes, parking instructions..."
                    value={form.loadingNotes}
                    onChange={(e) => set('loadingNotes', e.target.value)}
                    rows={3}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-2">
                    Delivery Location Notes
                  </p>
                  <textarea
                    placeholder="Dock info, gate codes, delivery requirements..."
                    value={form.deliveryNotes}
                    onChange={(e) => set('deliveryNotes', e.target.value)}
                    rows={3}
                    className={`${fieldClass} resize-none`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save as Template */}
        <div>
          <button
            type="button"
            onClick={() => setShowSaveTemplate((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-fx-text-dim hover:text-fx-orange transition-colors"
          >
            <BookmarkPlus size={14} />
            Save as Template
          </button>
          {showSaveTemplate && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Template name…"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex-1 h-9 bg-fx-surface-2 border border-fx-border rounded-lg text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="px-3 h-9 rounded-lg text-xs font-bold bg-fx-orange text-white disabled:opacity-50"
              >
                {savingTemplate ? '…' : 'Save'}
              </button>
            </div>
          )}
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
          {saving ? 'Posting…' : 'Post Load'}
        </Button>
      </form>
    </BottomSheet>
  );
}
