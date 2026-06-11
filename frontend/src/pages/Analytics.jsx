import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api.js';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import { TrendingUp, Users, Megaphone, Target } from 'lucide-react';
import clsx from 'clsx';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-white/10 bg-[#050505] px-4 py-3 text-xs" style={{backdropFilter: 'blur(10px)'}}>
      {label && <p className="font-black text-white uppercase tracking-widest mb-3">{label}</p>}
      {payload.map(p=>(
        <div key={p.name} className="flex items-center gap-3 mt-1.5">
          <div className="w-1.5 h-1.5 bg-white" style={{opacity: p.fill === '#ffffff' ? 1 : 0.4}}/>
          <p className="font-mono text-zinc-400">
            <span className="text-white font-bold">{p.name}:</span> {typeof p.value==='number'&&p.value>1000 ? p.value.toLocaleString('en-IN') : p.value}
            {p.name?.includes('Rate') ? '%' : ''}
          </p>
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { data: camData=[], isLoading: camLoad } = useQuery({ queryKey:['analytics-campaigns'], queryFn:()=>analyticsApi.campaigns(60) });
  const { data: cohorts=[], isLoading: cohortLoad } = useQuery({ queryKey:['cohorts'], queryFn:analyticsApi.cohorts });
  const { data: segData=[] } = useQuery({ queryKey:['analytics-segments'], queryFn:analyticsApi.segments });

  // Channel performance aggregation
  const chPerf = Object.values(camData.reduce((acc,c)=>{
    if(!acc[c.channel]) acc[c.channel]={channel:c.channel.toUpperCase(),campaigns:0,sent:0,delivered:0,opened:0,clicked:0};
    acc[c.channel].campaigns++;
    acc[c.channel].sent+=c.totalSent;
    acc[c.channel].delivered+=c.totalDelivered;
    acc[c.channel].opened+=c.totalOpened;
    acc[c.channel].clicked+=c.totalClicked;
    return acc;
  },{})).map(c=>({
    ...c,
    deliveryRate: c.sent>0 ? Number(((c.delivered/c.sent)*100).toFixed(1)) : 0,
    openRate:     c.delivered>0 ? Number(((c.opened/c.delivered)*100).toFixed(1)) : 0,
    clickRate:    c.opened>0 ? Number(((c.clicked/c.opened)*100).toFixed(1)) : 0,
  }));

  // RFM aggregation
  const rfm = Object.values(cohorts.reduce((acc,r)=>{
    const k=r.recency_label;
    if(!acc[k]) acc[k]={label:k,count:0,totalSpend:0};
    acc[k].count+=Number(r.count);
    acc[k].totalSpend+=Number(r.count)*Number(r.avg_spend);
    return acc;
  },{})).map(r=>({...r,avgSpend:r.count>0?Math.round(r.totalSpend/r.count):0}));
  const totalRFM = rfm.reduce((s,r)=>s+r.count,0);

  // Top campaigns
  const topCamps = [...camData].sort((a,b)=>b.openRate-a.openRate).slice(0,10);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
        <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-2">// Data Warehouse</div>
        <h1 className="text-4xl font-black tracking-tighter uppercase text-white">Performance Insights</h1>
        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-2">Correlated analytics across campaigns, segments, and nodes</p>
      </motion.div>

      {/* Channel performance row */}
      <div className="grid lg:grid-cols-2 gap-4">
        
        {/* Channel Deliverability Chart */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1}} 
          className="monolith-card p-6 relative overflow-hidden liquid-metal-hover">
          <div className="scan-line" />
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4 relative z-10">
            <Megaphone size={16} className="text-white"/>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Protocol Diagnostics</h3>
          </div>
          {chPerf.length>0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chPerf} barGap={0} margin={{top:10, right:10, left:-20, bottom:0}}>
                <XAxis dataKey="channel" tick={{fontSize:9,fill:'#71717a',fontWeight:900,fontFamily:'monospace'}} axisLine={false} tickLine={false} dy={10}/>
                <YAxis tick={{fontSize:9,fill:'#71717a',fontWeight:900,fontFamily:'monospace'}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
                <Tooltip content={<CustomTooltip/>} cursor={{fill: 'rgba(255,255,255,0.02)'}}/>
                <Bar dataKey="deliveryRate" name="Delivery Rate" fill="#ffffff" radius={[2,2,0,0]} />
                <Bar dataKey="openRate" name="Open Rate" fill="rgba(255,255,255,0.2)" radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">No telemetry data.</div>
          )}
        </motion.div>

        {/* RFM Cohorts */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1}} 
          className="monolith-card p-6 relative overflow-hidden liquid-metal-hover">
          <div className="scan-line" style={{animationDelay: '1s'}} />
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4 relative z-10">
            <Target size={16} className="text-white"/>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Recency Cohorts</h3>
          </div>
          {cohortLoad ? (
            <div className="space-y-4">{[...Array(4)].map((_,i)=><div key={i} className="h-10 bg-white/[0.02] border border-white/5 animate-pulse"/>)}</div>
          ) : rfm.length>0 ? (
            <div className="space-y-5">
              {rfm.map((r,i)=>{
                const pct=totalRFM>0?((r.count/totalRFM)*100).toFixed(1):0;
                const active = r.label.toLowerCase() === 'active';
                return (
                  <motion.div key={r.label} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-zinc-700'}`}/>
                        <span className={`font-black uppercase tracking-widest ${active ? 'text-white' : 'text-zinc-500'}`}>{r.label}</span>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="font-mono text-[10px] text-zinc-400">avg. ₹{r.avgSpend.toLocaleString('en-IN')}</span>
                        <span className="font-mono text-zinc-500 w-10 text-right">({pct}%)</span>
                        <span className="font-black text-white w-12 text-right">{r.count.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-1 bg-[#111] overflow-hidden">
                      <motion.div initial={{width:0}} animate={{width:`${pct}%`}}
                        transition={{delay:0.2+i*0.08,duration:1,ease:[0.23,1,0.32,1]}}
                        className={`h-full ${active ? 'bg-white' : 'bg-zinc-700'}`} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">No cohorts detected.</div>
          )}
        </motion.div>
      </div>

      {/* Campaign Performance Table */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.3}} 
        className="w-full border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center gap-3 bg-white/[0.02]">
          <TrendingUp size={16} className="text-white"/>
          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Campaign Efficacy (60D)</h3>
        </div>
        
        {topCamps.length>0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#050505]">
                  {['Campaign','Channel','Segment','Transmitted','Delivery %','Open %','Conv','State'].map(h=>(
                    <th key={h} className="px-6 py-4 text-left text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCamps.map((c,i)=>(
                  <motion.tr key={c.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group">
                    <td className="px-6 py-4 font-bold text-white max-w-[160px] truncate uppercase text-xs tracking-tight">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 border border-white/10 px-2 py-1">
                        {c.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500 font-mono">{c.segment?.name?.toUpperCase()||'SYSTEM ALL'}</td>
                    <td className="px-6 py-4 font-mono text-white text-xs">{c.totalSent.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={clsx('font-mono text-xs', c.deliveryRate>=90?'text-white':'text-zinc-500')}>{c.deliveryRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white">{c.openRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400 text-xs">{c.totalConverted}</td>
                    <td className="px-6 py-4">
                      <span className={clsx('text-[9px] font-black uppercase tracking-widest px-2 py-1 border', c.status === 'completed' ? 'border-white/20 text-zinc-400' : 'border-white text-white')}>
                        {c.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">NO CAMPAIGN RECORD</div>
        )}
      </motion.div>

      {/* Segment Sizes */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.4}} 
        className="monolith-card p-6 relative overflow-hidden liquid-metal-hover">
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4 relative z-10">
          <Users size={16} className="text-white"/>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Cluster Volumes</h3>
        </div>
        {segData.length>0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={segData.slice(0,10)} layout="vertical" barSize={10} margin={{left:-20}}>
              <XAxis type="number" tick={{fontSize:9,fill:'#71717a',fontWeight:900,fontFamily:'monospace'}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:8,fill:'#a1a1aa',fontWeight:900,fontFamily:'monospace',textTransform:'uppercase'}}
                axisLine={false} tickLine={false} width={150}/>
              <Tooltip content={<CustomTooltip/>} cursor={{fill: 'rgba(255,255,255,0.02)'}}/>
              <Bar dataKey="customerCount" name="Nodes" radius={[0,2,2,0]}>
                {segData.slice(0,10).map((_,i)=>(
                  <Cell key={i} fill="rgba(255,255,255,0.7)"/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">No clusters identified.</div>
        )}
      </motion.div>
    </div>
  );
}
