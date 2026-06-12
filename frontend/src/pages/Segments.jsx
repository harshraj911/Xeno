import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { segmentsApi } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Users, Tag, RefreshCw, Trash2, Wand2, X, Check, Brain, Network } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import NetworkBackground from '../components/NetworkBackground.jsx';

const FIELDS = [
  { value:'totalSpend',    label:'Total Spend (₹)',        type:'number' },
  { value:'orderCount',    label:'Order Count',            type:'number' },
  { value:'avgOrderValue', label:'Avg Order Value (₹)',    type:'number' },
  { value:'lastOrderAt',   label:'Last Order (days ago)',  type:'days'   },
  { value:'firstOrderAt',  label:'First Order (days ago)', type:'days'   },
  { value:'city',          label:'City',                   type:'string' },
  { value:'tags',          label:'Tags',                   type:'string' },
  { value:'channel',       label:'Channel',                type:'select', options:['whatsapp','sms','email','rcs'] },
];
const NUM_OPS    = [{v:'gte',l:'≥'},{v:'lte',l:'≤'},{v:'gt',l:'>'},{v:'lt',l:'<'},{v:'eq',l:'='}];
const DAYS_OPS   = [{v:'daysAgo_lte',l:'within last X days'},{v:'daysAgo_gte',l:'more than X days ago'}];
const STR_OPS    = [{v:'eq',l:'equals'},{v:'contains',l:'contains'},{v:'not_contains',l:'not contains'}];
const getOps = t => t==='number'?NUM_OPS : t==='days'?DAYS_OPS : STR_OPS;


