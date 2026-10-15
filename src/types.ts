export type Status = 'Pending' | 'Approved' | 'Rejected' | 'Contact' | 'Contact Fail' | 'Hold';
export type CaseType = 'Withdrawal' | 'Deposit';
export type WithdrawalSpeed = 'Normal' | 'Fast';
export type PaymentMethod = string;

export interface StatusLog {
  id: string;
  message: string;
  timestamp: string;
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
}
