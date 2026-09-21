import { createStore } from "zustand/vanilla";
import type { BoardCommand, Issue } from "./commands";

export type PendingCommand = { command: BoardCommand; phase: "pending" | "uncertain" };
type CommandState = {
  requests: Record<string, PendingCommand>;
  messages: Record<string, string>;
  begin: (command: BoardCommand) => boolean;
  uncertain: (command: BoardCommand) => void;
  finish: (command: BoardCommand, message: string) => void;
};
export const commandKey = (command: Pick<BoardCommand, "workspaceId" | "issueId" | "requestId">) => `${command.workspaceId}/${command.issueId ?? `new:${command.requestId}`}`;
export const issueCommandKey = (workspaceId: string, issueId: string) => `${workspaceId}/${issueId}`;

export function createCommandStore() {
  return createStore<CommandState>((set, get) => ({
    requests: {}, messages: {},
    begin(command) {
      const key = commandKey(command), old = get().requests[key];
      if (old && (old.phase === "pending" || JSON.stringify(old.command) !== JSON.stringify(command))) return false;
      set((state) => ({ requests: { ...state.requests, [key]: { command: structuredClone(command), phase: "pending" } }, messages: { ...state.messages, [key]: "" } }));
      return true;
    },
    uncertain(command) {
      const key = commandKey(command);
      if (get().requests[key]?.command.requestId !== command.requestId) return;
      set((state) => ({ requests: { ...state.requests, [key]: { command, phase: "uncertain" } } }));
    },
    finish(command, message) {
      const key = commandKey(command);
      if (get().requests[key]?.command.requestId !== command.requestId) return;
      set((state) => {
        const requests = { ...state.requests }; delete requests[key];
        return { requests, messages: { ...state.messages, [key]: message } };
      });
    },
  }));
}

// Overlay changes only presentation. A newer server row wins even while receipt confirmation is pending.
export function displayedStatus(issue: Issue, pending?: PendingCommand) {
  const command = pending?.command;
  return command?.operation === "transition" && issue.version <= command.expectedVersion
    ? command.payload.target_status : issue.status;
}
