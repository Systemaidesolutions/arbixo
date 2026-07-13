import type { UserRole, SubscriberSubtype } from "@prisma/client";

export type Capability = {
  canPost: boolean; // encode & post transactions
  canCancel: boolean; // void/cancel a posted document (a form of "edit")
  canApprove: boolean; // approve another user's pending document
  canGenerateReports: boolean; // BIR / financial reports
  isReadOnly: boolean; // view only — no posting/editing
};

/**
 * The single source of truth for what a subscriber can do, derived from
 * their role + subtype. Admins manage the platform, not a company's books,
 * so they get no posting/approval powers here.
 */
export function capabilitiesFor(
  role: UserRole,
  subtype: SubscriberSubtype | null
): Capability {
  if (role === "ADMIN") {
    return {
      canPost: false,
      canCancel: false,
      canApprove: false,
      canGenerateReports: true,
      isReadOnly: true,
    };
  }

  switch (subtype) {
    case "MANAGER":
      return {
        canPost: true,
        canCancel: true,
        canApprove: true,
        canGenerateReports: true,
        isReadOnly: false,
      };
    case "USER":
      return {
        canPost: true,
        canCancel: true,
        canApprove: false,
        canGenerateReports: true,
        isReadOnly: false,
      };
    case "REPORT_CREATOR":
      return {
        canPost: false,
        canCancel: false,
        canApprove: false,
        canGenerateReports: true,
        isReadOnly: true,
      };
    default:
      // A subscriber with no subtype set — treat as read-only until an
      // admin assigns one.
      return {
        canPost: false,
        canCancel: false,
        canApprove: false,
        canGenerateReports: true,
        isReadOnly: true,
      };
  }
}

export const SUBTYPE_LABELS: Record<SubscriberSubtype, string> = {
  MANAGER: "Manager",
  USER: "User",
  REPORT_CREATOR: "Report Creator",
};

export const SUBTYPE_DESCRIPTIONS: Record<SubscriberSubtype, string> = {
  MANAGER: "Encode, post, edit/void and approve transactions; generate BIR reports.",
  USER: "Encode, post and cancel transactions; generate BIR reports.",
  REPORT_CREATOR: "View transactions and generate BIR reports (read-only).",
};
