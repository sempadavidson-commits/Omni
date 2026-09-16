import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Inbox as InboxIcon, User, Home, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { currentUser, requireAuth, unreadInboxCount } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuthProtectedClick = (e: React.MouseEvent, path: string, name: string, actionDesc: string) => {
    if (!currentUser) {
      e.preventDefault();
      requireAuth(name, actionDesc, () => {
        navigate(path);
      });
    }
  };

  // 5 Destinations matching Image 3: Home, Friends, Create (+), Inbox, Profile
  const navItems = [
    {
      id: 'nav-home',
      path: '/',
      label: 'Home',
      icon: Home,
      authDesc: null,
      isActiveCheck: (path: string, loc: typeof location) => loc.pathname === '/' && !loc.search.includes('tab=following'),
    },
    {
      id: 'nav-friends',
      path: '/?tab=following',
      label: 'Friends',
      icon: Users,
      authDesc: 'Sign in to see your friends and followed creators.',
      isActiveCheck: (_path: string, loc: typeof location) => loc.search.includes('tab=following'),
    },
    {
      id: 'nav-create',
      path: '/create',
      label: '',
      icon: Plus,
      isAction: true,
      authDesc: 'Sign in to create and share your video.',
      isActiveCheck: (path: string, loc: typeof location) => loc.pathname === '/create',
    },
    {
      id: 'nav-inbox',
      path: '/inbox',
      label: 'Inbox',
      icon: InboxIcon,
      badge: unreadInboxCount > 0 ? (unreadInboxCount > 99 ? '99+' : unreadInboxCount) : undefined,
      authDesc: 'Sign in to access your activity and messages.',
      isActiveCheck: (path: string, loc: typeof location) => loc.pathname.startsWith('/inbox') || loc.pathname.startsWith('/messages'),
    },
    {
      id: 'nav-profile',
      path: '/profile',
      label: 'Profile',
      icon: User,
      authDesc: 'Sign in to access your creator profile.',
      isActiveCheck: (path: string, loc: typeof location) => loc.pathname.startsWith('/profile'),
    },
  ];

  return (
    <nav
      id="omni-bottom-navigation"
      aria-label="Main Navigation"
      className="absolute bottom-0 left-0 right-0 z-40 select-none pb-safe bg-black/95 backdrop-blur-md border-t border-white/[0.08]"
    >
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1 max-w-md mx-auto h-14">
        {navItems.map((item) => {
          const isItemActive = item.isActiveCheck ? item.isActiveCheck(item.path, location) : location.pathname === item.path;

          if (item.isAction) {
            return (
              <button
                key={item.id}
                id={item.id}
                onClick={(e) => {
                  if (item.authDesc && !currentUser) {
                    handleAuthProtectedClick(e, item.path, 'Create', item.authDesc);
                  } else {
                    navigate('/create');
                  }
                }}
                className="relative flex items-center justify-center min-w-[50px] h-10 group active:scale-95 transition-transform"
              >
                <div className="relative w-11 h-7.5 rounded-lg flex items-center justify-center">
                  {/* Left Cyan Edge & Right Pink Edge TikTok/Omni styled Icon */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-white to-[#fe2c55] rounded-[9px] p-[2px] shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                    <div className="w-full h-full bg-black rounded-[7px] flex items-center justify-center">
                      <Plus size={18} strokeWidth={3} className="text-white" />
                    </div>
                  </div>
                </div>
              </button>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              id={item.id}
              to={item.path}
              onClick={(e) =>
                item.authDesc
                  ? handleAuthProtectedClick(e, item.path, item.label, item.authDesc)
                  : undefined
              }
              className={cn(
                "relative flex flex-col items-center justify-center min-w-[56px] h-11 transition-all duration-200 group focus-visible:outline-none rounded-xl",
                isItemActive ? "text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <div className="relative">
                <Icon
                  size={21}
                  strokeWidth={isItemActive ? 2.5 : 1.8}
                  className={cn(
                    "transition-transform duration-200",
                    isItemActive && "scale-105"
                  )}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-3.5 px-1 rounded-full bg-[#fe2c55] text-white text-[9px] font-extrabold flex items-center justify-center shadow-md">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold mt-0.5 tracking-tight transition-colors",
                  isItemActive ? "text-white font-bold" : "text-slate-400"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
