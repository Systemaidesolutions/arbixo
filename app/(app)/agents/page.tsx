import { redirect } from "next/navigation";

// The four party types now each have their own page (see [entity]/page.tsx);
// the old combined tabbed screen redirects to the first one.
export default function AgentsPage() {
  redirect("/agents/customers");
}
