// Per-key async mutex: makes "check for a live quote, then create one" atomic
// within this server process (double-clicks, two tabs).
const g = globalThis as unknown as { __locks?: Map<string, Promise<unknown>> };

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const locks = (g.__locks ??= new Map());
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}
