import { AlertTriangle, Phone } from 'lucide-react';

interface HazmatData {
  properShippingName: string;
  hazmatClass: string;
  unNumber: string;
  packingGroup: string;
  quantity: string;
  emergencyPhone: string;
  placardRequired: boolean;
  reportableQuantity: boolean;
}

interface Props {
  data: HazmatData;
  onChange: <K extends keyof HazmatData>(key: K, value: HazmatData[K]) => void;
}

const HAZMAT_CLASSES = [
  '1 - Explosives',
  '2.1 - Flammable Gas',
  '2.2 - Non-Flammable Gas',
  '2.3 - Poison Gas',
  '3 - Flammable Liquid',
  '4.1 - Flammable Solid',
  '4.2 - Spontaneously Combustible',
  '4.3 - Dangerous When Wet',
  '5.1 - Oxidizer',
  '5.2 - Organic Peroxide',
  '6.1 - Poison',
  '6.2 - Infectious Substance',
  '7 - Radioactive',
  '8 - Corrosive',
  '9 - Miscellaneous',
];

const PACKING_GROUPS = ['I - Great Danger', 'II - Medium Danger', 'III - Minor Danger'];

export function HazmatFields({ data, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/25 text-xs text-amber-400">
        <AlertTriangle size={13} className="shrink-0" />
        <span>
          PHMSA requires these fields for hazmat shipments (49 CFR 172.200-204). BOL signing will be
          blocked if incomplete.
        </span>
      </div>

      {/* Proper Shipping Name */}
      <div>
        <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
          Proper Shipping Name *
        </label>
        <input
          className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
          placeholder="e.g. Gasoline"
          value={data.properShippingName}
          onChange={(e) => onChange('properShippingName', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Hazmat Class */}
        <div>
          <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
            Hazard Class *
          </label>
          <select
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            value={data.hazmatClass}
            onChange={(e) => onChange('hazmatClass', e.target.value)}
          >
            <option value="">Select...</option>
            {HAZMAT_CLASSES.map((c) => (
              <option key={c} value={c.split(' - ')[0]}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* UN Number */}
        <div>
          <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
            UN Number *
          </label>
          <input
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            placeholder="UN1203"
            value={data.unNumber}
            onChange={(e) => onChange('unNumber', e.target.value)}
          />
        </div>

        {/* Packing Group */}
        <div>
          <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
            Packing Group *
          </label>
          <select
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            value={data.packingGroup}
            onChange={(e) => onChange('packingGroup', e.target.value)}
          >
            <option value="">Select...</option>
            {PACKING_GROUPS.map((pg) => (
              <option key={pg} value={pg.split(' - ')[0]}>
                {pg}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
            Quantity *
          </label>
          <input
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            placeholder="e.g. 5000 lbs"
            value={data.quantity}
            onChange={(e) => onChange('quantity', e.target.value)}
          />
        </div>
      </div>

      {/* Emergency Phone */}
      <div>
        <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
          24-Hour Emergency Phone *
        </label>
        <div className="relative">
          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fx-text-dim" />
          <input
            type="tel"
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            placeholder="1-800-XXX-XXXX"
            value={data.emergencyPhone}
            onChange={(e) => onChange('emergencyPhone', e.target.value)}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={data.placardRequired}
            onChange={(e) => onChange('placardRequired', e.target.checked)}
            className="w-4 h-4 accent-orange-500 rounded"
          />
          <span className="text-sm font-semibold text-fx-text-muted">Placard Required</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={data.reportableQuantity}
            onChange={(e) => onChange('reportableQuantity', e.target.checked)}
            className="w-4 h-4 accent-orange-500 rounded"
          />
          <span className="text-sm font-semibold text-fx-text-muted">Reportable Quantity</span>
        </label>
      </div>
    </div>
  );
}
