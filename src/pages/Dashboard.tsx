import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { WithdrawalCase, Status } from '../types';
import { 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  Zap, 
  MoreVertical,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Trash2,
  Sparkles,
  Activity,
  LayoutDashboard,
  Phone,
  MessageCircle,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StatsGrid from '../components/StatsGrid';
import CaseModal from '../components/CaseModal';
import Toast, { ToastType } from '../components/Toast';
import SevenDayReport from '../components/SevenDayReport';
import { searchCases, highlightText } from '../lib/search';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === '7day' ? '7day' : 'overview';

  const handleTabChange = (tab: 'overview' | '7day') => {
    if (tab === '7day') {
      setSearchParams({ tab: '7day' });
    } else {
      setSearchParams({});
    }
  };
  const [cases, setCases] = useState<WithdrawalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exactMatch, setExactMatch] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [selectedCase, setSelectedCase] = useState<WithdrawalCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setToast({ message: `Error: ${error.message}`, type: 'error' });
    } else {
      setCases(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Listen for case updates
    const handleCasesUpdated = () => {
      fetchData();
    };
    window.addEventListener('casesUpdated', handleCasesUpdated);
    return () => window.removeEventListener('casesUpdated', handleCasesUpdated);
  }, []);

  const filteredCases = useMemo(() => {
    let result = searchCases(cases, searchQuery, exactMatch);
    if (statusFilter !== 'All') {
      result = result.filter(c => c.status === statusFilter);
    }
    return result;
  }, [cases, searchQuery, exactMatch, statusFilter]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, exactMatch, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() !== '' && filteredCases.length === 0 && !loading) {
        setToast({ message: `No cases found for "${searchQuery}"`, type: 'error' });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, filteredCases.length, loading]);

  const stats = useMemo(() => {
    const safeCases = Array.isArray(cases) ? cases : [];
    return {
      total: safeCases.length,
      pending: safeCases.filter(c => c?.status === 'Pending').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      approved: safeCases.filter(c => c?.status === 'Approved').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      rejected: safeCases.filter(c => c?.status === 'Rejected').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      contact: safeCases.filter(c => c?.status === 'Contact').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      contactFail: safeCases.filter(c => c?.status === 'Contact Fail').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      hold: safeCases.filter(c => c?.status === 'Hold').length,
    };
  }, [cases]);

  const last7DaysSummary = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const safeCases = Array.isArray(cases) ? cases : [];
    const recentCases = safeCases.filter(c => c?.created_at && new Date(c.created_at) >= sevenDaysAgo);
    
    return {
      total: recentCases.length,
      approved: recentCases.filter(c => c?.status === 'Approved').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      pending: recentCases.filter(c => c?.status === 'Pending').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      rejected: recentCases.filter(c => c?.status === 'Rejected').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      contact: recentCases.filter(c => c?.status === 'Contact').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
      contactFail: recentCases.filter(c => c?.status === 'Contact Fail').reduce((acc, curr) => acc + Math.abs(Number(curr?.amount) || 0), 0),
    };
  }, [cases]);

  const exportToCSV = () => {
    const headers = ['Case ID', 'Username', 'Platform', 'Amount', 'Status', 'Date'];
    const rows = filteredCases.map(c => [
      c.case_id,
      c.username,
      c.platform,
      c.amount,
      c.status,
      new Date(c.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const fileNameDate = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).split(' ')[0];
    link.setAttribute("download", `withdrawals_${fileNameDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Data exported to CSV', type: 'success' });
  };

  const handleDeleteCase = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!id) {
      setToast({ message: 'Cannot delete: Missing ID', type: 'error' });
      return;
    }
    if (!confirm('Are you sure you want to delete this case?')) return;
    
    const { error } = await supabase
      .from('withdrawals')
      .delete()
      .eq('id', id);

    if (error) {
      setToast({ message: `Delete failed: ${error.message}`, type: 'error' });
    } else {
      setCases(prev => prev.filter(c => c.id !== id));
      setToast({ message: 'Case deleted successfully', type: 'success' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="p-3 md:p-6 lg:p-10 space-y-5 md:space-y-10 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">
            <LayoutDashboard size={12} /> Home / Dashboard
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter premium-gradient-text">Case Intelligence</h1>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            <p className="text-zinc-400 text-[10px] md:text-xs lg:text-sm font-medium">AI-powered case management & analytics</p>
          </div>
        </div>
        
        {activeTab === 'overview' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <div className="relative w-full lg:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search anything..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all duration-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-white/[0.03] p-1 rounded-2xl border border-white/10">
              <button 
                onClick={() => setExactMatch(!exactMatch)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                  exactMatch ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Exact
              </button>
              
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | 'All')}
                className="flex-1 sm:flex-none bg-transparent py-2 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 focus:outline-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Contact">Contact</option>
                <option value="Contact Fail">Contact Fail</option>
                <option value="Hold">Hold</option>
              </select>
            </div>

            <button 
              onClick={exportToCSV}
              className="flex p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-all duration-300 group items-center justify-center"
              title="Export to CSV"
            >
              <Download size={18} className="group-hover:scale-110 transition-transform duration-300" />
            </button>
          </div>
        )}
      </div>

      {/* Dashboard View Slider */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md">
        <div className="inline-flex p-1 bg-white/[0.04] border border-white/10 rounded-2xl relative">
          <button
            onClick={() => handleTabChange('overview')}
            className={`relative px-4 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 z-10 ${
              activeTab === 'overview' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'overview' && (
              <motion.div
                layoutId="dashboard-slider-pill"
                className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/30"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <LayoutDashboard size={15} /> Overview & Cases
            </span>
          </button>

          <button
            onClick={() => handleTabChange('7day')}
            className={`relative px-4 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 z-10 ${
              activeTab === '7day' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === '7day' && (
              <motion.div
                layoutId="dashboard-slider-pill"
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <BarChart3 size={15} /> 7-Day Report
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/20 text-white">
                7D
              </span>
            </span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 hidden sm:flex items-center gap-2 px-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {activeTab === '7day' ? '7 Calendar Days in Asia/Dhaka' : `Live Database Sync • ${cases.length} total records`}
          </span>
        </div>
      </div>

      {activeTab === '7day' ? (
        <SevenDayReport
          cases={cases}
          loading={loading}
          onBackToOverview={() => handleTabChange('overview')}
          onSelectCase={(c) => setSelectedCase(c)}
          onRefresh={fetchData}
        />
      ) : (
        <>
          {/* Stats */}
          <StatsGrid {...stats} onFilterHold={() => setStatusFilter('Hold')} />

          {/* Table */}
          <div className="glass rounded-3xl overflow-hidden animate-slide-up border-white/[0.03]">
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <h2 className="text-lg md:text-xl font-bold tracking-tight">Active Cases</h2>
            <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
              {filteredCases.length} Results
            </div>
          </div>
          <button 
            onClick={fetchData} 
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-blue-500 transition-all duration-300"
          >
            <Zap size={20} className={loading ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto custom-scrollbar hidden md:block">
          <table className="w-full text-left border-collapse lg:min-w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="px-4 md:px-8 py-4 md:py-5 col-header hidden lg:table-cell">Case ID</th>
                <th className="px-4 md:px-8 py-4 md:py-5 col-header">User Information</th>
                <th className="px-4 md:px-8 py-4 md:py-5 col-header hidden sm:table-cell">Platform</th>
                <th className="px-4 md:px-8 py-4 md:py-5 col-header">Amount</th>
                <th className="px-4 md:px-8 py-4 md:py-5 col-header hidden md:table-cell">Status</th>
                {statusFilter === 'Hold' && <th className="px-4 md:px-8 py-4 md:py-5 col-header hidden md:table-cell">Callback</th>}
                <th className="px-4 md:px-8 py-4 md:py-5 col-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={statusFilter === 'Hold' ? 7 : 6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4 text-zinc-500">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm">Fetching records from Supabase...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedCases.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {paginatedCases.map((c, index) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      key={c.id ? `case-${c.id}-${index}` : `case-idx-${index}`} 
                      className="data-row cursor-pointer group"
                      onClick={() => setSelectedCase(c)}
                    >
                      <td className="px-4 md:px-8 py-4 md:py-5 hidden lg:table-cell">
                      <span className="data-value text-blue-400 font-bold">
                        {highlightText(c.case_id, searchQuery)}
                      </span>
                      <div className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest font-black">
                        {new Date(c.created_at).toLocaleString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true,
                          timeZone: 'Asia/Dhaka'
                        })}
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-5">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/[0.03] flex items-center justify-center text-[10px] md:text-xs font-black border border-white/10 group-hover:border-blue-500/30 transition-colors shrink-0">
                          {c.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm font-bold tracking-tight text-zinc-100 truncate">{highlightText(c.username, searchQuery)}</p>
                          <p className="text-[9px] md:text-[10px] text-zinc-400 font-mono tracking-tighter truncate">{highlightText(c.phone_number, searchQuery)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-5 hidden sm:table-cell">
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] px-2 md:px-3 py-1 md:py-1.5 bg-white/[0.03] rounded-lg border border-white/5 text-zinc-200">
                        {highlightText(c.platform, searchQuery)}
                      </span>
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-5">
                      <div className="flex flex-col">
                        <span className={`data-value font-black text-sm md:text-lg tracking-tighter ${
                          c.status === 'Pending' ? 'text-amber-500' : 
                          c.status === 'Approved' ? 'text-emerald-500' : 
                          c.status === 'Rejected' ? 'text-rose-500' :
                          c.status === 'Contact' ? 'text-blue-500' :
                          'text-purple-500'
                        }`}>
                          ৳{Math.abs(c.amount || 0).toLocaleString()}
                        </span>
                        <div className="md:hidden mt-1">
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-4 md:py-5 hidden md:table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                    {statusFilter === 'Hold' && (
                      <td className="px-4 md:px-8 py-4 md:py-5 hidden md:table-cell text-xs text-zinc-400">
                        {c.callback_at ? new Date(c.callback_at).toLocaleString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true,
                          timeZone: 'Asia/Dhaka'
                        }) : 'N/A'}
                      </td>
                    )}
                    <td className="px-4 md:px-8 py-4 md:py-5 text-right">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        <a 
                          href={`https://wa.me/88${c.phone_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 md:p-2.5 hover:bg-emerald-500/10 text-zinc-600 hover:text-emerald-500 rounded-xl transition-all duration-300"
                          title="WhatsApp User"
                        >
                          <MessageCircle size={16} />
                        </a>
                        <a 
                          href={`tel:${c.phone_number}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 md:p-2.5 hover:bg-blue-500/10 text-zinc-600 hover:text-blue-500 rounded-xl transition-all duration-300"
                          title="Call User"
                        >
                          <Phone size={16} />
                        </a>
                        <button 
                          onClick={(e) => handleDeleteCase(e, c.id)}
                          className="hidden sm:flex p-2 md:p-2.5 hover:bg-rose-500/10 text-zinc-600 hover:text-rose-500 rounded-xl transition-all duration-300"
                          title="Delete Case"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                    </motion.tr>
                ))
              }
              </AnimatePresence>
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-zinc-600">
                      <AlertCircle size={48} strokeWidth={1} />
                      <p className="text-sm">No records found matching your search</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-white/[0.03]">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center gap-4 text-zinc-500">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm">Fetching records...</p>
              </div>
            </div>
          ) : paginatedCases.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {paginatedCases.map((c, index) => (
                <motion.div
                  key={c.id ? `card-${c.id}-${index}` : `card-idx-${index}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="p-4 space-y-4 active:bg-white/[0.02] transition-colors"
                  onClick={() => setSelectedCase(c)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-xs font-black border border-white/10 shrink-0">
                        {c.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-100 truncate">{highlightText(c.username, searchQuery)}</p>
                        <p className="text-[10px] text-zinc-400 font-mono truncate">{highlightText(c.phone_number, searchQuery)}</p>
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">
                        {new Date(c.created_at).toLocaleString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true,
                          timeZone: 'Asia/Dhaka'
                        })}
                      </div>
                      <p className={`text-lg font-black tracking-tighter ${
                        c.status === 'Pending' ? 'text-amber-500' : 
                        c.status === 'Approved' ? 'text-emerald-500' : 
                        c.status === 'Rejected' ? 'text-rose-500' :
                        c.status === 'Contact' ? 'text-blue-500' :
                        'text-purple-500'
                      }`}>
                        ৳{Math.abs(c.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <a 
                        href={`https://wa.me/88${c.phone_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl"
                      >
                        <MessageCircle size={18} />
                      </a>
                      <a 
                        href={`tel:${c.phone_number}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl"
                      >
                        <Phone size={18} />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="px-6 py-24 text-center">
              <div className="flex flex-col items-center gap-4 text-zinc-600">
                <AlertCircle size={48} strokeWidth={1} />
                <p className="text-sm">No records found matching your search</p>
              </div>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between bg-white/5">
            <p className="text-xs text-zinc-500">
              Showing {paginatedCases.length} of {filteredCases.length} results
            </p>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-xs font-bold uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      <AnimatePresence>
        {selectedCase && (
          <CaseModal 
            caseData={selectedCase} 
            onClose={() => setSelectedCase(null)} 
            onUpdate={() => {
              window.dispatchEvent(new CustomEvent('casesUpdated'));
              fetchData();
              setToast({ message: 'Case updated successfully', type: 'success' });
            }}
          />
        )}
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    Pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    Approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    Rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    Contact: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Contact Fail': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Hold: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
  };

  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
}
