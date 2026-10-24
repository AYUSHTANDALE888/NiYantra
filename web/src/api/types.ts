export type Role = 'COLLEGE' | 'OFFICER' | 'SENIOR' | 'SUPER_SENIOR' | 'HOD' | 'BUREAU' | 'COMMITTEE' | 'AUTHORITY' | 'ADMIN';

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  regionId: string | null;
  regionCode: string | null;
  regionName: string | null;
  institutionId: string | null;
  institutionName: string | null;
  skills: string[];
}

export interface DemoUser {
  name: string;
  email: string;
  role: Role;
  title: string | null;
  region: string | null;
  institution: string | null;
}

export interface ClockInfo {
  now: string;
  today: string;
  offsetDays: number;
  simulated: boolean;
}

export interface NotificationItem {
  id: string;
  kind: string;
  message: string;
  read: boolean;
  createdAt: string;
  applicationId: string | null;
  applicationNo: string | null;
}
