import React, { useState, useMemo, useEffect } from 'react';
import { 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RotateCcw, 
  ArrowRight, 
  Search, 
  Check, 
  Filter, 
  Info, 
  Loader2, 
  ShieldCheck, 
  History, 
  AlertCircle,
  Copy,
  Users
} from 'lucide-react';
import { WithdrawalCase, PhoneNormalizationItem, PhoneAuditRecord } from '../types';
import { 
  scanCasesPhoneNumbers, 
  applyPhoneNormalizationBatch, 
  fetchPhoneAuditLogs, 
  rollbackPhoneNormalizationBatch, 
  rollbackSinglePhoneRecord,
  getBangladeshOperator
} from '../lib/phoneNormalization';
import { formatDhakaDateTime } from '../lib/statusHistory';

interface PhoneNormalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: WithdrawalCase[];
  onSuccess: () => void;
  currentUserEmail?: string;
}

type TabType = 'normalizable' | 'all' | 'canonical' | 'invalid' | 'duplicates' | 'audit';

export default function PhoneNormalizationModal({
  isOpen,
  onClose,
  cases,
  onSuccess,
  currentUserEmail = 'Admin'
}: PhoneNormalizationModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('normalizable');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    batchId: string;
    modifiedCount: number;
    skippedCount: number;
    errors: { caseId: string; error: string }[];
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<PhoneAuditRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Scan cases
  const scanResult = useMemo(() => {
    return scanCasesPhoneNumbers(cases);
  }, [cases]);

  // Initialize selected IDs with all normalizable items
  useEffect(() => {
    if (isOpen) {
      const normalizableItems = scanResult.items.filter(i => i.state === 'normalizable');
      setSelectedIds(new Set(normalizableItems.map(i => i.id)));
      setExecutionResult(null);
      loadAuditLogs();
    }
  }, [isOpen, scanResult]);

  async function loadAuditLogs() {
    setLoadingAudit(true);
    try {
      const logs = await fetchPhoneAuditLogs();
      setAuditLogs(logs);
    } finally {
      setLoadingAudit(false);
    }
  }

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    return scanResult.items.filter(item => {
      // Tab filter
      if (activeTab === 'normalizable' && item.state !== 'normalizable') return false;
      if (activeTab === 'canonical' && item.state !== 'canonical') return false;
      if (activeTab === 'invalid' && item.state !== 'invalid') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCaseId = item.case_id.toLowerCase().includes(q);
        const matchesUser = item.username.toLowerCase().includes(q);
        const matchesOrig = item.original_phone?.toLowerCase().includes(q);
        const matchesNorm = item.normalized_phone?.toLowerCase().includes(q);
        const matchesReason = item.reason.toLowerCase().includes(q);
        const matchesOperator = item.operatorName?.toLowerCase().includes(q);
        return matchesCaseId || matchesUser || matchesOrig || matchesNorm || matchesReason || matchesOperator;
      }
      return true;
    });
  }, [scanResult, activeTab, searchQuery]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllNormalizable = () => {
    const normalizable = scanResult.items.filter(i => i.state === 'normalizable');
    if (selectedIds.size === normalizable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(normalizable.map(i => i.id)));
    }
  };

  // Execute bulk fix
  const handleApplyFix = async () => {
    setShowConfirmDialog(false);
    setIsApplying(true);
    setProgress({ completed: 0, total: selectedIds.size });

    const itemsToProcess = scanResult.items.filter(
      item => item.state === 'normalizable' && selectedIds.has(item.id)
    );

    try {
      const result = await applyPhoneNormalizationBatch({
        itemsToNormalize: itemsToProcess,
        allCases: cases,
        performedBy: currentUserEmail,
        onProgress: (completed, total) => {
          setProgress({ completed, total });
        }
      });

      setExecutionResult(result);
      await loadAuditLogs();
      onSuccess(); // Refresh dashboard cases
    } catch (err: any) {
      setExecutionResult({
        success: false,
        batchId: '',
        modifiedCount: 0,
        skippedCount: 0,
        errors: [{ caseId: 'ALL', error: err?.message || 'Failed to apply normalization' }]
      });
    } finally {
      setIsApplying(false);
      setProgress(null);
    }
  };

  // Revert single record
  const handleRevertSingle = async (auditId: string) => {
    setRevertingId(auditId);
    try {
      const res = await rollbackSinglePhoneRecord(auditId, currentUserEmail);
      if (res.success) {
        await loadAuditLogs();
        onSuccess();
      } else {
        alert(`Failed to revert: ${res.error}`);
      }
    } finally {
      setRevertingId(null);
    }
  };

  // Revert entire batch
  const handleRevertBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to revert all phone numbers changed in this batch? Original numbers will be restored.')) {
      return;
    }
    setRevertingId(batchId);
    try {
      const res = await rollbackPhoneNormalizationBatch(batchId, currentUserEmail);
      if (res.success) {
        await loadAuditLogs();
        onSuccess();
      } else {
        alert(`Revert completed with errors: ${res.errors.map(e => e.error).join(', ')}`);
      }
    } finally {
      setRevertingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-6xl bg-[#0B1120] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-transparent flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Phone className="text-white" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Fix Existing Phone Number Formats
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Admin Action
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automatically convert Bangladeshi mobile numbers to canonical format <span className="font-mono text-blue-300 font-bold">01XXXXXXXXX</span> with audit logging & rollback.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scan Summary Cards */}
        <div className="p-4 sm:p-6 border-b border-white/5 bg-white/[0.01] grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Scanned</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{scanResult.totalScanned}</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">Existing database records</span>
          </div>

          <div 
            onClick={() => setActiveTab('normalizable')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'normalizable' 
                ? 'bg-blue-500/15 border-blue-500/40 shadow-lg shadow-blue-500/10' 
                : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Can Be Fixed</span>
              <Sparkles size={13} className="text-blue-400" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-blue-300 mt-1 font-mono">{scanResult.normalizableCount}</span>
            <span className="text-[10px] text-blue-400/70 mt-0.5">Ready for 01XXXXXXXXX fix</span>
          </div>

          <div 
            onClick={() => setActiveTab('canonical')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'canonical' 
                ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10' 
                : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Already Canonical</span>
              <CheckCircle2 size={13} className="text-emerald-400" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-emerald-300 mt-1 font-mono">{scanResult.canonicalCount}</span>
            <span className="text-[10px] text-emerald-400/70 mt-0.5">Correct 11-digit format</span>
          </div>

          <div 
            onClick={() => setActiveTab('invalid')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'invalid' 
                ? 'bg-rose-500/15 border-rose-500/40 shadow-lg shadow-rose-500/10' 
                : 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Invalid / Empty</span>
              <AlertCircle size={13} className="text-rose-400" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-rose-300 mt-1 font-mono">{scanResult.invalidCount}</span>
            <span className="text-[10px] text-rose-400/70 mt-0.5">Skipped safely</span>
          </div>

          <div 
            onClick={() => setActiveTab('duplicates')}
            className={`col-span-2 sm:col-span-1 p-3.5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'duplicates' 
                ? 'bg-violet-500/15 border-violet-500/40 shadow-lg shadow-violet-500/10' 
                : 'bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Shared Numbers</span>
              <Users size={13} className="text-violet-400" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-violet-300 mt-1 font-mono">{scanResult.duplicates.length}</span>
            <span className="text-[10px] text-violet-400/70 mt-0.5">Client collisions identified</span>
          </div>
        </div>

        {/* Tab Navigation and Search */}
        <div className="px-4 sm:px-6 py-3 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/[0.005]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <button
              onClick={() => setActiveTab('normalizable')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'normalizable' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>To Fix</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {scanResult.normalizableCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'all' 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>All Scanned</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 font-mono">
                {scanResult.totalScanned}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('canonical')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'canonical' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Canonical</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {scanResult.canonicalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('invalid')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'invalid' 
                  ? 'bg-rose-600 text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Invalid/Empty</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {scanResult.invalidCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'duplicates' 
                  ? 'bg-violet-600 text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Duplicate Analysis</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {scanResult.duplicates.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'audit' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History size={13} />
              <span>Audit & Rollback</span>
              {auditLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                  {auditLogs.length}
                </span>
              )}
            </button>
          </div>

          {activeTab !== 'audit' && activeTab !== 'duplicates' && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input
                type="text"
                placeholder="Search phone, case ID, user..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Execution Result Banner */}
          {executionResult && (
            <div className={`p-4 rounded-2xl border ${
              executionResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    executionResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {executionResult.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {executionResult.success ? 'Normalization Applied Successfully!' : 'Normalization Completed with Warnings'}
                    </h4>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Updated <span className="font-bold text-emerald-400">{executionResult.modifiedCount}</span> phone numbers to canonical 01XXXXXXXXX format. 
                      {executionResult.skippedCount > 0 && ` (${executionResult.skippedCount} skipped)`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('audit')}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold flex items-center gap-1.5"
                >
                  <History size={13} />
                  <span>View in Audit Log</span>
                </button>
              </div>

              {executionResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs text-rose-400 space-y-1">
                  <span className="font-bold">Errors encountered:</span>
                  {executionResult.errors.map((e, idx) => (
                    <div key={idx}>• Case {e.caseId}: {e.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: DUPLICATE ANALYSIS */}
          {activeTab === 'duplicates' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-start gap-3">
                <Info size={18} className="text-violet-400 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 space-y-1">
                  <p className="font-bold text-white">Understanding Shared Customer Phone Numbers</p>
                  <p>
                    When phone numbers with variations (e.g. <span className="font-mono text-zinc-200">018 6162 6323</span> vs <span className="font-mono text-zinc-200">01861626323</span>) are normalized, they naturally unify to the same canonical format. 
                    In withdrawal records, this demonstrates multiple withdrawal requests submitted by the exact same customer.
                  </p>
                  <p className="text-violet-300 font-semibold">
                    Safe Execution: Supabase stores withdrawal cases by primary key UUID and unique case ID, so shared phone numbers are safely supported and preserved without constraint conflicts.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scanResult.duplicates.map((group, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-400">{group.normalized}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {group.operatorName}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {group.count} Cases
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.cases.map(c => (
                        <div key={c.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-white">{c.case_id}</span>
                            <span className="text-zinc-400 ml-2">@{c.username}</span>
                            <span className="text-zinc-500 ml-1.5 text-[10px]">({c.platform})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-zinc-400 text-[11px] block">
                              Raw: {c.original || 'None'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: AUDIT & RECOVERY */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="text-emerald-400" size={16} />
                    Audit Trail & Instant Recovery
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Full history of phone number changes. You can restore individual records or rollback an entire batch anytime.
                  </p>
                </div>
                <button
                  onClick={loadAuditLogs}
                  disabled={loadingAudit}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-bold flex items-center gap-1.5"
                >
                  {loadingAudit ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  <span>Refresh Audit</span>
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-white/5">
                  <History className="mx-auto text-zinc-600 mb-2" size={32} />
                  <p className="text-sm text-zinc-400 font-bold">No normalization batches recorded yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    When you run "Normalize Eligible Records", audit records will appear here with instant 1-click restore options.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group audit by batch */}
                  {Array.from(new Set<string>(auditLogs.map(a => a.batch_id))).map((batchId: string) => {
                    const batchRecords = auditLogs.filter(a => a.batch_id === batchId);
                    const firstRecord = batchRecords[0];
                    const activeCount = batchRecords.filter(a => a.status === 'applied').length;

                    return (
                      <div key={batchId} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-blue-400">
                                Batch #{batchId.substring(0, 8)}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                Performed by {firstRecord.performed_by}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                • {formatDhakaDateTime(firstRecord.performed_at)} (Dhaka)
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {batchRecords.length} total changes ({activeCount} currently applied, {batchRecords.length - activeCount} reverted)
                            </p>
                          </div>

                          {activeCount > 0 && (
                            <button
                              onClick={() => handleRevertBatch(batchId)}
                              disabled={revertingId === batchId}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                            >
                              {revertingId === batchId ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <RotateCcw size={13} />
                              )}
                              <span>Rollback Entire Batch ({activeCount})</span>
                            </button>
                          )}
                        </div>

                        {/* Batch records table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-zinc-500 border-b border-white/5 text-[10px] uppercase tracking-wider">
                                <th className="pb-2 font-bold">Case ID</th>
                                <th className="pb-2 font-bold">Original Format</th>
                                <th className="pb-2 font-bold">Normalized Format</th>
                                <th className="pb-2 font-bold">Status</th>
                                <th className="pb-2 font-bold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {batchRecords.map(rec => (
                                <tr key={rec.id} className="text-zinc-300 hover:bg-white/[0.01]">
                                  <td className="py-2.5 font-mono font-bold text-white">{rec.case_id}</td>
                                  <td className="py-2.5 font-mono text-zinc-400">"{rec.original_phone || 'null'}"</td>
                                  <td className="py-2.5 font-mono text-emerald-400 font-bold">{rec.normalized_phone}</td>
                                  <td className="py-2.5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      rec.status === 'applied' 
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                        : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                                    }`}>
                                      {rec.status === 'applied' ? 'Applied' : `Reverted (${formatDhakaDateTime(rec.reverted_at)})`}
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-right">
                                    {rec.status === 'applied' && (
                                      <button
                                        onClick={() => handleRevertSingle(rec.id)}
                                        disabled={revertingId === rec.id}
                                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                                      >
                                        {revertingId === rec.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                        <span>Restore Original</span>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: ITEMS LIST (Normalizable, All, Canonical, Invalid) */}
          {activeTab !== 'audit' && activeTab !== 'duplicates' && (
            <div className="space-y-3">
              {activeTab === 'normalizable' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selectAllCheck"
                      checked={selectedIds.size > 0 && selectedIds.size === scanResult.normalizableCount}
                      onChange={handleSelectAllNormalizable}
                      className="w-4 h-4 rounded text-blue-600 bg-white/5 border-white/20 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="selectAllCheck" className="text-xs font-bold text-white cursor-pointer select-none">
                      Select All Normalizable ({scanResult.normalizableCount} records)
                    </label>
                  </div>

                  <span className="text-[11px] text-blue-300 font-mono">
                    {selectedIds.size} of {scanResult.normalizableCount} selected for fix
                  </span>
                </div>
              )}

              {filteredItems.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-white/5">
                  <CheckCircle2 className="mx-auto text-zinc-600 mb-2" size={32} />
                  <p className="text-sm text-zinc-400 font-bold">No records found for this view</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {activeTab === 'normalizable' 
                      ? 'All phone numbers in your database are already standardized in canonical format!' 
                      : 'Try adjusting your search query or switching tabs.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/5">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/[0.02] text-zinc-400 border-b border-white/10 text-[10px] uppercase tracking-wider font-bold">
                        {activeTab === 'normalizable' && (
                          <th className="py-3 px-4 w-10">
                            <span className="sr-only">Select</span>
                          </th>
                        )}
                        <th className="py-3 px-4">Case ID</th>
                        <th className="py-3 px-4">User / Platform</th>
                        <th className="py-3 px-4">Original In Database</th>
                        <th className="py-3 px-4">Standardized (01XXXXXXXXX)</th>
                        <th className="py-3 px-4">Status & Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredItems.map(item => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <tr 
                            key={item.id} 
                            className={`transition-colors hover:bg-white/[0.02] ${
                              isSelected && activeTab === 'normalizable' ? 'bg-blue-600/[0.05]' : ''
                            }`}
                          >
                            {activeTab === 'normalizable' && (
                              <td className="py-3 px-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(item.id)}
                                  className="w-4 h-4 rounded text-blue-600 bg-white/5 border-white/20 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                />
                              </td>
                            )}

                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-white">{item.case_id}</span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-zinc-300 font-medium">{item.username}</div>
                              <div className="text-[10px] text-zinc-500 uppercase">{item.platform}</div>
                            </td>

                            <td className="py-3 px-4">
                              {item.original_phone ? (
                                <span className="font-mono text-zinc-300 px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">
                                  {item.original_phone}
                                </span>
                              ) : (
                                <span className="text-zinc-500 italic">null (empty)</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {item.normalized_phone ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    {item.normalized_phone}
                                  </span>
                                  {item.operatorName && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                      {item.operatorName}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-rose-400 font-mono text-xs">N/A</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.state === 'canonical' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                    : item.state === 'normalizable'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {item.state === 'canonical' ? 'Canonical' : item.state === 'normalizable' ? 'Fixable' : 'Invalid'}
                                </span>
                                <span className="text-[11px] text-zinc-400 truncate max-w-xs" title={item.reason}>
                                  {item.reason}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Action Bar */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>
              Safe Operation: Non-destructive, preserves case IDs, statuses, and notes. Original values are saved to audit history.
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-bold transition-colors"
            >
              Close
            </button>

            {activeTab === 'normalizable' && scanResult.normalizableCount > 0 && (
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={isApplying || selectedIds.size === 0}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>
                      Normalizing {progress ? `(${progress.completed}/${progress.total})` : '...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Apply Fix to {selectedIds.size} Records</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Modal Safeguard */}
        {showConfirmDialog && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111827] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <Sparkles size={24} />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-white">Confirm Bulk Phone Standardization</h3>
                <p className="text-xs text-zinc-300">
                  You are about to update <span className="font-bold text-blue-400">{selectedIds.size} records</span> to the canonical <span className="font-mono text-emerald-400 font-bold">01XXXXXXXXX</span> format.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-zinc-300 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Check size={14} />
                  <span>Audit Trail Created Automatically</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Check size={14} />
                  <span>Full Rollback Supported Anytime</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Check size={14} />
                  <span>All Other Case Fields Untouched</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyFix}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
                >
                  Yes, Apply Standardization
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
