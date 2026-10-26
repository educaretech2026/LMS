"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ShieldCheck, Loader2, RotateCw, AlertTriangle } from "lucide-react";

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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  // Cloudflare test sitekey (always passes) if NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured
  const siteKey =
    siteKeyProp ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    "1x00000000000000000000AA";

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    try {
      // Clean up previous widget if exists
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      // Ensure container is empty before rendering
      containerRef.current.innerHTML = "";

      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: "light",
        callback: (token: string) => {
          setIsLoaded(true);
          setHasError(false);
          setErrorMessage("");
          onVerify(token);
        },
        "expired-callback": () => {
          onVerify("");
          if (onExpire) onExpire();
        },
        "error-callback": (errorCode?: string) => {
          console.warn("[Turnstile] Widget error callback:", errorCode);
          setHasError(true);
          setIsLoaded(true);
          setErrorMessage(
            errorCode === "110200" || errorCode === "110600"
              ? "Security challenge domain mismatch. Please verify domain settings."
              : "Security verification could not be loaded. Please click Retry or disable ad-blockers."
          );
        },
      });

      widgetIdRef.current = id;
      setIsLoaded(true);
      setHasError(false);
    } catch (err: any) {
      console.error("[Turnstile] Render exception:", err);
      setHasError(true);
      setIsLoaded(true);
      setErrorMessage("Failed to initialize security verification widget.");
    }
  }, [siteKey, action, onVerify, onExpire]);

  useEffect(() => {
    let isMounted = true;

    // Register global callback for explicit onload
    window.onloadTurnstileCallback = () => {
      if (isMounted) {
        renderWidget();
      }
    };

    // If Turnstile is already available on window, render immediately
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

    // Load Turnstile script dynamically if not present
    const scriptId = "cf-turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit";
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        if (isMounted) {
          console.error("[Turnstile] Failed to load external script from challenges.cloudflare.com");
          setHasError(true);
          setIsLoaded(true);
          setErrorMessage("Security script was blocked. Please disable ad-blockers on this page.");
        }
      };
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", () => {
        if (isMounted) renderWidget();
      }, { once: true });
    }

    // Polling fallback in case onload fired before listener attached
    const interval = setInterval(() => {
      if (window.turnstile && isMounted) {
        clearInterval(interval);
        renderWidget();
      }
    }, 150);

    // Timeout: if neither loads nor renders after 8s, show retry UI instead of dead screen
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!widgetIdRef.current && isMounted) {
        setHasError(true);
        setIsLoaded(true);
        setErrorMessage("Verification widget took too long to load. Please click Retry.");
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, retryCount]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoaded(false);
    setErrorMessage("");
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-surface border border-border-soft transition-all shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-3">
        <ShieldCheck className="w-4 h-4 text-brand-blue" />
        <span>Bot Protection & Security Verification</span>
      </div>

      <div className="relative min-h-[65px] w-full flex items-center justify-center">
        {/* Loading Indicator */}
        {!isLoaded && !hasError && (
          <div className="flex items-center gap-2 text-xs text-text-muted py-3 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
            <span>Loading security challenge...</span>
          </div>
        )}

        {/* Dedicated Isolated DOM container for Cloudflare iframe */}
        <div
          ref={containerRef}
          className={`flex justify-center transition-opacity duration-200 ${
            !isLoaded || hasError ? "hidden" : "block"
          }`}
        />

        {/* Error and Retry State */}
        {hasError && (
          <div className="flex flex-col items-center gap-2 text-center p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-700 max-w-sm">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage || "Security widget could not load."}</span>
            </div>
            <p className="text-[11px] text-rose-600/90 leading-relaxed">
              If you are using an ad-blocker or privacy extension, please pause it for this website.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Retry Verification
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
