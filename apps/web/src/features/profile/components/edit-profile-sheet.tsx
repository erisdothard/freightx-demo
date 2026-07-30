import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Camera } from 'lucide-react';

interface EditProfileSheetProps {
  open: boolean;
  onClose: () => void;
}

// On-brand preset avatars (trucking-themed, stored as data URIs so <img src> works everywhere)
function svgUri(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const DEFAULT_AVATARS = [
  // Truck — brand orange
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#E86030"/><rect x="8" y="14" width="16" height="13" rx="1.5" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 17h5l3 4v6h-8V17z" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="27" r="2" fill="white"/><circle cx="28" cy="27" r="2" fill="white"/></svg>`,
  ),
  // Package — deep orange
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#C03A12"/><path d="M10 17l10-6 10 6v12l-10 6-10-6V17z" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="10,17 20,23 30,17" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="20" y1="23" x2="20" y2="35" stroke="white" stroke-width="1.5"/></svg>`,
  ),
  // Map pin — blue
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#3B82F6"/><path d="M20 10c-4.4 0-8 3.6-8 8 0 5.5 8 14 8 14s8-8.5 8-14c0-4.4-3.6-8-8-8z" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="18" r="2.5" fill="none" stroke="white" stroke-width="1.5"/></svg>`,
  ),
  // Headset / dispatcher — purple
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#8B5CF6"/><path d="M12 22v-3a8 8 0 0116 0v3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/><rect x="10" y="21" width="4" height="7" rx="2" fill="none" stroke="white" stroke-width="1.5"/><rect x="26" y="21" width="4" height="7" rx="2" fill="none" stroke="white" stroke-width="1.5"/></svg>`,
  ),
  // Route — green
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#10B981"/><circle cx="13" cy="13" r="2.5" fill="none" stroke="white" stroke-width="1.5"/><circle cx="27" cy="27" r="2.5" fill="none" stroke="white" stroke-width="1.5"/><path d="M13 15.5c0 4 7 3 7 7s7 4 7 4" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2.5 2"/></svg>`,
  ),
  // Star / rating — amber
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#F59E0B"/><polygon points="20,11 22.5,17.5 29.5,17.5 24,22 26,29 20,25 14,29 16,22 10.5,17.5 17.5,17.5" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ),
];

export function EditProfileSheet({ open, onClose }: EditProfileSheetProps) {
  const { profile, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    avatar_url: '',
  });

  // Sync form with current profile data when sheet opens
  useEffect(() => {
    if (open && profile) {
      setForm({
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? '',
        avatar_url: profile.avatar_url ?? '',
      });
      setError(null);
      setSuccess(false);
    }
  }, [open, profile]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      setForm((prev) => ({ ...prev, avatar_url: publicUrl }));
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  function handleSelectDefault(avatarPath: string) {
    setForm((prev) => ({ ...prev, avatar_url: avatarPath }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await updateProfile({
      full_name: form.full_name.trim() || null,
      phone: form.phone.trim() || null,
      avatar_url: form.avatar_url || null,
    });
    setSaving(false);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Personal Info">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar Section */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-3 text-center">
            Profile Photo
          </p>

          <div className="flex flex-col items-center gap-4">
            {/* Current/Preview Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-fx-orange/10 border-2 border-fx-orange/30 flex items-center justify-center overflow-hidden">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-extrabold text-fx-orange">
                    {form.full_name ? form.full_name.charAt(0).toUpperCase() : 'U'}
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
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Default Avatars */}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-fx-text-dim">Or choose:</p>
              {DEFAULT_AVATARS.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectDefault(avatar)}
                  className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                    form.avatar_url === avatar
                      ? 'border-fx-orange bg-fx-orange/10'
                      : 'border-fx-border hover:border-fx-orange/50'
                  }`}
                >
                  <img src={avatar} alt={`Avatar ${index + 1}`} className="w-6 h-6" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Full Name
          </p>
          <Input
            placeholder="Your full name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            required
          />
        </div>

        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Email
          </p>
          <Input value={profile?.email ?? ''} disabled className="opacity-50 cursor-not-allowed" />
          <p className="text-xs text-fx-text-dim mt-1 pl-1">Email cannot be changed here</p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Phone
          </p>
          <Input
            type="tel"
            placeholder="(555) 000-0000"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-xl px-4 py-3">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-400 bg-green-400/10 rounded-xl px-4 py-3 text-center font-semibold">
            ✓ Saved!
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
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </BottomSheet>
  );
}
