import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Clock, CheckCircle2, XCircle, ArrowUpRight, PhoneCall, PhoneOff, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface StatsProps {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  contact: number;
  contactFail: number;
  hold: number;
  onFilterHold?: () => void;
}

export default function StatsGrid({ total, pending, approved, rejected, contact, contactFail, hold, onFilterHold }: StatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      <StatCard label="Total Cases" value={total} icon={<LayoutDashboard size={20} />} color="blue" />
      <StatCard label="Pending Value" value={pending} icon={<Clock size={20} />} color="amber" />
      <StatCard label="Resolved Value" value={approved} icon={<CheckCircle2 size={20} />} color="emerald" />
      <StatCard label="Flagged Value" value={rejected} icon={<XCircle size={20} />} color="rose" />
      <StatCard label="Contact Value" value={contact} icon={<PhoneCall size={20} />} color="cyan" />
      <StatCard label="Contact Fail Value" value={contactFail} icon={<PhoneOff size={20} />} color="purple" />
      <StatCard label="Hold Cases" value={hold} icon={<AlertCircle size={20} />} color="orange" onClick={onFilterHold} />
    </div>
  );
}

function StatCard({ label, value, icon, color, onClick }: { label: string, value: number, icon: React.ReactNode, color: 'blue' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'purple' | 'orange', onClick?: () => void }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  const colors = {
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20'
  };

  const valueColors = {
    blue: 'text-[#F9FAFB]',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400'
  };

  const formatValue = (val: number) => {
    if (label.includes('Value')) {
      return `৳${Math.abs(val).toLocaleString()}`;
    }
    return val.toLocaleString();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      onClick={onClick}
      className={`glass p-5 md:p-6 rounded-3xl glass-hover relative overflow-hidden group min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Shimmer background on hover */}
      <div className="absolute inset-0 shimmer-effect opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10">
        <div className={`p-2.5 md:p-3 rounded-2xl border transition-all duration-500 group-hover:shadow-lg ${colors[color]}`}>
          {icon}
        </div>
        <div className="p-1.5 rounded-full bg-white/5 border border-white/5 text-[#9CA3AF] group-hover:text-[#F9FAFB] transition-colors">
          <ArrowUpRight size={14} />
        </div>
      </div>
      
      <div className="space-y-1.5 relative z-10">
        <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-[0.2em]">{label}</p>
        <p className={`text-2xl md:text-3xl font-black tracking-tighter data-value ${valueColors[color]}`}>
          {formatValue(displayValue)}
        </p>
        <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden mt-2">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className={`h-full ${color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'rose' ? 'bg-rose-500' : color === 'cyan' ? 'bg-cyan-500' : color === 'purple' ? 'bg-purple-500' : 'bg-orange-500'}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
