import React from 'react';
import { Home, Inbox as InboxIcon, Plus, User, Users } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { IconButton } from './ui/IconButton';

const NAV_ITEMS = [
  { id: 'nav-home', path: '/', label: 'Home', icon: Home, active: (pathname: string, search: string) => pathname === '/' && !search.includes('tab=following') },
  { id: 'nav-friends', path: '/?tab=following', label: 'Following', icon: Users, protected: true, active: (pathname: string, search: string) => pathname === '/' && search.includes('tab=following') },
  { id: 'nav-inbox', path: '/inbox/activity', label: 'Inbox', icon: InboxIcon, protected: true, active: (pathname: string) => pathname.startsWith('/inbox') || pathname.startsWith('/messages') },
  { id: 'nav-profile', path: '/profile', label: 'Profile', icon: User, protected: true, active: (pathname: string) => pathname.startsWith('/profile') },
] as const;

export function BottomNav() {
  const { currentUser, requireAuth, unreadInboxCount } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const openProtected = (event: React.MouseEvent, path: string, label: string) => {
    if (currentUser) return;
    event.preventDefault();
    requireAuth(label, `Sign in to open ${label.toLowerCase()}.`, () => navigate(path));
  };

  return <nav aria-label="Primary" className="absolute inset-x-0 bottom-0 z-40 border-t border-[var(--omni-border-subtle)] bg-[rgba(11,11,10,.94)] pb-safe backdrop-blur-xl">
    <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
      {NAV_ITEMS.slice(0, 2).map(item => <NavItem key={item.id} item={item} location={location} badge={undefined} onClick={event => item.protected && openProtected(event, item.path, item.label)}/>) }
      <IconButton label="Create a Moment" onClick={() => currentUser ? navigate('/create') : requireAuth('Create', 'Sign in to create a Moment.', () => navigate('/create'))} className="mx-auto rounded-[14px] bg-[var(--omni-text-primary)] text-omni-bg hover:bg-white"><Plus size={22} strokeWidth={2.5}/></IconButton>
      {NAV_ITEMS.slice(2).map(item => <NavItem key={item.id} item={item} location={location} badge={item.id === 'nav-inbox' && unreadInboxCount > 0 ? Math.min(unreadInboxCount, 99) : undefined} onClick={event => item.protected && openProtected(event, item.path, item.label)}/>) }
    </div>
  </nav>;
}

type Item = typeof NAV_ITEMS[number];
function NavItem({ item, location, badge, onClick }: { item: Item; location: ReturnType<typeof useLocation>; badge?: number; onClick: (event: React.MouseEvent) => void }) {
  const Icon = item.icon;
  const selected = item.active(location.pathname, location.search);
  return <NavLink id={item.id} to={item.path} onClick={onClick} aria-label={item.label} aria-current={selected ? 'page' : undefined} className={cn('relative mx-auto flex h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors', selected ? 'text-[var(--omni-text-primary)]' : 'text-[var(--omni-text-muted)] hover:text-[var(--omni-text-secondary)]')}>
    <span className="relative"><Icon size={21} strokeWidth={selected ? 2.4 : 1.8}/>{badge !== undefined && <span className="absolute -right-3 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-omni-accent px-1 text-[9px] font-bold text-omni-bg">{badge}</span>}</span><span>{item.label}</span>
  </NavLink>;
}
