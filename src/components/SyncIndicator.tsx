import React from 'react';
import { Wifi, WifiOff, Cloud, RefreshCw, Network } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

export function SyncIndicator() {
  const { syncState } = useAppContext();

  const getConfig = () => {
    switch (syncState) {
      case 'GLOBAL_ONLINE':
        return { icon: Cloud, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Global Online' };
      case 'LOCAL_ONLINE':
        return { icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Local Edge Mode' };
      case 'PEER_AVAILABLE':
        return { icon: Network, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Peer Network' };
      case 'SYNCING':
        return { icon: RefreshCw, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Syncing...', spin: true };
      case 'OFFLINE':
      default:
        return { icon: WifiOff, color: 'text-zinc-400', bg: 'bg-zinc-400/10', label: 'Offline (Local)' };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide uppercase transition-all duration-300 border-transparent",
      config.color,
      config.bg,
      "border-current/20"
    )}>
      <Icon size={12} className={cn(config.spin && "animate-spin")} />
      {config.label}
    </div>
  );
}
