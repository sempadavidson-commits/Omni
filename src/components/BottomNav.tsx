import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, PlusSquare, Bell, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { currentUser, requireAuth } = useAppContext();
  const navigate = useNavigate();

  const handleAuthProtectedClick = (e: React.MouseEvent, path: string, name: string, actionDesc: string) => {
    if (!currentUser && (path === '/messages' || path === '/create' || path === '/notifications')) {
      e.preventDefault();
      requireAuth(name, actionDesc, () => {
        navigate(path);
      });
    }
  };

  const navItems = [
    { icon: Home, path: '/', label: 'Home' },
    { icon: MessageCircle, path: '/messages', label: 'Messages', authDesc: 'Create an account to send messages.' },
    { icon: PlusSquare, path: '/create', label: 'Create', authDesc: 'Sign in to create a post.', center: true },
    { icon: Bell, path: '/notifications', label: 'Notifications', authDesc: 'Sign in to view your notifications.' },
    { icon: User, path: '/profile', label: 'Profile' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-zinc-900 pb-safe pb-4 pt-2 px-6 z-40">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={(e) => item.authDesc ? handleAuthProtectedClick(e, item.path, item.label, item.authDesc) : undefined}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center transition-all duration-200 relative",
              item.center ? "-mt-6" : "w-12 h-12",
              isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {({ isActive }) => (
              <>
                {item.center ? (
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center text-black shadow-lg transition-transform active:scale-95",
                    isActive ? "bg-white" : "bg-zinc-200"
                  )}>
                    <item.icon size={26} strokeWidth={2.5} />
                  </div>
                ) : (
                  <>
                    <item.icon 
                      size={24} 
                      strokeWidth={isActive ? 2.5 : 2} 
                      className={cn("transition-transform duration-200", isActive && "scale-110")}
                    />
                    {isActive && (
                      <span className="absolute -bottom-3 w-1 h-1 rounded-full bg-white" />
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
