import { supabase } from './supabase';
import { 
  WithdrawalCase, 
  PhoneNormalizationItem, 
  PhoneNormalizationScanResult, 
  PhoneAuditRecord, 
  PhoneDuplicateGroup,
  StatusLog
} from '../types';
import { formatDhakaDateTime } from './statusHistory';

export const BANGLA_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const LOCAL_STORAGE_AUDIT_KEY = 'caseflow_phone_audit_records';

/**
 * Identify the telecom operator from a canonical or 01... number
 */
export function getBangladeshOperator(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.length < 3) return 'Unknown';
  const prefix = phoneNumber.substring(0, 3);
  switch (prefix) {
    case '017':
    case '013':
      return 'Grameenphone';
    case '018':
      return 'Robi';
    case '019':
    case '014':
      return 'Banglalink';
    case '016':
      return 'Airtel';
    case '015':
      return 'Teletalk';
    default:
      return 'Other Operator';
  }
}

/**
 * Convert any string containing Bengali digits (০-৯) into English digits (0-9).
 */
export function convertBanglaToEnglishDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[০-৯]/g, (char) => BANGLA_DIGITS[char] || char);
}

/**
 * Check if a string is already in pure canonical 11-digit format: 01[3-9]XXXXXXXX
 */
export function isPureCanonical(raw: unknown): boolean {
  return typeof raw === 'string' && /^01[3-9]\d{8}$/.test(raw.trim());
}

/**
 * Standardize and validate a Bangladeshi mobile phone number.
 * Target Canonical Format: 01XXXXXXXXX (11 digits, starts with 013-019)
 */
export function normalizeBangladeshPhone(input: string | null | undefined): {
  isValid: boolean;
  normalized: string | null;
  reason: string;
  state: 'canonical' | 'normalizable' | 'invalid';
  operatorName?: string;
  details?: string;
} {
  if (input === null || input === undefined) {
    return {
      isValid: false,
      normalized: null,
      reason: 'Missing or null phone number',
      state: 'invalid'
    };
  }

  const rawTrimmed = String(input).trim();
  if (!rawTrimmed) {
    return {
      isValid: false,
      normalized: null,
      reason: 'Empty phone number',
      state: 'invalid'
    };
  }

  // Check if it was already pure canonical English digits without spaces or extra symbols
  const alreadyPure = isPureCanonical(rawTrimmed);

  // 1. Convert Bangla digits
  const englishDigits = convertBanglaToEnglishDigits(rawTrimmed);
  const hadBanglaDigits = /[০-৯]/.test(rawTrimmed);

  // 2. Strip non-digits (spaces, dashes, parens, plus, dots, slashes)
  let digits = englishDigits.replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      normalized: null,
      reason: 'No numeric digits found',
      state: 'invalid'
    };
  }

  // 3. Handle international prefixes:
  // "0+880..." (common data entry artifact where 0 and +880 are both typed)
  if (digits.startsWith('0880') && digits.length >= 14) {
    digits = digits.substring(4);
  }
  // "00880..." standard international exit code
  else if (digits.startsWith('00880') && digits.length >= 15) {
    digits = digits.substring(5);
  }
  // "+880..." or "880..."
  else if (digits.startsWith('880') && digits.length >= 13) {
    digits = digits.substring(3);
  }

  // 4. If 10 digits starting with 1[3-9], prepend leading 0
  if (digits.length === 10 && /^1[3-9]\d{8}$/.test(digits)) {
    digits = '0' + digits;
  }

  // 5. Check if it matches canonical 11 digits: 01[3-9]\d{8}
  if (/^01[3-9]\d{8}$/.test(digits)) {
    const operator = getBangladeshOperator(digits);

    if (alreadyPure) {
      return {
        isValid: true,
        normalized: digits,
        reason: 'Already in canonical format (01XXXXXXXXX)',
        state: 'canonical',
        operatorName: operator
      };
    }

    // Determine why it needed normalization for clear audit display
    const reasons: string[] = [];
    if (hadBanglaDigits) reasons.push('Converted Bengali numerals');
    if (/\s/.test(rawTrimmed)) reasons.push('Removed spaces');
    if (/[-_./]/.test(rawTrimmed)) reasons.push('Removed punctuation');
    if (/[+0]*880/.test(rawTrimmed)) reasons.push('Stripped +880 country code');
    if (rawTrimmed.length === 10 && rawTrimmed.startsWith('1')) reasons.push('Added missing leading 0');
    if (reasons.length === 0) reasons.push('Standardized to 11-digit canonical format');

    return {
      isValid: true,
      normalized: digits,
      reason: reasons.join(' • '),
      state: 'normalizable',
      operatorName: operator
    };
  }

  // Rejection reasons for invalid/ambiguous numbers
  let rejectionReason = 'Cannot safely validate as Bangladesh mobile';
  if (digits.length !== 11) {
    rejectionReason = `Invalid digit count (${digits.length} digits, expected 11)`;
  } else if (!/^01/.test(digits)) {
    rejectionReason = `Does not start with 01 (${digits.substring(0, 2)}...)`;
  } else if (!/^01[3-9]/.test(digits)) {
    rejectionReason = `Invalid mobile operator prefix (${digits.substring(0, 3)})`;
  }

  return {
    isValid: false,
    normalized: null,
    reason: rejectionReason,
    state: 'invalid'
  };
}

