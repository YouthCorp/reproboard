/** Restore after React has removed/reparented modal and card nodes. */
export function restoreDialogFocus(previous: HTMLElement | null, fallback: () => HTMLElement | null) {
  requestAnimationFrame(() => {
    const usable = (element: HTMLElement | null): element is HTMLElement => !!element && element !== document.body && element.isConnected && !element.matches(":disabled") && element.getClientRects().length > 0;
    const target = usable(previous) ? previous : fallback();
    if (!usable(target)) return;
    const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    const top = dialogs.item(dialogs.length - 1);
    if (!top || top.contains(target)) target.focus();
  });
}
import type { KeyboardEvent } from "react";

export function containDialogTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, summary, [tabindex]")).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
  const first = controls[0]; const last = controls.at(-1);
  if (first && last && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
    event.preventDefault(); event.stopPropagation(); (event.shiftKey ? last : first).focus();
  }
}
