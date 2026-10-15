import React, { useState } from 'react';
import { WithdrawalCase, Status } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Eye, 
  EyeOff, 
  Zap, 
  Phone, 
  CreditCard, 
  Clock, 
  Calendar,
  Trash2,
  CheckCircle2,
  AlertCircle,
  StickyNote,
  Save,
  Loader2,
  Edit3,
  ChevronLeft,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PLATFORMS, PAYMENT_METHODS } from '../constants';

interface CaseModalProps {
  caseData: WithdrawalCase;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CaseModal({ caseData, onClose, onUpdate }: CaseModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(caseData.status);
  const [notes, setNotes] = useState(caseData.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackNote, setCallbackNote] = useState('');
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    username: caseData.username,
    user_password: caseData.user_password,
    platform: caseData.platform,
    phone_number: caseData.phone_number,
    amount: caseData.amount,
    case_id: caseData.case_id,
    payment_method: caseData.payment_method,
    created_at: caseData.created_at
  });
  const [isCustomPlatform, setIsCustomPlatform] = useState(!PLATFORMS.includes(caseData.platform));
  const [isCustomPayment, setIsCustomPayment] = useState(!PAYMENT_METHODS.some(m => m.toLowerCase() === caseData.payment_method?.toLowerCase()));

  const handleUpdateStatus = async (newStatus: Status) => {
    setLoading(true);
    const newLog = {
      id: crypto.randomUUID(),
      message: `Status changed to ${newStatus}`,
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Dhaka'
      }).replace(',', '')
    };

    const { error } = await supabase
      .from('withdrawals')
      .update({ 
        status: newStatus,
        status_logs: [newLog, ...caseData.status_logs]
      })
      .eq('id', caseData.id);

    if (!error) {
      setStatus(newStatus);
      onUpdate();
    }
    setLoading(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Dhaka'
    });
    
    // Check if the note already has a timestamp, if not append it
    const noteWithTimestamp = notes.includes(timestamp) ? notes : `${notes} (${timestamp})`;

    const { error } = await supabase
      .from('withdrawals')
      .update({ notes: noteWithTimestamp })
      .eq('id', caseData.id);

    if (!error) {
      setNotes(noteWithTimestamp);
      onUpdate();
    }
    setSavingNotes(false);
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('withdrawals')
      .update({
        username: editData.username,
        user_password: editData.user_password,
        platform: editData.platform,
        phone_number: editData.phone_number,
        amount: Number(editData.amount),
        case_id: editData.case_id,
        payment_method: editData.payment_method,
        created_at: editData.created_at
      })
      .eq('id', caseData.id);

    if (!error) {
      setIsEditing(false);
      onUpdate();
    } else {
      alert('Error updating case: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this case?')) return;
    setLoading(true);
    const { error } = await supabase
      .from('withdrawals')
      .delete()
      .eq('id', caseData.id);

    if (!error) {
      onClose();
      onUpdate();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl glass rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={onClose}
                className="p-2 -ml-2 text-zinc-500 hover:text-white transition-colors md:hidden"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-600/20">
                <Zap className="text-blue-500 fill-blue-500" size={20} md:size={24} />
              </div>
              <div>
                {isEditing ? (
                  <input 
                    type="text"
                    value={editData.case_id}
                    onChange={(e) => setEditData({...editData, case_id: e.target.value})}
                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-lg md:text-xl font-bold tracking-tight outline-none focus:border-blue-500 text-white"
                  />
                ) : (
                  <h3 className="text-lg md:text-xl font-bold tracking-tight text-white data-value">{caseData.case_id}</h3>
                )}
                <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                  <Calendar size={10} md:size={12} />
                  <span>Created {new Date(caseData.created_at).toLocaleString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true,
                    timeZone: 'Asia/Dhaka'
                  })}</span>
                </div>
              </div>
            </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-full transition-colors ${isEditing ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:bg-white/10 hover:text-white'}`}
              title={isEditing ? "Cancel Editing" : "Edit Case"}
            >
              <Edit3 size={20} />
            </button>
            <button 
              onClick={handleDelete}
              className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-full transition-colors"
            >
              <Trash2 size={20} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} className="text-zinc-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Details */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {isEditing ? (
                <>
                  <EditDetailItem 
                    label="Username" 
                    value={editData.username} 
                    onChange={(val) => setEditData({...editData, username: val})}
                    icon={<User size={14} />} 
                  />
                  <EditDetailItem 
                    label="Password" 
                    value={editData.user_password} 
                    onChange={(val) => setEditData({...editData, user_password: val})}
                    icon={<Eye size={14} />} 
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <Zap size={14} />
                      <span>Platform</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={isCustomPlatform ? 'OTHER' : editData.platform}
                        onChange={(e) => {
                          if (e.target.value === 'OTHER') {
                            setIsCustomPlatform(true);
                            setEditData({...editData, platform: ''});
                          } else {
                            setIsCustomPlatform(false);
                            setEditData({...editData, platform: e.target.value});
                          }
                        }}
                        className="bg-zinc-900 border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
                      >
                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="OTHER">OTHER (Type Manually)</option>
                      </select>
                      {isCustomPlatform && (
                        <input 
                          type="text"
                          value={editData.platform}
                          onChange={(e) => setEditData({...editData, platform: e.target.value})}
                          placeholder="Type platform name..."
                          className="bg-zinc-900 border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  </div>
                  <EditDetailItem 
                    label="Phone Number" 
                    value={editData.phone_number} 
                    onChange={(val) => {
                      let cleaned = val.replace(/\D/g, '');
                      if (cleaned.startsWith('880')) {
                        cleaned = cleaned.slice(3);
                      }
                      if (cleaned.length === 10 && cleaned.startsWith('1')) {
                        cleaned = '0' + cleaned;
                      }
                      setEditData({...editData, phone_number: cleaned});
                    }}
                    icon={<Phone size={14} />} 
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <CreditCard size={14} />
                      <span>Payment Method</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={isCustomPayment ? 'OTHER' : PAYMENT_METHODS.find(m => m.toLowerCase() === editData.payment_method?.toLowerCase()) || ''}
                        onChange={(e) => {
                          if (e.target.value === 'OTHER') {
                            setIsCustomPayment(true);
                            setEditData({...editData, payment_method: ''});
                          } else {
                            setIsCustomPayment(false);
                            setEditData({...editData, payment_method: e.target.value.toLowerCase()});
                          }
                        }}
                        className="bg-zinc-900 border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
                      >
                        <option value="">Select Method</option>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value="OTHER">OTHER (Type Manually)</option>
                      </select>
                      {isCustomPayment && (
                        <input 
                          type="text"
                          value={editData.payment_method}
                          onChange={(e) => setEditData({...editData, payment_method: e.target.value})}
                          placeholder="Type payment method..."
                          className="bg-zinc-900 border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  </div>
                  <EditDetailItem 
                    label="Amount" 
                    value={editData.amount.toString()} 
                    onChange={(val) => setEditData({...editData, amount: Number(val) || 0})}
                    icon={<CreditCard size={14} />} 
                    type="number"
                  />
                  <EditDetailItem 
                    label="Case Date & Time" 
                    value={(() => {
                      const date = new Date(editData.created_at);
                      return new Intl.DateTimeFormat('sv-SE', {
                        timeZone: 'Asia/Dhaka',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(date).replace(' ', 'T');
                    })()} 
                    onChange={(val) => setEditData({...editData, created_at: new Date(val).toISOString()})}
                    icon={<Calendar size={14} />} 
                    type="datetime-local"
                  />
                  <div className="flex items-end">
                    <button 
                      onClick={handleSaveChanges}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Changes</>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <DetailItem label="Username" value={caseData.username} icon={<User size={14} />} />
                  <DetailItem 
                    label="Password" 
                    value={showPassword ? caseData.user_password : '••••••••'} 
                    icon={<Eye size={14} />} 
                    action={
                      <button onClick={() => setShowPassword(!showPassword)} className="text-blue-500 hover:text-blue-400">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                  <DetailItem label="Platform" value={caseData.platform} icon={<Zap size={14} />} className="uppercase" />
                  <DetailItem 
                    label="Phone Number" 
                    value={caseData.phone_number} 
                    icon={<Phone size={14} />} 
                    action={
                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://wa.me/88${caseData.phone_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-600/20 text-emerald-500 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                          title="WhatsApp User"
                        >
                          <MessageCircle size={14} />
                        </a>
                        <a 
                          href={`tel:${caseData.phone_number}`}
                          className="p-1.5 bg-blue-600/20 text-blue-500 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                          title="Call User"
                        >
                          <Phone size={14} />
                        </a>
                      </div>
                    }
                  />
                  <DetailItem label="Payment Method" value={caseData.payment_method} icon={<CreditCard size={14} />} className="capitalize" />
                  <DetailItem label="Speed" value={caseData.withdrawal_speed} icon={<Zap size={14} />} />
                  <DetailItem label="Type" value={caseData.type} icon={<Zap size={14} />} />
                  <DetailItem 
                    label="Amount" 
                    value={`৳${caseData.amount?.toLocaleString() || '0'}`} 
                    icon={<CreditCard size={14} />} 
                    valueClassName={(caseData.amount || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}
                  />
                </>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Update Status</h4>
              <div className="flex flex-wrap gap-3">
                {(['Pending', 'Approved', 'Rejected', 'Contact', 'Contact Fail', 'Hold'] as Status[]).map((s) => (
                  <button 
                    key={s}
                    disabled={loading}
                    onClick={() => {
                      if (s === 'Hold') {
                        setCallbackModalOpen(true);
                      } else {
                        handleUpdateStatus(s);
                      }
                    }}
                    className={`flex-1 min-w-[30%] py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      status === s 
                        ? s === 'Pending' ? 'bg-amber-500/10 border-amber-500 text-amber-500' 
                        : s === 'Approved' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                        : s === 'Rejected' ? 'bg-rose-500/10 border-rose-500 text-rose-500'
                        : s === 'Contact' ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                        : s === 'Hold' ? 'bg-orange-500/10 border-orange-500 text-orange-500'
                        : 'bg-purple-500/10 border-purple-500 text-purple-500'
                        : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <StickyNote size={14} /> Case Notes
                </h4>
                {notes !== (caseData.notes || '') && (
                  <button 
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="text-[10px] font-bold uppercase tracking-widest text-blue-500 flex items-center gap-1 hover:text-blue-400 transition-colors"
                  >
                    {savingNotes ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                    Save Note
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { label: 'কল দিছি মোবাইল বন্দ', value: 'কল দিছি মোবাইল বন্দ' },
                  { label: 'দিবে নাহ', value: 'দিবে নাহ' },
                  { label: 'লাস্ট নাম্বার চাচ্ছে', value: 'লাস্ট নাম্বার চাচ্ছে' }
                ].map((opt) => (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={opt.value}
                    onClick={() => setNotes(prev => prev ? `${prev}\n${opt.value}` : opt.value)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 rounded-lg border border-white/5 transition-colors"
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </div>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes about this case..."
                className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-xs min-h-[100px] focus:outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Clock size={14} /> Status Timeline
            </h4>
            <div className="relative space-y-8 timeline-line pl-4">
              {caseData.status_logs?.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                  key={log.id ? `log-${log.id}-${i}` : `log-idx-${i}`} 
                  className="relative pl-6"
                >
                  <div className="absolute left-[-13px] top-1.5 w-3 h-3 rounded-full bg-[#050505] border-2 border-blue-500 z-10"></div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-200">{log.message}</p>
                    <p className="text-xs text-zinc-500 data-value">
                      {(() => {
                        try {
                          const date = new Date(log.timestamp.replace(' ', 'T'));
                          if (isNaN(date.getTime())) return log.timestamp;
                          return date.toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'Asia/Dhaka'
                          }).replace(',', '');
                        } catch {
                          return log.timestamp;
                        }
                      })()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        {callbackModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#181818] border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-sm font-bold text-white">Schedule Callback</h3>
              <input type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white" />
              <input type="time" value={callbackTime} onChange={e => setCallbackTime(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white" />
              <textarea value={callbackNote} onChange={e => setCallbackNote(e.target.value)} placeholder="Note..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white" />
              <div className="flex gap-2">
                <button onClick={() => setCallbackModalOpen(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl text-xs font-bold uppercase text-white">Cancel</button>
                <button onClick={async () => {
                  if (!callbackDate || !callbackTime) return;
                  setLoading(true);
                  const callback_at = `${callbackDate}T${callbackTime}:00Z`;
                  const updateData = { status: 'Hold', hold_at: new Date().toISOString(), callback_at, callback_note: callbackNote };
                  const newLog = { id: crypto.randomUUID(), message: 'Status changed to Hold', timestamp: new Date().toLocaleString() };
                  await supabase.from('withdrawals').update({ ...updateData, status_logs: [newLog, ...caseData.status_logs] }).eq('id', caseData.id);
                  setStatus('Hold');
                  onUpdate();
                  setLoading(false);
                  setCallbackModalOpen(false);
                }} className="flex-1 py-3 bg-blue-600 rounded-xl text-xs font-bold uppercase text-white">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function DetailItem({ label, value, icon, className = '', valueClassName = '', action }: { label: string, value: string, icon: React.ReactNode, className?: string, valueClassName?: string, action?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center justify-between bg-white/[0.05] border border-white/10 rounded-xl p-3">
        <span className={`text-sm md:text-xs font-medium text-zinc-100 ${className} ${valueClassName}`}>{value}</span>
        {action}
      </div>
    </div>
  );
}

function EditDetailItem({ label, value, onChange, icon, type = 'text' }: { label: string, value: string, onChange: (val: string) => void, icon: React.ReactNode, type?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm md:text-xs text-white outline-none focus:border-blue-500 transition-all"
      />
    </div>
  );
}