/* ── Segment Floating Node ────────────────────────────────── */
function SegCard({ seg, onRefresh, onDelete, idx }) {
  return (
    <motion.div
      initial={{opacity:0, scale:0.9, y: 20}} animate={{opacity:1, scale:1, y: 0}}
      transition={{ delay: idx * 0.05, type: 'spring', damping: 20 }}
      whileHover={{y:-8, scale: 1.02}}
      className="monolith-card p-6 relative overflow-visible group cursor-crosshair h-full flex flex-col justify-between"
      style={{
        background: 'rgba(5,5,5,0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      {/* Node Connection Line decoration */}
      <div className="absolute -top-4 -left-4 w-8 h-8 border-t border-l border-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b border-r border-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        <div className="flex items-start justify-between mb-6">
          <div className="w-10 h-10 flex items-center justify-center bg-white/[0.03] border border-white/10 group-hover:border-white/30 transition-all">
            <Network size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
          </div>
          <div className="text-right">
            <motion.div initial={{scale:0}} animate={{scale:1}} className="text-2xl font-black text-white tracking-tighter">
              {seg.customerCount.toLocaleString()}
            </motion.div>
            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-0.5">Nodes</div>
          </div>
        </div>

        <p className="text-xs font-black text-white mb-2 uppercase tracking-widest break-words leading-tight">
          {seg.name}
        </p>
        
        {seg.aiGenerated && (
          <span className="inline-flex items-center gap-1.5 text-[8px] font-black text-black bg-white px-2 py-0.5 mb-3 uppercase tracking-[0.2em]">
            <Brain size={10} /> AI Synced
          </span>
        )}
        
        {seg.description && (
          <p className="text-[10px] text-zinc-500 font-medium line-clamp-2 leading-relaxed mb-4">
            {seg.description}
          </p>
        )}
      </div>

      <div>
        <div className="h-px bg-white/[0.04] mb-4 w-full" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div animate={{ opacity:[0.2, 1, 0.2] }} transition={{ duration:2, repeat: Infinity }} className="w-1.5 h-1.5 bg-white rounded-full" />
            <p className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">
              {seg.lastCalculated ? format(new Date(seg.lastCalculated),'HH:mm:ss') : 'PENDING'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>onRefresh(seg.id)} className="w-6 h-6 flex items-center justify-center border border-white/5 hover:border-white/30 text-zinc-500 hover:text-white transition-all bg-[#050505]">
              <RefreshCw size={10}/>
            </button>
            <button onClick={()=>onDelete(seg.id)} className="w-6 h-6 flex items-center justify-center border border-white/5 hover:border-white/30 text-zinc-500 hover:text-white transition-all bg-[#050505]">
              <Trash2 size={10}/>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Segments() {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [aiPrev, setAiPrev] = useState(null);
  const [aiLoad, setAiLoad] = useState(false);
  const [prevCount, setPrevCount] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', operator:'AND', conditions:[{field:'totalSpend',op:'gte',value:''}] });

  const { data: segs=[], isLoading } = useQuery({ queryKey:['segments'], queryFn:segmentsApi.list });
  
  const createMut = useMutation({ mutationFn:segmentsApi.create, onSuccess:()=>{ qc.invalidateQueries(['segments']); toast.success('Segment nodes initialized'); setShow(false); reset(); }});
  const refreshMut = useMutation({ mutationFn:segmentsApi.refresh, onSuccess:()=>{ qc.invalidateQueries(['segments']); toast.success('Nodes synced'); }});
  const deleteMut = useMutation({ mutationFn:segmentsApi.delete, onSuccess:()=>{ qc.invalidateQueries(['segments']); toast.success('Cluster terminated'); }});

  function reset() { setForm({name:'',description:'',operator:'AND',conditions:[{field:'totalSpend',op:'gte',value:''}]}); setPrevCount(null); setPrompt(''); setAiPrev(null); }

  const doAiGen = async () => {
    if(!prompt.trim()) return;
    setAiLoad(true);
    try {
      const r = await segmentsApi.aiGenerate(prompt);
      setAiPrev(r);
      toast.success(`Matrix query returned ${r.estimatedCount} nodes`);
    } catch { toast.error('AI correlation failed'); }
    finally { setAiLoad(false); }
  };

  const doPreview = async () => {
    try { const {count} = await segmentsApi.preview({operator:form.operator,conditions:form.conditions}); setPrevCount(count); }
    catch { toast.error('Preview failed'); }
  };

  const addCond = () => setForm(f=>({...f,conditions:[...f.conditions,{field:'orderCount',op:'gte',value:''}]}));
  const remCond = i => setForm(f=>({...f,conditions:f.conditions.filter((_,idx)=>idx!==i)}));
  const updCond = (i,k,v) => setForm(f=>({...f,conditions:f.conditions.map((c,idx)=>idx===i?{...c,[k]:v}:c)}));

  return (
    <div className="space-y-6 max-w-[1400px] relative min-h-full">
      {/* Network Background for active segments */}
      {segs.length > 0 && !show && <NetworkBackground activeNodes={segs.length * 5} opacity={0.4} />}

      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="flex items-end justify-between relative z-10">
        <div>
          <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-2">// Network Clusters</div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase">Audience Intelligence</h1>
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-2">{segs.length} Active Neural Clusters</p>
        </div>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
          onClick={()=>{setShow(true);setAiMode(true)}} className="btn-primary gap-2 text-[10px]">
          <Plus size={12}/> Initialize Node
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {show && (
          <motion.div initial={{opacity:0,y:20,scale:0.98}} animate={{opacity:1,y:0,scale:1}}
            exit={{opacity:0,y:10,scale:0.98}} transition={{type:'spring',damping:30,stiffness:400}}
            className="border border-white/10 bg-[#050505] relative z-20">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div className="flex items-center justify-between p-6 border-b border-white/[0.04]">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                <Sparkles size={14} className="text-white"/> Generate Cluster
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex border border-white/10 p-0.5">
                  {['AI','Manual'].map(m=>(
                    <button key={m} onClick={()=>setAiMode(m==='AI')}
                      className={clsx('px-5 py-1.5 text-[9px] font-black transition-all flex items-center gap-2 uppercase tracking-widest',
                        (m==='AI')===aiMode ? 'bg-white text-black' : 'text-zinc-500 hover:text-white')}>
                      {m==='AI' && <Brain size={10}/>}{m}
                    </button>
                  ))}
                </div>
                <button onClick={()=>{setShow(false);reset()}} className="p-2 text-zinc-600 hover:text-white"><X size={14}/></button>
              </div>
            </div>

            <div className="p-6">
              {aiMode ? (
                <div className="space-y-6">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.1em]">
                    // Input natural language parameters. AI engine will construct logical network rules.
                  </p>
                  <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
                    placeholder="E.g. VIP customers who spent > 50000 but inactive for 3 months"
                    className="input min-h-[100px]"
                  />
                  <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
                    onClick={doAiGen} disabled={aiLoad||!prompt.trim()} 
                    className="btn-monolith gap-3 w-full border border-white/20 hover:border-white disabled:opacity-30">
                    {aiLoad ? <RefreshCw size={14} className="animate-spin"/> : <Network size={14}/>}
                    {aiLoad ? 'Compiling Rules...' : 'Execute Correlation'}
                  </motion.button>

                  <AnimatePresence>
                    {aiPrev && (
                      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                        className="p-5 border border-white/15 bg-white/[0.03] space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{aiPrev.name}</p>
                          <div className="text-right">
                            <motion.span initial={{scale:0}} animate={{scale:1}} className="text-xl font-black text-white tracking-tighter">
                              {aiPrev.estimatedCount.toLocaleString()}
                            </motion.span>
                            <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-2 block">Nodes</span>
                          </div>
                        </div>
                        {aiPrev.description && <p className="text-xs text-zinc-400 font-mono">{aiPrev.description}</p>}
                        
                        <div className="flex gap-3 pt-2">
                          <motion.button whileTap={{scale:0.97}}
                            onClick={()=>createMut.mutate({name:aiPrev.name,description:aiPrev.description,rules:aiPrev.rules,aiGenerated:true,aiPrompt:prompt})}
                            disabled={createMut.isPending} 
                            className="bg-white text-black px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-zinc-200">
                            <Check size={12}/> Activate Cluster
                          </motion.button>
                          <button onClick={()=>setAiPrev(null)} className="border border-white/10 text-white px-5 py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center gap-2">
                            <X size={12}/> Discard
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[8px] font-black text-zinc-600 mb-2 block uppercase tracking-[0.2em]">Node Identifier *</label>
                      <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="E.g. High Value Segment" className="input-monolith"/>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-zinc-600 mb-2 block uppercase tracking-[0.2em]">Parameters</label>
                      <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Optional metadata" className="input-monolith"/>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white/[0.02] p-4 border border-white/5">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Logic Gate:</span>
                    <select value={form.operator} onChange={e=>setForm({...form,operator:e.target.value})} 
                      className="input w-auto py-1.5 font-black uppercase tracking-widest">
                      <option value="AND">REQUIRE ALL (AND)</option>
                      <option value="OR">REQUIRE ANY (OR)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    {form.conditions.map((c,i)=>{
                      const fd = FIELDS.find(f=>f.value===c.field);
                      const ops = getOps(fd?.type||'number');
                      return (
                        <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}}
                          className="flex items-center gap-3">
                          <select value={c.field} onChange={e=>{const nf=FIELDS.find(f=>f.value===e.target.value);updCond(i,'field',e.target.value);updCond(i,'op',getOps(nf?.type)[0].v);}}
                            className="input w-1/3">
                            <option value="">Select Parameter</option>
                            {FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <select value={c.op} onChange={e=>updCond(i,'op',e.target.value)} className="input w-1/4">
                            {ops.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                          {fd?.type==='select'
                            ? <select value={c.value} onChange={e=>updCond(i,'value',e.target.value)} className="input flex-1">
                                {fd.options.map(o=><option key={o} value={o}>{o}</option>)}
                              </select>
                            : <input value={c.value} onChange={e=>updCond(i,'value',e.target.value)} placeholder="Value" className="input flex-1 font-mono"/>
                          }
                          <button onClick={()=>remCond(i)} className="w-8 h-8 flex items-center justify-center border border-white/5 text-zinc-600 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0">
                            <X size={12}/>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                    <button onClick={addCond} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white">
                      <Plus size={10}/> Add Parameter
                    </button>
                    <div className="w-px h-4 bg-white/10" />
                    <button onClick={doPreview} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white">
                      <Users size={10}/> Compute Sample
                    </button>
                    {prevCount!==null && (
                      <motion.span initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}}
                        className="text-[10px] font-mono text-white ml-2 bg-white/10 px-2 py-0.5 border border-white/20">
                        {prevCount} valid nodes
                      </motion.span>
                    )}
                    <button onClick={()=>createMut.mutate({name:form.name,description:form.description,rules:{operator:form.operator,conditions:form.conditions}})}
                      disabled={!form.name||createMut.isPending} className="btn-monolith ml-auto py-2.5 text-[9px] disabled:opacity-30">
                      <Check size={12}/> Create Node
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* States */}
      <div className="relative z-10">
        {segs.length===0 && !show ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} 
            className="border border-white/5 bg-[#050505]/80 backdrop-blur-xl p-24 text-center relative overflow-hidden h-[60vh] flex flex-col justify-center items-center">
            <NetworkBackground activeNodes={50} opacity={0.2} />
            <div className="relative z-10 text-center">
              <motion.div animate={{scale:[0.9, 1.1, 0.9], opacity:[0.5, 1, 0.5]}} transition={{duration:4,repeat:Infinity}}>
                <div className="w-16 h-16 flex items-center justify-center border border-white/10 bg-white/[0.02] mx-auto mb-6 rotate-45">
                  <Brain size={24} className="text-white -rotate-45" />
                </div>
              </motion.div>
              <div className="text-[8px] font-black tracking-[0.5em] text-zinc-600 uppercase mb-3">// Network Unpopulated</div>
              <p className="text-white font-black text-2xl mb-2 uppercase tracking-tighter">Initialize Intelligence Graph</p>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest mb-8 max-w-md mx-auto">SYS: NO NODE CLUSTERS DETECTED IN CURRENT MATRIX. AWAITING SEGMENT DEFINITION PROMPT.</p>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>{setShow(true);setAiMode(true);}} className="btn-monolith mx-auto px-10">
                <Sparkles size={14}/> Define First Cluster
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            <AnimatePresence>
              {segs.map((s, idx)=>(
                <SegCard key={s.id} seg={s} idx={idx} onRefresh={id=>refreshMut.mutate(id)} onDelete={id=>deleteMut.mutate(id)}/>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
