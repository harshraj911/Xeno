import { useQuery } from '@tanstack/react-query';
import { analyticsApi, ingestApi } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Megaphone, IndianRupee, Package,
  MessageSquare, Eye, MousePointer, TrendingUp, TrendingDown,
  RefreshCw, Database, ArrowUpRight, Sparkles, Zap, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const PALETTE = [
  { color: '#06b6d4', glow: 'rgba(6,182,212,0.4)',   bg: 'rgba(6,182,212,0.08)'   },
  { color: '#10b981', glow: 'rgba(16,185,129,0.4)',  bg: 'rgba(16,185,129,0.08)'  },
  { color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)',  bg: 'rgba(139,92,246,0.08)'  },
  { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)',  bg: 'rgba(245,158,11,0.08)'  },
  { color: '#ec4899', glow: 'rgba(236,72,153,0.4)',  bg: 'rgba(236,72,153,0.08)'  },
  { color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  bg: 'rgba(59,130,246,0.08)'  },
  { color: '#f97316', glow: 'rgba(249,115,22,0.4)',  bg: 'rgba(249,115,22,0.08)'  },
  { color: '#a855f7', glow: 'rgba(168,85,247,0.4)',  bg: 'rgba(168,85,247,0.08)'  },
];

const CH_COLORS = { whatsapp:'#22c55e', sms:'#3b82f6', email:'#a855f7', rcs:'#f97316' };

