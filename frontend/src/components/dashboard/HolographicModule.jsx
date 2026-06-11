import { motion } from 'framer-motion';
import { ArrowUpRight, TrendingDown, Minus } from 'lucide-react';

const PALETTE = [
  { color: '#ffffff', glow: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)' },
  { color: '#fafafa', glow: 'rgba(255,255,255,0.2)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
  { color: '#f4f4f5', glow: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.1)'  },
  { color: '#e4e4e7', glow: 'rgba(255,255,255,0.05)', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)' },
];

export default function HolographicModule({
  icon: Icon,
  label,
  value,
  change,
  prefix = '',
  suffix = '',
  index = 0,
  subtitle,
  large = false,
}) {
  const p = PALETTE[index % PALETTE.length];

  const changePositive = change > 0;
  const changeNeutral = change === null || change === undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-xl group sweep-hover"
      style={{
        background: '#09090b',
        border: `1px solid ${p.border}`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Corner glow bleed */}
      <div
        className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: 'white', filter: 'blur(80px)', opacity: 0.03 }}
      />

      <div className={`p-${large ? '8' : '6'}`} style={{ padding: large ? '2rem' : '1.5rem' }}>
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.1]"
          >
            <Icon size={18} className="text-white" />
          </div>

          {/* Change badge */}
          {!changeNeutral && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg border border-white/10"
              style={{ color: changePositive ? '#ffffff' : '#a1a1aa' }}
            >
              {changePositive ? <ArrowUpRight size={10} /> : <TrendingDown size={10} />}
              {Math.abs(change)}%
            </motion.div>
          )}
        </div>

        {/* Value */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + index * 0.05 }}
          className="text-[2.2rem] font-black tracking-tight text-white leading-none"
        >
          {prefix}
          {typeof value === 'number' ? value.toLocaleString('en-IN') : (value ?? '—')}
          {suffix}
        </motion.div>

        <div className="text-[10px] font-black text-zinc-500 mt-2 uppercase tracking-[0.2em]">{label}</div>
        {subtitle && <div className="text-xs text-zinc-700 mt-0.5">{subtitle}</div>}

        {/* Animated accent line */}
        <div className="mt-4 h-[2px] rounded-full overflow-hidden bg-white/[0.05]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(90, 40 + (index * 12) % 50)}%` }}
            transition={{ delay: 0.5 + index * 0.05, duration: 1.2 }}
            className="h-full bg-white"
          />
        </div>
      </div>
    </motion.div>
  );
}
