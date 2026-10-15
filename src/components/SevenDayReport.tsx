import React, { useState, useMemo } from 'react';
import { WithdrawalCase, Status } from '../types';
import { 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  Download, 
  RefreshCw, 
  PhoneCall,
  PhoneOff,
  DollarSign,
  Filter,
  Search,
  Layers,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface ReportSectionProps {
  cases: WithdrawalCase[];
  loading?: boolean;
  onBackToOverview: () => void;
  onSelectCase?: (c: WithdrawalCase) => void;
  onRefresh?: () => void;
}

export type DateFilterOption = 
  | 'Today'
  | 'Yesterday'
  | 'Last 7 Days'
  | 'This Month'
  | 'Last Month'
  | 'This Year'
  | 'Last Year'
  | 'Custom Date Range';

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

/**
 * Helper to get year, month (1-12), day in Asia/Dhaka.
 */
function getDhakaParts(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(d);
  const year = Number(parts.find(p => p.type === 'year')?.value || 2026);
  const month = Number(parts.find(p => p.type === 'month')?.value || 1);
  const day = Number(parts.find(p => p.type === 'day')?.value || 1);
  return { year, month, day };
}

function formatDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function SevenDayReport({
  cases,
  loading = false,
  onBackToOverview,
  onSelectCase,
  onRefresh
}: ReportSectionProps) {
  // Date filter state
  const [selectedFilter, setSelectedFilter] = useState<DateFilterOption>('Last 7 Days');
  
  // Custom date range state (defaults to today in Dhaka)
  const todayParts = useMemo(() => getDhakaParts(new Date()), []);
  const todayString = useMemo(() => formatDateStr(todayParts.year, todayParts.month, todayParts.day), [todayParts]);
  
  const [customStartDate, setCustomStartDate] = useState<string>(todayString);
  const [customEndDate, setCustomEndDate] = useState<string>(todayString);
  const [tableSearch, setTableSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<Status | 'All'>('All');

  // Compute active date range bounds [startDate, endDate] in Asia/Dhaka
  const { startDate, endDate, dateRangeLabel } = useMemo(() => {
    const { year, month, day } = todayParts;
    const today = formatDateStr(year, month, day);

    switch (selectedFilter) {
      case 'Today': {
        return {
          startDate: today,
          endDate: today,
          dateRangeLabel: `Today (${today})`
        };
      }
      case 'Yesterday': {
        const yestDate = new Date(Date.UTC(year, month - 1, day - 1, 12));
        const yestParts = getDhakaParts(yestDate);
        const yestStr = formatDateStr(yestParts.year, yestParts.month, yestParts.day);
        return {
          startDate: yestStr,
          endDate: yestStr,
          dateRangeLabel: `Yesterday (${yestStr})`
        };
      }
      case 'Last 7 Days': {
        const l7Date = new Date(Date.UTC(year, month - 1, day - 6, 12));
        const l7Parts = getDhakaParts(l7Date);
        const l7Start = formatDateStr(l7Parts.year, l7Parts.month, l7Parts.day);
        return {
          startDate: l7Start,
          endDate: today,
          dateRangeLabel: `Last 7 Days (${l7Start} to ${today})`
        };
      }
      case 'This Month': {
        const start = formatDateStr(year, month, 1);
        const monthName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', month: 'short' }).format(new Date());
        return {
          startDate: start,
          endDate: today,
          dateRangeLabel: `This Month (${monthName} ${year}: ${start} to ${today})`
        };
      }
      case 'Last Month': {
        const prevMonthDate = new Date(Date.UTC(year, month - 2, 1, 12));
        const prevMonthParts = getDhakaParts(prevMonthDate);
        const lastDayOfPrevMonth = new Date(Date.UTC(year, month - 1, 0, 12)).getUTCDate();
        const start = formatDateStr(prevMonthParts.year, prevMonthParts.month, 1);
        const end = formatDateStr(prevMonthParts.year, prevMonthParts.month, lastDayOfPrevMonth);
        const prevMonthName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', month: 'short' }).format(prevMonthDate);
        return {
          startDate: start,
          endDate: end,
          dateRangeLabel: `Last Month (${prevMonthName} ${prevMonthParts.year}: ${start} to ${end})`
        };
      }
      case 'This Year': {
        const start = formatDateStr(year, 1, 1);
        return {
          startDate: start,
          endDate: today,
          dateRangeLabel: `This Year (${year}: ${start} to ${today})`
        };
      }
      case 'Last Year': {
        const start = formatDateStr(year - 1, 1, 1);
        const end = formatDateStr(year - 1, 12, 31);
        return {
          startDate: start,
          endDate: end,
          dateRangeLabel: `Last Year (${year - 1}: ${start} to ${end})`
        };
      }
      case 'Custom Date Range': {
        const s = customStartDate || today;
        const e = customEndDate || today;
        const sortedStart = s <= e ? s : e;
        const sortedEnd = s <= e ? e : s;
        return {
          startDate: sortedStart,
          endDate: sortedEnd,
          dateRangeLabel: `Custom Range (${sortedStart} to ${sortedEnd})`
        };
      }
      default:
        return {
          startDate: today,
          endDate: today,
          dateRangeLabel: today
        };
    }
  }, [selectedFilter, customStartDate, customEndDate, todayParts]);

  // Filter cases strictly by the selected date range in Asia/Dhaka
  const matchingCases = useMemo(() => {
    const safeCases = Array.isArray(cases) ? cases : [];
    return safeCases.filter(c => {
      if (!c?.created_at) return false;
      const caseDate = getDhakaDateString(c.created_at);
      if (!caseDate) return false;
      return caseDate >= startDate && caseDate <= endDate;
    });
  }, [cases, startDate, endDate]);

  // Exact Report Summary Metrics:
  // - Total Cases
  // - Rejected Cases
  // - Approved Cases
  // - Pending Cases
  // - Hold Cases
  // - Contact Cases
  // - Contact Fail Cases
  // - Total Amount
  const summary = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;

    let rejectedCount = 0;
    let rejectedAmount = 0;

    let approvedCount = 0;
    let approvedAmount = 0;

    let pendingCount = 0;
    let pendingAmount = 0;

    let holdCount = 0;
    let holdAmount = 0;

    let contactCount = 0;
    let contactAmount = 0;

    let contactFailCount = 0;
    let contactFailAmount = 0;

    for (const c of matchingCases) {
      totalCount += 1;
      const val = Math.abs(Number(c.amount) || 0);
      totalAmount += val;

      switch (c.status) {
        case 'Approved':
          approvedCount += 1;
          approvedAmount += val;
          break;
        case 'Rejected':
          rejectedCount += 1;
          rejectedAmount += val;
          break;
        case 'Pending':
          pendingCount += 1;
          pendingAmount += val;
          break;
        case 'Hold':
          holdCount += 1;
          holdAmount += val;
          break;
        case 'Contact':
          contactCount += 1;
          contactAmount += val;
          break;
        case 'Contact Fail':
          contactFailCount += 1;
          contactFailAmount += val;
          break;
        default:
          break;
      }
    }

    return {
      totalCases: totalCount,
      totalAmount,
      rejectedCases: rejectedCount,
      rejectedAmount,
      approvedCases: approvedCount,
      approvedAmount,
      pendingCases: pendingCount,
      pendingAmount,
      holdCases: holdCount,
      holdAmount,
      contactCases: contactCount,
      contactAmount,
      contactFailCases: contactFailCount,
      contactFailAmount
    };
  }, [matchingCases]);

  // Cases filtered for table display (with optional sub-filter)
  const displayCases = useMemo(() => {
    return matchingCases.filter(c => {
      if (selectedStatusFilter !== 'All' && c.status !== selectedStatusFilter) {
        return false;
      }
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        c.case_id?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.platform?.toLowerCase().includes(q) ||
        c.phone_number?.toLowerCase().includes(q)
      );
    });
  }, [matchingCases, selectedStatusFilter, tableSearch]);

  // Export report to CSV
  const handleExportCSV = () => {
    const headers = ['Case ID', 'Username', 'Platform', 'Amount (BDT)', 'Status', 'Created Date (Asia/Dhaka)'];
    const rows = matchingCases.map(c => [
      c.case_id,
      c.username,
      c.platform,
      Math.abs(Number(c.amount) || 0),
      c.status,
      getDhakaDateString(c.created_at)
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `case_report_${startDate}_to_${endDate}.csv`);
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
      transition={{ duration: 0.25 }}
      className="space-y-6 md:space-y-8"
    >
      {/* Top Action Bar & Filter Controls */}
      <div className="glass rounded-3xl p-5 md:p-6 border border-white/5 bg-[#111827] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Back button & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToOverview}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all duration-200 flex items-center gap-2 text-xs font-semibold shrink-0"
              title="Return to Cases Dashboard"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <FileText size={20} className="text-blue-500" />
                Case Report Summary
              </h2>
              <div className="flex items-center gap-2 text-[10px] md:text-xs text-zinc-400 mt-0.5">
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono font-bold">
                  Asia/Dhaka (GMT+6)
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-300 font-medium">{dateRangeLabel}</span>
              </div>
            </div>
          </div>

          {/* Date Filter Dropdown & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Customizable Date Range Dropdown */}
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2">
              <Calendar size={15} className="text-zinc-400" />
              <span className="text-xs text-zinc-400 font-medium">Filter:</span>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as DateFilterOption)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
              >
                <option value="Today" className="bg-[#111827] text-white">Today</option>
                <option value="Yesterday" className="bg-[#111827] text-white">Yesterday</option>
                <option value="Last 7 Days" className="bg-[#111827] text-white">Last 7 Days</option>
                <option value="This Month" className="bg-[#111827] text-white">This Month</option>
                <option value="Last Month" className="bg-[#111827] text-white">Last Month</option>
                <option value="This Year" className="bg-[#111827] text-white">This Year</option>
                <option value="Last Year" className="bg-[#111827] text-white">Last Year</option>
                <option value="Custom Date Range" className="bg-[#111827] text-white">Custom Date Range</option>
              </select>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                title="Refresh Report Data"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : ''} />
              </button>
            )}

            <button
              onClick={handleExportCSV}
              disabled={matchingCases.length === 0}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all duration-200"
              title="Download CSV for this date range"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Custom Date Pickers (Shown only when 'Custom Date Range' is selected) */}
        {selectedFilter === 'Custom Date Range' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t border-white/5 flex flex-wrap items-center gap-4"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Start Date:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">End Date:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>

            <span className="text-[11px] text-zinc-500 italic">
              All dates are evaluated in Bangladesh Standard Time (Asia/Dhaka).
            </span>
          </motion.div>
        )}
      </div>

      {/* 
        REPORT SUMMARY: Exactly the 8 required statistics
        1. Total Cases
        2. Rejected Cases
        3. Approved Cases
        4. Pending Cases
        5. Hold Cases
        6. Contact Cases
        7. Contact Fail Cases
        8. Total Amount
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* 1. Total Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Cases</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{summary.totalCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Value: <span className="text-zinc-200 font-bold">৳{summary.totalAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 2. Rejected Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-rose-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Rejected Cases</span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400">{summary.rejectedCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Amount: <span className="text-rose-300 font-bold">৳{summary.rejectedAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 3. Approved Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Approved Cases</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">{summary.approvedCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Amount: <span className="text-emerald-300 font-bold">৳{summary.approvedAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 4. Pending Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pending Cases</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400">{summary.pendingCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Amount: <span className="text-amber-300 font-bold">৳{summary.pendingAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 5. Hold Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-orange-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Hold Cases</span>
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-orange-400">{summary.holdCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Amount: <span className="text-orange-300 font-bold">৳{summary.holdAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 6. Contact Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-sky-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Contact Cases</span>
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <PhoneCall size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-sky-400">{summary.contactCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Amount: <span className="text-sky-300 font-bold">৳{summary.contactAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 7. Contact Fail Cases */}
        <div className="glass rounded-2xl p-5 border border-white/10 bg-[#111827] relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Contact Fail Cases</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <PhoneOff size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-400">{summary.contactFailCases}</span>
            <span className="text-xs text-zinc-400">cases</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Amount: <span className="text-purple-300 font-bold">৳{summary.contactFailAmount.toLocaleString()}</span>
          </p>
        </div>

        {/* 8. Total Amount */}
        <div className="glass rounded-2xl p-5 border border-indigo-500/30 bg-gradient-to-br from-[#111827] to-[#1E1B4B]/40 relative overflow-hidden group hover:border-indigo-500/60 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Total Amount</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-black text-indigo-400 font-mono">৳{summary.totalAmount.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">
            Across <span className="text-white font-bold">{summary.totalCases}</span> total cases in range
          </p>
        </div>
      </div>

      {/* Cases List for Selected Date Range */}
      <div className="glass rounded-3xl p-5 md:p-8 border border-white/5 bg-[#111827] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Cases in Selected Date Range</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                {displayCases.length}
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Filtered by {dateRangeLabel}
            </p>
          </div>

          {/* Search & Status Filter inside Range */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input
                type="text"
                placeholder="Search in range..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-blue-500/50 text-white"
              />
            </div>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as Status | 'All')}
              className="bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#111827]">All Statuses</option>
              <option value="Approved" className="bg-[#111827]">Approved</option>
              <option value="Pending" className="bg-[#111827]">Pending</option>
              <option value="Rejected" className="bg-[#111827]">Rejected</option>
              <option value="Hold" className="bg-[#111827]">Hold</option>
              <option value="Contact" className="bg-[#111827]">Contact</option>
              <option value="Contact Fail" className="bg-[#111827]">Contact Fail</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {displayCases.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-400 font-bold bg-white/[0.01]">
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created (Dhaka)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] text-xs">
                {displayCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase && onSelectCase(c)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">{c.case_id}</td>
                    <td className="py-3 px-4 font-medium text-white">{c.username}</td>
                    <td className="py-3 px-4 text-zinc-400 uppercase text-[10px] font-bold">{c.platform}</td>
                    <td className="py-3 px-4 font-bold text-white font-mono">৳{Math.abs(Number(c.amount) || 0).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        c.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        c.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        c.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        c.status === 'Hold' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        c.status === 'Contact' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                        'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 text-[11px]">
                      {new Date(c.created_at).toLocaleString('en-GB', {
                        timeZone: 'Asia/Dhaka',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-400 font-semibold hover:underline">
                      View Details →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500 flex flex-col items-center gap-2">
            <AlertCircle size={32} strokeWidth={1.5} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">No cases found for the selected date range</p>
            <p className="text-xs text-zinc-500">
              Try selecting another range (e.g. "Last 7 Days", "This Month", or custom dates)
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
