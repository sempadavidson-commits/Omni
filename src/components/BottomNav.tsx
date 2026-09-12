import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Plus, MessageCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { currentUser, requireAuth } = useAppContext();
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

  const navItems = [
    { icon: Home, path: '/', label: 'Home' },
    { icon: Search, path: '/search', label: 'Discover' },
    { icon: Plus, path: '/create', label: 'Create', center: true, authDesc: 'Sign in to create a post.' },
    { icon: MessageCircle, path: '/inbox', label: 'Inbox', authDesc: 'Sign in to view messages and notifications.' },
    { icon: User, path: '/profile', label: 'Profile' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black border-t border-zinc-900 pb-safe z-40">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={(e) => item.authDesc ? handleAuthProtectedClick(e, item.path, item.label, item.authDesc) : undefined}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center w-14 h-12 transition-colors",
              isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {({ isActive }) => (
              <>
                {item.center ? (
                  <div className="w-11 h-8 rounded-[12px] bg-white flex items-center justify-center text-black active:scale-95 transition-transform mb-1">
                    <item.icon size={20} strokeWidth={3} />
                  </div>
                ) : (
                  <item.icon 
                    size={24} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={cn("mb-1", isActive && "drop-shadow-md")}
                  />
                )}
                <span className={cn("text-[10px] font-medium tracking-wide", isActive ? "text-white font-semibold" : "text-zinc-500")}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
