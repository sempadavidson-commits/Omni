import React from 'react';
import { ArrowLeft, Bell, Database, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Surface } from '../components/ui/Surface';

const readPreference = (key: string, fallback: boolean) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
};

function Preference({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 px-4 py-3">
    <span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs leading-5 text-[var(--omni-text-secondary)]">{description}</span></span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--omni-accent)]"/>
  </label>;
}

export function Settings() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAppContext();
  const [dataSaver, setDataSaver] = React.useState(() => readPreference('omni_data_saver', false));
  const [autoplay, setAutoplay] = React.useState(() => readPreference('omni_autoplay', true));
  const [notificationState, setNotificationState] = React.useState<NotificationPermission | 'unsupported'>(() => 'Notification' in window ? Notification.permission : 'unsupported');

  const savePreference = (key: string, value: boolean, setter: (value: boolean) => void) => {
    setter(value);
    try { localStorage.setItem(key, String(value)); } catch {}
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
  };

  return <div className="h-full overflow-y-auto bg-omni-bg pb-24 text-[var(--omni-text-primary)]">
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-[var(--omni-border-subtle)] bg-[rgba(11,11,10,.94)] px-3 backdrop-blur-xl">
      <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.08]"><ArrowLeft size={21}/></button>
      <div><h1 className="text-lg font-semibold">Settings</h1><p className="text-xs text-[var(--omni-text-muted)]">Account, privacy and device controls</p></div>
    </header>

    <main className="space-y-5 px-4 py-5">
      <section aria-labelledby="account-heading"><h2 id="account-heading" className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--omni-text-muted)]">Account</h2><Surface className="p-4"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--omni-accent-soft)] text-omni-accent"><ShieldCheck size={21}/></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{currentUser?.displayName || 'Not signed in'}</p><p className="truncate text-xs text-[var(--omni-text-secondary)]">{currentUser?.email || (currentUser ? `@${currentUser.username}` : 'Sign in to manage your account')}</p></div></div></Surface></section>

      <section aria-labelledby="experience-heading"><h2 id="experience-heading" className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--omni-text-muted)]">Playback</h2><Surface className="divide-y divide-[var(--omni-border-subtle)]"><Preference label="Autoplay videos" description="Play the focused video automatically." checked={autoplay} onChange={value => savePreference('omni_autoplay', value, setAutoplay)}/><Preference label="Data saver" description="Prefer lower-bandwidth media while using mobile data." checked={dataSaver} onChange={value => savePreference('omni_data_saver', value, setDataSaver)}/></Surface></section>

      <section aria-labelledby="device-heading"><h2 id="device-heading" className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--omni-text-muted)]">Device</h2><Surface className="p-4"><div className="flex items-start gap-3"><Bell size={20} className="mt-0.5 text-omni-accent"/><div className="flex-1"><p className="text-sm font-medium">Notifications</p><p className="mt-1 text-xs leading-5 text-[var(--omni-text-secondary)]">Current permission: {notificationState}.</p>{notificationState === 'default' && <Button size="sm" variant="secondary" className="mt-3" onClick={requestNotifications}>Enable notifications</Button>}</div></div></Surface></section>

      <section aria-labelledby="privacy-heading"><h2 id="privacy-heading" className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--omni-text-muted)]">Privacy</h2><Surface className="space-y-3 p-4"><div className="flex gap-3"><Database size={20} className="mt-0.5 text-omni-accent"/><p className="text-xs leading-5 text-[var(--omni-text-secondary)]">Saved and private content is restricted to its authenticated owner. Device preferences stay on this device.</p></div><div className="flex gap-3"><Smartphone size={20} className="mt-0.5 text-omni-accent"/><p className="text-xs leading-5 text-[var(--omni-text-secondary)]">Omni follows your operating system’s reduced-motion and appearance preferences.</p></div></Surface></section>

      {currentUser && <Button variant="danger" className="w-full" onClick={logout}><LogOut size={18}/>Sign out</Button>}
    </main>
  </div>;
}
