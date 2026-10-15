-- ==============================================================================
-- Migration: 20261015_create_case_status_history.sql
-- Description: Creates the case_status_history table, indexes, RLS policies,
--              and an automatic database trigger for tracking status changes.
-- ==============================================================================

-- 1. Create dedicated case_status_history table
CREATE TABLE IF NOT EXISTS public.case_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
    case_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    note TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast queries, filtering, and timelines
CREATE INDEX IF NOT EXISTS idx_case_status_history_withdrawal_id ON public.case_status_history(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_case_status_history_case_id ON public.case_status_history(case_id);
CREATE INDEX IF NOT EXISTS idx_case_status_history_changed_at ON public.case_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_status_history_transitions ON public.case_status_history(previous_status, new_status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Security Policies
-- Read access: Allow authenticated and authorized users to read history
DROP POLICY IF EXISTS "Allow read case_status_history" ON public.case_status_history;
CREATE POLICY "Allow read case_status_history"
    ON public.case_status_history
    FOR SELECT
    USING (true);

-- Insert access: Allow recorded history inserts
DROP POLICY IF EXISTS "Allow insert case_status_history" ON public.case_status_history;
CREATE POLICY "Allow insert case_status_history"
    ON public.case_status_history
    FOR INSERT
    WITH CHECK (true);

-- Deny update & delete: Protect history records from unauthorized tampering or deletion
DROP POLICY IF EXISTS "Deny update case_status_history" ON public.case_status_history;
CREATE POLICY "Deny update case_status_history"
    ON public.case_status_history
    FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "Deny delete case_status_history" ON public.case_status_history;
CREATE POLICY "Deny delete case_status_history"
    ON public.case_status_history
    FOR DELETE
    USING (false);

-- 5. Trigger Function: Automatically records status changes on withdrawals table
CREATE OR REPLACE FUNCTION public.fn_track_withdrawal_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
    v_note TEXT;
BEGIN
    -- Only record if status has actually changed (handles NULL safely)
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Safely extract user email from auth JWT if available
        BEGIN
            v_user_email := auth.jwt() ->> 'email';
        EXCEPTION WHEN OTHERS THEN
            v_user_email := NULL;
        END;

        IF v_user_email IS NULL OR v_user_email = '' THEN
            v_user_email := 'Admin';
        END IF;

        -- Extract note if callback note or general note was set
        IF NEW.status = 'Hold' AND NEW.callback_note IS NOT NULL AND NEW.callback_note <> '' THEN
            v_note := NEW.callback_note;
        ELSE
            v_note := NULL;
        END IF;

        -- Deduplicate: Prevent duplicate entry if one was already inserted within the last 3 seconds
        IF NOT EXISTS (
            SELECT 1 FROM public.case_status_history
            WHERE withdrawal_id = NEW.id
              AND new_status = NEW.status
              AND changed_at >= (now() - INTERVAL '3 seconds')
        ) THEN
            INSERT INTO public.case_status_history (
                withdrawal_id,
                case_id,
                previous_status,
                new_status,
                changed_by,
                note,
                changed_at
            ) VALUES (
                NEW.id,
                NEW.case_id,
                OLD.status,
                NEW.status,
                v_user_email,
                v_note,
                now()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Trigger to withdrawals table
DROP TRIGGER IF EXISTS trg_track_withdrawal_status_change ON public.withdrawals;
CREATE TRIGGER trg_track_withdrawal_status_change
    AFTER UPDATE OF status ON public.withdrawals
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_track_withdrawal_status_change();
