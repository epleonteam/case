import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, X, Shield } from 'lucide-react';

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'New Case', path: '/paste', icon: FileText },
  ];

  return (
    <>
      {/* Backdrop Overlay for closing sidebar on outside click */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside className={`fixed top-16 bottom-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-[#374151] p-6 flex flex-col transform transition-transform duration-300 shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-lg font-black tracking-tighter text-[#F9FAFB]">CASEFLOW AI</span>
          </div>
          <button onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors" title="Close Sidebar"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-[#9CA3AF] hover:bg-white/[0.03] hover:text-[#F9FAFB]'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
