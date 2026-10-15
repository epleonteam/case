import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, Check } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('remembered_login');
    if (savedData) {
      const { email: savedEmail, password: savedPassword, expiry } = JSON.parse(savedData);
      if (new Date().getTime() < expiry) {
        setEmail(savedEmail);
        setPassword(savedPassword);
      } else {
        localStorage.removeItem('remembered_login');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (rememberMe) {
        const expiry = new Date().getTime() + (3 * 24 * 60 * 60 * 1000); // 3 days
        localStorage.setItem('remembered_login', JSON.stringify({ email, password, expiry }));
      } else {
        localStorage.removeItem('remembered_login');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050505]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass p-8 rounded-2xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-600/20">
            <Zap className="text-blue-500 fill-blue-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Login</h1>
          <p className="text-zinc-500 text-sm mt-2">Secure access to withdrawal management</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <button 
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                rememberMe 
                  ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20' 
                  : 'bg-zinc-900 border-white/10 group-hover:border-white/20'
              }`}>
                {rememberMe && <Check size={14} className="text-white" />}
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400 transition-colors">Remember Me</span>
            </button>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 glow-button"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Authorized Personnel Only</p>
        </div>
      </motion.div>
    </div>
  );
}
