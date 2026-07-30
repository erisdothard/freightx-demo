import { useState, useEffect } from 'react';
import { Bell, Mail, Phone, MessageSquare, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';
import { supabase } from '@/lib/supabase';

interface ChannelSettings {
  push: boolean;
  email: boolean;
  sms: boolean;
}

interface NotificationSettings {
  new_loads: ChannelSettings;
  bid_updates: ChannelSettings;
  load_status: ChannelSettings;
  messages: ChannelSettings;
  reminders: ChannelSettings;
  marketing: ChannelSettings;
}

const DEFAULTS: NotificationSettings = {
  new_loads: { push: true, email: true, sms: false },
  bid_updates: { push: true, email: true, sms: true },
  load_status: { push: true, email: false, sms: false },
  messages: { push: true, email: false, sms: false },
  reminders: { push: true, email: true, sms: false },
  marketing: { push: false, email: true, sms: false },
};

const SETTING_META: Array<{
  id: keyof NotificationSettings;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'new_loads',
    label: 'New Loads',
    description: 'Get notified when new loads match your preferences',
    icon: Bell,
  },
  {
    id: 'bid_updates',
    label: 'Bid Updates',
    description: 'Notifications about your bids (accepted, rejected, new bids)',
    icon: Bell,
  },
  {
    id: 'load_status',
    label: 'Load Status',
    description: 'Status changes on your active loads',
    icon: Bell,
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'New messages from other users',
    icon: MessageSquare,
  },
  {
    id: 'reminders',
    label: 'Reminders',
    description: 'Pickup reminders, delivery deadlines, document expirations',
    icon: Bell,
  },
  {
    id: 'marketing',
    label: 'Tips & Updates',
    description: 'Product updates, tips, and industry news',
    icon: Mail,
  },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [phoneNumber, setPhoneNumber] = useState('');

  const role = getNavRole(profile?.role);

  // Load preferences from DB
  useEffect(() => {
    if (!profile?.id) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('notification_preferences')
      .select('settings, phone_number')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(
        ({
          data,
        }: {
          data: { settings: NotificationSettings; phone_number: string | null } | null;
        }) => {
          if (data) {
            setSettings(data.settings ?? DEFAULTS);
            setPhoneNumber(data.phone_number ?? '');
          }
          setLoadingPrefs(false);
        },
      );
  }, [profile?.id]);

  const toggleSetting = (id: keyof NotificationSettings, channel: keyof ChannelSettings) => {
    setSettings((prev) => ({
      ...prev,
      [id]: { ...prev[id], [channel]: !prev[id][channel] },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('notification_preferences').upsert({
      user_id: profile.id,
      settings,
      phone_number: phoneNumber.trim() || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loadingPrefs) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="text-fx-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Notifications" showBack backAction={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔔</div>
          <h1 className="text-xl font-bold text-fx-text">Notification Settings</h1>
          <p className="text-sm text-fx-text-muted mt-1">Choose how you want to be notified</p>
        </div>

        {/* SMS Phone Number */}
        <div className="bg-fx-surface border border-fx-border rounded-2xl p-4 mb-4">
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            SMS Phone Number
          </p>
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              setSaved(false);
            }}
            className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
          />
          <p className="text-[10px] text-fx-text-dim mt-1.5">
            E.164 format required for SMS (e.g. +15551234567)
          </p>
        </div>

        {/* Channel Headers */}
        <div className="flex items-center justify-end gap-4 mb-4 pr-2">
          <div className="flex items-center gap-1">
            <Phone size={14} className="text-fx-text-dim" />
            <span className="text-[10px] text-fx-text-dim uppercase">SMS</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail size={14} className="text-fx-text-dim" />
            <span className="text-[10px] text-fx-text-dim uppercase">Email</span>
          </div>
          <div className="flex items-center gap-1">
            <Bell size={14} className="text-fx-text-dim" />
            <span className="text-[10px] text-fx-text-dim uppercase">Push</span>
          </div>
        </div>

        {/* Settings List */}
        <div className="space-y-3 mb-6">
          {SETTING_META.map((meta) => {
            const s = settings[meta.id];
            return (
              <div key={meta.id} className="bg-fx-surface border border-fx-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
                    <meta.icon size={18} className="text-fx-orange" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-fx-text">{meta.label}</p>
                    <p className="text-xs text-fx-text-muted mt-0.5">{meta.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3">
                  {(['sms', 'email', 'push'] as const).map((channel) => (
                    <button
                      key={channel}
                      onClick={() => toggleSetting(meta.id, channel)}
                      className={`w-10 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        s[channel] ? 'bg-fx-orange text-white' : 'bg-fx-surface-2 text-fx-text-dim'
                      }`}
                    >
                      {s[channel] && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full h-12 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 ${
            saved ? 'bg-green-500 text-white' : 'bg-fx-orange text-white hover:opacity-90'
          }`}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving...
            </>
          ) : saved ? (
            <>
              <Check size={16} /> Saved!
            </>
          ) : (
            'Save Changes'
          )}
        </button>

        <p className="text-center text-[10px] text-fx-text-dim mt-6">FreightX v0.13.0 · Phase 13</p>
      </div>

      <BottomNav role={role} />
    </div>
  );
}
