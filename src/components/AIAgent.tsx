import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, X, Minimize2, Maximize2, Loader2, Sparkles, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WithdrawalCase, Status } from '../types';
import { Type, FunctionDeclaration } from "@google/genai";
// Removed direct GoogleGenAI usage in favor of backend proxy


interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
}

export default function AIAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your AI Case Management Assistant. How can I help you today? You can ask me about existing cases, or tell me to create a new one.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createCaseTool: FunctionDeclaration = {
    name: "createCase",
    parameters: {
      type: Type.OBJECT,
      description: "Create a new case in the management system. Extract title as username, description as notes, and priority as withdrawal_speed.",
      properties: {
        case_id: { type: Type.STRING, description: "A unique identifier for the case (e.g., CASE-123). If not provided, generate a random one like CASE-XXXX." },
        username: { type: Type.STRING, description: "The title of the case or the name of the user." },
        amount: { type: Type.NUMBER, description: "The amount associated with the case. Default to 0 if not specified." },
        platform: { type: Type.STRING, description: "The platform or category (e.g., Nagad, Bkash, Rocket, Other)." },
        payment_method: { type: Type.STRING, description: "The payment method used." },
        phone_number: { type: Type.STRING, description: "The contact phone number." },
        withdrawal_speed: { type: Type.STRING, enum: ["Normal", "Fast"], description: "The priority of the case. 'Fast' for high priority, 'Normal' otherwise." },
        notes: { type: Type.STRING, description: "Detailed description or notes for the case." },
      },
      required: ["username", "platform"],
    },
  };

  const handleCreateCase = async (args: any) => {
    const caseId = args.case_id || `CASE-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCase: Partial<WithdrawalCase> = {
      ...args,
      case_id: caseId,
      amount: args.amount || 0,
      platform: args.platform || 'Other',
      status: 'Pending' as Status,
      type: 'Withdrawal',
      created_at: new Date().toISOString(),
      status_logs: [{
        id: crypto.randomUUID(),
        message: 'Case created via AI Intelligent Assistant',
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

    const { data, error } = await supabase
      .from('withdrawals')
      .insert([newCase])
      .select();

    if (error) {
      console.error('Error creating case:', error);
      return `Failed to create case: ${error.message}`;
    }
    
    // Dispatch custom event for real-time update
    window.dispatchEvent(new CustomEvent('caseCreated'));
    
    return `Successfully created case ${args.case_id} for ${args.username}. You can see it on the dashboard now.`;
  };

  const [cases, setCases] = useState<WithdrawalCase[]>([]);

  useEffect(() => {
    const fetchCases = async () => {
      const { data } = await supabase.from('withdrawals').select('*');
      if (data) setCases(data);
    };
    if (isOpen) fetchCases();
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const systemContext = `You are CaseFlow AI, a sophisticated and highly intelligent Case Management Assistant. 
      Your personality: Professional, efficient, high-tech, and helpful. You speak clearly and concisely.
      
      Company Info: CaseFlow AI is a leading platform for intelligent case automation and analytics.
      Pricing Plans: 
      - Basic: $99/mo (up to 100 cases, standard support)
      - Pro: $299/mo (unlimited cases, AI insights, priority support)
      - Enterprise: Custom pricing for large-scale operations.
      
      Current System Data (Latest 20 cases): ${JSON.stringify(cases.slice(0, 20))}. 
      
      Your capabilities:
      1. Answer questions about existing cases, pricing, and company services.
      2. Create new cases using the 'createCase' tool.
      
      Guidelines for Case Creation:
      - Extract 'username' as the Case Title or User Name.
      - Extract 'notes' as the detailed description.
      - Extract 'withdrawal_speed' as 'Fast' (for high priority/urgent) or 'Normal'.
      - Extract 'platform' (e.g., Nagad, Bkash, Rocket, Bank).
      - If essential info is missing (Title/Username or Platform), ask the user politely before calling the tool.
      
      Always maintain a premium, high-tech tone. Use formatting like bold text for emphasis where appropriate.`;

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.concat(userMessage).map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }]
          })),
          config: {
            systemInstruction: systemContext,
            tools: [{ functionDeclarations: [createCaseTool] }],
          }
        })
      }).then(res => res.json());


      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'createCase') {
            const result = await handleCreateCase(call.args);
            setMessages(prev => [...prev, { role: 'model', text: result }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'model', text: response.text || "I'm sorry, I couldn't process that." }]);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`glass rounded-2xl md:rounded-3xl overflow-hidden flex flex-col mb-4 shadow-2xl border-white/10 ${
              isMinimized 
                ? 'h-16 w-64 md:w-72' 
                : 'fixed inset-4 md:relative md:inset-auto h-[calc(100vh-2rem)] md:h-[500px] w-[calc(100vw-2rem)] md:w-[400px]'
            }`}
          >
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Bot size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white">AI Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] md:text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors hidden md:block"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={18} md:size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20"
                >
                  {messages.map((m, i) => (
                    <div 
                      key={`${m.role}-${i}-${m.text.substring(0, 20)}`} 
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm md:text-xs leading-relaxed shadow-sm ${
                        m.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white/[0.05] border border-white/10 text-zinc-100 rounded-tl-none'
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/[0.05] border border-white/10 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-400" />
                        <span className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">AI is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-3 md:p-4 border-t border-white/5 bg-white/[0.02]">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Ask me anything..."
                      className="w-full bg-white/[0.05] border border-white/10 rounded-2xl py-3 md:py-3 pl-4 pr-12 text-sm md:text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-30 shadow-lg shadow-blue-600/20"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                  <p className="text-[8px] md:text-[9px] text-zinc-500 mt-2 text-center uppercase tracking-widest font-bold">Powered by Gemini AI</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-600 text-white shadow-2xl shadow-blue-600/40 flex items-center justify-center relative group overflow-hidden ${isOpen ? 'hidden' : 'flex'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-500"></div>
        <div className="absolute inset-0 shimmer-effect opacity-30"></div>
        <Bot size={24} md:size={28} className="relative z-10 group-hover:rotate-12 transition-transform duration-300" />
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-emerald-500 border-2 border-[#05070a] rounded-full z-20"></div>
      </motion.button>
    </div>
  );
}
