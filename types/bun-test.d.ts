declare module 'bun:test' {
  type MutableTuple<T extends readonly unknown[]> = [...T];

  interface TestFunction {
    (name: string, callback: (...args: unknown[]) => void | Promise<void>): void;
    each<T extends readonly unknown[]>(cases: readonly T[]): (
      name: string,
      callback: (...args: MutableTuple<T>) => void | Promise<void>,
    ) => void;
  }

  interface Matchers {
    toBe(expected: unknown): void;
    toBeNull(): void;
    toEqual(expected: unknown): void;
    toHaveLength(expected: number): void;
    toContain(expected: unknown): void;
    toThrow(expected?: string | RegExp): void;
    toMatchObject(expected: Record<string, unknown>): void;
    readonly not: Matchers;
    readonly rejects: Matchers;
  }

  export const describe: (name: string, callback: () => void) => void;
  export const test: TestFunction;
  export const expect: (actual: unknown) => Matchers;
}