/**
 * Scan all existing cases and produce a comprehensive preview:
 * - Scanned count
 * - Valid normalizable items
 * - Already canonical items
 * - Invalid/ambiguous items
 * - Potential duplicate phone numbers revealed or created
 */
export function scanCasesPhoneNumbers(cases: WithdrawalCase[]): PhoneNormalizationScanResult {
  const items: PhoneNormalizationItem[] = [];
  const normalizedMap = new Map<string, PhoneDuplicateGroup['cases']>();

  let canonicalCount = 0;
  let normalizableCount = 0;
  let invalidCount = 0;

  for (const c of cases) {
    const raw = c.phone_number;
    const res = normalizeBangladeshPhone(raw);

    const item: PhoneNormalizationItem = {
      id: c.id,
      case_id: c.case_id,
      username: c.username || 'N/A',
      platform: c.platform || 'N/A',
      status: c.status,
      original_phone: raw ?? null,
      normalized_phone: res.normalized,
      state: res.state,
      reason: res.reason,
      operatorName: res.operatorName,
      selected: res.state === 'normalizable'
    };

    items.push(item);

    if (res.state === 'canonical') {
      canonicalCount++;
    } else if (res.state === 'normalizable') {
      normalizableCount++;
    } else {
      invalidCount++;
    }

    if (res.normalized) {
      const list = normalizedMap.get(res.normalized) || [];
      list.push({
        id: c.id,
        case_id: c.case_id,
        original: raw ?? null,
        username: c.username || 'N/A',
        platform: c.platform || 'N/A',
        status: c.status
      });
      normalizedMap.set(res.normalized, list);
    }
  }

  // Filter groups with count > 1
  const duplicates: PhoneDuplicateGroup[] = [];
  for (const [norm, groupCases] of normalizedMap.entries()) {
    if (groupCases.length > 1) {
      duplicates.push({
        normalized: norm,
        count: groupCases.length,
        operatorName: getBangladeshOperator(norm),
        cases: groupCases
      });
    }
  }

  // Sort duplicates with highest collision count first
  duplicates.sort((a, b) => b.count - a.count);

  return {
    totalScanned: cases.length,
    canonicalCount,
    normalizableCount,
    invalidCount,
    items,
    duplicates
  };
}

/**
 * Safe local storage audit helper
 */
function getLocalAuditRecords(): PhoneAuditRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAuditRecords(records: PhoneAuditRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_AUDIT_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to save audit logs to localStorage:', e);
  }
}

/**
 * Fetch all audit logs (merges database audit table with local recovery cache)
 */
export async function fetchPhoneAuditLogs(): Promise<PhoneAuditRecord[]> {
  const localLogs = getLocalAuditRecords();
  const resultMap = new Map<string, PhoneAuditRecord>();

  // Add local logs first
  localLogs.forEach(log => {
    resultMap.set(log.id, log);
  });

  try {
    const { data: dbLogs, error } = await supabase
      .from('phone_normalization_audit')
      .select('*')
      .order('performed_at', { ascending: false });

    if (!error && Array.isArray(dbLogs)) {
      dbLogs.forEach((rec: any) => {
        resultMap.set(rec.id, {
          id: rec.id,
          batch_id: rec.batch_id,
          case_id: rec.case_id,
          withdrawal_id: rec.withdrawal_id,
          original_phone: rec.original_phone,
          normalized_phone: rec.normalized_phone,
          performed_by: rec.performed_by || 'Admin',
          performed_at: rec.performed_at,
          status: rec.status as 'applied' | 'reverted',
          reverted_at: rec.reverted_at,
          reverted_by: rec.reverted_by,
          notes: rec.notes
        });
      });
    }
  } catch {
    // If table doesn't exist yet, local logs provide complete offline and fallback support
  }

  const sorted = Array.from(resultMap.values()).sort((a, b) => {
    const timeA = new Date(a.performed_at).getTime() || 0;
    const timeB = new Date(b.performed_at).getTime() || 0;
    return timeB - timeA;
  });

  return sorted;
}

