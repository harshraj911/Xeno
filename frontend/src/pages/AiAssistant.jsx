import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi, segmentsApi, campaignsApi, BASE_URL } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, RefreshCw, Zap, Terminal, Check, Info, AlertCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

const API = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const SUGGESTIONS = [
  { text: "Find high-value customers who haven't ordered in 60+ days", tag: 'SEG' },
  { text: "Create a segment for Delhi customers who spent ₹10k+",    tag: 'ACT' },
  { text: "Write a win-back WhatsApp message for lapsed customers",    tag: 'MSG' },
  { text: "Which channel has the best open rates? Analyze data.",       tag: 'INS' },
  { text: "Delete my oldest draft campaign",                           tag: 'ACT' },
];

/* ── Typing Indicator ─────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/10 bg-white/[0.03]">
        <Bot size={12} className="text-zinc-400" />
      </div>
      <div className="px-4 py-3 border border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              className="w-1 h-1 bg-white rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Message Bubble ───────────────────────────────── */
function Msg({ msg }) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system_executed';

  if (isSystem) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center my-2">
        <div className="flex items-center gap-2 px-3 py-1.5 border border-white/10 bg-white/[0.02] text-[9px] font-black uppercase tracking-widest text-zinc-500">
          <Check size={10} className="text-white" />
          {msg.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 border ${
        isUser ? 'border-white/20 bg-white text-black' : 'border-white/10 bg-white/[0.03]'
      }`}>
        {isUser
          ? <User size={11} className="text-black" />
          : <Bot size={11} className="text-zinc-400" />
        }
      </div>
      <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed border ${
        isUser
          ? 'bg-white text-black border-white font-medium'
          : 'bg-white/[0.02] text-zinc-300 border-white/5'
      }`}>
        {msg.streaming
          ? <>{msg.content}<motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="inline-block w-0.5 h-3.5 bg-white ml-0.5 align-middle" /></>
          : (() => {
              const parts = msg.content.split('```json');
              const verbal = parts[0].trim();
              if (verbal) return <div className="whitespace-pre-wrap">{verbal}</div>;
              if (parts.length > 1) return <div className="text-[10px] font-mono text-zinc-500 italic">Executing command...</div>;
              return <div className="whitespace-pre-wrap">{msg.content}</div>;
            })()
        }
      </div>
    </motion.div>
  );
}

