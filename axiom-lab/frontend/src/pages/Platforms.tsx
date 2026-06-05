import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Settings } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ExternalLink, Instagram, MessageCircle, MapPin, Globe, Edit2, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Platform {
  name: string;
  icon: React.ReactNode;
  url: string;
  handle: string;
  color: string;
}

const platforms: Platform[] = [
  { name: 'Instagram', icon: <Instagram size={22} />, url: 'https://instagram.com/axiom.research.bali', handle: '@axiom.research.bali', color: 'from-pink-500 to-purple-600' },
  { name: 'Telegram', icon: <MessageCircle size={22} />, url: 'https://t.me/axiomresearchbali', handle: 't.me/axiomresearchbali', color: 'from-blue-400 to-blue-600' },
  { name: 'WhatsApp', icon: <MessageCircle size={22} />, url: 'https://wa.me/6282146282559', handle: '+62 821 4628 2559', color: 'from-green-400 to-green-600' },
  { name: 'TikTok', icon: <span className="text-xl font-bold">T</span>, url: 'https://tiktok.com/@axiom_bali', handle: '@axiom_bali', color: 'from-gray-700 to-gray-900' },
  { name: 'Google Maps', icon: <MapPin size={22} />, url: 'https://maps.google.com/?q=Axiom+Lab+Bali', handle: 'Axiom Lab Bali', color: 'from-red-400 to-red-600' },
  { name: 'Website', icon: <Globe size={22} />, url: 'https://axiomresearchbali.com/shop', handle: 'axiomresearchbali.com/shop', color: 'from-cyan-400 to-cyan-600' },
  { name: 'Twitter/X', icon: <span className="text-xl font-bold">𝕏</span>, url: 'https://x.com/axiom_bali', handle: '@axiom_bali', color: 'from-gray-500 to-gray-700' },
];

export default function Platforms() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Settings>('/settings').then(s => { setSettings(s); setForm(s); });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        instagram_followers: form.instagram_followers,
        telegram_members: form.telegram_members,
        gmaps_rating: form.gmaps_rating,
        gmaps_reviews: form.gmaps_reviews,
      });
      setSettings(prev => ({ ...prev, ...form }));
      toast('success', 'Platform stats updated');
      setEditing(false);
    } catch { toast('error', 'Save failed'); }
    finally { setSaving(false); }
  };

  const stats = [
    { label: 'Instagram Followers', key: 'instagram_followers', value: settings.instagram_followers },
    { label: 'Telegram Members', key: 'telegram_members', value: settings.telegram_members },
    { label: 'Google Maps Rating', key: 'gmaps_rating', value: settings.gmaps_rating },
    { label: 'Google Maps Reviews', key: 'gmaps_reviews', value: settings.gmaps_reviews },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platforms</h1>
          <p className="text-txt-secondary text-sm mt-0.5">Quick access to all your channels</p>
        </div>
        {isAdmin && (
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-1.5"><Save size={14} />{saving ? 'Saving...' : 'Save Stats'}</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5"><Edit2 size={14} /> Edit Stats</button>
          )
        )}
      </div>

      {/* Platform grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {platforms.map(p => (
          <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
            className="card group hover:border-cyan/30 transition-all cursor-pointer flex flex-col gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white shrink-0`}>
              {p.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-txt-primary text-sm">{p.name}</p>
              <p className="text-xs text-txt-muted truncate">{p.handle}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-txt-muted group-hover:text-cyan transition-colors">
              <ExternalLink size={11} /> Open
            </div>
          </a>
        ))}
      </div>

      {/* Stats */}
      <div className="card">
        <h2 className="text-sm font-semibold text-txt-primary mb-4">Platform Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.key} className="bg-bg border border-border rounded-xl p-4">
              <p className="text-xs text-txt-muted mb-1">{stat.label}</p>
              {editing && isAdmin ? (
                <input
                  className="input text-lg font-bold text-cyan p-0 bg-transparent border-0 border-b border-border rounded-none focus:border-cyan"
                  value={String(form[stat.key as keyof Settings] || '')}
                  onChange={e => setForm(f => ({ ...f, [stat.key]: e.target.value }))}
                />
              ) : (
                <p className="text-2xl font-bold text-cyan">{stat.value || '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Business info */}
      <div className="card">
        <h2 className="text-sm font-semibold text-txt-primary mb-3">Business Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {[
            ['Business', 'The Axiom Lab'],
            ['Location', 'Pererenan, Bali, Indonesia'],
            ['WhatsApp', '+62 821 4628 2559'],
            ['Instagram', '@axiom.research.bali'],
            ['Website', 'axiomresearchbali.com'],
          ].map(([label, val]) => (
            <div key={label} className="flex gap-3">
              <span className="text-txt-muted w-24 shrink-0">{label}</span>
              <span className="text-txt-primary">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