function KpiCard({ icon: Icon, label, value, change, index, prefix='' }) {
  const p = PALETTE[index % PALETTE.length];
  const pos = change >= 0;
  return (
    <motion.div
      initial={{ opacity:0, y:24 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay: index*0.06, duration:0.5, ease:[0.23,1,0.32,1] }}
      whileHover={{ y:-4, transition:{duration:0.2} }}
      className="glass-card p-6 relative overflow-hidden holo-card"
    >
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-[60px] opacity-25 pointer-events-none"
        style={{background:p.color}} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{background:p.bg, border:`1px solid ${p.color}30`}}>
          <Icon size={18} style={{color:p.color}} />
        </div>
        {change !== undefined && change !== null && (
          <motion.div
            initial={{scale:0}} animate={{scale:1}} transition={{delay:0.5+index*0.06, type:'spring'}}
            className={clsx(
              'flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-xl',
              pos ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-rose-300 bg-rose-500/10 border border-rose-500/20'
            )}>
            {pos ? <ArrowUpRight size={11}/> : <TrendingDown size={11}/>}
            {Math.abs(change)}%
          </motion.div>
        )}
      </div>

      <div className="mt-2">
        <motion.div
          initial={{opacity:0}} animate={{opacity:1}}
          transition={{delay:0.3+index*0.06}}
          className="text-3xl font-black tracking-tight text-white">
          {prefix}{typeof value==='number' ? value.toLocaleString('en-IN') : value}
        </motion.div>
        <div className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-widest">{label}</div>
      </div>

      <div className="mt-4 h-1 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          initial={{width:0}} animate={{width:'65%'}}
          transition={{delay:0.8+index*0.06, duration:0.8, ease:[0.23,1,0.32,1]}}
          className="h-full rounded-full"
          style={{background:`linear-gradient(90deg, ${p.color}55, ${p.color})`, boxShadow:`0 0 12px ${p.glow}`}}
        />
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-flat px-4 py-3 text-xs shadow-2xl" style={{borderRadius:14}}>
      <p className="text-slate-500 font-bold uppercase tracking-wider mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-bold mt-0.5" style={{color:p.color}}>
          {p.name}: {typeof p.value==='number' && p.value>999 ? `₹${p.value.toLocaleString('en-IN')}` : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'], queryFn: analyticsApi.dashboard, refetchInterval: 5000
  });

  const handleSeed = async () => {
    const t = toast.loading('Seeding 500 demo customers...');
    try {
      await ingestApi.seed(500);
      toast.success('Demo data ready!', {id:t});
      setTimeout(() => refetch(), 1500);
    } catch(e) { toast.error(e.response?.data?.error||'Failed', {id:t}); }
  };

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-10 w-56 skeleton rounded-2xl"/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_,i)=><div key={i} className="h-36 skeleton rounded-3xl"/>)}
      </div>
    </div>
  );

  const s = data?.summary || {};
  const comms = data?.communications || {};
  const hasData = s.totalCustomers > 0;

  const revData = (data?.dailyRevenue||[]).map(d=>({
    date: format(parseISO(String(d.date).split('T')[0]), 'MMM d'),
    revenue: Math.round(d.revenue||0), orders: d.orders||0
  }));
  const chData = (data?.channelBreakdown||[]).map(c=>({
    name:c.channel, value:c.count, color:CH_COLORS[c.channel]||'#94a3b8'
  }));

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="gradient-text">Command</span>
            <span className="text-white"> Center</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {hasData ? 'Live overview of your shopper engagement.' : 'Seed demo data to get started.'}
          </p>
        </div>
        <div className="flex gap-3">
          {!hasData && (
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={handleSeed} className="btn-primary gap-2">
              <Database size={15}/> Seed Demo Data
            </motion.button>
          )}
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={()=>refetch()} className="btn-secondary">
            <RefreshCw size={14}/>
          </motion.button>
        </div>
      </motion.div>

      {!hasData && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}}
          className="glass-card p-12 text-center border-animated">
          <motion.div animate={{y:[-5,5,-5]}} transition={{duration:3,repeat:Infinity}}>
            <Database size={40} className="mx-auto mb-4" style={{color:'rgba(139,92,246,0.5)'}}/>
          </motion.div>
          <p className="text-slate-400 font-semibold mb-2">No data yet.</p>
          <p className="text-sm text-slate-600 mb-6">Seed 500 realistic customers and orders to explore the platform.</p>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
            onClick={handleSeed} className="btn-primary mx-auto">
            <Sparkles size={14}/> Seed Demo Data
          </motion.button>
        </motion.div>
      )}

      {/* KPI Grid top row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users}          label="Total Customers"    value={s.totalCustomers||0}   change={s.customerGrowth}  index={0} />
        <KpiCard icon={IndianRupee}    label="Revenue This Month" value={s.revenueThisMonth||0} change={s.revenueGrowth}   index={1} prefix="₹" />
        <KpiCard icon={Megaphone}      label="Total Campaigns"    value={s.totalCampaigns||0}   index={2} />
        <KpiCard icon={Package}        label="Orders This Month"  value={s.ordersThisMonth||0}  index={3} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={MessageSquare}  label="Messages Sent"      value={comms.total||0}                           index={4} />
        <KpiCard icon={TrendingUp}     label="Delivery Rate"      value={`${comms.globalDeliveryRate||0}%`}        index={5} />
        <KpiCard icon={Eye}            label="Open Rate"          value={`${comms.globalOpenRate||0}%`}            index={6} />
        <KpiCard icon={Activity}       label="Active Campaigns"   value={s.activeCampaigns||0}                     index={7} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue area */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}}
          className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-black text-white">Revenue Trend</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Last 30 days</p>
            </div>
            {s.revenueGrowth !== null && (
              <div className={clsx('flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl',
                s.revenueGrowth>=0 ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                                   : 'text-rose-300 bg-rose-500/10 border border-rose-500/20')}>
                {s.revenueGrowth>=0 ? <ArrowUpRight size={12}/> : <TrendingDown size={12}/>}
                {Math.abs(s.revenueGrowth)}% MoM
              </div>
            )}
          </div>
          {revData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revData}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fontSize:10,fill:'#475569',fontWeight:700}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#475569',fontWeight:700}} axisLine={false} tickLine={false}
                  tickFormatter={v => v>=1000 ? `₹${Math.round(v/1000)}k` : `₹${v}`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2.5}
                  fill="url(#rg)" dot={false} name="Revenue"
                  style={{filter:'drop-shadow(0 0 8px rgba(6,182,212,0.5))'}}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-slate-700 font-semibold text-sm">No revenue data yet</div>
          )}
        </motion.div>

        {/* Channel pie */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.6}}
          className="glass-card p-6">
          <h3 className="text-base font-black text-white mb-1">Channels</h3>
          <p className="text-xs text-slate-500 font-semibold mb-6">Last 30 days distribution</p>
          {chData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={chData} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                    dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {chData.map(e => <Cell key={e.name} fill={e.color}
                      style={{filter:`drop-shadow(0 0 6px ${e.color}80)`}}/>)}
                  </Pie>
                  <Tooltip formatter={(v,n)=>[v,n]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-4">
                {chData.map(c => (
                  <div key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{background:c.color, boxShadow:`0 0 6px ${c.color}`}}/>
                      <span className="text-xs font-bold text-slate-400 capitalize">{c.name}</span>
                    </div>
                    <span className="text-xs font-black text-white">{c.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-700 text-sm font-semibold">No campaign data</div>
          )}
        </motion.div>
      </div>

      {/* Recent campaigns */}
      {data?.recentCampaigns?.length > 0 && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.7}}
          className="glass-card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-base font-black text-white">Recent Campaigns</h3>
            <span className="badge badge-ai"><Zap size={10}/> Live</span>
          </div>
          <div>
            {data.recentCampaigns.map((c, i) => {
              const dr = c.totalSent>0 ? ((c.totalDelivered/c.totalSent)*100).toFixed(0) : 0;
              const or = c.totalDelivered>0 ? ((c.totalOpened/c.totalDelivered)*100).toFixed(0) : 0;
              return (
                <motion.div key={c.id}
                  initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:0.8+i*0.05}}
                  className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
                    <Megaphone size={14} style={{color:CH_COLORS[c.channel]||'#94a3b8'}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-600 font-semibold capitalize">{c.channel} · {format(new Date(c.createdAt),'MMM d, yyyy')}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-xs font-black">
                    <div className="text-right">
                      <p className="text-slate-300">{c.totalSent.toLocaleString()}</p>
                      <p className="text-slate-700">sent</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400">{dr}%</p>
                      <p className="text-slate-700">delivered</p>
                    </div>
                    <div className="text-right">
                      <p className="text-violet-400">{or}%</p>
                      <p className="text-slate-700">opened</p>
                    </div>
                  </div>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
