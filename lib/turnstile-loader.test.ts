import { describe, expect, test } from 'bun:test';
import {
  TURNSTILE_SRC,
  loadTurnstile,
  resetTurnstileLoader,
  type TurnstileApi,
  type TurnstileHost,
} from './turnstile-loader';

const api = {} as TurnstileApi;

type FakeScript = {
  isConnected: boolean;
  listeners: Partial<Record<'load' | 'error', Array<() => void>>>;
  addEventListener(type: 'load' | 'error', fn: () => void): void;
  remove(): void;
};

/**
 * Fake browser: the page keeps every appended script, findScript returns one while it is still
 * connected, and remove() disconnects it. A script that already fired never fires again.
 */
function fakeHost(initialApi?: TurnstileApi) {
  resetTurnstileLoader();
  let current = initialApi;
  const page: FakeScript[] = [];
  const state = { created: 0, appended: 0 };
  const host: TurnstileHost = {
    getApi: () => current,
    findScript: () => page.find((s) => s.isConnected) ?? null,
    createScript: () => {
      state.created++;
      const script: FakeScript = {
        isConnected: false,
        listeners: {},
        addEventListener(type, fn) {
          (script.listeners[type] ??= []).push(fn);
        },
        remove() {
          script.isConnected = false;
        },
      };
      return script;
    },
    appendScript: (script) => {
      state.appended++;
      (script as FakeScript).isConnected = true;
      page.push(script as FakeScript);
    },
  };
  return {
    host,
    state,
    page,
    /** Fires the event on the newest script in the page, like the browser does once. */
    fire(type: 'load' | 'error', loaded?: TurnstileApi) {
      current = loaded ?? current;
      const script = page[page.length - 1];
      script.listeners[type]?.forEach((fn) => fn());
    },
  };
}

/** Rejects instead of hanging forever, so a stuck promise counts as a failure. */
function within<T>(promise: Promise<T>, ms = 200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out waiting for Turnstile')), ms)
    ),
  ]);
}

describe('loadTurnstile', () => {
  test('resolves immediately when the script was loaded by a previous page', async () => {
    const { host, state } = fakeHost(api);
    expect(await loadTurnstile(host)).toBe(api);
    expect(state.created).toBe(0);
    expect(state.appended).toBe(0);
  });

  test('loads the script once and shares it between concurrent mounts', async () => {
    const { host, state, fire } = fakeHost();
    const first = loadTurnstile(host);
    const second = loadTurnstile(host);
    fire('load', api);
    expect(await first).toBe(api);
    expect(await second).toBe(api);
    expect(state.created).toBe(1);
    expect(state.appended).toBe(1);
    expect(TURNSTILE_SRC).toContain('render=explicit');
  });

  test('reuses a script tag that is already in the page still loading', async () => {
    const { host, state, page, fire } = fakeHost();
    const first = loadTurnstile(host);
    // Simulate another mount that lost the stored promise but finds the live tag.
    resetTurnstileLoader();
    const second = loadTurnstile(host);
    expect(state.created).toBe(1);
    expect(page.length).toBe(1);
    fire('load', api);
    expect(await second).toBe(api);
    void first;
  });

  test('rejects on error, removes the failed tag and retries with the same page', async () => {
    const { host, state, page, fire } = fakeHost();
    const promise = loadTurnstile(host);
    fire('error');
    await expect(promise).rejects.toThrow();
    expect(page.some((s) => s.isConnected)).toBe(false);

    const again = loadTurnstile(host);
    expect(state.created).toBe(2);
    fire('load', api);
    expect(await within(again)).toBe(api);
  });

  test('rejects on load without the API, removes the tag and retries with the same page', async () => {
    const { host, state, page, fire } = fakeHost();
    const promise = loadTurnstile(host);
    fire('load');
    await expect(promise).rejects.toThrow();
    expect(page.some((s) => s.isConnected)).toBe(false);

    const again = loadTurnstile(host);
    expect(state.created).toBe(2);
    fire('load', api);
    expect(await within(again)).toBe(api);
  });
});
