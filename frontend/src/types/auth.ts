export interface ClinicInfo {
  id: number;
  name: string;
}

export interface UserInfo {
  id: number;
  full_name: string;
  email: string;
  organization_id: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
  accessible_clinics: ClinicInfo[];
  active_clinic_id: number | null;
}
