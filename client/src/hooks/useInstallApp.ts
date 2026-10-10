import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useInstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    return (window as any).deferredInstallPrompt || null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as an app)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const checkGlobalPrompt = () => {
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
      }
    };

    checkGlobalPrompt();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredInstallPrompt = null;
      toast.success('POS App added to your home screen!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pos:installprompt-ready', checkGlobalPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pos:installprompt-ready', checkGlobalPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (onShowFallback?: () => void) => {
    const promptEvent = deferredPrompt || (window as any).deferredInstallPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          (window as any).deferredInstallPrompt = null;
          toast.success('POS App added to your home screen!');
        }
      } catch (err) {
        console.error('Install prompt error:', err);
        if (onShowFallback) onShowFallback();
      }
    } else {
      if (onShowFallback) {
        onShowFallback();
      } else {
        toast('To install, tap your browser menu (⋮) and select "Install App" or "Add to Home Screen".', {
          icon: '📱',
          duration: 5000,
        });
      }
    }
  };

  return {
    isInstalled,
    isIOS,
    hasNativePrompt: !!(deferredPrompt || (window as any).deferredInstallPrompt),
    promptInstall,
  };
}
