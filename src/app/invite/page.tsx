import type { Metadata } from "next";
import { QueryProvider } from "@/lib/query/query-provider";
import { InviteAccept } from "@/features/workspaces/invite-accept";

export const metadata: Metadata = { title: "팀 초대 수락", referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default function InvitePage() {
  return <QueryProvider><InviteAccept /></QueryProvider>;
}
