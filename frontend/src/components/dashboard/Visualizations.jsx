import { useMemo } from 'react';
import {
  AreaChart, Area, RadialBarChart, RadialBar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PolarAngleAxis
} from 'recharts';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';

/* ─── Custom Tooltip ────────────────────────────────── */
/* ─── Custom Tooltip ────────────────────────────────── */
const GlassTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#09090b',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: '12px 16px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
      minWidth: 120,
    }}>
      <p style={{ color: '#52525b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: '#ffffff', fontSize: 13, fontWeight: 900, margin: '3px 0' }}>
          {p.name}: {prefix}{typeof p.value === 'number' && p.value > 999 ? p.value.toLocaleString('en-IN') : p.value}
        </p>
      ))}
    </div>
  );
};

/* ─── Revenue Wave Chart ───────────────────────────── */
export function RevenueWave({ data = [] }) {
  const formatted = useMemo(() =>
    data.map(d => ({
      date: format(parseISO(String(d.date).split('T')[0]), 'MMM d'),
      revenue: Math.round(d.revenue || 0),
      orders: d.orders || 0,
    })), [data]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525b', fontWeight: 800 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#52525b', fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} width={48} />
        <Tooltip content={<GlassTooltip prefix="₹" />} />
        <Area type="monotone" dataKey="revenue" stroke="#ffffff" strokeWidth={2} fill="url(#revGrad)" dot={false} name="Revenue" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Radial Engagement Rings ──────────────────────── */
export function EngagementRings({ delivery = 0, open = 0, click = 0 }) {
  const data = [
    { name: 'Click-thru', value: click,    fill: '#3f3f46' },
    { name: 'Open Rate',  value: open,     fill: '#71717a' },
    { name: 'Delivery',   value: delivery, fill: '#ffffff' },
  ];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <RadialBarChart
          innerRadius="30%" outerRadius="100%"
          data={data} startAngle={90} endAngle={-270}
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background={{ fill: 'rgba(255,255,255,0.03)' }} cornerRadius={10}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </RadialBar>
          <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
        </RadialBarChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-3xl font-black text-white">{delivery}%</div>
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Global</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Channel Mini Sparklines ──────────────────────── */
const MONO_CH = { whatsapp: '#ffffff', sms: '#d4d4d8', email: '#71717a', rcs: '#3f3f46' };

export function ChannelBars({ data = [] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="space-y-4">
      {data.map((ch, i) => {
        const pct = Math.round((ch.count / total) * 100);
        const col = MONO_CH[ch.channel] || '#52525b';
        return (
          <motion.div key={ch.channel} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{ch.channel}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-white">{ch.count.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-zinc-600">{pct}%</span>
              </div>
            </div>
            <div className="h-[2px] rounded-full overflow-hidden bg-white/[0.03]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.2 + i * 0.05, duration: 1 }}
                style={{ background: col, height: '100%', opacity: 0.3 + (pct/100) * 0.7 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