export interface ApplyNormalizationParams {
  itemsToNormalize: PhoneNormalizationItem[];
  allCases: WithdrawalCase[];
  performedBy?: string;
  onProgress?: (completed: number, total: number) => void;
}

export interface ApplyNormalizationResult {
  success: boolean;
  batchId: string;
  modifiedCount: number;
  skippedCount: number;
  errors: { caseId: string; error: string }[];
  auditRecords: PhoneAuditRecord[];
}

/**
 * Safely apply phone number normalization to eligible records.
 * 1. Preserves all other fields (amounts, statuses, IDs, notes, timestamps).
 * 2. Updates `withdrawals.phone_number = normalized_phone`.
 * 3. Appends an audit entry to `withdrawals.status_logs` so the original phone is preserved inside the case itself.
 * 4. Inserts row into `phone_normalization_audit` database table.
 * 5. Saves audit record into protected audit storage for instant recovery/rollback.
 * 6. Safely catches any constraint violation or single record error and skips that record without failing the batch.
 */
export async function applyPhoneNormalizationBatch({
  itemsToNormalize,
  allCases,
  performedBy = 'Admin',
  onProgress
}: ApplyNormalizationParams): Promise<ApplyNormalizationResult> {
  const batchId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const dhakaTime = formatDhakaDateTime(nowIso);

  const errors: { caseId: string; error: string }[] = [];
  const createdAuditRecords: PhoneAuditRecord[] = [];
  let modifiedCount = 0;
  let skippedCount = 0;

  // Build a lookup map of existing cases to get their status_logs
  const caseMap = new Map<string, WithdrawalCase>();
  allCases.forEach(c => caseMap.set(c.id, c));

  const total = itemsToNormalize.length;

  for (let i = 0; i < total; i++) {
    const item = itemsToNormalize[i];

    if (!item.normalized_phone || item.state !== 'normalizable') {
      skippedCount++;
      if (onProgress) onProgress(i + 1, total);
      continue;
    }

    const existingCase = caseMap.get(item.id);
    const existingLogs: StatusLog[] = existingCase?.status_logs || [];

    // Audit log entry inside the case itself
    const auditLog: StatusLog = {
      id: crypto.randomUUID(),
      message: `Phone number format normalized from "${item.original_phone || 'Empty'}" to "${item.normalized_phone}"`,
      timestamp: nowIso,
      changed_by: performedBy,
      note: `Audit [Batch: ${batchId.substring(0, 8)}] Original format: "${item.original_phone}"`
    };

    const updatedLogs = [auditLog, ...existingLogs];

    try {
      // 1. Update withdrawals table
      const { error: updateErr } = await supabase
        .from('withdrawals')
        .update({
          phone_number: item.normalized_phone,
          status_logs: updatedLogs
        })
        .eq('id', item.id);

      if (updateErr) {
        errors.push({
          caseId: item.case_id,
          error: updateErr.message
        });
        skippedCount++;
        if (onProgress) onProgress(i + 1, total);
        continue;
      }

      // Record successful audit record
      const auditRecord: PhoneAuditRecord = {
        id: crypto.randomUUID(),
        batch_id: batchId,
        case_id: item.case_id,
        withdrawal_id: item.id,
        original_phone: item.original_phone,
        normalized_phone: item.normalized_phone,
        performed_by: performedBy,
        performed_at: nowIso,
        status: 'applied',
        notes: `Normalized on ${dhakaTime}`
      };

      createdAuditRecords.push(auditRecord);
      modifiedCount++;

      // 2. Insert into dedicated Supabase phone_normalization_audit table
      try {
        await supabase
          .from('phone_normalization_audit')
          .insert({
            id: auditRecord.id,
            batch_id: batchId,
            case_id: item.case_id,
            withdrawal_id: item.id,
            original_phone: item.original_phone,
            normalized_phone: item.normalized_phone,
            performed_by: performedBy,
            performed_at: nowIso,
            status: 'applied',
            notes: auditRecord.notes
          });
      } catch {
        // Table might not be migrated yet in some setups; local audit cache guarantees recovery
      }
    } catch (err: any) {
      errors.push({
        caseId: item.case_id,
        error: err?.message || 'Unexpected database error'
      });
      skippedCount++;
    }

    if (onProgress) onProgress(i + 1, total);
  }

  // Update local storage audit log cache
  if (createdAuditRecords.length > 0) {
    const existingAudits = getLocalAuditRecords();
    saveLocalAuditRecords([...createdAuditRecords, ...existingAudits]);
  }

  return {
    success: errors.length === 0,
    batchId,
    modifiedCount,
    skippedCount,
    errors,
    auditRecords: createdAuditRecords
  };
}

