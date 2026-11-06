import { describe, expect, test } from 'bun:test';
import {
  TURNSTILE_SRC,
  loadTurnstile,
  resetTurnstileLoader,
  type TurnstileApi,
  type TurnstileHost,
} from './turnstile-loader';

const api = {} as TurnstileApi;

function fakeHost(initialApi?: TurnstileApi, reset = true) {
  if (reset) resetTurnstileLoader();
  let current = initialApi;
  const listeners: Record<string, () => void> = {};
  const state = { created: 0, appended: 0, existing: false };
  const script = {
    isConnected: false,
    addEventListener(type: 'load' | 'error', fn: () => void) {
      listeners[type] = fn;
    },
  };
  const host: TurnstileHost = {
    getApi: () => current,
    findScript: () => (state.existing ? script : null),
    createScript: () => {
      state.created++;
      return script;
    },
    appendScript: () => {
      state.appended++;
      script.isConnected = true;
    },
  };
  return {
    host,
    state,
    fire(type: 'load' | 'error', loaded?: TurnstileApi) {
      current = loaded ?? current;
      listeners[type]();
    },
  };
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

  test('reuses a script tag that is already in the page without adding another', async () => {
    const { host, state, fire } = fakeHost();
    state.existing = true;
    state.created = 0;
    const promise = loadTurnstile(host);
    fire('load', api);
    await promise;
    expect(state.created).toBe(0);
  });

  test('rejects on error and allows a later retry', async () => {
    const failing = fakeHost();
    const promise = loadTurnstile(failing.host);
    failing.fire('error');
    await expect(promise).rejects.toThrow();

    const retry = fakeHost(undefined, false);
    const again = loadTurnstile(retry.host);
    retry.fire('load', api);
    expect(await again).toBe(api);
  });
});
