import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'error': return <AlertCircle className="text-rose-500" size={20} />;
      case 'info': return <Info className="text-blue-500" size={20} />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success': return 'border-emerald-500/20';
      case 'error': return 'border-rose-500/20';
      case 'info': return 'border-blue-500/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl glass shadow-2xl border ${getBorderColor()}`}
    >
      {getIcon()}
      <span className="text-sm font-medium text-white">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors">
        <X size={14} className="text-zinc-500" />
      </button>
    </motion.div>
  );
}
