import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-1.5 text-sm font-bold text-white transition-colors"
      >
        <Download size={16} />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-1.5 text-sm font-bold text-white transition-colors"
        >
           <Download size={16} />
           <span className="hidden sm:inline">Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="ltr">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-gray-800">
              <h3 className="text-lg font-bold text-[var(--color-church-blue)]">Install on iPhone / iPad</h3>
              <p className="mt-4 text-sm text-gray-600 space-y-2">
                <div>1. Tap the <strong>Share</strong> button in Safari toolbar.</div>
                <div>2. Scroll down and tap <strong>Add to Home Screen</strong>.</div>
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-800 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
