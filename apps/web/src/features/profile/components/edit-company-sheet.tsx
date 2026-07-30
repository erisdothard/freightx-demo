import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, uploadCompanyLogo } from '@/services/companies.service';
import { Camera } from 'lucide-react';

interface EditCompanySheetProps {
  open: boolean;
  onClose: () => void;
}

export function EditCompanySheet({ open, onClose }: EditCompanySheetProps) {
  const { profile, company, createCompany, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mc_number: '',
    dot_number: '',
    broker_authority: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    logo_url: '',
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
    if (company) {
      setForm({
        name: company.name ?? '',
        mc_number: company.mc_number ?? '',
        dot_number: company.dot_number ?? '',
        broker_authority: company.broker_authority ?? '',
        phone: company.phone ?? '',
        email: company.email ?? '',
        address: company.address ?? '',
        city: company.city ?? '',
        state: company.state ?? '',
        zip: company.zip ?? '',
        logo_url: company.logo_url ?? '',
      });
    }
  }, [open, company]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !company?.id) return;

    setUploading(true);
    setError(null);
    try {
      // Upload to storage
      const publicUrl = await uploadCompanyLogo(company.id, file);
      console.log('Logo uploaded, URL:', publicUrl);

      // Immediately save to database so all team members see it
      const { error: saveError } = await updateCompany(company.id, { logo_url: publicUrl });
      if (saveError) {
        throw new Error(saveError);
      }

      // Update form state
      setForm((prev) => ({ ...prev, logo_url: publicUrl }));

      // Refresh profile to update context
      await refreshProfile();

      // Show success briefly
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  }

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fields = {
      name: form.name.trim(),
      mc_number: form.mc_number.trim() || null,
      dot_number: form.dot_number.trim() || null,
      broker_authority: form.broker_authority.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim().toUpperCase().slice(0, 2) || null,
      zip: form.zip.trim() || null,
      logo_url: form.logo_url || null,
    };

    let err: string | null = null;

    if (!company) {
      // No company yet — create one
      const { error: createErr } = await createCompany({
        name: fields.name,
        mc_number: fields.mc_number ?? undefined,
        dot_number: fields.dot_number ?? undefined,
        broker_authority: fields.broker_authority ?? undefined,
        phone: fields.phone ?? undefined,
        email: fields.email ?? undefined,
      });
      err = createErr;
    } else {
      const { error: updateErr } = await updateCompany(company.id, fields);
      err = updateErr;
    }

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    }
  }

  const companyType = company?.type ?? (profile?.role === 'admin' ? 'carrier' : profile?.role);
  const isCarrier = companyType === 'carrier';
  const isBroker = companyType === 'broker';
  const isOwner = company?.owner_id === profile?.id;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={company ? 'Company Profile' : 'Create Company'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company Logo - Only owners can edit */}
        {company && isOwner && (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-3 text-center">
              Company Logo
            </p>

            <div className="flex flex-col items-center gap-4">
              {/* Current/Preview Logo */}
              <div className="relative">
                <div className="w-16 h-16 rounded-lg bg-fx-orange/10 border-2 border-fx-orange/30 flex items-center justify-center overflow-hidden">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Company logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-extrabold text-fx-orange">
                      {form.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-fx-orange rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera size={14} className="text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* Company Logo - Read-only for non-owners */}
        {company && !isOwner && form.logo_url && (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-3 text-center">
              Company Logo
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-fx-orange/10 border-2 border-fx-orange/30 flex items-center justify-center overflow-hidden">
                <img
                  src={form.logo_url}
                  alt="Company logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-fx-text-dim">Only the company owner can change the logo</p>
            </div>
          </div>
        )}

        {/* Company name */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Company Name
          </p>
          <Input
            placeholder="Your Company LLC"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>

        {/* Authority numbers */}
        {(isCarrier || isBroker) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                MC #
              </p>
              <Input
                placeholder="MC-123456"
                value={form.mc_number}
                onChange={(e) => set('mc_number', e.target.value)}
              />
            </div>
            {isCarrier && (
              <div>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                  DOT #
                </p>
                <Input
                  placeholder="DOT-123456"
                  value={form.dot_number}
                  onChange={(e) => set('dot_number', e.target.value)}
                />
              </div>
            )}
            {isBroker && (
              <div>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                  Broker Auth #
                </p>
                <Input
                  placeholder="BA-123456"
                  value={form.broker_authority}
                  onChange={(e) => set('broker_authority', e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Phone
            </p>
            <Input
              type="tel"
              placeholder="(555) 000-0000"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Email
            </p>
            <Input
              type="email"
              placeholder="office@company.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Address
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Street address"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <Input
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </div>
              <Input
                placeholder="ST"
                maxLength={2}
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
              />
              <div className="col-span-2">
                <Input
                  placeholder="ZIP"
                  value={form.zip}
                  onChange={(e) => set('zip', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-xl px-4 py-3">{error}</p>
        )}

        {success && !uploading && (
          <p className="text-sm text-green-400 bg-green-400/10 rounded-xl px-4 py-3 text-center font-semibold">
            ✓ Saved! All team members will see this change.
          </p>
        )}

        <Button
          type="submit"
          disabled={saving || success}
          size="lg"
          fullWidth
          className="rounded-2xl font-bold"
          style={{
            background: 'linear-gradient(145deg, #F07040, #C03A12)',
            boxShadow: '0 4px 20px rgba(232,96,48,0.4)',
          }}
        >
          {saving ? 'Saving…' : company ? 'Save Changes' : 'Create Company'}
        </Button>
      </form>
    </BottomSheet>
  );
}
