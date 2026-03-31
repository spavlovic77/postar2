export type AppRole = "super_admin" | "company_admin" | "operator" | "processor";
export type CompanyRole = "company_admin" | "operator" | "processor";

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_super_admin: boolean;
  pfs_activation_link: string | null;
  onboarded_at: string | null;
  created_at: string;
}

export type CompanyStatus = "active" | "deactivated";
export type IonApStatus = "pending" | "active" | "error";

export interface Company {
  id: string;
  dic: string;
  legal_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  pfs_created_at: string;
  status: CompanyStatus;
  deactivated_at: string | null;
  ion_ap_org_id: number | null;
  ion_ap_identifier_id: number | null;
  ion_ap_status: IonApStatus;
  ion_ap_error: string | null;
  ion_ap_activated_at: string | null;
  price_per_document: number | null;
  created_at: string;
}

export interface CompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  role: CompanyRole;
  is_genesis: boolean;
  status: "active" | "inactive";
  invited_by: string | null;
  created_at: string;
  company?: Company;
}

export interface Invitation {
  id: string;
  email: string;
  roles: ("super_admin" | "company_admin" | "operator" | "processor")[];
  company_ids: string[];
  is_genesis: boolean;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface PfsVerification {
  id: string;
  verification_token: string;
  dic: string;
  legal_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  pfs_created_at: string;
  created_at: string;
}

export type DocumentDirection = "received" | "sent";
export type DocumentStatus = "pending" | "processing" | "new" | "read" | "assigned" | "processed" | "failed";

export interface Document {
  id: string;
  company_id: string;
  department_id: string | null;
  assigned_to_company_id: string | null;
  direction: DocumentDirection;
  status: DocumentStatus;
  ion_ap_transaction_id: number;
  transaction_uuid: string | null;
  document_type: string | null;
  document_id: string | null;
  sender_identifier: string | null;
  receiver_identifier: string | null;
  blob_url: string | null;
  metadata: DocumentMetadata | null;
  billed_at: string | null;
  wallet_transaction_id: string | null;
  retry_count: number;
  last_error: string | null;
  last_retry_at: string | null;
  peppol_created_at: string | null;
  created_at: string;
}

export interface DocumentLineDetail {
  name: string;
  amount?: string;
}

export interface DocumentMetadata {
  supplierName?: string;
  supplierTaxId?: string;
  buyerName?: string;
  buyerTaxId?: string;
  currency?: string;
  totalAmount?: string;
  taxAmount?: string;
  lineItems?: string[];
  lineDetails?: DocumentLineDetail[];
  issueDate?: string;
  dueDate?: string;
}

export interface Department {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface DepartmentMembership {
  id: string;
  user_id: string;
  department_id: string;
  created_at: string;
  department?: Department;
}

// ============================================================
// Billing
// ============================================================

export type WalletTransactionType = "charge" | "top_up" | "refund" | "adjustment";
export type PaymentLinkStatus = "pending" | "completed" | "expired";

export interface Wallet {
  id: string;
  owner_id: string;
  available_balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  company_id: string | null;
  document_id: string | null;
  type: WalletTransactionType;
  amount: number;
  balance_after: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface PaymentLink {
  id: string;
  wallet_id: string;
  external_transaction_id: string;
  amount: number;
  status: PaymentLinkStatus;
  payme_url: string | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  roles: AppRole[];
}

// ============================================================
// Role display constants
// ============================================================

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  operator: "Operator",
  processor: "Processor",
};

export const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  company_admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  operator: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  processor: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};