export default function AiAssistant() {
  const qc = useQueryClient();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput]   = useState('');
  const [loading, setLoad]  = useState(false);
  const [thinking, setThink] = useState(false);
  
  // Persistence logic
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('xeno_ai_session');
    if (saved) return saved;
    const newId = uuidv4();
    localStorage.setItem('xeno_ai_session', newId);
    return newId;
  });

  const bottom  = useRef(null);
  const inputRef = useRef(null);

  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: analyticsApi.dashboard });
  const { data: prov } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => fetch(`${API}/ai/providers`).then(r => r.json()),
    staleTime: Infinity
  });

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const resp = await fetch(`${API}/ai/conversation/${sessionId}`);
        const data = await resp.json();
        if (data.length > 0) {
          setMsgs(data.map(m => ({ id: m.id, role: m.role, content: m.content })));
        } else {
          setMsgs([{
            id: 'welcome', role: 'assistant',
            content: `XENO AI COMMAND CONSOLE ONLINE.\n\nI am your intelligent CRM co-pilot. Query capabilities:\n→ Identify audience segments from natural language\n→ Draft personalized campaign messages\n→ Analyze campaign performance data\n→ Surface and correlate customer insights\n\nEnter command:`
          }]);
        }
      } catch (err) {
        console.error('Failed to load history', err);
      }
    };
    loadHistory();
  }, [sessionId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const executeCommand = async (fullText) => {
    // Look for any code block with json or just triple backticks
    const jsonMatch = fullText.match(/```(?:json)?\n?([\s\S]*?)```/);
    if (!jsonMatch) return;

    try {
      const cleanJson = jsonMatch[1].trim();
      const { command, payload } = JSON.parse(cleanJson);
      let result = null;

      switch (command) {
        case 'CREATE_SEGMENT':
          result = await segmentsApi.create(payload);
          qc.invalidateQueries(['segments']);
          qc.invalidateQueries(['dashboard']);
          toast.success(`Segment "${payload.name}" created via AI`);
          setMsgs(p => [...p, { id: uuidv4(), role: 'system_executed', content: `Created segment: ${payload.name}` }]);
          break;
        case 'DELETE_SEGMENT':
          await segmentsApi.delete(payload.segmentId);
          qc.invalidateQueries(['segments']);
          qc.invalidateQueries(['dashboard']);
          toast.success(`Segment deleted via AI`);
          setMsgs(p => [...p, { id: uuidv4(), role: 'system_executed', content: `Deleted segment ID: ${payload.segmentId}` }]);
          break;
        case 'CREATE_CAMPAIGN':
          result = await campaignsApi.create(payload);
          qc.invalidateQueries(['campaigns']);
          qc.invalidateQueries(['dashboard']);
          toast.success(`Campaign "${payload.name}" drafted via AI`);
          setMsgs(p => [...p, { id: uuidv4(), role: 'system_executed', content: `Drafted campaign: ${payload.name}` }]);
          break;
        case 'DELETE_CAMPAIGN':
          await campaignsApi.delete(payload.campaignId);
          qc.invalidateQueries(['campaigns']);
          qc.invalidateQueries(['dashboard']);
          toast.success(`Campaign deleted via AI`);
          setMsgs(p => [...p, { id: uuidv4(), role: 'system_executed', content: `Deleted campaign ID: ${payload.campaignId}` }]);
          break;
        default:
          console.warn('Unknown AI command:', command);
      }
    } catch (err) {
      console.error('Failed to execute AI command', err);
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || err.message;
      toast.error(`AI Task Failed: ${msg}`);
    }
  };

  const send = async (text = input) => {
    if (!text.trim() || loading) return;
    const uid = uuidv4();
    const aid = uuidv4();
    setMsgs(p => [...p, { id: uid, role: 'user', content: text }, { id: aid, role: 'assistant', content: '', streaming: true }]);
    setInput(''); setLoad(true); setThink(true);

    const history = msgs
      .filter(m => m.role !== 'system_executed')
      .slice(-10)
      .map(({ role, content }) => ({ 
        role, 
        content: content.replace(/```(?:json)?\n?([\s\S]*?)```/g, '').trim() 
      }));
    history.push({ role: 'user', content: text });

    try {
      const resp = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId })
      });
      if (!resp.ok) throw new Error('AI unavailable');
      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';
      setThink(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Robust SSE line splitting and multi-block handling
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line || !line.startsWith('data: ')) continue;
          
          // In case multiple data: blocks are on one line (rare but possible in some proxies)
          const dataBlocks = line.split('data: ').filter(Boolean);
          for (const block of dataBlocks) {
            try {
              const d = JSON.parse(block.trim());
              if (d.delta) { 
                full += d.delta; 
                setMsgs(p => p.map(m => m.id === aid ? { ...m, content: full } : m)); 
              }
              if (d.done) { 
                setMsgs(p => p.map(m => m.id === aid ? { ...m, streaming: false, content: full || 'Done.' } : m));
                executeCommand(full);
              }
              if (d.error) { 
                setMsgs(p => p.map(m => m.id === aid ? { ...m, streaming: false, content: `ERROR: ${d.error}` } : m)); 
              }
            } catch (e) {
              console.error('SSE JSON Parse Error:', e, block);
            }
          }
        }
      }
      
      // Handle completion if stream ends without 'done' event
      setMsgs(p => p.map(m => m.id === aid ? { ...m, streaming: false, content: full || (full === '' ? 'AI failed to generate a response. Please try again.' : full) } : m));
    } catch (e) {
      setThink(false);
      setMsgs(p => p.map(m => m.id === aid ? { ...m, streaming: false, content: 'ERROR: AI subsystem unavailable. Check your API key configuration.' } : m));
    } finally { setLoad(false); inputRef.current?.focus(); }
  };

  const clearChat = () => {
    const newId = uuidv4();
    setSessionId(newId);
    localStorage.setItem('xeno_ai_session', newId);
    setMsgs([{ id: 'w', role: 'assistant', content: 'Console cleared. New session started. Enter command:' }]);
  };

  const provLabel = prov ? [prov.groq && 'Groq', prov.nvidia && 'NVIDIA'].filter(Boolean).join(' + ') : '...';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-[860px] mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3 mb-4 border border-white/5 flex-shrink-0"
        style={{ background: 'rgba(5,5,5,0.9)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 flex items-center justify-center border border-white/15 bg-white/[0.04]">
              <Terminal size={14} className="text-white" />
            </div>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white"
            />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Xeno AI Console</p>
            <p className="text-[9px] text-zinc-600 font-mono flex items-center gap-1.5 mt-0.5">
              <Zap size={8} />
              {provLabel} · LLaMA 3.1 70B
            </p>
          </div>
        </div>

        {dash?.summary && (
          <div className="hidden md:flex items-center gap-4 text-[9px] font-black text-zinc-700 uppercase tracking-widest">
            <span>{dash.summary.totalCustomers?.toLocaleString()} CUST</span>
            <div className="w-px h-3 bg-white/5" />
            <span>{dash.summary.totalCampaigns} CMPN</span>
            <div className="w-px h-3 bg-white/5" />
            <span>{dash.summary.activeSegments} SEG</span>
          </div>
        )}

        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-700 hover:text-white transition-all border border-white/5 hover:border-white/20"
        >
          <RefreshCw size={9} /> Reset Session
        </button>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4 scroll-smooth">
        <AnimatePresence>
          {msgs.map(m => <Msg key={m.id} msg={m} />)}
          {thinking && (
            <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottom} />
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {msgs.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pb-4"
          >
            <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em] mb-2">// Quick commands</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SUGGESTIONS.map((s, i) => (
                <motion.button key={i}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-3 px-4 py-3 text-left border border-white/5 bg-white/[0.01] transition-all magnetic-btn"
                >
                  <span className="text-[8px] font-black tracking-widest text-zinc-600 flex-shrink-0 border border-white/10 px-1.5 py-0.5">{s.tag}</span>
                  <span className="text-[11px] font-medium text-zinc-500 flex-1 line-clamp-1 group-hover:text-white transition-colors">{s.text}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="border border-white/10 bg-[#050505] flex-shrink-0 relative overflow-hidden mb-6"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-50" />
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="text-[10px] font-mono text-zinc-700 mt-2.5 flex-shrink-0">›</div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask AI to create segments, draft campaigns, or analyze data..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-700 outline-none resize-none min-h-[36px] max-h-[120px] leading-relaxed font-mono"
            rows={1}
          />
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => send()} disabled={!input.trim() || loading}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white text-black disabled:opacity-20 transition-all mt-0.5 magnetic-btn group"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
          </motion.button>
        </div>
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-[8px] font-mono text-zinc-700">↩ send</span>
          <span className="text-[8px] font-mono text-zinc-800">·</span>
          <span className="text-[8px] font-mono text-zinc-700">⇧↩ newline</span>
        </div>
      </motion.div>
    </div>
  );
}
