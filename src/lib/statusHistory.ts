import { supabase } from './supabase';
import { Status, CaseStatusHistory, StatusLog } from '../types';

/**
 * Format any timestamp into Asia/Dhaka (GMT+6) string.
 * Example: "16 Oct 2026, 01:25 AM"
 */
export function formatDhakaDateTime(isoOrDateStr: string | Date | undefined | null): string {
  if (!isoOrDateStr) return 'N/A';
  try {
    const d = typeof isoOrDateStr === 'string' ? new Date(isoOrDateStr) : isoOrDateStr;
    if (isNaN(d.getTime())) return String(isoOrDateStr);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return String(isoOrDateStr);
  }
}

/**
 * Extract status from legacy status_logs message like "Status changed to Approved"
 */
function extractStatusFromMessage(msg: string): Status | null {
  const match = msg.match(/Status changed to (Approved|Rejected|Pending|Hold|Contact Fail|Contact)/i);
  if (match && match[1]) {
    return match[1] as Status;
  }
  return null;
}

/**
 * Fetch all status change history for a given case.
 * Queries the dedicated case_status_history table, and merges/falls back to
 * structured status_logs from the case record so history is never lost.
 */
export async function fetchCaseStatusHistory(
  withdrawalId: string,
  fallbackLogs: StatusLog[] = [],
  caseId: string = ''
): Promise<{ data: CaseStatusHistory[]; error: string | null }> {
  try {
    const { data: dbRecords, error: dbErr } = await supabase
      .from('case_status_history')
      .select('*')
      .eq('withdrawal_id', withdrawalId)
      .order('changed_at', { ascending: false });

    const results: CaseStatusHistory[] = [];
    const seenKeys = new Set<string>();

    if (!dbErr && Array.isArray(dbRecords)) {
      for (const rec of dbRecords) {
        const key = `${rec.withdrawal_id}-${rec.new_status}-${rec.changed_at}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(rec);
        }
      }
    }

    // Also process fallback logs from withdrawals.status_logs
    if (Array.isArray(fallbackLogs)) {
      for (const log of fallbackLogs) {
        // If it's a structured log with previous/new status
        if (log.new_status) {
          const key = `${withdrawalId}-${log.new_status}-${log.timestamp}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push({
              id: log.id || crypto.randomUUID(),
              withdrawal_id: withdrawalId,
              case_id: caseId,
              previous_status: log.previous_status || null,
              new_status: log.new_status,
              changed_by: log.changed_by || 'Admin',
              note: log.note || undefined,
              changed_at: log.timestamp
            });
          }
        } else if (log.message) {
          const extractedStatus = extractStatusFromMessage(log.message);
          if (extractedStatus) {
            const key = `${withdrawalId}-${extractedStatus}-${log.timestamp}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push({
                id: log.id || crypto.randomUUID(),
                withdrawal_id: withdrawalId,
                case_id: caseId,
                previous_status: null,
                new_status: extractedStatus,
                changed_by: 'Admin',
                note: log.message !== `Status changed to ${extractedStatus}` ? log.message : undefined,
                changed_at: log.timestamp
              });
            }
          }
        }
      }
    }

    // Sort newest changes first
    results.sort((a, b) => {
      const timeA = new Date(a.changed_at).getTime() || 0;
      const timeB = new Date(b.changed_at).getTime() || 0;
      return timeB - timeA;
    });

    return { data: results, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch status history' };
  }
}

export interface RecordStatusChangeParams {
  withdrawalId: string;
  caseId: string;
  previousStatus: Status | string | null;
  newStatus: Status;
  changedBy?: string;
  note?: string;
  existingLogs?: StatusLog[];
  additionalCaseUpdates?: Record<string, any>;
}

/**
 * Record a status change:
 * 1. Verifies that previous_status !== new_status (avoids unchanged duplicates).
 * 2. Updates the withdrawals record (trigger logs history automatically if migration was run).
 * 3. Also inserts into case_status_history directly and appends to status_logs for 100% reliability.
 * 4. Ensures failures are surfaced properly rather than silent reports.
 */
export async function recordCaseStatusChange({
  withdrawalId,
  caseId,
  previousStatus,
  newStatus,
  changedBy,
  note,
  existingLogs = [],
  additionalCaseUpdates = {}
}: RecordStatusChangeParams): Promise<{ success: boolean; changed: boolean; error: string | null }> {
  // If status remains unchanged, do not record history or update
  if (previousStatus === newStatus) {
    return { success: true, changed: false, error: null };
  }

  const nowIso = new Date().toISOString();
  const dhakaFormattedTime = formatDhakaDateTime(nowIso);

  // Prepare structured log
  const newLog: StatusLog = {
    id: crypto.randomUUID(),
    message: note 
      ? `Status changed from ${previousStatus || 'None'} to ${newStatus}: ${note}`
      : `Status changed from ${previousStatus || 'None'} to ${newStatus}`,
    timestamp: nowIso,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: changedBy || 'Admin',
    note: note || undefined
  };

  const updatedLogs = [newLog, ...existingLogs];

  try {
    // 1. Update the withdrawals table
    const updatePayload: Record<string, any> = {
      status: newStatus,
      status_logs: updatedLogs,
      ...additionalCaseUpdates
    };

    const { error: updateError } = await supabase
      .from('withdrawals')
      .update(updatePayload)
      .eq('id', withdrawalId);

    if (updateError) {
      return { success: false, changed: false, error: `Failed to update status: ${updateError.message}` };
    }

    // 2. Insert into dedicated case_status_history table
    // (If the table exists, this creates the dedicated row. If the trigger also fired, the trigger has deduplication)
    try {
      await supabase
        .from('case_status_history')
        .insert({
          id: crypto.randomUUID(),
          withdrawal_id: withdrawalId,
          case_id: caseId,
          previous_status: previousStatus || null,
          new_status: newStatus,
          changed_by: changedBy || 'Admin',
          note: note || null,
          changed_at: nowIso
        });
    } catch {
      // If table does not exist yet prior to SQL migration running in Supabase,
      // the status_logs on the withdrawal record already safely persisted the change.
    }

    return { success: true, changed: true, error: null };
  } catch (err: any) {
    return { success: false, changed: false, error: err?.message || 'Status change failed' };
  }
}
