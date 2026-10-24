export type Role = "super_admin" | "trainer" | "staff" | "client";

export interface Profile {
  id: string;
  organization_id: string | null;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  locale: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
