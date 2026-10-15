import React, { useState, useMemo } from 'react';
import { WithdrawalCase } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  Download, 
  RefreshCw, 
  ChevronRight,
  Info,
  DollarSign,
  PhoneCall,
  PhoneOff,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SevenDayReportProps {
  cases: WithdrawalCase[];
  loading?: boolean;
  onBackToOverview: () => void;
  onSelectCase?: (c: WithdrawalCase) => void;
  onRefresh?: () => void;
}

export interface DayMetric {
  dateStr: string; // YYYY-MM-DD
  weekday: string; // Friday, Saturday, etc.
  shortDate: string; // Oct 09
  fullDate: string; // 09 Oct 2026
  isToday: boolean;
  casesCreated: number;
  totalValue: number;
  resolvedCount: number;
  resolvedValue: number;
  pendingCount: number;
  pendingValue: number;
  flaggedCount: number;
  flaggedValue: number;
  contactCount: number;
  contactFailCount: number;
  holdCount: number;
  callbackCount: number;
  dayCases: WithdrawalCase[];
}

/**
 * Returns YYYY-MM-DD string for a timestamp in the Asia/Dhaka timezone.
 */
export function getDhakaDateString(isoStringOrDate: string | Date): string {
  try {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return '';
  }
}

export default function SevenDayReport({
  cases,
  loading = false,
  onBackToOverview,
  onSelectCase,
  onRefresh
}: SevenDayReportProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6); // Default to today (last day)
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Generate the exact 7 calendar days in Asia/Dhaka timezone (today and previous 6 days)
  const reportDays: DayMetric[] = useMemo(() => {
    const now = new Date();
    const dhakaDateStr = getDhakaDateString(now);
    const [currY, currM, currD] = dhakaDateStr.split('-').map(Number);
    const safeCases = Array.isArray(cases) ? cases : [];

    const days: DayMetric[] = [];

    for (let i = 6; i >= 0; i--) {
      // Anchor at UTC noon to avoid any midnight boundary shifts
      const d = new Date(Date.UTC(currY, currM - 1, currD - i, 12, 0, 0));
      const dateStr = getDhakaDateString(d);
      const isToday = i === 0;

      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        weekday: 'long'
      }).format(d);

      const shortDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        month: 'short',
        day: '2-digit'
      }).format(d);

      const fullDate = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(d);

      // Filter cases created on this exact calendar day in Asia/Dhaka
      const matchingCases = safeCases.filter(c => {
        if (!c?.created_at) return false;
        return getDhakaDateString(c.created_at) === dateStr;
      });

      const totalValue = matchingCases.reduce((sum, c) => sum + Math.abs(Number(c?.amount) || 0), 0);
      
      const resolvedCases = matchingCases.filter(c => c?.status === 'Approved');
      const pendingCases = matchingCases.filter(c => c?.status === 'Pending');
      const flaggedCases = matchingCases.filter(c => c?.status === 'Rejected');
      const contactCases = matchingCases.filter(c => c?.status === 'Contact');
      const contactFailCases = matchingCases.filter(c => c?.status === 'Contact Fail');
      const holdCases = matchingCases.filter(c => c?.status === 'Hold');

      // Check callback cases scheduled or noted for this date
      const callbackCases = matchingCases.filter(c => {
        if (!c?.callback_at) return false;
        return getDhakaDateString(c.callback_at) === dateStr || c.status === 'Hold';
      });

      days.push({
        dateStr,
        weekday,
        shortDate,
        fullDate,
        isToday,
        casesCreated: matchingCases.length,
        totalValue,
        resolvedCount: resolvedCases.length,
        resolvedValue: resolvedCases.reduce((sum, c) => sum + Math.abs(Number(c?.amount) || 0), 0),
        pendingCount: pendingCases.length,
        pendingValue: pendingCases.reduce((sum, c) => sum + Math.abs(Number(c?.amount) || 0), 0),
        flaggedCount: flaggedCases.length,
        flaggedValue: flaggedCases.reduce((sum, c) => sum + Math.abs(Number(c?.amount) || 0), 0),
        contactCount: contactCases.length,
        contactFailCount: contactFailCases.length,
        holdCount: holdCases.length,
        callbackCount: callbackCases.length,
        dayCases: matchingCases
      });
    }

    return days;
  }, [cases]);

  // 7-day aggregate metrics
  const totals = useMemo(() => {
    const totalCreated = reportDays.reduce((acc, d) => acc + d.casesCreated, 0);
    const totalValue = reportDays.reduce((acc, d) => acc + d.totalValue, 0);
    const totalResolved = reportDays.reduce((acc, d) => acc + d.resolvedCount, 0);
    const totalResolvedValue = reportDays.reduce((acc, d) => acc + d.resolvedValue, 0);
    const totalPending = reportDays.reduce((acc, d) => acc + d.pendingCount, 0);
    const totalPendingValue = reportDays.reduce((acc, d) => acc + d.pendingValue, 0);
    const totalFlagged = reportDays.reduce((acc, d) => acc + d.flaggedCount, 0);
    const totalFlaggedValue = reportDays.reduce((acc, d) => acc + d.flaggedValue, 0);
    const totalHold = reportDays.reduce((acc, d) => acc + d.holdCount, 0);
    const totalCallbacks = reportDays.reduce((acc, d) => acc + d.callbackCount, 0);

    const resolutionRate = totalCreated > 0 ? Math.round((totalResolved / totalCreated) * 100) : 0;
    const avgDailyCases = (totalCreated / 7).toFixed(1);
    const peakDay = [...reportDays].sort((a, b) => b.casesCreated - a.casesCreated)[0];

    return {
      totalCreated,
      totalValue,
      totalResolved,
      totalResolvedValue,
      totalPending,
      totalPendingValue,
      totalFlagged,
      totalFlaggedValue,
      totalHold,
      totalCallbacks,
      resolutionRate,
      avgDailyCases,
      peakDay
    };
  }, [reportDays]);

  const activeDay = selectedDayIndex !== null ? reportDays[selectedDayIndex] : null;

  // Max value for scaling chart bars
  const maxCasesCount = Math.max(...reportDays.map(d => d.casesCreated), 5);
  const maxValueAmount = Math.max(...reportDays.map(d => d.totalValue), 1000);

  // Export 7-day daily breakdown to CSV
  const handleExport7DayReport = () => {
    const headers = [
      'Date (Asia/Dhaka)',
      'Weekday',
      'Cases Created',
      'Total Value (BDT)',
      'Resolved (Approved)',
      'Pending',
      'Flagged (Rejected)',
      'Contact',
      'Contact Fail',
      'Hold',
      'Callbacks'
    ];

    const rows = reportDays.map(d => [
      d.dateStr,
      d.weekday,
      d.casesCreated,
      d.totalValue,
      d.resolvedCount,
      d.pendingCount,
      d.flaggedCount,
      d.contactCount,
      d.contactFailCount,
      d.holdCount,
      d.callbackCount
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const today = reportDays[reportDays.length - 1]?.dateStr || '7day';
    link.setAttribute('download', `caseflow_7day_report_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOverview}
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all duration-200 flex items-center gap-2 text-xs font-semibold"
            title="Return to Cases Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
              Timezone: Asia/Dhaka (GMT+6)
            </span>
            <span className="text-xs text-zinc-400 hidden md:inline">
              {reportDays[0]?.fullDate} — {reportDays[6]?.fullDate}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>
          )}
          <button
            onClick={handleExport7DayReport}
            className="px-4 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all duration-200"
          >
            <Download size={15} />
            <span>Export 7-Day CSV</span>
          </button>
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="glass rounded-3xl p-6 md:p-8 border border-white/5 bg-gradient-to-br from-[#111827] via-[#0F172A] to-[#111827] relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <BarChart3 size={20} />
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                7-Day Executive Intelligence Report
              </h2>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Consolidated 7-calendar-day audit for Bangladesh Standard Time (<span className="text-zinc-200 font-medium">Asia/Dhaka</span>). 
              Daily creation and financial volume are tracked from exact historical timestamps, with outcome status breakdowns for each day.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                7-Day Resolution Rate
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-black text-emerald-400">
                  {totals.resolutionRate}%
                </span>
                <span className="text-xs text-zinc-400">
                  ({totals.totalResolved}/{totals.totalCreated})
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Created */}
        <div className="glass rounded-2xl p-5 border border-white/5 bg-[#111827] relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">7D Cases Created</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-white">{totals.totalCreated}</span>
            <span className="text-[11px] text-zinc-400 font-mono">avg {totals.avgDailyCases}/day</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Peak: <span className="text-zinc-200 font-semibold">{totals.peakDay.weekday} ({totals.peakDay.casesCreated} cases)</span>
          </p>
        </div>

        {/* Total Financial Value */}
        <div className="glass rounded-2xl p-5 border border-white/5 bg-[#111827] relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">7D Total Value</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-indigo-400">৳{totals.totalValue.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Resolved Value: <span className="text-emerald-400 font-medium">৳{totals.totalResolvedValue.toLocaleString()}</span>
          </p>
        </div>

        {/* Pending Cases */}
        <div className="glass rounded-2xl p-5 border border-white/5 bg-[#111827] relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">7D Pending Outcome</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-amber-400">{totals.totalPending}</span>
            <span className="text-xs text-zinc-400 font-mono">৳{totals.totalPendingValue.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Flagged Cases: <span className="text-rose-400 font-medium">{totals.totalFlagged}</span>
          </p>
        </div>

        {/* Hold & Callbacks */}
        <div className="glass rounded-2xl p-5 border border-white/5 bg-[#111827] relative overflow-hidden group hover:border-orange-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">7D Hold & Reminders</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-orange-400">{totals.totalHold}</span>
            <span className="text-xs text-zinc-400">cases on hold</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Scheduled Callbacks: <span className="text-zinc-200 font-medium">{totals.totalCallbacks}</span>
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Daily Cases Created & Volume */}
        <div className="glass rounded-3xl p-6 md:p-8 border border-white/5 bg-[#111827] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-400" />
                Daily Case Creation Volume
              </h3>
              <p className="text-xs text-zinc-400">Cases created each calendar day in Asia/Dhaka</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Cases
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Amount (৳)
              </span>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="relative pt-6 pb-2">
            <div className="h-56 flex items-end justify-between gap-2 md:gap-4 px-2 border-b border-white/10">
              {reportDays.map((day, idx) => {
                const heightPercent = maxCasesCount > 0 ? Math.max((day.casesCreated / maxCasesCount) * 100, 4) : 4;
                const isSelected = selectedDayIndex === idx;
                const isHovered = hoveredDayIndex === idx;

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => setSelectedDayIndex(idx)}
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    {/* Tooltip on Hover or Selection */}
                    {(isHovered || isSelected) && (
                      <div className="absolute -top-14 z-20 px-2.5 py-1.5 rounded-lg bg-[#1F2937] border border-white/15 text-[11px] shadow-xl whitespace-nowrap pointer-events-none transform -translate-y-1">
                        <div className="font-bold text-white">{day.weekday}, {day.shortDate}</div>
                        <div className="text-indigo-300 font-mono">
                          {day.casesCreated} cases • ৳{day.totalValue.toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Bar Label (Count) */}
                    <span className={`text-[10px] md:text-xs font-bold mb-1 transition-colors ${
                      isSelected ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-white'
                    }`}>
                      {day.casesCreated}
                    </span>

                    {/* Bar graphic */}
                    <div className="w-full max-w-[48px] bg-white/[0.04] rounded-t-lg overflow-hidden flex flex-col justify-end h-full">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.05 }}
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          isSelected 
                            ? 'bg-gradient-to-t from-indigo-600 to-blue-500 shadow-lg shadow-indigo-500/30' 
                            : 'bg-gradient-to-t from-indigo-900/60 to-indigo-600/70 group-hover:from-indigo-600 group-hover:to-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between gap-2 md:gap-4 px-2 mt-3">
              {reportDays.map((day, idx) => (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`flex-1 text-center transition-colors ${
                    selectedDayIndex === idx ? 'text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <p className="text-[10px] md:text-xs font-medium truncate">{day.shortDate}</p>
                  <p className="text-[9px] uppercase tracking-wider opacity-75 truncate">{day.isToday ? 'Today' : day.weekday.slice(0, 3)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Status Outcome Breakdown */}
        <div className="glass rounded-3xl p-6 md:p-8 border border-white/5 bg-[#111827] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                Daily Status Outcome
              </h3>
              <p className="text-xs text-zinc-400">Current status of cases created on each day</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[10px] md:text-xs">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Resolved
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Pending
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> Flagged
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-400" /> Hold
              </span>
            </div>
          </div>

          {/* Grouped Proportion Bars */}
          <div className="space-y-3 pt-2">
            {reportDays.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              const hasActivity = day.casesCreated > 0;
              const resWidth = hasActivity ? (day.resolvedCount / day.casesCreated) * 100 : 0;
              const pendWidth = hasActivity ? (day.pendingCount / day.casesCreated) * 100 : 0;
              const flagWidth = hasActivity ? (day.flaggedCount / day.casesCreated) * 100 : 0;
              const holdWidth = hasActivity ? (day.holdCount / day.casesCreated) * 100 : 0;

              return (
                <div
                  key={day.dateStr}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isSelected ? 'bg-white/[0.06] border border-indigo-500/40' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-zinc-300">
                      {day.weekday}, {day.shortDate} {day.isToday && <span className="text-[9px] text-blue-400 font-bold ml-1 uppercase">(Today)</span>}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {day.casesCreated} cases {hasActivity && `• ${Math.round(resWidth)}% resolved`}
                    </span>
                  </div>

                  {/* Proportional Multi-color Bar */}
                  <div className="h-3 w-full bg-white/[0.03] rounded-full overflow-hidden flex border border-white/5">
                    {hasActivity ? (
                      <>
                        <div style={{ width: `${resWidth}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Resolved: ${day.resolvedCount}`} />
                        <div style={{ width: `${pendWidth}%` }} className="h-full bg-amber-500 transition-all duration-300" title={`Pending: ${day.pendingCount}`} />
                        <div style={{ width: `${flagWidth}%` }} className="h-full bg-rose-500 transition-all duration-300" title={`Flagged: ${day.flaggedCount}`} />
                        <div style={{ width: `${holdWidth}%` }} className="h-full bg-orange-500 transition-all duration-300" title={`Hold: ${day.holdCount}`} />
                      </>
                    ) : (
                      <div className="w-full h-full bg-white/[0.02] flex items-center justify-center text-[9px] text-zinc-600">
                        No cases
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Deep Dive Panel */}
      {activeDay && (
        <div className="glass rounded-3xl p-6 md:p-8 border border-white/5 bg-[#111827] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-400" />
                <h3 className="text-lg font-bold text-white">
                  Day Inspector: {activeDay.weekday}, {activeDay.fullDate}
                </h3>
                {activeDay.isToday && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    TODAY
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Showing all {activeDay.casesCreated} cases created on this date
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Resolved: {activeDay.resolvedCount} (৳{activeDay.resolvedValue.toLocaleString()})
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Pending: {activeDay.pendingCount} (৳{activeDay.pendingValue.toLocaleString()})
              </span>
              {activeDay.holdCount > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  Hold: {activeDay.holdCount}
                </span>
              )}
            </div>
          </div>

          {/* Cases List for Selected Day */}
          {activeDay.dayCases.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Platform</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Time (Dhaka)</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] text-xs">
                  {activeDay.dayCases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCase && onSelectCase(c)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{c.case_id}</td>
                      <td className="py-3 px-4 font-medium text-white">{c.username}</td>
                      <td className="py-3 px-4 text-zinc-400 uppercase text-[10px] font-bold">{c.platform}</td>
                      <td className="py-3 px-4 font-bold text-white">৳{Math.abs(c.amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                          c.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          c.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          c.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          c.status === 'Hold' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-[11px]">
                        {new Date(c.created_at).toLocaleTimeString('en-US', {
                          timeZone: 'Asia/Dhaka',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-indigo-400 font-semibold hover:underline">
                        View Details →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 flex flex-col items-center gap-2">
              <AlertCircle size={32} strokeWidth={1.5} />
              <p className="text-sm">No cases were created on {activeDay.weekday}, {activeDay.fullDate}</p>
            </div>
          )}
        </div>
      )}

      {/* 7-Day Consolidated Audit Table */}
      <div className="glass rounded-3xl p-6 md:p-8 border border-white/5 bg-[#111827] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">7-Day Consolidated Calendar Ledger</h3>
            <p className="text-xs text-zinc-400">Daily verification across all 7 calendar days in Asia/Dhaka</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-400 font-bold bg-white/[0.01]">
                <th className="py-3.5 px-4">Date & Weekday</th>
                <th className="py-3.5 px-4">Cases Created</th>
                <th className="py-3.5 px-4">Total Value</th>
                <th className="py-3.5 px-4">Resolved</th>
                <th className="py-3.5 px-4">Pending</th>
                <th className="py-3.5 px-4">Flagged</th>
                <th className="py-3.5 px-4">Hold</th>
                <th className="py-3.5 px-4">Callbacks</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs">
              {reportDays.map((d, idx) => (
                <tr
                  key={d.dateStr}
                  className={`hover:bg-white/[0.02] transition-colors ${
                    selectedDayIndex === idx ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {d.fullDate} <span className="text-zinc-400 font-normal">({d.weekday})</span>
                    {d.isToday && <span className="ml-2 text-[9px] text-blue-400 font-bold uppercase">Today</span>}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-indigo-400">{d.casesCreated}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-white">৳{d.totalValue.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-medium">{d.resolvedCount}</td>
                  <td className="py-3.5 px-4 text-amber-400 font-medium">{d.pendingCount}</td>
                  <td className="py-3.5 px-4 text-rose-400 font-medium">{d.flaggedCount}</td>
                  <td className="py-3.5 px-4 text-orange-400 font-medium">{d.holdCount}</td>
                  <td className="py-3.5 px-4 text-zinc-400">{d.callbackCount}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedDayIndex(idx)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-[11px]"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 text-xs font-bold bg-white/[0.02]">
                <td className="py-4 px-4 text-zinc-300 uppercase tracking-wider">7-Day Total</td>
                <td className="py-4 px-4 text-indigo-400">{totals.totalCreated}</td>
                <td className="py-4 px-4 text-white">৳{totals.totalValue.toLocaleString()}</td>
                <td className="py-4 px-4 text-emerald-400">{totals.totalResolved}</td>
                <td className="py-4 px-4 text-amber-400">{totals.totalPending}</td>
                <td className="py-4 px-4 text-rose-400">{totals.totalFlagged}</td>
                <td className="py-4 px-4 text-orange-400">{totals.totalHold}</td>
                <td className="py-4 px-4 text-zinc-400">{totals.totalCallbacks}</td>
                <td className="py-4 px-4 text-right text-zinc-500">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Methodology & Data Integrity Disclaimer Note */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3 text-xs text-zinc-400">
        <Info size={18} className="text-zinc-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-zinc-300">Data Integrity & Calculation Methodology</p>
          <p className="text-[11px] leading-relaxed">
            Daily Created Cases and Daily Financial Volume (৳) are calculated based on each case's immutable <code>created_at</code> database timestamp grouped by calendar day in the <code>Asia/Dhaka</code> timezone.
            Status outcome figures (Resolved, Pending, Flagged, Hold) represent the current status of the records created on that respective date.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
