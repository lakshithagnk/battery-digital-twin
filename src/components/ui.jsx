import clsx from 'clsx'
import { safeJson } from '../utils/format'

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-4 md:mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-brand-cyan">{eyebrow}</p>}
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white lg:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ children, className }) {
  return <section className={clsx('panel p-4 sm:p-5', className)}>{children}</section>
}

export function SoftPanel({ children, className }) {
  return <section className={clsx('panel-soft p-4 sm:p-5', className)}>{children}</section>
}

export function StatCard({ label, value, unit, sub, tone = 'blue', children }) {
  const toneMap = {
    blue: 'text-brand-blue',
    cyan: 'text-brand-cyan',
    green: 'text-brand-green',
    amber: 'text-brand-amber',
    red: 'text-brand-red',
    violet: 'text-brand-violet',
    pink: 'text-brand-pink'
  }
  return (
    <div className="mini-card overflow-hidden relative">
      <div className={clsx('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-20', {
        'bg-brand-blue': tone === 'blue',
        'bg-brand-cyan': tone === 'cyan',
        'bg-brand-green': tone === 'green',
        'bg-brand-amber': tone === 'amber',
        'bg-brand-red': tone === 'red',
        'bg-brand-violet': tone === 'violet',
        'bg-brand-pink': tone === 'pink'
      })} />
      <p className="label">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={clsx('font-display text-2xl font-black tracking-tight', toneMap[tone] ?? toneMap.blue)}>{value}</span>
        {unit && <span className="text-sm font-bold text-ink-400">{unit}</span>}
      </div>
      {sub && <p className="mt-2 text-xs text-ink-400">{sub}</p>}
      {children}
    </div>
  )
}

export function Badge({ tone = 'slate', children, className }) {
  const map = {
    blue: 'badge-blue',
    cyan: 'badge-cyan',
    green: 'badge-green',
    amber: 'badge-amber',
    red: 'badge-red',
    violet: 'badge-violet',
    slate: 'badge-slate'
  }
  return <span className={clsx(map[tone] ?? map.slate, className)}>{children}</span>
}

export function StatusDot({ status = 'idle' }) {
  const map = {
    ok: 'dot-green',
    connected: 'dot-green',
    online: 'dot-green',
    warning: 'dot-amber',
    testing: 'dot-blue',
    error: 'dot-red',
    fault: 'dot-red',
    idle: 'dot-idle',
    closed: 'dot-idle'
  }
  return <span className={map[status] ?? map.idle} />
}

export function Button({ variant = 'ghost', className, children, ...props }) {
  const map = {
    primary: 'btn-primary',
    cyan: 'btn-cyan',
    green: 'btn-green',
    danger: 'btn-danger',
    ghost: 'btn-ghost'
  }
  return <button className={clsx(map[variant] ?? map.ghost, className)} {...props}>{children}</button>
}

export function Input({ label, hint, className, ...props }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      <input className="input" {...props} />
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export function Select({ label, hint, children, className, ...props }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      <select className="input" {...props}>{children}</select>
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export function Textarea({ label, hint, className, ...props }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      <textarea className="input min-h-32 font-mono" {...props} />
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export function ProgressBar({ value = 0, max = 100, tone = 'cyan' }) {
  const percent = Math.min(100, Math.max(0, (Number(value) / Math.max(Number(max), 1)) * 100))
  const colors = {
    cyan: 'from-brand-cyan to-brand-blue',
    green: 'from-brand-green to-brand-cyan',
    amber: 'from-brand-amber to-brand-red',
    violet: 'from-brand-violet to-brand-pink'
  }
  return (
    <div className="h-2 overflow-hidden rounded-full bg-night-700">
      <div className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-300', colors[tone] ?? colors.cyan)} style={{ width: `${percent}%` }} />
    </div>
  )
}

export function JsonBlock({ data, title, className }) {
  return (
    <div className={clsx('overflow-hidden rounded-2xl border border-white/10 bg-night-950/85', className)}>
      {title && <div className="border-b border-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-ink-400">{title}</div>}
      <pre className="max-h-96 overflow-auto p-4 text-xs leading-5 text-cyan-100"><code>{typeof data === 'string' ? data : safeJson(data)}</code></pre>
    </div>
  )
}

export function EmptyState({ title, description, action, icon = '◫' }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <div className="mb-4 text-5xl opacity-50">{icon}</div>
      <p className="font-display text-lg font-black text-white">{title}</p>
      {description && <p className="mt-2 max-w-lg text-sm leading-6 text-ink-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionTitle({ eyebrow, title, description, right }) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-cyan">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-xl font-black text-white">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-400">{description}</p>}
      </div>
      {right}
    </div>
  )
}
