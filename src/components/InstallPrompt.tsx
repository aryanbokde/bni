"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

const DISMISS_KEY = "pwa-install-dismissed";
const INSTALLED_KEY = "pwa-installed";
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Only show on mobile
    if (window.innerWidth > 768) return;

    try {
      // Already installed
      if (localStorage.getItem(INSTALLED_KEY)) return;

      // Dismissed recently
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const dismissedAt = new Date(dismissed).getTime();
        const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (daysSince < DISMISS_DAYS) return;
      }
    } catch {
      // localStorage not available (private browsing, etc.)
      return;
    }

    // iOS detection
    const ua = navigator.userAgent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStandalone = (window.navigator as any).standalone === true;

    if (isiOS && !isStandalone) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Android/Chrome: listen for beforeinstallprompt
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setShow(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function handleInstall() {
    if (!deferredPromptRef.current) return;

    deferredPromptRef.current.prompt();
    const result = await deferredPromptRef.current.userChoice;

    if (result.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "true");
    }

    deferredPromptRef.current = null;
    setShow(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <Image src="/icons/icon-192.png" alt="BNI" width={48} height={48} className="w-12 h-12 rounded-xl" />
          <div className="flex-1">
            <h3 className="font-bold text-navy text-sm">Install BNI Connect</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isIOS
                ? "Tap the Share button then 'Add to Home Screen' to install"
                : "Add to home screen for quick access to member directory and matrix"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="btn-primary flex-1 text-sm py-2"
            >
              Install App
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="flex-1 text-sm py-2 px-4 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
          >
            {isIOS ? "Got it" : "Not Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Type for the BeforeInstallPrompt event (not in standard TS lib)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
