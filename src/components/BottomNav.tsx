import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, Plus, Inbox as InboxIcon, User, Home } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { currentUser, requireAuth, unreadInboxCount } = useAppContext();
  const navigate = useNavigate();

  const handleAuthProtectedClick = (e: React.MouseEvent, path: string, name: string, actionDesc: string) => {
    if (!currentUser) {
      e.preventDefault();
      requireAuth(name, actionDesc, () => {
        navigate(path);
      });
    }
  };

  // 4 Core Destinations: Home, Create, Inbox, Profile
  const navItems = [
    {
      id: 'nav-home',
      path: '/',
      label: 'Home',
      icon: Home,
      authDesc: null,
    },
    {
      id: 'nav-create',
      path: '/create',
      label: 'Create',
      icon: Plus,
      isAction: true,
      authDesc: 'Sign in to create and share your video.',
    },
    {
      id: 'nav-inbox',
      path: '/inbox',
      label: 'Inbox',
      icon: InboxIcon,
      badge: unreadInboxCount > 0 ? (unreadInboxCount > 99 ? '99+' : unreadInboxCount) : null,
      authDesc: 'Sign in to access your activity and messages.',
    },
    {
      id: 'nav-profile',
      path: '/profile',
      label: 'Profile',
      icon: User,
      authDesc: 'Sign in to access your creator profile.',
    },
  ];

  return (
    <nav
      id="omni-bottom-navigation"
      aria-label="Main Navigation"
      className="absolute bottom-0 left-0 right-0 z-40 select-none pb-safe bg-[#07080c]/95  border-t "
    >
      <div className="flex items-center justify-around px-4 pt-2 pb-1.5 max-w-md mx-auto h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            id={item.id}
            to={item.path}
            end={item.path === '/'}
            onClick={(e) =>
              item.authDesc
                ? handleAuthProtectedClick(e, item.path, item.label, item.authDesc)
                : undefined
            }
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center min-w-[64px] h-12 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-xl",
                isActive ? "text-cyan-400" : "text-slate-400 hover:text-slate-200"
              )
            }
          >
            {({ isActive }) => {
              if (item.isAction) {
                return (
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-12 h-8 rounded-xl flex items-center justify-center transition-all duration-300 relative group-hover:scale-105 active:scale-95",
                        isActive
                          ? "bg-gradient-to-tr from-cyan-400 to-indigo-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                          : "bg-white/[0.08] hover:bg-white/[0.12] text-white border-white/[0.12]"
                      )}
                    >
                      <Plus size={20} strokeWidth={2.8} className={isActive ? "text-[#07080c]" : "text-cyan-400"} />
                    </div>
                    <span className={cn("text-[10px] font-semibold mt-1 tracking-tight", isActive ? "text-cyan-400" : "text-slate-400")}>
                      {item.label}
                    </span>
                  </div>
                );
              }

              const Icon = item.icon;
              return (
                <div className="flex flex-col items-center relative">
                  <div className="relative">
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={cn(
                        "transition-transform duration-200",
                        isActive && "scale-105 drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]"
                      )}
                    />
                    {item.badge && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-black text-[9px] font-extrabold flex items-center justify-center shadow-md animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium mt-1 tracking-tight transition-colors",
                      isActive ? "text-cyan-400 font-semibold" : "text-slate-400"
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
                  )}
                </div>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
