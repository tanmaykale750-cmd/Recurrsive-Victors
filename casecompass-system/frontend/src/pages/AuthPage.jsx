import { useState } from 'react'
import { LuCompass, LuLoaderCircle, LuShieldCheck, LuFileSearch, LuCalendarCheck, LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '../state/AuthStore'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/controls'
import { cn } from '../lib/cn'

function Field({ id, label, hint, error, ...rest }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className={cn('field h-10', error && 'border-danger')} {...rest} />
      {hint && !error && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </div>
  )
}

const POINTS = [
  { icon: LuFileSearch, title: 'Every date tied to its source', body: 'Each event links to the document, page and exact sentence it came from.' },
  { icon: LuShieldCheck, title: 'Unclear dates are never guessed', body: 'Blurry, handwritten or vague dates are held for a reviewer instead.' },
  { icon: LuCalendarCheck, title: 'Court-ready chronology', body: 'Export a list of dates with citations, contradictions and missing documents.' },
]

export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') await login(form.email.trim(), form.password)
      else await register({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), password: form.password })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brass-soft text-brass ring-1 ring-brass/25"><LuCompass className="size-5" /></span>
          <span className="text-[16px] font-semibold">CaseCompass</span>
        </div>
        <div className="max-w-[440px]">
          <h1 className="text-[28px] leading-tight">Turn a case bundle into a chronology you can trust.</h1>
          <ul className="mt-8 grid gap-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><p.icon className="size-[18px]" /></span>
                <span>
                  <b className="block text-[14px] font-semibold">{p.title}</b>
                  <span className="text-[13px] text-ink-2">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-ink-3">CaseCompass organises the supplied record. It is not legal advice and does not predict outcomes.</p>
      </aside>

      <main className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-brass-soft text-brass ring-1 ring-brass/25"><LuCompass className="size-5" /></span>
            <span className="text-[16px] font-semibold">CaseCompass</span>
          </div>
          <h2 className="text-[22px]">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>
          <p className="mt-1 text-[13.5px] text-ink-2">{mode === 'signin' ? 'Welcome back. Pick up where you left off.' : 'Your name is recorded on every correction you make.'}</p>
          <SegmentedControl
            className="mt-5 w-full [&>button]:flex-1 [&>button]:justify-center"
            label="Account"
            value={mode}
            onChange={(m) => { setMode(m); setError('') }}
            options={[{ value: 'signin', label: 'Sign in' }, { value: 'register', label: 'Create account' }]}
          />
          <form onSubmit={submit} className="mt-5 grid gap-3.5" noValidate>
            {mode === 'register' && (
              <>
                <Field id="name" label="Full name" autoComplete="name" value={form.name} onChange={set('name')} required />
                <Field id="phone" label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} required hint="10 to 15 digits, with country code if outside India" />
              </>
            )}
            <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
            <div className="grid gap-1.5">
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input id="password" className="field h-10 pr-10" type={show ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} required />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
                  {show ? <LuEyeOff className="size-4" /> : <LuEye className="size-4" />}
                </button>
              </div>
              {mode === 'register' && <span className="text-[11.5px] text-ink-3">At least 8 characters, with letters and numbers</span>}
            </div>
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{error}</p>}
            <Button type="submit" variant="primary" className="mt-1 h-10" disabled={busy}>
              {busy && <LuLoaderCircle className="animate-spin" />} {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
