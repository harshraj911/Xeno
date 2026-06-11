import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ShoppingBag, IndianRupee, MapPin, Pencil, Check, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

/* ─── Edit Form ─── */
function EditForm({ customer, onSave, onCancel, onDelete, saving }) {
  const [form, setForm] = useState({
    name:    customer.name    || '',
    email:   customer.email   || '',
    phone:   customer.phone   || '',
    city:    customer.city    || '',
    channel: customer.channel || 'email',
    isActive: customer.isActive ?? true,
    tags:    (customer.tags || []).join(', '),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      isActive: form.isActive,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    onSave(payload);
  };

  const labelCls = "block text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2";
  const inputCls = "w-full bg-[#030303] border border-white/10 px-4 py-3 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-white/30 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={form.name} onChange={e=>set('name',e.target.value)} required/>
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91…"/>
        </div>
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input className={inputCls} type="email" value={form.email} onChange={e=>set('email',e.target.value)} required/>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>City</label>
          <input className={inputCls} value={form.city} onChange={e=>set('city',e.target.value)} placeholder="E.g. Mumbai"/>
        </div>
        <div>
          <label className={labelCls}>Channel</label>
          <select className={inputCls} value={form.channel} onChange={e=>set('channel',e.target.value)}>
            {['email','whatsapp','sms','rcs'].map(ch=>(
              <option key={ch} value={ch}>{ch.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Tags (comma separated)</label>
        <input className={inputCls} value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="vip, loyal, churned"/>
      </div>
      <div className="flex items-center gap-3 py-2">
        <button type="button"
          onClick={()=>set('isActive',!form.isActive)}
          className={clsx(
            'relative w-10 h-5 border transition-colors duration-200 flex-shrink-0',
            form.isActive ? 'bg-white border-white' : 'bg-transparent border-white/20'
          )}>
          <span className={clsx(
            'absolute top-[2px] w-3.5 h-3.5 transition-all duration-200',
            form.isActive ? 'left-[22px] bg-black' : 'left-[2px] bg-white/40'
          )}/>
        </button>
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{form.isActive ? 'Node Active' : 'Node Inactive'}</span>
      </div>
      
      <div className="flex flex-col gap-3 pt-6 border-t border-white/[0.04]">
        <button type="submit" disabled={saving}
          className="btn-monolith w-full">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
          {saving ? 'Syncing...' : 'Update Record'}
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 btn-monolith-outline">
            Cancel
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete}
              className="px-6 border border-white/10 hover:border-white text-zinc-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all">
              <Trash2 size={14}/>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/* ─── Customer Drawer ─── */
function CustomerDrawer({ id, onClose }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
    enabled: !!id,
    onSuccess: () => setEditing(false),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', id],
    queryFn: () => customersApi.timeline(id),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: (data) => customersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['customer', id]);
      qc.invalidateQueries(['customers']);
      toast.success('Node synchronized');
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => customersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['customers']);
      toast.success('Node terminated');
      onClose();
    },
  });

  return (
    <AnimatePresence>
      {id && (
        <>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-40" onClick={onClose}/>
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
            transition={{type:'spring',damping:30,stiffness:400}}
            className="fixed right-0 top-0 h-full w-[480px] z-50 overflow-y-auto"
            style={{background:'#050505', borderLeft:'1px solid rgba(255,255,255,0.1)'}}>
            
            {/* Top decorative line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white" />

            {isLoading ? (
              <div className="p-8 space-y-6">
                {[...Array(6)].map((_,i)=><div key={i} className="h-10 bg-white/[0.02] border border-white/5 animate-pulse"/>)}
              </div>
            ) : c ? (
              <div className="p-8 space-y-8">
                {/* ── Top bar ── */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 flex items-center justify-center text-xl font-black text-white border border-white/20 bg-white/[0.03]">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-black text-white tracking-tighter uppercase">{c.name}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{c.email}</p>
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">ID: {c.id.substring(0,8)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!editing && (
                      <button onClick={()=>setEditing(true)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white transition-all">
                        <Pencil size={12}/> <span className="text-[9px] font-black uppercase tracking-widest">Edit</span>
                      </button>
                    )}
                    <button onClick={onClose}
                      className="w-8 h-8 flex items-center justify-center border border-white/10 hover:bg-white text-zinc-400 hover:text-black transition-all">
                      <X size={14}/>
                    </button>
                  </div>
                </div>

                {/* ── Edit / View mode ── */}
                <AnimatePresence mode="wait">
                  {editing ? (
                    <motion.div key="edit" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                      <div className="h-px w-full bg-white/10 mb-6" />
                      <EditForm
                        customer={c}
                        saving={updateMut.isPending}
                        onSave={(data)=>updateMut.mutate(data)}
                        onCancel={()=>setEditing(false)}
                        onDelete={()=>{ if(window.confirm('Terminate this node?')) deleteMut.mutate(); }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-8">
                      {/* Meta tags */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="px-3 py-1 border border-white text-white text-[9px] font-black uppercase tracking-widest">{c.channel}</span>
                        {c.city && <span className="px-3 py-1 border border-white/20 text-zinc-300 text-[9px] font-black uppercase tracking-widest bg-white/[0.02] flex items-center gap-1.5"><MapPin size={10}/> {c.city}</span>}
                        {c.phone && <span className="px-3 py-1 border border-white/20 text-zinc-300 text-[9px] font-black uppercase tracking-widest bg-white/[0.02]">{c.phone}</span>}
                        {c.tags?.map(t=><span key={t} className="px-3 py-1 border border-white/10 text-zinc-400 text-[9px] font-black uppercase tracking-widest">{t}</span>)}
                        <span className={clsx('px-3 py-1 border text-[9px] font-black uppercase tracking-widest', c.isActive ? 'border-white text-white' : 'border-zinc-800 text-zinc-600')}>
                          {c.isActive ? 'Active' : 'Offline'}
                        </span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-1 p-1 bg-white/10 border border-white/10">
                        {[
                          {v:c.totalSpend, l:'LTV', pf:'₹'},
                          {v:c.orderCount, l:'Orders', pf:''},
                          {v:c.avgOrderValue, l:'AOV', pf:'₹'},
                        ].map(m=>(
                          <div key={m.l} className="bg-[#050505] p-4 text-center">
                            <p className="text-xl font-black text-white tracking-tighter">{m.pf}{Math.round(m.v).toLocaleString()}</p>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">{m.l}</p>
                          </div>
                        ))}
                      </div>

                      {c.lastOrderAt && (
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest border-l-2 border-white/20 pl-3">
                          Last Signal: {format(new Date(c.lastOrderAt),'HH:mm:ss · yyyy.MM.dd')}
                        </p>
                      )}

                      {/* Timeline Log */}
                      {timeline.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-2">
                            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Activity Log</p>
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          </div>
                          
                          <div className="space-y-4 relative font-mono text-xs">
                            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10"/>
                            {timeline.slice(0,15).map((item,i)=>(
                              <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}} className="flex gap-4">
                                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 z-10 bg-[#050505] border border-white/20 text-white">
                                  {item.type==='order' ? <ShoppingBag size={10}/> : <IndianRupee size={10}/>}
                                </div>
                                <div className="flex-1 pb-2">
                                  {item.type==='order' ? (
                                    <>
                                      <p className="text-[11px] text-zinc-300">
                                        <span className="text-white font-bold">ORDER_COMPLETED</span> // ₹{Math.round(item.data.amount).toLocaleString('en-IN')}
                                      </p>
                                      <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-widest">
                                        {format(new Date(item.date),'HH:mm:ss · MM.dd.yy')} · src={item.data.category||item.data.channel}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[11px] text-zinc-300">
                                        <span className="text-white font-bold">CMPN_INTERACTION</span> // {item.data.status}
                                      </p>
                                      <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-widest">
                                        {format(new Date(item.date),'HH:mm:ss · MM.dd.yy')} · id={item.data.campaign?.name||'System'}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="p-8 text-zinc-600 font-mono text-sm">ERR: NODE_NOT_FOUND</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Customers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selId, setSelId] = useState(null);
  const [sort, setSort] = useState('createdAt');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, sort],
    queryFn: () => customersApi.list({ page, limit:25, search:search||undefined, sort }),
    keepPreviousData: true
  });

  const { data: statsData } = useQuery({ queryKey:['customer-stats'], queryFn:customersApi.stats });

  const customers = data?.data||[];
  const pg = data?.pagination;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="flex items-end justify-between">
        <div>
          <div className="text-[8px] font-black tracking-[0.5em] text-zinc-700 uppercase mb-2">// Global Dataset</div>
          <h1 className="text-4xl font-black tracking-tighter uppercase text-white">Audience Matrix</h1>
          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1.5">
            {statsData?.total?.toLocaleString()||'—'} nodes connected
          </p>
        </div>
      </motion.div>

      {/* Aggregate Stats */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {l:'Total Nodes',v:statsData.total?.toLocaleString()},
            {l:'Avg Lifetime Value',v:`₹${Math.round(statsData.avgSpend).toLocaleString('en-IN')}`},
            {l:'Avg Order Freq',v:statsData.avgOrders},
            {l:'Peak Node Value',v:`₹${Math.round(statsData.topSpend).toLocaleString('en-IN')}`},
          ].map((m,i)=>(
            <motion.div key={m.l} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
              className="monolith-card p-6">
              <p className="text-2xl font-black text-white tracking-tighter">{m.v}</p>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-2">{m.l}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Controls */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}} className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
            placeholder="Query matrix..." className="w-full bg-[#050505] border border-white/10 px-4 py-2.5 pl-10 text-xs text-white font-mono placeholder-zinc-700 outline-none focus:border-white/30 transition-all"/>
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value)} className="bg-[#050505] border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-white/30 transition-all">
          <option value="createdAt">Chronological</option>
          <option value="totalSpend">Highest Value</option>
          <option value="orderCount">Highest Frequency</option>
          <option value="lastOrderAt">Recent Activity</option>
        </select>
      </motion.div>

      {/* Data Table */}
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.25}}
        className="w-full border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                {['Identifier','Comms','Location','Lifetime Value','Freq','Last Signal','Classification'].map(h=>(
                  <th key={h} className="px-6 py-4 text-left text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(10)].map((_,i)=>(
                    <tr key={i} className="border-b border-white/5">
                      {[...Array(7)].map((_,j)=>(
                        <td key={j} className="px-6 py-4"><div className="h-3 bg-white/5 animate-pulse"/></td>
                      ))}
                    </tr>
                  ))
                : customers.map((c,i)=>(
                    <motion.tr key={c.id}
                      initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.02, type:'spring', stiffness: 300, damping: 20}}
                      whileHover={{ y: -8, scale: 1.01, backgroundColor: 'rgba(255,255,255,0.03)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', zIndex: 10 }}
                      className="border-b border-white/5 transition-all duration-300 cursor-crosshair group relative block sm:table-row" 
                      onClick={()=>setSelId(c.id)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center text-[10px] font-black border border-white/10 bg-white/[0.02] group-hover:border-white/30 group-hover:text-white text-zinc-500 transition-all">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs uppercase tracking-tight">{c.name}</p>
                            <p className="text-[10px] text-zinc-600 font-mono mt-0.5 group-hover:text-zinc-400 transition-colors">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 border border-white/10 px-2 py-1">
                          {c.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{c.city||'UNKNOWN'}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-white font-mono">₹{Math.round(c.totalSpend).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-zinc-400 font-mono">{c.orderCount}</td>
                      <td className="px-6 py-4 text-[10px] text-zinc-500 font-mono uppercase">
                        {c.lastOrderAt ? format(new Date(c.lastOrderAt),'yyyy.MM.dd') : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {c.tags?.slice(0,2).map(t=><span key={t} className="text-[8px] font-black uppercase tracking-widest text-zinc-500 bg-white/[0.03] border border-white/5 px-1.5 py-0.5">{t}</span>)}
                        </div>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {pg && pg.pages > 1 && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-600 bg-white/[0.01]">
            <span>{pg.total.toLocaleString()} MATCHES</span>
            <div className="flex items-center gap-4">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                className="hover:text-white disabled:opacity-30 transition-colors">← PREV</button>
              <span className="text-white px-2 py-1 border border-white/10 bg-black">{page} // {pg.pages}</span>
              <button disabled={page===pg.pages} onClick={()=>setPage(p=>p+1)}
                className="hover:text-white disabled:opacity-30 transition-colors">NEXT →</button>
            </div>
          </div>
        )}
      </motion.div>

      <CustomerDrawer id={selId} onClose={()=>setSelId(null)}/>
    </div>
  );
}
