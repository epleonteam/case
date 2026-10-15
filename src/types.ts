export type Status = 'Pending' | 'Approved' | 'Rejected' | 'Contact' | 'Contact Fail' | 'Hold';
export type CaseType = 'Withdrawal' | 'Deposit';
export type WithdrawalSpeed = 'Normal' | 'Fast';
export type PaymentMethod = string;

export interface StatusLog {
  id: string;
  message: string;
  timestamp: string;
  previous_status?: Status | string | null;
  new_status?: Status;
  changed_by?: string;
  note?: string;
}

export interface CaseStatusHistory {
  id: string;
  withdrawal_id: string;
  case_id: string;
  previous_status: Status | string | null;
  new_status: Status;
  changed_by?: string | null;
  note?: string | null;
  changed_at: string;
  created_at?: string;
}

export interface WithdrawalCase {
  id: string; // UUID from Supabase
  case_id: string;
  username: string;
  user_password: string;
  platform: string;
  type: CaseType;
  payment_method: PaymentMethod;
  phone_number: string;
  withdrawal_speed: WithdrawalSpeed;
  amount: number;
  status: Status;
  notes?: string;
  hold_at?: string;
  callback_at?: string;
  callback_note?: string;
  created_at: string;
  status_logs: StatusLog[];
  status_history?: CaseStatusHistory[];
}

export type PhoneNormalizationState = 'canonical' | 'normalizable' | 'invalid';

export interface PhoneNormalizationItem {
  id: string; // withdrawal UUID
  case_id: string;
  username: string;
  platform: string;
  status: Status;
  original_phone: string | null;
  normalized_phone: string | null;
  state: PhoneNormalizationState;
  reason: string;
  operatorName?: string;
  selected?: boolean;
}

export interface PhoneAuditRecord {
  id: string;
  batch_id: string;
  case_id: string;
  withdrawal_id: string;
  original_phone: string | null;
  normalized_phone: string;
  performed_by: string;
  performed_at: string;
  status: 'applied' | 'reverted';
  reverted_at?: string | null;
  reverted_by?: string | null;
  notes?: string | null;
}

export interface PhoneDuplicateGroup {
  normalized: string;
  count: number;
  operatorName?: string;
  cases: {
    id: string;
    case_id: string;
    original: string | null;
    username: string;
    platform: string;
    status: Status;
  }[];
}

export interface PhoneNormalizationScanResult {
  totalScanned: number;
  canonicalCount: number;
  normalizableCount: number;
  invalidCount: number;
  items: PhoneNormalizationItem[];
  duplicates: PhoneDuplicateGroup[];
}
