export type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    }
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

export const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type ScriptLike = {
  isConnected: boolean;
  remove(): void;
  addEventListener(type: 'load' | 'error', listener: () => void): void;
};

export interface TurnstileHost {
  getApi(): TurnstileApi | undefined;
  findScript(src: string): ScriptLike | null;
  createScript(src: string): ScriptLike;
  appendScript(script: ScriptLike): void;
}

let pending: Promise<TurnstileApi> | null = null;

/**
 * Resolves with the Turnstile API, loading the script at most once. It is safe to call on every
 * mount: when the script was already loaded by a previous page (client navigation) it resolves
 * right away instead of waiting for a load event that will not happen again.
 */
export function loadTurnstile(host: TurnstileHost): Promise<TurnstileApi> {
  const ready = host.getApi();
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;

  const attempt = new Promise<TurnstileApi>((resolve, reject) => {
    const fail = () => {
      // A tag that already failed never fires again: leave it in the page and the next attempt
      // would find it and wait forever. Remove it so the retry creates a fresh one.
      script.remove();
      if (pending === attempt) pending = null;
      reject(new Error('Could not load Turnstile'));
    };
    const script =
      host.findScript(TURNSTILE_SRC) ?? host.createScript(TURNSTILE_SRC);
    script.addEventListener('load', () => {
      const api = host.getApi();
      if (api) resolve(api);
      else fail();
    });
    script.addEventListener('error', fail);
    if (!script.isConnected) host.appendScript(script);
  });
  pending = attempt;
  return attempt;
}

/** Test helper: forgets a stored attempt. */
export function resetTurnstileLoader(): void {
  pending = null;
}
