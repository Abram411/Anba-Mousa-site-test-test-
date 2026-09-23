import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg whitespace-nowrap">
      <WifiOff size={16} />
      Offline — Using cached data
    </div>
  );
};
