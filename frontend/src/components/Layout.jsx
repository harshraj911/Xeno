import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import {
  LayoutDashboard, Users, Tag, Megaphone, BarChart3,
  Bot, Zap, Search, Settings, Command, Database,
  ChevronRight, Activity
} from 'lucide-react';
import clsx from 'clsx';
import NetworkBackground from './NetworkBackground.jsx';

const NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/customers',  icon: Users,           label: 'Audience'  },
  { path: '/segments',   icon: Tag,             label: 'Segments'  },
  { path: '/campaigns',  icon: Megaphone,       label: 'Campaigns' },
  { path: '/analytics',  icon: BarChart3,       label: 'Insights'  },
  { path: '/ai',         icon: Bot,             label: 'Xeno AI',  pulse: true },
  { path: '/settings',   icon: Database,        label: 'System'    },
];

/* ── Mouse Spotlight ──────────────────────── */
function MouseSpotlight() {
  useEffect(() => {
    const update = (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', update, { passive: true });
    return () => window.removeEventListener('mousemove', update);
  }, []);
  return null;
}

/* ── Ambient Background Grid ──────────────── */
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Dot grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />
      {/* Radial vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)',
      }} />
    </div>
  );
}

/* ── Command Palette ──────────────────────── */
function CommandPalette({ open, onClose }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const items = NAV.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => ref.current?.focus(), 50); }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity:0, scale:0.95, y:-20 }}
            animate={{ opacity:1, scale:1, y:0 }}
            exit={{ opacity:0, scale:0.95, y:-20 }}
            transition={{ type:'spring', damping:30, stiffness:400 }}
            className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-lg z-[201]"
          >
            <div className="bg-[#050505] border border-white/10 overflow-hidden" style={{boxShadow:'0 40px 80px rgba(0,0,0,0.9)'}}>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
                <Search size={14} className="text-zinc-500 flex-shrink-0" />
                <input ref={ref} value={q} onChange={e=>setQ(e.target.value)}
                  placeholder="Jump to any section..."
                  className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-zinc-700 outline-none"
                />
                <kbd className="px-2 py-1 bg-white/5 border border-white/8 text-[9px] font-black text-zinc-600 tracking-widest">ESC</kbd>
              </div>
              <div className="p-2">
                {items.map((item, i) => (
                  <motion.button key={item.path}
                    initial={{opacity:0, x:-8}} animate={{opacity:1, x:0}}
                    transition={{delay: i*0.03}}
                    onClick={() => { nav(item.path); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-all group text-left"
                  >
                    <div className="w-8 h-8 flex items-center justify-center bg-white/[0.03] border border-white/[0.06] group-hover:border-white/10 transition-colors flex-shrink-0">
                      <item.icon size={14} className="text-zinc-500 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">{item.label}</span>
                    <span className="ml-auto text-[9px] font-black text-zinc-700 group-hover:text-zinc-500 tracking-widest">ENTER ↩</span>
                  </motion.button>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-white/[0.04] flex items-center gap-4">
                <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">XENO // COMMAND</span>
                <span className="ml-auto text-[9px] text-zinc-700">↑↓ navigate · ↩ select</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const currentNav = NAV.find(n => location.pathname.startsWith(n.path));

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setCmdOpen(p=>!p); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      <MouseSpotlight />
      <AmbientBackground />
      <NetworkBackground activeNodes={60} opacity={0.3} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ── Floating Sidebar ─────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ type:'spring', damping:32, stiffness:300 }}
        className="relative z-20 flex flex-col h-screen flex-shrink-0 m-3 mr-0"
        style={{
          background: 'rgba(5,5,5,0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 px-4 border-b border-white/[0.04] flex-shrink-0',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <motion.div
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 relative bg-white"
          >
            <Zap size={16} className="text-black" fill="currentColor" />
            <motion.div
              animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.4, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-white -z-10"
            />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
              >
                <div className="font-black text-sm text-white tracking-[0.1em] uppercase leading-none">Xeno</div>
                <div className="text-[8px] font-black tracking-[0.4em] text-zinc-700 uppercase mt-0.5">Monolith</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search trigger */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="px-3 pt-3">
              <button onClick={() => setCmdOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-zinc-600 hover:text-zinc-400 transition-all group"
                style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)'}}
              >
                <Search size={12} />
                <span className="text-[10px] font-medium flex-1 text-left">Search...</span>
                <div className="flex items-center gap-0.5 opacity-50">
                  <Command size={8} /><span className="text-[9px] font-black">K</span>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="flex-1 px-2 pt-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <NavLink key={item.path} to={item.path} className="block" title={collapsed ? item.label : undefined}>
                <motion.div
                  whileHover={{ x: collapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.97 }}
                  className={clsx(
                    'relative flex items-center gap-3 px-3 py-2.5 transition-all duration-200 cursor-pointer select-none',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  {/* Active background */}
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-white/[0.06] border border-white/10"
                      transition={{ type:'spring', damping:35, stiffness:400 }}
                    />
                  )}
                  {/* Active left bar */}
                  {active && (
                    <motion.div
                      layoutId="sidebar-bar"
                      className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-white"
                      transition={{ type:'spring', damping:35, stiffness:400 }}
                    />
                  )}

                  <div className="relative z-10 flex items-center gap-3 w-full">
                    <item.icon size={15}
                      className={clsx(
                        'transition-colors flex-shrink-0',
                        active ? 'text-white' : 'text-zinc-600'
                      )}
                    />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{opacity:0, x:-4}} animate={{opacity:1, x:0}} exit={{opacity:0}}
                          className={clsx(
                            'text-xs font-semibold flex-1 truncate',
                            active ? 'text-white' : 'text-zinc-500'
                          )}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && item.pulse && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"
                        style={{ boxShadow: '0 0 6px #fff' }}
                      />
                    )}
                  </div>
                </motion.div>
              </NavLink>
            );
          })}
        </nav>

        {/* System status */}
        <AnimatePresence>
          {!collapsed && currentNav && (
            <motion.div
              initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} exit={{opacity:0}}
              className="mx-2 mb-2 px-3 py-2.5 border border-white/[0.04]"
              style={{background:'rgba(255,255,255,0.01)'}}
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1 h-1 bg-white rounded-full flex-shrink-0"
                />
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Active</span>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 mt-1 truncate">{currentNav.label}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-white/[0.03]">
          <button onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center gap-2 py-2 text-zinc-700 hover:text-zinc-400 transition-all hover:bg-white/[0.03]"
          >
            <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ type:'spring', damping:20 }}>
              <ChevronRight size={12} />
            </motion.div>
            {!collapsed && <span className="text-[9px] font-black tracking-widest uppercase">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Main Content ──────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity:0, y:12, filter:'blur(4px)' }}
            animate={{ opacity:1, y:0, filter:'blur(0px)' }}
            exit={{ opacity:0, y:-8, filter:'blur(4px)' }}
            transition={{ duration:0.4, ease:[0.23,1,0.32,1] }}
            className="flex-1 overflow-y-auto p-6 lg:p-8"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