/**
 * Revert/Rollback an entire batch of normalized phone numbers to their original values.
 */
export async function rollbackPhoneNormalizationBatch(
  batchId: string,
  performedBy: string = 'Admin'
): Promise<{ success: boolean; revertedCount: number; errors: { caseId: string; error: string }[] }> {
  const allAudits = await fetchPhoneAuditLogs();
  const batchRecords = allAudits.filter(a => a.batch_id === batchId && a.status === 'applied');

  if (batchRecords.length === 0) {
    return { success: true, revertedCount: 0, errors: [] };
  }

  const nowIso = new Date().toISOString();
  let revertedCount = 0;
  const errors: { caseId: string; error: string }[] = [];

  for (const rec of batchRecords) {
    try {
      // Revert phone_number back to original_phone
      const { error: updateErr } = await supabase
        .from('withdrawals')
        .update({
          phone_number: rec.original_phone
        })
        .eq('id', rec.withdrawal_id);

      if (updateErr) {
        errors.push({ caseId: rec.case_id, error: updateErr.message });
        continue;
      }

      // Mark audit record as reverted
      rec.status = 'reverted';
      rec.reverted_at = nowIso;
      rec.reverted_by = performedBy;
      revertedCount++;

      // Try updating in Supabase audit table
      try {
        await supabase
          .from('phone_normalization_audit')
          .update({
            status: 'reverted',
            reverted_at: nowIso,
            reverted_by: performedBy
          })
          .eq('id', rec.id);
      } catch {
        // Local cache handles state
      }
    } catch (err: any) {
      errors.push({ caseId: rec.case_id, error: err?.message || 'Failed to rollback' });
    }
  }

  // Save updated audit cache
  const localAudits = getLocalAuditRecords();
  const updatedLocal = localAudits.map(localRec => {
    if (localRec.batch_id === batchId) {
      return {
        ...localRec,
        status: 'reverted' as const,
        reverted_at: nowIso,
        reverted_by: performedBy
      };
    }
    return localRec;
  });
  saveLocalAuditRecords(updatedLocal);

  return {
    success: errors.length === 0,
    revertedCount,
    errors
  };
}

/**
 * Revert a single phone number record back to its original value.
 */
export async function rollbackSinglePhoneRecord(
  auditId: string,
  performedBy: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  const allAudits = await fetchPhoneAuditLogs();
  const record = allAudits.find(a => a.id === auditId);

  if (!record) {
    return { success: false, error: 'Audit record not found' };
  }

  const nowIso = new Date().toISOString();

  try {
    const { error: updateErr } = await supabase
      .from('withdrawals')
      .update({
        phone_number: record.original_phone
      })
      .eq('id', record.withdrawal_id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Update in Supabase
    try {
      await supabase
        .from('phone_normalization_audit')
        .update({
          status: 'reverted',
          reverted_at: nowIso,
          reverted_by: performedBy
        })
        .eq('id', record.id);
    } catch {}

    // Update local cache
    const localAudits = getLocalAuditRecords();
    const updated = localAudits.map(l => l.id === auditId ? {
      ...l,
      status: 'reverted' as const,
      reverted_at: nowIso,
      reverted_by: performedBy
    } : l);
    saveLocalAuditRecords(updated);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to revert phone number' };
  }
}
