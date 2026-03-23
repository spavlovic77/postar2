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
  created_at: string;
}

export interface CompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  roles: CompanyRole[];
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
  retry_count: number;
  last_error: string | null;
  last_retry_at: string | null;
  peppol_created_at: string | null;
  created_at: string;
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

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  roles: AppRole[];
}
