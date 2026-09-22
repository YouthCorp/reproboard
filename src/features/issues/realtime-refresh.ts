export type RealtimeState = "connecting" | "syncing" | "subscribed" | "error";

// Events are hints, never rows. A dirty bit queues a trailing read during a read.
export function createRealtimeRefresh(refresh: () => Promise<void>, report: (state: RealtimeState) => void) {
  let stopped = false, connected = false, dirty = false, running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    if (stopped || !connected || running || timer) return;
    timer = setTimeout(() => { timer = undefined; void drain(); }, 50);
  }
  async function drain() {
    if (stopped || !connected) return;
    running = true;
    while (dirty && connected && !stopped) {
      dirty = false;
      report("syncing");
      try { await refresh(); }
      catch {
        if (!stopped) report("error");
        running = false;
        // A new event may retry a read, never a write. No busy error retry loop.
        if (dirty) schedule();
        return;
      }
    }
    running = false;
    if (!stopped && connected) report("subscribed");
  }
  return {
    subscribed() { if (stopped) return; connected = true; dirty = true; report("syncing"); schedule(); },
    changed() { if (stopped) return; dirty = true; schedule(); },
    failed() { if (stopped) return; connected = false; report("error"); },
    stop() { stopped = true; clearTimeout(timer); },
  };
}
