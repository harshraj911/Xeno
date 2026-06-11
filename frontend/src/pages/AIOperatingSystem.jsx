import { Suspense, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsApi, ingestApi } from '../services/api.js';
import {
  Users, Megaphone, IndianRupee, Package,
  MessageSquare, Eye, TrendingUp, Activity,
  RefreshCw, Database, Sparkles, Zap,
  ArrowUpRight, TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import XenoCore from '../components/dashboard/XenoCore.jsx';
import HolographicModule from '../components/dashboard/HolographicModule.jsx';
import { RevenueWave, EngagementRings, ChannelBars } from '../components/dashboard/Visualizations.jsx';

/* ─── Neural Dot Canvas ─────────────────────────────── */
function NeuralBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let nodes = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 35; i++) {
      nodes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1 + 0.5,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 160) {
            const op = (1 - dist / 160) * 0.06;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255,255,255,${op})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,0.15)`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.5 }} />;
}

/* ─── Status Bar ────────────────────────────────────── */
function StatusBar({ hasData, lastUpdated, onRefetch, isLoading }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-5 py-2.5 mb-8 border border-white/5"
      style={{ background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-center gap-4">
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-1 h-1 bg-white rounded-full"
          style={{ boxShadow: '0 0 6px #fff' }}
        />
        <span className="text-[9px] font-black tracking-[0.4em] text-zinc-600 uppercase">Xeno Intelligence OS</span>
        <div className="h-3 w-px bg-white/5" />
        <span className="text-[9px] font-mono text-zinc-700">v2.0 · {new Date().toLocaleTimeString()}</span>
      </div>

      <div className="hidden md:flex items-center gap-2">
        {['AI ENGINE', 'DATA SYNC', 'XENO CORE'].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 border border-white/5 bg-white/[0.02]">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
              className="w-0.5 h-0.5 bg-white rounded-full"
            />
            <span className="text-[8px] font-black tracking-widest text-zinc-700 uppercase">{label}</span>
            <span className="text-[8px] font-black text-white uppercase">ON</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-[8px] font-mono text-zinc-700 hidden lg:block">
            {format(lastUpdated, 'HH:mm:ss')}
          </span>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onRefetch} disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black tracking-widest uppercase text-zinc-600 hover:text-white transition-all disabled:opacity-40 border border-white/5 hover:border-white/20"
        >
          <motion.div animate={isLoading ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
            <RefreshCw size={10} />
          </motion.div>
          Sync
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Seed Prompt ───────────────────────────────────── */
function SeedPrompt({ onSeed }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden p-16 text-center border border-white/5"
      style={{ background: '#050505' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      <motion.div animate={{ y: [-4, 4, -4] }} transition={{ duration: 4, repeat: Infinity }}>
        <div className="w-16 h-16 mx-auto mb-8 flex items-center justify-center relative border border-white/10 bg-white/[0.02]">
          <Database size={28} className="text-white" />
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-white/10"
          />
        </div>
      </motion.div>
      <div className="text-[9px] font-black tracking-[0.4em] text-zinc-600 uppercase mb-3">System Void</div>
      <h2 className="text-3xl font-black text-white mb-3 tracking-tighter">Initialize Intelligence Core</h2>
      <p className="text-zinc-600 text-sm mb-2 max-w-sm mx-auto leading-relaxed">
        Seed 500 realistic customers, orders, and campaigns to activate the full command center.
      </p>
      <p className="text-zinc-800 text-[10px] font-mono mb-10">// Synthetic data via Faker.js · Demo safe</p>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onSeed}
        className="inline-flex items-center gap-3 px-10 py-4 bg-white text-black font-black text-xs uppercase tracking-[0.2em] hover:tracking-[0.3em] transition-all"
      >
        <Sparkles size={14} />
        Seed Demo Universe
        <Zap size={14} fill="currentColor" />
      </motion.button>
    </motion.div>
  );
}

/* ─── Campaign Row ──────────────────────────────────── */
function CampaignRow({ c, i }) {
  const dr = c.totalSent > 0 ? ((c.totalDelivered / c.totalSent) * 100).toFixed(0) : 0;
  const or = c.totalDelivered > 0 ? ((c.totalOpened / c.totalDelivered) * 100).toFixed(0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 * i }}
      className="flex items-center gap-4 px-6 py-4 transition-all hover:bg-white/[0.02] border-b border-white/[0.03] group"
    >
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 bg-white/[0.02] border border-white/[0.06] group-hover:border-white/15 transition-colors">
        <Megaphone size={12} className="text-zinc-500 group-hover:text-white transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-white truncate uppercase tracking-tight">{c.name}</p>
        <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest mt-0.5">{c.channel} · {format(new Date(c.createdAt), 'MMM d, yyyy')}</p>
      </div>

      <div className="hidden md:flex items-center gap-6 text-xs font-black">
        <div className="text-right">
          <p className="text-white text-xs">{c.totalSent.toLocaleString()}</p>
          <p className="text-zinc-700 text-[8px] uppercase tracking-widest">Sent</p>
        </div>
        <div className="text-right">
          <p className="text-white text-xs">{dr}%</p>
          <p className="text-zinc-700 text-[8px] uppercase tracking-widest">Deliv</p>
        </div>
        <div className="text-right">
          <p className="text-white text-xs">{or}%</p>
          <p className="text-zinc-700 text-[8px] uppercase tracking-widest">Open</p>
        </div>
      </div>

      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 px-2 py-1 border border-white/5 ml-4">{c.status}</span>
    </motion.div>
  );
}

/* ─── Panel Component ───────────────────────────────── */
function Panel({ title, subtitle, children, delay = 0, className = '', style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.23, 1, 0.32, 1], duration: 0.6 }}
      className={`border border-white/[0.06] overflow-hidden ${className}`}
      style={{ background: '#050505', ...style }}
    >
      {(title || subtitle) && (
        <div className="px-6 pt-5 pb-3 border-b border-white/[0.04]">
          {title && <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>}
          {subtitle && <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </motion.div>
  );
}

/* ─── Main Component ────────────────────────────────── */
export default function AIOperatingSystem() {
  const [lastUpdated, setLastUpdated] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-ai'],
    queryFn: async () => {
      const res = await analyticsApi.dashboard();
      setLastUpdated(new Date());
      return res;
    },
    refetchInterval: 5000,
  });

  const handleSeed = async () => {
    const t = toast.loading('Initializing demo universe...');
    try {
      await ingestApi.seed(500);
      toast.success('500 customers seeded!', { id: t });
      setTimeout(() => refetch(), 1500);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Seed failed', { id: t });
    }
  };

  const s = data?.summary || {};
  const comms = data?.communications || {};
  const hasData = (s.totalCustomers || 0) > 0;
  const deliveryRate = Number(comms.globalDeliveryRate || 0);
  const openRate = Number(comms.globalOpenRate || 0);
  const clickRate = Number(comms.globalClickRate || 5);

  const kpis = [
    { icon: Users,         label: 'Total Customers',  value: s.totalCustomers,   change: s.customerGrowth, index: 0 },
    { icon: IndianRupee,   label: 'Revenue / Month',  value: s.revenueThisMonth, change: s.revenueGrowth,  index: 1, prefix: '₹' },
    { icon: Megaphone,     label: 'Total Campaigns',  value: s.totalCampaigns,   change: null,             index: 2 },
    { icon: Package,       label: 'Orders / Month',   value: s.ordersThisMonth,  change: null,             index: 3 },
    { icon: MessageSquare, label: 'Messages Sent',    value: comms.total,        change: null,             index: 4 },
    { icon: TrendingUp,    label: 'Delivery Rate',    value: deliveryRate,       change: null,             index: 5, suffix: '%' },
    { icon: Eye,           label: 'Open Rate',        value: openRate,           change: null,             index: 6, suffix: '%' },
    { icon: Activity,      label: 'Active Campaigns', value: s.activeCampaigns,  change: null,             index: 7 },
  ];

  return (
    <div className="relative min-h-screen max-w-[1440px]">
      <NeuralBackground />

      <div className="relative z-10">
        <StatusBar hasData={hasData} lastUpdated={lastUpdated} onRefetch={refetch} isLoading={isLoading} />

        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between mb-8"
        >
          <div>
            <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-2">// Intelligence Command Center</div>
            <h1 className="text-5xl font-black tracking-tighter leading-none text-white">
              XENO CORE
            </h1>
            <p className="text-zinc-600 text-xs font-medium mt-2 tracking-wide">
              {hasData
                ? `${(s.totalCustomers || 0).toLocaleString('en-IN')} customers · Real-time intelligence active`
                : 'No data — initialize the demo universe to begin'}
            </p>
          </div>

          {!hasData && (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleSeed}
              className="btn-primary gap-2"
            >
              <Database size={13} /> Seed Data
            </motion.button>
          )}
        </motion.div>

        {/* ── Hero: 3D Core + KPIs ─────────────────────── */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          {/* 3D Core */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="col-span-12 lg:col-span-4 relative overflow-hidden border border-white/[0.06]"
            style={{ background: '#050505', minHeight: 360 }}
          >
            <div className="absolute top-4 left-4 z-10 space-y-0.5">
              <div className="text-[8px] font-mono text-white/20">SYS://CORE.ENGINE</div>
              <div className="text-[8px] font-mono text-white/20">STATUS: NOMINAL</div>
            </div>
            <div className="absolute bottom-4 right-4 z-10 text-right space-y-0.5">
              <div className="text-[8px] font-mono text-white/20">RENDER: WebGL</div>
              <div className="text-[8px] font-mono text-white/20">FPS: 60</div>
            </div>
            <div className="absolute inset-0 pointer-events-none z-10" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 4px)',
            }} />
            <Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 border border-white/10 border-t-white/40" style={{ borderRadius: 0 }}
                />
              </div>
            }>
              <XenoCore revenue={s.revenueThisMonth} customers={s.totalCustomers} />
            </Suspense>
          </motion.div>

          {/* Top 4 KPIs */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-4">
            {kpis.slice(0, 4).map(k => (
              <HolographicModule key={k.label} {...k} />
            ))}
          </div>
        </div>

        {/* ── Second KPI Row ──────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.slice(4).map(k => (
            <HolographicModule key={k.label} {...k} />
          ))}
        </div>

        {/* ── Seed Prompt ─────────────────────────────── */}
        {!hasData && !isLoading && (
          <div className="mb-6">
            <SeedPrompt onSeed={handleSeed} />
          </div>
        )}

        {/* ── Charts Row ──────────────────────────────── */}
        {hasData && (
          <div className="grid grid-cols-12 gap-4 mb-4">
            <Panel title="Revenue Wave" subtitle="30-Day Trend" delay={0.3} className="col-span-12 lg:col-span-7">
              <div className="flex items-center justify-between px-6 py-3">
                <div />
                {s.revenueGrowth != null && (
                  <div className="flex items-center gap-1 text-[9px] font-black px-2 py-1 border border-white/10"
                    style={{ color: s.revenueGrowth >= 0 ? '#fff' : '#5a5a5a' }}>
                    {s.revenueGrowth >= 0 ? <ArrowUpRight size={9} /> : <TrendingDown size={9} />}
                    {Math.abs(s.revenueGrowth)}% MOM
                  </div>
                )}
              </div>
              <div className="px-2 pb-4">
                <RevenueWave data={data?.dailyRevenue || []} />
              </div>
            </Panel>

            <Panel title="Engagement" subtitle="Real-time Attribution" delay={0.4} className="col-span-12 lg:col-span-5">
              <div className="px-4 py-4">
                <EngagementRings delivery={deliveryRate} open={openRate} click={clickRate} />
              </div>
            </Panel>
          </div>
        )}

        {/* ── Channel + Campaigns ─────────────────────── */}
        {hasData && (
          <div className="grid grid-cols-12 gap-4 mb-6">
            <Panel title="Channel Split" subtitle="Distribution" delay={0.5} className="col-span-12 lg:col-span-4" style={{padding: '1.5rem'}}>
              <div className="px-6 pb-6 pt-0">
                <ChannelBars data={data?.channelBreakdown || []} />
              </div>
            </Panel>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="col-span-12 lg:col-span-8 border border-white/[0.06] overflow-hidden"
              style={{ background: '#050505' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Recent Campaigns</h3>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-widest"
                >
                  <motion.div className="w-1 h-1 bg-white rounded-full" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  Live
                </motion.div>
              </div>
              <div>
                {(data?.recentCampaigns || []).slice(0, 5).map((c, i) => (
                  <CampaignRow key={c.id} c={c} i={i} />
                ))}
                {(!data?.recentCampaigns || data.recentCampaigns.length === 0) && (
                  <div className="text-center py-12 text-zinc-700 text-xs font-black uppercase tracking-widest">
                    No campaigns yet
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────── */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4 h-80 border border-white/5 bg-white/[0.02] animate-pulse" />
              <div className="col-span-8 grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-36 border border-white/5 bg-white/[0.02] animate-pulse" />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
