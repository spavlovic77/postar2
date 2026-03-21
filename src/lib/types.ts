export type AppRole = "super_admin" | "company_admin" | "accountant";

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_super_admin: boolean;
  onboarded_at: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  dic: string;
  legal_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  pfs_created_at: string;
  created_at: string;
}

export interface CompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  role: "company_admin" | "accountant";
  is_genesis: boolean;
  status: "active" | "inactive";
  invited_by: string | null;
  created_at: string;
  company?: Company;
}

export interface Invitation {
  id: string;
  email: string;
  role: "super_admin" | "company_admin" | "accountant";
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
