'use client';

import * as React from 'react';

import { loadTurnstile, type TurnstileApi, type TurnstileHost } from '@/lib/turnstile-loader';

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const browserHost: TurnstileHost = {
  getApi: () => window.turnstile,
  findScript: (src) =>
    document.querySelector<HTMLScriptElement>(`script[src="${src}"]`),
  createScript: (src) =>
    Object.assign(document.createElement('script'), { src, async: true }),
  appendScript: (script) => document.head.appendChild(script as HTMLScriptElement),
};

interface TurnstileWidgetProps {
  siteKey?: string;
  action: string;
  onToken: (token: string | null) => void;
  resetKey: number;
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  resetKey,
}: TurnstileWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const onTokenRef = React.useRef(onToken);

  React.useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const reset = React.useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    onTokenRef.current(null);
  }, []);

  const lastResetKeyRef = React.useRef(resetKey);

  React.useEffect(() => {
    if (lastResetKeyRef.current !== resetKey) {
      lastResetKeyRef.current = resetKey;
      reset();
    }
  }, [reset, resetKey]);

  React.useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let widgetId: string | null = null;

    // Runs on every mount: the script may already be loaded from a previous page
    // (client navigation), so we cannot wait for a load event that will not repeat.
    loadTurnstile(browserHost)
      .then((turnstile) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          action,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
        widgetIdRef.current = widgetId;
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = null;
      onTokenRef.current(null);
    };
  }, [action, siteKey]);

  if (!siteKey) return null;

  return <div ref={containerRef} />;
}
