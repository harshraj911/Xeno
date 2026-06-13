import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { ingestApi } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Sparkles, Server, RefreshCw, AlertTriangle, Zap, Activity, Trash2, Cpu, HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';



export default function Settings() {
  const [seeding, setSeeding] = useState(false);
  const [count, setCount] = useState(500);

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
    refetchInterval: 30000,
    retry: 2
  });
  const { data: providers } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => api.get('/ai/providers'),
    staleTime: Infinity,
    retry: 1
  });

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await ingestApi.seed(count);
      toast.success(`Matrix synced. ${count} nodes created.`);
    } catch(e) {
      toast.error(e.response?.data?.error || 'SYS_ERR: Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const isHealthy = health?.status === 'healthy';
  const dbUp      = health?.services?.database      === 'up';
  const apiUp     = health?.services?.api           === 'up' || !!health;
  const chanUp    = health?.services?.channelService === 'up';

  return (
    <div className="space-y-8 max-w-[1000px]">
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
        <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-2">// Infrastructure</div>
        <h1 className="text-4xl font-black tracking-tighter uppercase text-white">System Config</h1>
        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-2">Manage API protocols and neural matrix data</p>
      </motion.div>

      {/* Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'API Protocol',    status: apiUp,  icon:Server,    detail:'PORT: 4000' },
          { label:'Core Database',   status: dbUp,   icon:Database,  detail:'PGSQL // ACTIVE' },
          { label:'IO Channels',     status: chanUp, icon:Activity,  detail:'STUB // PORT 5030' },
          { label:'Message Queue',   status: apiUp,  icon:Zap,       detail:'BULLMQ // REDIS' },
        ].map((item,i)=>(
          <motion.div key={item.label} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
            className="monolith-card p-6 flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:border-white/20">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 flex items-center justify-center bg-white/[0.03] border border-white/10 group-hover:border-white/30 transition-all">
                <item.icon size={16} className={clsx('transition-colors', item.status ? 'text-white' : 'text-zinc-600')} />
              </div>
              <div className="flex items-center gap-2 px-2 py-1 border border-white/10 bg-[#050505]">
                <motion.div animate={item.status ? { opacity:[0.3, 1, 0.3], scale:[1, 1.2, 1] } : {}} transition={{ duration: 2, repeat: Infinity }}
                  className={`w-1.5 h-1.5 rounded-full ${item.status ? 'bg-white' : 'bg-red-900 shadow-[0_0_8px_rgba(255,0,0,0.5)]'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                  {item.status ? 'NOMINAL' : 'OFFLINE'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-tight mb-1">{item.label}</p>
              <p className="text-[9px] font-mono text-zinc-600 tracking-widest">{item.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Primary Config Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* AI Providers */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}} 
          className="border border-white/10 bg-[#050505] p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
            <Cpu size={16} className="text-white"/>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Neural Coprocessors</h3>
          </div>
          
          <div className="space-y-4">
            {[
              { name:'Groq Engine',        key:'groq',   desc:'LLaMA 3.1 70B // 14.4k req/d' },
              { name:'NVIDIA NIM',         key:'nvidia', desc:'LLaMA 3.1 70B // Free tier' },
            ].map((p,i)=>{
              const active = providers?.[p.key];
              return (
                <div key={p.name} className="flex items-center justify-between p-4 border border-white/5 bg-white/[0.02]">
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-widest mb-1">{p.name}</p>
                    <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">{p.desc}</p>
                    {!active && (
                      <p className="text-[8px] font-black text-red-500 mt-2 uppercase tracking-widest">ERR: {p.key.toUpperCase()}_API_KEY MISSING</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 border ${active ? 'border-white text-white bg-white/10' : 'border-zinc-800 text-zinc-600'}`}>
                      {active ? 'SYNCHED' : 'DISCONNECTED'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {providers && (
            <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-between">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Zap size={10} className="text-white" /> Active Router
              </div>
              <div className="text-xs font-mono text-white">
                {providers.primary.toUpperCase()}
              </div>
            </div>
          )}
        </motion.div>

        {/* Data Seeder */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.3}} 
          className="border border-white/10 bg-[#050505] p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
            <HardDrive size={16} className="text-white"/>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Matrix Constructor</h3>
          </div>
          
          <div className="flex-1">
            <p className="text-[10px] text-zinc-500 font-mono tracking-widest leading-relaxed mb-6">
              // Synthesizes highly realistic node clusters, transactional arrays, and historical behavioral patterns into the core database.
            </p>

            <div className="bg-white/[0.02] border border-white/5 p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Node Quantum</span>
                <span className="text-xs font-mono text-white">{count}</span>
              </div>
              <input 
                type="range" min={50} max={2000} step={50} value={count} 
                onChange={e=>setCount(Number(e.target.value))}
                className="w-full accent-white h-1 bg-white/10 appearance-none rounded-none"
              />
            </div>
          </div>

          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
            onClick={handleSeed} disabled={seeding} 
            className="w-full btn-monolith justify-center text-[10px] py-4 magnetic-btn group">
            {seeding ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14} className="group-hover:animate-pulse"/>}
            {seeding ? `COMPILING ${count} NODES...` : `EXECUTE SYNTHESIS`}
          </motion.button>
        </motion.div>
      </div>

      {/* Architecture & Clear Data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Architecture */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.4}} 
          className="md:col-span-3 border border-white/10 bg-black p-6 relative overflow-hidden">
          
          {/* subtle grid background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 40px)'
          }} />

          <h3 className="text-[10px] font-black text-white mb-6 uppercase tracking-[0.3em] relative z-10">System Schema</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 relative z-10">
            {[
              {l:'Logic Tier',        v:'Node.js // Exp'},
              {l:'Data Layer',        v:'PGSQL // Prisma'},
              {l:'Job Network',       v:'BullMQ // Redis'},
              {l:'Neural Core',       v:'Groq // NVIDIA'},
              {l:'Client Env',        v:'React // Vite'},
              {l:'UI Framework',      v:'Tailwind // Framer'},
              {l:'External I/O',      v:'Comms Stub .JS'},
              {l:'Deployment',        v:'Docker Core'},
            ].map((item,i)=>(
              <div key={item.l} className="border-l border-white/10 pl-3">
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">{item.l}</p>
                <p className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest">{item.v}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.5}} 
          className="md:col-span-1 border border-zinc-800 bg-[#020202] px-6 py-8 flex flex-col justify-center items-center text-center">
          <AlertTriangle size={24} className="text-zinc-600 mb-4"/>
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Hard Reset</h3>
          <p className="text-[9px] text-zinc-700 font-mono tracking-widest mb-6">FORMAT_DATABASE</p>
          
          <button
            onClick={async () => {
              if(window.confirm('SYS_WARN: EXECUTING FULL WIPEOUT. PROCEED?')) {
                const t = toast.loading('Formatting matrix...');
                try {
                  await ingestApi.clear();
                  toast.success('Matrix successfully formatted', { id: t });
                } catch(e) {
                  toast.error('ERR: Format failure', { id: t });
                }
              }
            }}
            className="border border-white/10 hover:bg-white text-[9px] font-black text-zinc-400 hover:text-black transition-all px-4 py-2 uppercase tracking-widest magnetic-btn"
          >
            Purge Core
          </button>
        </motion.div>
        
      </div>
    </div>
  );
}
