import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { parseRawWithdrawalText, normalizePhoneNumber } from '../lib/parser';
import { WithdrawalCase } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Save, Trash2, AlertCircle, CheckCircle2, Zap, User, Eye, Phone, CreditCard, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import Toast, { ToastType } from '../components/Toast';
import { PLATFORMS, PAYMENT_METHODS } from '../constants';
import { Type } from "@google/genai";
// Removed direct GoogleGenAI usage in favor of backend proxy


export default function Paste() {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<Partial<WithdrawalCase> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [notes, setNotes] = useState('');
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [isCustomPayment, setIsCustomPayment] = useState(false);
  const [isAiOptimizing, setIsAiOptimizing] = useState(false);

  const handleAiOptimize = async () => {
    if (!rawText.trim()) return;
    setIsAiOptimizing(true);
    setToast({ message: 'AI is analyzing your data...', type: 'info' });

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: `Extract case details from this text and return ONLY a JSON object.
          Fields: case_id, username, user_password, platform (Nagad/Bkash/Rocket/Other), payment_method, phone_number, withdrawal_speed (Fast/Normal), amount (number), type (Withdrawal).
          Text: ${rawText}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                case_id: { type: Type.STRING },
                username: { type: Type.STRING },
                user_password: { type: Type.STRING },
                platform: { type: Type.STRING },
                payment_method: { type: Type.STRING },
                phone_number: { type: Type.STRING },
                withdrawal_speed: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING }
              }
            }
          }
        })
      }).then(res => res.json());


      const data = JSON.parse(response.text || '{}');
      
      // Normalize phone number
      if (data.phone_number && typeof data.phone_number === 'string') {
        data.phone_number = normalizePhoneNumber(data.phone_number);
      }

      const formattedData: Partial<WithdrawalCase> = {
        ...data,
        created_at: new Date().toISOString(),
        status_logs: [{
          id: crypto.randomUUID(),
          message: 'Case optimized and formatted by AI Intelligence',
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
        }]
      };

      setParsedData(formattedData);
      setIsCustomPlatform(!PLATFORMS.includes(formattedData.platform || ''));
      setIsCustomPayment(!PAYMENT_METHODS.some(m => m.toLowerCase() === formattedData.payment_method?.toLowerCase()));
      setToast({ message: 'AI Optimization Complete', type: 'success' });
    } catch (err) {
      console.error('AI Optimization Error:', err);
      setToast({ message: 'AI Optimization failed. Falling back to manual parse.', type: 'error' });
      handleParse();
    } finally {
      setIsAiOptimizing(false);
    }
  };

  const handleParse = () => {
    if (!rawText.trim()) return;
    try {
      const data = parseRawWithdrawalText(rawText);
      if (!data.created_at) {
        data.created_at = new Date().toISOString();
      }
      setParsedData(data);
      setIsCustomPlatform(!PLATFORMS.includes(data.platform || ''));
      setIsCustomPayment(!PAYMENT_METHODS.some(m => m.toLowerCase() === data.payment_method?.toLowerCase()));
      setError(null);
      setToast({ message: 'Text parsed successfully', type: 'success' });
    } catch (err) {
      setError('Failed to parse text. Please check the format.');
      setToast({ message: 'Parsing failed', type: 'error' });
    }
  };

  const updateField = (field: keyof WithdrawalCase, value: any) => {
    if (!parsedData) return;
    let finalValue = value;
    if (field === 'phone_number' && typeof value === 'string') {
      finalValue = normalizePhoneNumber(value);
    }
    setParsedData({ ...parsedData, [field]: finalValue });
  };

  const handleSave = async () => {
    if (!parsedData) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from('withdrawals')
      .insert([
        {
          case_id: parsedData.case_id,
          username: parsedData.username,
          user_password: parsedData.user_password,
          platform: parsedData.platform,
          payment_method: parsedData.payment_method,
          phone_number: parsedData.phone_number,
          amount: parsedData.amount,
          status_logs: parsedData.status_logs,
          status: 'Pending',
          notes: notes,
          created_at: parsedData.created_at || new Date().toISOString()
        }
      ]);

    if (error) {
      if (error.code === '23505') {
        setError('A case with this ID already exists.');
        setToast({ message: 'Duplicate Case ID', type: 'error' });
      } else {
        setError(error.message);
        setToast({ message: `Error: ${error.message}`, type: 'error' });
      }
      setLoading(false);
    } else {
      setSuccess(true);
      setToast({ message: 'Case saved to Supabase', type: 'success' });
      window.dispatchEvent(new CustomEvent('casesUpdated'));
      setTimeout(() => navigate('/'), 1500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Case Entry</h1>
          <p className="text-slate-500">Add new cases to the system</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">Raw Text Input</h2>
            <textarea 
              className="w-full h-96 p-4 border rounded-lg font-mono text-sm"
              placeholder="Paste withdrawal log..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={handleAiOptimize} disabled={!rawText.trim() || isAiOptimizing} className="button-primary flex-1">
                {isAiOptimizing ? 'Analyzing...' : 'AI Optimize'}
              </button>
              <button onClick={handleParse} disabled={!rawText.trim() || isAiOptimizing} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-medium">
                Manual Parse
              </button>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {parsedData ? (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="glass rounded-3xl p-8 space-y-8 relative overflow-hidden"
              >
                <div className="absolute inset-0 shimmer-effect opacity-10 pointer-events-none"></div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2 relative z-10">
                  <CheckCircle2 size={16} /> Parsed Preview & Edit
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                  <EditPreviewItem 
                    label="Case ID" 
                    value={parsedData.case_id || ''} 
                    onChange={(val) => updateField('case_id', val)} 
                  />
                  <EditPreviewItem 
                    label="Username" 
                    value={parsedData.username || ''} 
                    onChange={(val) => updateField('username', val)} 
                  />
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Platform</p>
                    <select 
                      value={isCustomPlatform ? 'OTHER' : parsedData.platform}
                      onChange={(e) => {
                        if (e.target.value === 'OTHER') {
                          setIsCustomPlatform(true);
                          updateField('platform', '');
                        } else {
                          setIsCustomPlatform(false);
                          updateField('platform', e.target.value);
                        }
                      }}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                    >
                      {PLATFORMS.map(p => <option key={p} value={p} className="bg-[#0a0a0a]">{p}</option>)}
                      <option value="OTHER" className="bg-[#0a0a0a]">OTHER</option>
                    </select>
                    {isCustomPlatform && (
                      <input 
                        type="text"
                        value={parsedData.platform || ''}
                        onChange={(e) => updateField('platform', e.target.value)}
                        placeholder="Type platform..."
                        className="w-full mt-2 bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500/50 transition-all"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Payment Method</p>
                    <select 
                      value={isCustomPayment ? 'OTHER' : PAYMENT_METHODS.find(m => m.toLowerCase() === parsedData.payment_method?.toLowerCase()) || ''}
                      onChange={(e) => {
                        if (e.target.value === 'OTHER') {
                          setIsCustomPayment(true);
                          updateField('payment_method', '');
                        } else {
                          setIsCustomPayment(false);
                          updateField('payment_method', e.target.value.toLowerCase());
                        }
                      }}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                    >
                      <option value="" className="bg-[#0a0a0a]">Select Method</option>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-[#0a0a0a]">{m}</option>)}
                      <option value="OTHER" className="bg-[#0a0a0a]">OTHER</option>
                    </select>
                    {isCustomPayment && (
                      <input 
                        type="text"
                        value={parsedData.payment_method || ''}
                        onChange={(e) => updateField('payment_method', e.target.value)}
                        placeholder="Type method..."
                        className="w-full mt-2 bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-blue-500/50 transition-all"
                      />
                    )}
                  </div>
                  <EditPreviewItem 
                    label="Amount" 
                    value={parsedData.amount?.toString() || ''} 
                    onChange={(val) => updateField('amount', Number(val) || 0)} 
                    type="number"
                  />
                  <EditPreviewItem 
                    label="Phone" 
                    value={parsedData.phone_number || ''} 
                    onChange={(val) => updateField('phone_number', val)} 
                  />
                  <EditPreviewItem 
                    label="Password" 
                    value={parsedData.user_password || ''} 
                    onChange={(val) => updateField('user_password', val)} 
                  />
                  <EditPreviewItem 
                    label="Case Date & Time" 
                    value={(() => {
                      const date = parsedData.created_at ? new Date(parsedData.created_at) : new Date();
                      return new Intl.DateTimeFormat('sv-SE', {
                        timeZone: 'Asia/Dhaka',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(date).replace(' ', 'T');
                    })()} 
                    onChange={(val) => updateField('created_at', new Date(val).toISOString())} 
                    type="datetime-local"
                  />
                </div>

                <div className="space-y-3 relative z-10">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Timeline Logs</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {parsedData.status_logs?.map((log, i) => (
                      <div key={log.id ? `log-${log.id}-${i}` : `log-idx-${i}`} className="p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <p className="text-xs font-semibold text-zinc-300">{log.message}</p>
                        <p className="text-[10px] text-zinc-600 mt-1 font-mono">
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
                    ))}
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Internal Notes</h3>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes..."
                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-xs focus:outline-none focus:border-blue-500/50 transition-all resize-none min-h-[100px]"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-3 relative z-10">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                {success ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-xl flex items-center justify-center gap-3 relative z-10">
                    <CheckCircle2 size={16} /> Saved Successfully!
                  </div>
                ) : (
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 glow-button uppercase tracking-widest text-xs relative z-10 shadow-lg shadow-blue-600/20"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Save size={18} /> Save to Database
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center text-zinc-700 border-2 border-dashed border-white/5 rounded-3xl p-12 bg-white/[0.01]"
              >
                <div className="p-6 rounded-full bg-white/[0.02] mb-6">
                  <FileText size={48} strokeWidth={1} className="opacity-20" />
                </div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-40">Waiting for input</p>
                <p className="mt-2 text-xs opacity-20">Parse text to see preview</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditPreviewItem({ label, value, onChange, type = 'text' }: { label: string, value: string, onChange: (val: string) => void, type?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 transition-all"
      />
    </div>
  );
}
