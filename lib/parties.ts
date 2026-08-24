import type { CustomerType, VendorType } from "@prisma/client";

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  PRIVATE: "Private",
  GOVERNMENT: "Government",
};

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  SUPPLIER: "Supplier",
  GOVERNMENT_AGENCY: "Government agency",
};

export type PartyEntityType = "customer" | "vendor" | "employee" | "contact";

export const PARTY_LABELS: Record<
  PartyEntityType,
  { singular: string; plural: string; apiBase: string; responseKey: string }
> = {
  customer: { singular: "Customer", plural: "Customers", apiBase: "/api/customers", responseKey: "customers" },
  vendor: { singular: "Vendor", plural: "Vendors", apiBase: "/api/vendors", responseKey: "vendors" },
  employee: { singular: "Employee", plural: "Employees", apiBase: "/api/employees", responseKey: "employees" },
  contact: { singular: "Contact", plural: "Contacts", apiBase: "/api/contacts", responseKey: "contacts" },
};
