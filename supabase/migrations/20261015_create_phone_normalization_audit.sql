-- ==============================================================================
-- Migration: 20261015_create_phone_normalization_audit.sql
-- Description: Creates the phone_normalization_audit table, indexes, RLS policies,
--              to safely track, audit, and revert phone number normalizations.
-- ==============================================================================

-- 1. Create dedicated phone_normalization_audit table
CREATE TABLE IF NOT EXISTS public.phone_normalization_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
    original_phone TEXT,
    normalized_phone TEXT NOT NULL,
    performed_by TEXT DEFAULT 'Admin',
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'applied', -- 'applied' | 'reverted'
    reverted_at TIMESTAMPTZ,
    reverted_by TEXT,
    notes TEXT
);

-- 2. Indexes for fast queries, batch retrieval, and rollback
CREATE INDEX IF NOT EXISTS idx_phone_audit_batch_id ON public.phone_normalization_audit(batch_id);
CREATE INDEX IF NOT EXISTS idx_phone_audit_case_id ON public.phone_normalization_audit(case_id);
CREATE INDEX IF NOT EXISTS idx_phone_audit_withdrawal_id ON public.phone_normalization_audit(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_phone_audit_performed_at ON public.phone_normalization_audit(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_audit_status ON public.phone_normalization_audit(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.phone_normalization_audit ENABLE ROW LEVEL SECURITY;

-- 4. RLS Security Policies
-- Read access: Allow reading audit logs
DROP POLICY IF EXISTS "Allow read phone_normalization_audit" ON public.phone_normalization_audit;
CREATE POLICY "Allow read phone_normalization_audit"
    ON public.phone_normalization_audit
    FOR SELECT
    USING (true);

-- Insert access: Allow inserting audit records
DROP POLICY IF EXISTS "Allow insert phone_normalization_audit" ON public.phone_normalization_audit;
CREATE POLICY "Allow insert phone_normalization_audit"
    ON public.phone_normalization_audit
    FOR INSERT
    WITH CHECK (true);

-- Update access: Only allow updating status/reverted fields for rollback
DROP POLICY IF EXISTS "Allow update phone_normalization_audit" ON public.phone_normalization_audit;
CREATE POLICY "Allow update phone_normalization_audit"
    ON public.phone_normalization_audit
    FOR UPDATE
    USING (true)
    WITH CHECK (status IN ('applied', 'reverted'));

-- Deletion denied: Protect audit trails from deletion
DROP POLICY IF EXISTS "Deny delete phone_normalization_audit" ON public.phone_normalization_audit;
CREATE POLICY "Deny delete phone_normalization_audit"
    ON public.phone_normalization_audit
    FOR DELETE
    USING (false);
