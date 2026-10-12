type Release = () => void;

let queue: Promise<void> = Promise.resolve();

export function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let release!: Release;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = queue;
  queue = queue.then(() => next);
  return previous.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}
