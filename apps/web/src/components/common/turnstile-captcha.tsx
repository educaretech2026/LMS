"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          cData?: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (code?: string) => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

interface TurnstileCaptchaProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  action?: string;
  className?: string;
}

export function TurnstileCaptcha({
  siteKey: siteKeyProp,
  onVerify,
  onExpire,
  action = "admission_enquiry",
  className = "",
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Cloudflare test sitekey (always passes) if NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured
  const siteKey =
    siteKeyProp ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    "1x00000000000000000000AA";

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "light",
          callback: (token: string) => {
            if (isMounted) {
              onVerify(token);
              setHasError(false);
            }
          },
          "expired-callback": () => {
            if (isMounted) {
              onVerify("");
              if (onExpire) onExpire();
            }
          },
          "error-callback": () => {
            if (isMounted) {
              console.warn("[Turnstile] Widget verification error callback triggered.");
              setHasError(true);
            }
          },
        });
        widgetIdRef.current = id;
        setIsLoaded(true);
      } catch (err) {
        console.error("[Turnstile] Render error:", err);
        setHasError(true);
      }
    };

    // If script already exists and window.turnstile is available
    if (window.turnstile) {
      renderWidget();
      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    }

    // Otherwise load script dynamically
    const scriptId = "cf-turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkInterval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkInterval);
        renderWidget();
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!widgetIdRef.current && isMounted) {
        setIsLoaded(true); // Don't block forever
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(checkInterval);
      clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action]);

  return (
    <div className={`flex flex-col items-center justify-center p-3.5 rounded-2xl bg-surface border border-border-soft ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-2">
        <ShieldCheck className="w-4 h-4 text-brand-blue" />
        <span>Bot Protection & Security Verification</span>
      </div>

      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center">
        {!isLoaded && !hasError && (
          <div className="flex items-center gap-2 text-xs text-text-muted py-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
            <span>Loading verification...</span>
          </div>
        )}
      </div>

      {hasError && (
        <p className="text-[11px] text-rose-500 mt-1">
          Security widget could not load. If ad-blockers are active, please disable them for this page.
        </p>
      )}
    </div>
  );
}
