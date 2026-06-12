import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { campaignsApi, segmentsApi } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Plus, Sparkles, Play, Pause, X, Check, RefreshCw, Wand2, ArrowRight, Zap } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const CH = [
  {id:'whatsapp', label:'WhatsApp', color:'#ffffff', bg:'rgba(255,255,255,0.05)'},
  {id:'sms',      label:'SMS',      color:'#d4d4d8', bg:'rgba(255,255,255,0.03)'},
  {id:'email',    label:'Email',    color:'#71717a', bg:'rgba(255,255,255,0.02)'},
  {id:'rcs',      label:'RCS',      color:'#3f3f46', bg:'rgba(255,255,255,0.01)'},
];

const STATUS_CONF = {
  draft:     { color:'#3f3f46', label:'Draft'     },
  running:   { color:'#ffffff', label:'Running'   },
  completed: { color:'#a1a1aa', label:'Completed' },
  paused:    { color:'#52525b', label:'Paused'    },
  failed:    { color:'#27272a', label:'Failed'    },
};

function CampaignCard({ c, onLaunch, onPause, idx }) {
  const nav = useNavigate();
  const ch = CH.find(x => x.id === c.channel) || CH[0];
  const sc = STATUS_CONF[c.status] || STATUS_CONF.draft;
  const dr = c.totalSent > 0 ? ((c.totalDelivered / c.totalSent) * 100).toFixed(0) : 0;
  const or = c.totalDelivered > 0 ? ((c.totalOpened / c.totalDelivered) * 100).toFixed(0) : 0;

  const metrics = [
    { label: 'Sent', value: c.totalSent?.toLocaleString() || '0' },
    { label: 'Deliv', value: `${dr}%` },
    { label: 'Open', value: `${or}%` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4 }}
      onClick={() => nav(`/campaigns/${c.id}`)}
      className="relative overflow-hidden border border-white/[0.06] bg-[#050505] cursor-pointer group transition-all duration-500 hover:border-white/15"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Light sweep on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.04) 50%, transparent 100%)'}}
      />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center border border-white/8 bg-white/[0.02] group-hover:border-white/20 transition-colors">
              <Megaphone size={12} className="text-zinc-500 group-hover:text-white transition-colors" />
            </div>
            <span className="text-[9px] font-black tracking-widest uppercase text-zinc-600" style={{color: ch.color}}>{ch.label}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <motion.div
              animate={c.status === 'running' ? { opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-1 rounded-full"
              style={{ background: sc.color }}
            />
            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: sc.color }}>{sc.label}</span>
          </div>
        </div>

        <h3 className="font-black text-white text-sm mb-1 truncate uppercase tracking-tight group-hover:text-white transition-colors">
          {c.name}
        </h3>
        <p className="text-[9px] text-zinc-700 font-mono mb-4">
          {c.segment?.name || 'All customers'} · {format(new Date(c.createdAt), 'MMM d, yyyy')}
        </p>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {metrics.map(m => (
            <div key={m.label} className="border border-white/5 px-2 py-1.5 text-center bg-white/[0.01]">
              <div className="text-xs font-black text-white">{m.value}</div>
              <div className="text-[8px] text-zinc-700 uppercase tracking-widest">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Delivery bar */}
        {c.totalSent > 0 && (
          <div className="h-px bg-white/[0.04] overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dr}%` }}
              transition={{ delay: 0.5 + idx * 0.06, duration: 1.2, ease: 'easeOut' }}
              className="h-full bg-white"
              style={{ opacity: 0.4 + (Number(dr) / 100) * 0.6 }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {c.status === 'draft' && (
            <button
              onClick={e => { e.stopPropagation(); onLaunch(c.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-[9px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors"
            >
              <Play size={9} fill="currentColor" /> Launch
            </button>
          )}
          {c.status === 'running' && (
            <button
              onClick={e => { e.stopPropagation(); onPause(c.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
            >
              <Pause size={9} fill="currentColor" /> Pause
            </button>
          )}
          <div className="ml-auto flex items-center gap-1 text-[9px] text-zinc-700 group-hover:text-zinc-500 transition-colors font-mono">
            View <ArrowRight size={9} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Campaigns() {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSugg, setAiSugg] = useState(null);
  const [form, setForm] = useState({ name:'', segmentId:'', channel:'whatsapp', message:'', aiMessage:'' });

  const { data: campsResp, isLoading } = useQuery({ queryKey:['campaigns'], queryFn:campaignsApi.list });
  const camps = campsResp?.data || [];

  const { data: segs=[] } = useQuery({ queryKey:['segments'], queryFn:segmentsApi.list });
  const createMut = useMutation({ mutationFn:campaignsApi.create, onSuccess:()=>{ qc.invalidateQueries(['campaigns']); toast.success('Campaign created'); setShow(false); }});
  const launchMut = useMutation({ mutationFn:campaignsApi.launch, onSuccess:()=>{ qc.invalidateQueries(['campaigns']); toast.success('Campaign launched'); }});
  const pauseMut  = useMutation({ mutationFn:campaignsApi.pause,  onSuccess:()=>{ qc.invalidateQueries(['campaigns']); toast.success('Campaign paused'); }});

  const doAiMsg = async () => {
    if (!form.aiMessage.trim()) return;
    setAiLoading(true);
    try {
      const segName = segs.find(s => s.id === form.segmentId)?.name || 'general audience';
      const r = await campaignsApi.aiMessage({ 
        intent: form.aiMessage, 
        channel: form.channel,
        segmentDescription: segName
      });
      setAiSugg(r);
    } catch { toast.error('AI generation failed'); }
    finally { setAiLoading(false); }
  };

  const submit = () => {
    if (!form.name || !form.segmentId) return toast.error('Name and segment required');
    const msg = aiMode ? aiSugg?.message || form.aiMessage : form.message;
    createMut.mutate({ name:form.name, segmentId:form.segmentId, channel:form.channel, messageTemplate:msg });
  };

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="flex items-end justify-between">
        <div>
          <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-2">// Campaign Studio</div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase">Campaigns</h1>
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-1.5">
            {camps.length} total · {camps.filter(c=>c.status==='running').length} active
          </p>
        </div>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
          onClick={()=>setShow(true)} className="btn-primary gap-2">
          <Plus size={13}/> New Campaign
        </motion.button>
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{opacity:0,y:12,scale:0.98}}
            animate={{opacity:1,y:0,scale:1}}
            exit={{opacity:0,y:12,scale:0.98}}
            transition={{type:'spring',damping:30,stiffness:340}}
            className="border border-white/10 bg-[#050505] p-6 relative"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={13}/> New Campaign
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex border border-white/10 overflow-hidden">
                  {['AI', 'Manual'].map(m => (
                    <button key={m} onClick={()=>setAiMode(m==='AI')}
                      className={clsx('px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all',
                        (m==='AI')===aiMode ? 'bg-white text-black' : 'text-zinc-600 hover:bg-white/5')}>
                      {m==='AI' && <Sparkles size={8} className="inline mr-1"/>}{m}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShow(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={14}/></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Campaign Name *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                  placeholder="e.g. VIP Re-engagement" className="input" />
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Audience Segment *</label>
                <select value={form.segmentId} onChange={e=>setForm({...form,segmentId:e.target.value})} className="input">
                  <option value="">Select segment...</option>
                  {segs.map(s=><option key={s.id} value={s.id}>{s.name} ({s.customerCount})</option>)}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Channel</label>
              <div className="flex gap-2">
                {CH.map(c=>(
                  <button key={c.id} onClick={()=>setForm({...form,channel:c.id})}
                    className={clsx('px-4 py-2 text-[9px] font-black uppercase tracking-widest border transition-all',
                      form.channel===c.id ? 'bg-white text-black border-white' : 'border-white/10 text-zinc-600 hover:border-white/20')}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {aiMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">AI Prompt</label>
                  <textarea value={form.aiMessage} onChange={e=>setForm({...form,aiMessage:e.target.value})}
                    placeholder="Describe your campaign goal... (e.g. 'Win-back customers inactive for 90 days')"
                    className="input min-h-[80px]" rows={3}/>
                </div>
                <button onClick={doAiMsg} disabled={aiLoading||!form.aiMessage.trim()}
                  className="btn-monolith text-[9px] disabled:opacity-40 gap-2">
                  {aiLoading ? <RefreshCw size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                  {aiLoading ? 'Generating...' : 'Generate Message'}
                </button>
                <AnimatePresence>
                  {aiSugg && (
                    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                      className="p-4 border border-white/15 bg-white/[0.03]">
                      <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2">Generated Message</p>
                      <p className="text-sm text-zinc-200 font-medium leading-relaxed">{aiSugg.message}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block mb-1.5">Message *</label>
                <textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})}
                  placeholder="Write your campaign message..." className="input min-h-[80px]" rows={3}/>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
              <button onClick={submit} disabled={createMut.isPending} className="btn-primary gap-2 disabled:opacity-40">
                <Check size={13}/> Create Campaign
              </button>
              <button onClick={()=>setShow(false)} className="btn-secondary">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-64 border border-white/5 bg-white/[0.01] animate-pulse" />
          ))}
        </div>
      ) : camps.length === 0 ? (
        <motion.div initial={{opacity:0}} animate={{opacity:1}}
          className="border border-white/5 bg-[#050505] p-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
          <motion.div animate={{y:[-4,4,-4]}} transition={{duration:4,repeat:Infinity}}>
            <Megaphone size={40} className="mx-auto mb-6 text-white/10" />
          </motion.div>
          <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-3">// Campaign Studio</div>
          <p className="text-white font-black text-xl mb-2 uppercase tracking-tighter">No Campaigns Yet</p>
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest mb-8">Create your first campaign to start reaching customers</p>
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
            onClick={()=>setShow(true)} className="btn-primary gap-2 mx-auto">
            <Plus size={13}/> Create First Campaign
          </motion.button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {camps.map((c, idx) => (
              <CampaignCard key={c.id} c={c} idx={idx}
                onLaunch={id=>launchMut.mutate(id)}
                onPause={id=>pauseMut.mutate(id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
