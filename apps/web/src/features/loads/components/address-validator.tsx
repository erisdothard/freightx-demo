/**
 * Address Validation Component
 *
 * Validates addresses using Google Maps Geocoding API and shows
 * "Did you mean?" suggestions to prevent geocoding errors like
 * "Nashville, TN → Portland, OR".
 *
 * Usage:
 *   <AddressValidator
 *     initialAddress="123 Main St"
 *     initialCity="Nashville"
 *     initialState="TN"
 *     onConfirm={(result) => {
 *       // User confirmed the address
 *       setOriginLat(result.coords[0]);
 *       setOriginLng(result.coords[1]);
 *       setOriginAddressNormalized(result.normalized_address);
 *     }}
 *   />
 */

import { useState } from 'react';
import { MapPin, CheckCircle, AlertCircle, Loader2, Search } from 'lucide-react';
import {
  validateAddress,
  getConfidenceLabel,
  type GeocodingResult,
} from '@/lib/geocoding-enterprise';

interface AddressValidatorProps {
  initialAddress?: string;
  initialCity?: string;
  initialState?: string;
  onConfirm: (result: GeocodingResult) => void;
  onCancel?: () => void;
}

export function AddressValidator({
  initialAddress = '',
  initialCity = '',
  initialState = '',
  onConfirm,
  onCancel,
}: AddressValidatorProps) {
  const [address, setAddress] = useState(initialAddress);
  const [city, setCity] = useState(initialCity);
  const [state, setState] = useState(initialState);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    if (!address.trim() || !city.trim() || !state.trim()) {
      setError('Please enter a complete address');
      return;
    }

    setValidating(true);
    setError(null);
    setSuggestions([]);

    try {
      const results = await validateAddress(address, city, state, 3);

      if (results.length === 0) {
        setError('Address not found. Please check spelling and try again.');
        setSuggestions([]);
      } else {
        setSuggestions(results);
        setError(null);
      }
    } catch (err) {
      setError('Failed to validate address. Please try again.');
      console.error('[AddressValidator] Validation error:', err);
    } finally {
      setValidating(false);
    }
  }

  function handleSelectSuggestion(result: GeocodingResult) {
    onConfirm(result);
  }

  return (
    <div className="space-y-4">
      {/* Input fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-fx-text-muted mb-1.5">
            Street Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main Street"
            className="w-full h-11 bg-fx-surface border border-fx-border rounded-xl px-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:outline-none focus:border-fx-orange/50 transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-fx-text-muted mb-1.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Nashville"
              className="w-full h-11 bg-fx-surface border border-fx-border rounded-xl px-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:outline-none focus:border-fx-orange/50 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fx-text-muted mb-1.5">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="TN"
              maxLength={2}
              className="w-full h-11 bg-fx-surface border border-fx-border rounded-xl px-3 text-sm text-fx-text placeholder:text-fx-text-dim uppercase focus:outline-none focus:border-fx-orange/50 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
            />
          </div>
        </div>
      </div>

      {/* Validate button */}
      <button
        onClick={handleValidate}
        disabled={validating}
        className="w-full h-11 bg-fx-orange hover:bg-fx-orange/90 disabled:bg-fx-surface-2 disabled:text-fx-text-dim text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {validating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <Search size={16} />
            Validate Address
          </>
        )}
      </button>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Address Not Found</p>
            <p className="text-xs text-red-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fx-text-muted uppercase tracking-widest">
            Did you mean:
          </p>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id || index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full bg-fx-surface border border-fx-border hover:border-fx-orange/50 rounded-xl p-3 text-left transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0 group-hover:bg-fx-orange/20 transition-colors">
                  <MapPin size={18} className="text-fx-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-fx-text">
                      {suggestion.normalized_address}
                    </p>
                    {index === 0 && (
                      <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-[10px] font-bold text-green-400 uppercase">
                        Best Match
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-fx-text-dim">
                    <span className="flex items-center gap-1">
                      {suggestion.confidence === 'ROOFTOP' ? (
                        <CheckCircle size={11} className="text-green-400" />
                      ) : (
                        <AlertCircle size={11} className="text-yellow-400" />
                      )}
                      {getConfidenceLabel(suggestion.confidence)}
                    </span>
                    <span className="text-fx-border">•</span>
                    <span>
                      {suggestion.coords[0].toFixed(6)}, {suggestion.coords[1].toFixed(6)}
                    </span>
                  </div>
                  {suggestion.components.postal_code && (
                    <p className="text-[11px] text-fx-text-muted mt-0.5">
                      ZIP: {suggestion.components.postal_code}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full h-10 bg-fx-surface border border-fx-border hover:border-fx-text-dim text-fx-text-muted font-semibold rounded-xl transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/**
 * Inline address validator (for use inside forms)
 *
 * Shows validation status inline without modal.
 */
export function InlineAddressValidator({
  address,
  city,
  state,
  onAddressChange,
  onCityChange,
  onStateChange,
  onValidationComplete,
}: {
  address: string;
  city: string;
  state: string;
  onAddressChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onValidationComplete?: (result: GeocodingResult | null) => void;
}) {
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'validating' | 'valid' | 'invalid'
  >('idle');
  const [validatedResult, setValidatedResult] = useState<GeocodingResult | null>(null);

  async function handleValidate() {
    if (!address.trim() || !city.trim() || !state.trim()) {
      setValidationStatus('idle');
      return;
    }

    setValidationStatus('validating');

    try {
      const results = await validateAddress(address, city, state, 1);

      if (results.length > 0) {
        setValidationStatus('valid');
        setValidatedResult(results[0]);
        onValidationComplete?.(results[0]);
      } else {
        setValidationStatus('invalid');
        setValidatedResult(null);
        onValidationComplete?.(null);
      }
    } catch {
      setValidationStatus('invalid');
      setValidatedResult(null);
      onValidationComplete?.(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => {
            onAddressChange(e.target.value);
            setValidationStatus('idle');
          }}
          onBlur={handleValidate}
          placeholder="123 Main Street"
          className="w-full h-11 bg-fx-surface border border-fx-border rounded-xl px-3 pr-10 text-sm text-fx-text placeholder:text-fx-text-dim focus:outline-none focus:border-fx-orange/50 transition-colors"
        />
        {validationStatus === 'validating' && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fx-text-dim animate-spin"
          />
        )}
        {validationStatus === 'valid' && (
          <CheckCircle
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400"
          />
        )}
        {validationStatus === 'invalid' && (
          <AlertCircle
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={city}
          onChange={(e) => {
            onCityChange(e.target.value);
            setValidationStatus('idle');
          }}
          onBlur={handleValidate}
          placeholder="City"
          className="h-11 bg-fx-surface border border-fx-border rounded-xl px-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:outline-none focus:border-fx-orange/50 transition-colors"
        />
        <input
          type="text"
          value={state}
          onChange={(e) => {
            onStateChange(e.target.value.toUpperCase());
            setValidationStatus('idle');
          }}
          onBlur={handleValidate}
          placeholder="State"
          maxLength={2}
          className="h-11 bg-fx-surface border border-fx-border rounded-xl px-3 text-sm text-fx-text placeholder:text-fx-text-dim uppercase focus:outline-none focus:border-fx-orange/50 transition-colors"
        />
      </div>

      {validationStatus === 'valid' && validatedResult && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-2.5 flex items-start gap-2">
          <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-green-400 mb-0.5">Address Validated</p>
            <p className="text-[11px] text-green-300 truncate">
              {validatedResult.normalized_address}
            </p>
          </div>
        </div>
      )}

      {validationStatus === 'invalid' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-red-400">
            Address not found. Please check and try again.
          </p>
        </div>
      )}
    </div>
  );
}
