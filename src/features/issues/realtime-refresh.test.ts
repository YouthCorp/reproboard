import { afterEach, expect, it, vi } from "vitest";
import { createRealtimeRefresh } from "./realtime-refresh";

afterEach(() => vi.useRealTimers());
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }

it("waits for subscription then reads, coalescing duplicate notifications", async () => {
  vi.useFakeTimers(); const read = vi.fn(async () => {}), report = vi.fn();
  const sync = createRealtimeRefresh(read, report);
  sync.changed(); sync.changed(); await vi.advanceTimersByTimeAsync(100);
  expect(read).not.toHaveBeenCalled();
  sync.subscribed(); sync.changed(); sync.changed(); await vi.advanceTimersByTimeAsync(50);
  expect(read).toHaveBeenCalledTimes(1); expect(report).toHaveBeenLastCalledWith("subscribed"); sync.stop();
});
it("does a trailing read for an event during the subscription snapshot", async () => {
  vi.useFakeTimers(); const gate = deferred(); const read = vi.fn().mockImplementationOnce(() => gate.promise).mockResolvedValue(undefined);
  const report = vi.fn(), sync = createRealtimeRefresh(read, report);
  sync.subscribed(); await vi.advanceTimersByTimeAsync(50);
  sync.changed(); sync.changed(); expect(read).toHaveBeenCalledTimes(1);
  expect(report).not.toHaveBeenCalledWith("subscribed");
  gate.resolve(); await vi.advanceTimersByTimeAsync(0);
  expect(read).toHaveBeenCalledTimes(2); expect(report).toHaveBeenLastCalledWith("subscribed"); sync.stop();
});
it("does not report caught up when the connection failed during a read", async () => {
  vi.useFakeTimers(); const gate = deferred(), report = vi.fn();
  const sync = createRealtimeRefresh(() => gate.promise, report);
  sync.subscribed(); await vi.advanceTimersByTimeAsync(50); sync.failed(); gate.resolve(); await vi.advanceTimersByTimeAsync(0);
  expect(report).toHaveBeenLastCalledWith("error"); sync.stop();
});
it("stops pending timers, trailing reads and late state reports on cleanup", async () => {
  vi.useFakeTimers(); const gate = deferred(), report = vi.fn(), read = vi.fn(() => gate.promise);
  const sync = createRealtimeRefresh(read, report);
  sync.subscribed(); await vi.advanceTimersByTimeAsync(50); sync.changed(); sync.stop(); report.mockClear(); gate.resolve();
  await vi.advanceTimersByTimeAsync(100); sync.subscribed(); sync.changed();
  expect(read).toHaveBeenCalledTimes(1); expect(report).not.toHaveBeenCalled();
  const next = createRealtimeRefresh(read, report); next.subscribed(); next.stop(); await vi.advanceTimersByTimeAsync(100);
  expect(read).toHaveBeenCalledTimes(1);
});
it("read errors are visible without an automatic retry loop; a later event can refresh", async () => {
  vi.useFakeTimers(); const read = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined), report = vi.fn();
  const sync = createRealtimeRefresh(read, report);
  sync.subscribed(); await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(1); expect(report).toHaveBeenLastCalledWith("error");
  sync.changed(); await vi.advanceTimersByTimeAsync(50);
  expect(read).toHaveBeenCalledTimes(2); expect(report).toHaveBeenLastCalledWith("subscribed"); sync.stop();
});
