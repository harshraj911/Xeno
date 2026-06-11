import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi, receiptsApi } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, Sparkles, RefreshCw,
  Send, CheckCircle, XCircle, Eye, MousePointer,
  ShoppingCart, BookOpen, TrendingUp, Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUS_COLORS = {
  queued:'#475569', sent:'#06b6d4', delivered:'#22c55e',
  opened:'#a855f7', read:'#f59e0b', clicked:'#f97316',
  converted:'#10b981', failed:'#ef4444'
};

const METRICS = [
  { key:'totalSent',      label:'Sent',       icon:Send,         color:'#06b6d4' },
  { key:'totalDelivered', label:'Delivered',   icon:CheckCircle,  color:'#22c55e' },
  { key:'totalFailed',    label:'Failed',      icon:XCircle,      color:'#ef4444' },
  { key:'totalOpened',    label:'Opened',      icon:Eye,          color:'#a855f7' },
  { key:'totalRead',      label:'Read',        icon:BookOpen,     color:'#f59e0b' },
  { key:'totalClicked',   label:'Clicked',     icon:MousePointer, color:'#f97316' },
  { key:'totalConverted', label:'Converted',   icon:ShoppingCart, color:'#10b981' },
];

function FunnelBar({ label, value, max, color, index }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
      transition={{ delay: index * 0.08, ease:[0.23,1,0.32,1] }}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-bold text-slate-400">{label}</span>
        <span className="font-black text-white">{value.toLocaleString()} <span className="text-slate-600">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }}
          transition={{ delay: 0.3 + index*0.08, duration:0.8, ease:[0.23,1,0.32,1] }}
          className="h-full rounded-full"
          style={{ background:`linear-gradient(90deg, ${color}66, ${color})`, boxShadow:`0 0 10px ${color}66` }}
        />
      </div>
    </motion.div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsApi.get(id),
    refetchInterval: d => d?.status === 'running' ? 5000 : 30000
  });

  const { data: stats } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => campaignsApi.stats(id),
    refetchInterval: 8000
  });

  const { data: insightsData, isFetching: insightsFetch, refetch: fetchInsights } = useQuery({
    queryKey: ['campaign-insights', id],
    queryFn: () => campaignsApi.insights(id),
    enabled: false
  });

  const { data: receipts } = useQuery({
    queryKey: ['receipts', id],
    queryFn: () => receiptsApi.campaign(id, { limit:30 }),
    refetchInterval: 8000
  });

  const launchMut = useMutation({ mutationFn:()=>campaignsApi.launch(id), onSuccess:()=>{ qc.invalidateQueries(['campaign',id]); toast.success('🚀 Campaign launched!'); }});
  const pauseMut  = useMutation({ mutationFn:()=>campaignsApi.pause(id),  onSuccess:()=>{ qc.invalidateQueries(['campaign',id]); toast.success('Campaign paused'); }});

  if (isLoading) return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="h-10 w-64 skeleton rounded-2xl"/>
      <div className="grid grid-cols-4 gap-4">{[...Array(7)].map((_,i)=><div key={i} className="h-28 skeleton rounded-3xl"/>)}</div>
    </div>
  );
  if (!campaign) return <div className="p-6 text-slate-500 font-semibold">Campaign not found</div>;

  const s = stats || campaign;
  const dr = s.totalSent>0 ? ((s.totalDelivered/s.totalSent)*100).toFixed(1) : 0;
  const or = s.totalDelivered>0 ? ((s.totalOpened/s.totalDelivered)*100).toFixed(1) : 0;
  const cr = s.totalOpened>0 ? ((s.totalClicked/s.totalOpened)*100).toFixed(1) : 0;

  const breakdownData = Object.entries(s.statusBreakdown||{})
    .map(([st,cnt])=>({ status:st, count:cnt, color:STATUS_COLORS[st]||'#475569' }))
    .sort((a,b)=>b.count-a.count);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
        className="flex items-center gap-4">
        <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
          onClick={()=>navigate('/campaigns')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
          <ArrowLeft size={16}/>
        </motion.button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white tracking-tight">{campaign.name}</h1>
            {campaign.aiGenerated && (
              <span className="badge badge-ai"><Sparkles size={10}/> AI Generated</span>
            )}
            <span className={`badge badge-${campaign.status}`}>{campaign.status}</span>
          </div>
          <p className="text-sm text-slate-500 font-semibold mt-0.5">
            {campaign.segment?.name} · {campaign.channel} · {format(new Date(campaign.createdAt),'MMM d, yyyy h:mm a')}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status==='draft' && (
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={()=>launchMut.mutate()} disabled={launchMut.isPending} className="btn-primary magnetic-btn">
              {launchMut.isPending?<RefreshCw size={14} className="animate-spin"/>:<Play size={14}/>} Launch
            </motion.button>
          )}
          {campaign.status==='running' && (
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={()=>pauseMut.mutate()} className="btn-secondary magnetic-btn">
              <Pause size={14}/> Pause
            </motion.button>
          )}
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={()=>fetchInsights()}
            disabled={insightsFetch || s.totalSent===0}
            className="btn-secondary magnetic-btn">
            {insightsFetch?<RefreshCw size={14} className="animate-spin"/>:<Sparkles size={14}/>} AI Insights
          </motion.button>
        </div>
      </motion.div>

      {/* AI Insights */}
      <AnimatePresence>
        {insightsData?.insights && (
          <motion.div initial={{opacity:0,y:10,scale:0.98}} animate={{opacity:1,y:0,scale:1}}
            exit={{opacity:0,y:10}} className="border-animated p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-violet-400"/>
              <span className="text-xs font-black text-violet-300 uppercase tracking-wider">AI Campaign Analysis</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-medium">
              {insightsData.insights}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message preview */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.1}}
        className="glass-card p-5 liquid-metal-hover">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Message Template</p>
        <p className="text-sm text-slate-300 font-mono leading-relaxed px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          {campaign.messageTemplate}
        </p>
      </motion.div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {METRICS.map((m, i) => (
          <motion.div key={m.key}
            initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
            transition={{delay:0.1+i*0.05, type:'spring'}}
            whileHover={{y:-3}}
            className="glass-card p-4 text-center relative overflow-hidden liquid-metal-hover">
            <div className="absolute inset-0 opacity-10" style={{background:`radial-gradient(circle at 50% 0%, ${m.color}, transparent 70%)`}}/>
            <m.icon size={16} className="mx-auto mb-2" style={{color:m.color}}/>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4+i*0.05}}
              className="text-xl font-black text-white">
              {(s[m.key]||0).toLocaleString()}
            </motion.div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Delivery Rate', value:`${dr}%`, color:'#22c55e', sub:'of sent' },
          { label:'Open Rate',     value:`${or}%`, color:'#a855f7', sub:'of delivered' },
          { label:'Click Rate',    value:`${cr}%`, color:'#f97316', sub:'of opened' },
        ].map((r, i) => (
          <motion.div key={r.label}
            initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3+i*0.08}}
            className="glass-card p-5 text-center relative overflow-hidden liquid-metal-hover">
            <div className="absolute inset-0 opacity-10" style={{background:`radial-gradient(circle at 50% 0%, ${r.color}, transparent 70%)`}}/>
            <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:0.5+i*0.1, type:'spring', stiffness:200}}
              className="text-4xl font-black mb-1" style={{color:r.color}}>
              {r.value}
            </motion.div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{r.label}</p>
            <p className="text-[10px] text-slate-700 font-semibold mt-0.5">{r.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.4}}
          className="glass-card p-6 liquid-metal-hover flex-1">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-violet-400"/>
            <h3 className="text-sm font-black text-white">Delivery Funnel</h3>
          </div>
          {s.totalSent > 0 ? (
            <div className="space-y-4">
              {[
                {label:'Sent',      value:s.totalSent,      color:'#06b6d4'},
                {label:'Delivered', value:s.totalDelivered, color:'#22c55e'},
                {label:'Opened',    value:s.totalOpened,    color:'#a855f7'},
                {label:'Clicked',   value:s.totalClicked,   color:'#f97316'},
                {label:'Converted', value:s.totalConverted, color:'#10b981'},
              ].map((item, i) => (
                <FunnelBar key={item.label} {...item} max={s.totalSent} index={i}/>
              ))}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-3">
              <Play size={32} className="text-slate-700"/>
              <p className="text-sm text-slate-600 font-semibold">Launch campaign to see funnel data</p>
            </div>
          )}
        </motion.div>

        {/* Status bar chart */}
        <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:0.4}}
          className="glass-card p-6 liquid-metal-hover flex-1">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} className="text-cyan-400"/>
            <h3 className="text-sm font-black text-white">Status Distribution</h3>
          </div>
          {breakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdownData} layout="vertical">
                <XAxis type="number" tick={{fontSize:10,fill:'#475569',fontWeight:700}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="status" tick={{fontSize:10,fill:'#64748b',fontWeight:700}}
                  axisLine={false} tickLine={false} width={70}/>
                <Tooltip
                  contentStyle={{background:'rgba(8,8,20,0.95)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12}}
                  labelStyle={{color:'#64748b',fontSize:11,fontWeight:700}}
                  itemStyle={{color:'#e2e8f0',fontSize:13,fontWeight:700}}
                />
                <Bar dataKey="count" radius={[0,6,6,0]}>
                  {breakdownData.map(e=>(
                    <Cell key={e.status} fill={e.color}
                      style={{filter:`drop-shadow(0 0 6px ${e.color}66)`}}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-slate-700 font-semibold text-sm">No data yet</div>
          )}
        </motion.div>
      </div>

      {/* Recent messages */}
      {receipts?.data?.length > 0 && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}}
          className="glass-card overflow-hidden liquid-metal-hover">
          <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-sm font-black text-white">Recent Messages</h3>
            <span className="text-xs font-black text-slate-600">{receipts.pagination?.total?.toLocaleString()} total</span>
          </div>
          <div>
            {receipts.data.map((comm, i) => (
              <motion.div key={comm.id}
                initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
                className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                  <span className="text-xs font-black text-slate-500">
                    {comm.customer?.name?.charAt(0)||'?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-300 truncate">{comm.customer?.name}</p>
                  <p className="text-xs text-slate-600 font-semibold truncate">{comm.customer?.email}</p>
                </div>
                <p className="text-xs text-slate-700 font-semibold hidden md:block">
                  {comm.sentAt ? format(new Date(comm.sentAt),'MMM d, h:mm a') : '—'}
                </p>
                <span className="badge text-[10px] font-black"
                  style={{background:`${STATUS_COLORS[comm.status]}18`, color:STATUS_COLORS[comm.status],
                    border:`1px solid ${STATUS_COLORS[comm.status]}35`}}>
                  {comm.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
