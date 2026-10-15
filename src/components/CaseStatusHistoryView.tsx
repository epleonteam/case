import React, { useState, useEffect, useMemo } from 'react';
import { Status, CaseStatusHistory, StatusLog } from '../types';
import { fetchCaseStatusHistory, formatDhakaDateTime } from '../lib/statusHistory';
import { 
  Clock, 
  ArrowRight, 
  User, 
  FileText, 
  Filter, 
  RotateCcw, 
  Calendar,
  List,
  GitCommit,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PhoneCall,
  PhoneOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CaseStatusHistoryViewProps {
  withdrawalId: string;
  caseId: string;
  fallbackLogs?: StatusLog[];
  refreshKey?: number;
}

export function getStatusBadgeStyle(status: Status | string | null | undefined) {
  switch (status) {
    case 'Approved':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Rejected':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Pending':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Hold':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'Contact':
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'Contact Fail':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
}

export default function CaseStatusHistoryView({
  withdrawalId,
  caseId,
  fallbackLogs = [],
  refreshKey = 0
}: CaseStatusHistoryViewProps) {
  const [history, setHistory] = useState<CaseStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransition, setSelectedTransition] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  // Load history from DB / fallback logs
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const { data } = await fetchCaseStatusHistory(withdrawalId, fallbackLogs, caseId);
      if (isMounted) {
        setHistory(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [withdrawalId, fallbackLogs, caseId, refreshKey]);

  // Extract all available transitions for dropdown
  const availableTransitions = useMemo(() => {
    const transitions = new Set<string>();
    history.forEach(item => {
      const from = item.previous_status || 'Initial';
      const to = item.new_status;
      transitions.add(`${from} → ${to}`);
    });
    return Array.from(transitions);
  }, [history]);

  // Filter history by transition and date range
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Transition filter
      if (selectedTransition !== 'All') {
        const trans = `${item.previous_status || 'Initial'} → ${item.new_status}`;
        if (trans !== selectedTransition) return false;
      }

      // Date range filter (using Asia/Dhaka day string)
      if (startDate || endDate) {
        try {
          const itemDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(item.changed_at));

          if (startDate && itemDate < startDate) return false;
          if (endDate && itemDate > endDate) return false;
        } catch {
          // Keep if date parsing fails
        }
      }

      return true;
    });
  }, [history, selectedTransition, startDate, endDate]);

  const hasActiveFilters = selectedTransition !== 'All' || Boolean(startDate) || Boolean(endDate);

  const resetFilters = () => {
    setSelectedTransition('All');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Status Change History
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-zinc-300">
            {history.length}
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              viewMode === 'timeline' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              viewMode === 'table' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Filter Controls (Collapsible / Compact) */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-semibold">
            <Filter size={12} />
            <span>Filter History</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold transition-colors"
            >
              <RotateCcw size={10} />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Transition selector */}
          <div>
            <select
              value={selectedTransition}
              onChange={(e) => setSelectedTransition(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Transitions ({history.length})</option>
              {availableTransitions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start date"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              title="From date in Asia/Dhaka"
            />
          </div>

          {/* Date Range: End */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              title="To date in Asia/Dhaka"
            />
          </div>
        </div>
      </div>

      {/* History Content */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading status history...</span>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-white/[0.01] border border-white/5 text-center flex flex-col items-center gap-2">
          <AlertCircle size={24} className="text-zinc-600" />
          <p className="text-xs font-medium text-zinc-400">
            {history.length === 0 
              ? 'No status changes recorded yet for this case' 
              : 'No changes match your selected filters'}
          </p>
          <p className="text-[11px] text-zinc-500 max-w-xs">
            {history.length === 0 
              ? 'Future status updates will be tracked automatically with exact timestamp, transition, and note.' 
              : 'Try clearing the transition or date filters to see all recorded entries.'}
          </p>
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="relative pl-4 space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[2px] before:bg-white/10">
          {filteredHistory.map((entry, idx) => (
            <motion.div
              key={entry.id || idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              className="relative pl-6 group"
            >
              {/* Dot indicator */}
              <div className="absolute -left-[5px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#111827] border-2 border-blue-500 z-10 group-hover:scale-125 transition-transform" />

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors space-y-2">
                {/* Transition pills */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(entry.previous_status)}`}>
                    {entry.previous_status || 'Initial'}
                  </span>
                  <ArrowRight size={12} className="text-zinc-500 shrink-0" />
                  <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(entry.new_status)}`}>
                    {entry.new_status}
                  </span>
                </div>

                {/* Metadata: Time & User */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-2 pt-1 border-t border-white/[0.04]">
                  <span className="font-mono text-zinc-300">
                    {formatDhakaDateTime(entry.changed_at)}
                  </span>
                  <span className="flex items-center gap-1 text-zinc-400 text-[10px]">
                    <User size={10} className="text-zinc-500" />
                    <span>{entry.changed_by || 'Admin'}</span>
                  </span>
                </div>

                {/* Optional Note */}
                {entry.note && (
                  <div className="mt-1.5 p-2 rounded-xl bg-black/30 border border-white/5 text-[11px] text-zinc-300 flex items-start gap-1.5 leading-relaxed">
                    <FileText size={12} className="text-blue-400 shrink-0 mt-0.5" />
                    <span>{entry.note}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto custom-scrollbar border border-white/5 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-400 font-bold bg-white/[0.02]">
                <th className="py-2.5 px-3">Transition</th>
                <th className="py-2.5 px-3">Date & Time (Dhaka)</th>
                <th className="py-2.5 px-3">Changed By</th>
                <th className="py-2.5 px-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-[11px]">
              {filteredHistory.map((entry, idx) => (
                <tr key={entry.id || idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getStatusBadgeStyle(entry.previous_status)}`}>
                        {entry.previous_status || 'Initial'}
                      </span>
                      <ArrowRight size={10} className="text-zinc-500" />
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getStatusBadgeStyle(entry.new_status)}`}>
                        {entry.new_status}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-300 whitespace-nowrap">
                    {formatDhakaDateTime(entry.changed_at)}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                    {entry.changed_by || 'Admin'}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-300 max-w-xs truncate">
                    {entry.note || <span className="text-zinc-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
