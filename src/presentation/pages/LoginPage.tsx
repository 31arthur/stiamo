import { useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { ArrowRight, Cloud, HardDrive, Loader2, MailCheck } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { Logo } from '@/presentation/layout/Logo'
import { fadeUp, spring, stagger } from '@/presentation/motion/presets'

const SAMPLE_BLOCKS = [
  { title: 'Hearing — Mehta v. Coastal', time: '10:30 · Court 23', tone: 'bg-ws-sb-soft text-ws-sb border-ws-sb/30', x: '8%', y: '18%', d: 0 },
  { title: 'FSA sprint planning', time: '11:30 · Virtual', tone: 'bg-ws-fsa-soft text-ws-fsa border-ws-fsa/30', x: '38%', y: '34%', d: 1.2 },
  { title: 'Confirm appointment — Mr. Arora', time: '14:00 · Call', tone: 'bg-ws-personal-soft text-ws-personal border-ws-personal/30', x: '14%', y: '54%', d: 0.6 },
  { title: 'Podcast episode prep', time: '17:00 · Studio 2', tone: 'bg-ws-media-soft text-ws-media border-ws-media/30', x: '44%', y: '70%', d: 1.8 },
]

type Mode = 'signin' | 'signup' | 'reset'

const COPY: Record<Mode, { title: string; cta: string }> = {
  signin: { title: 'Welcome back', cta: 'Sign in' },
  signup: { title: 'Create your account', cta: 'Create account' },
  reset: { title: 'Reset password', cta: 'Send reset link' },
}

export function LoginPage() {
  const { user, login, register, resetPassword } = useAuth()
  const { backend } = useServices()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
  const shake = useAnimationControls()

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={redirectTo} replace />

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'reset') {
        await resetPassword(email)
        setNotice('Check your inbox for a link to reset your password.')
      } else {
        await (mode === 'signin' ? login({ email, password }) : register({ name, email, password }))
        navigate(redirectTo, { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-ambient grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r bg-muted/30 lg:block">
        <motion.div variants={stagger(0.1, 0.1)} initial="hidden" animate="show" className="relative z-10 flex h-full flex-col justify-between p-12">
          <motion.div variants={fadeUp}>
            <Logo />
          </motion.div>
          <div className="max-w-md">
            <motion.h1 variants={fadeUp} className="font-display text-6xl leading-[1.02] tracking-tight">
              Plan the day <em className="text-ws-sb">you meant</em> to have.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 text-muted-foreground">
              Cases and hearings, appointments and meetings, tasks, follow-ups and goals — across S&B, FSA, media and life. One calm canvas.
            </motion.p>
          </div>
          <motion.p variants={fadeUp} className="text-xs text-muted-foreground">
            stiamo — <span className="italic">“we are”</span>, together, on time.
          </motion.p>
        </motion.div>
        {SAMPLE_BLOCKS.map((b) => (
          <motion.div
            key={b.title}
            className={cn('absolute z-0 w-60 rounded-xl border px-3 py-2 shadow-float backdrop-blur-sm', b.tone)}
            style={{ left: `calc(${b.x} + 18rem)`, top: b.y }}
            initial={{ opacity: 0, y: 30, rotate: -2 }}
            animate={{ opacity: 0.9, y: [0, -10, 0], rotate: [-2, 1, -2] }}
            transition={{
              opacity: { duration: 0.8, delay: 0.4 + b.d * 0.3 },
              y: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: b.d },
              rotate: { duration: 9, repeat: Infinity, ease: 'easeInOut', delay: b.d },
            }}
          >
            <div className="text-[11px] font-medium opacity-70">{b.time}</div>
            <div className="text-sm font-medium text-foreground">{b.title}</div>
          </motion.div>
        ))}
      </section>

      <section className="flex items-center justify-center p-5 sm:p-8">
        <motion.div animate={shake} className="w-full max-w-sm">
          <motion.div variants={stagger(0.07, 0.15)} initial="hidden" animate="show" className="grid gap-5">
            <motion.div variants={fadeUp} className="lg:hidden">
              <Logo />
            </motion.div>
            <motion.div variants={fadeUp}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2 key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-display text-4xl tracking-tight">
                  {COPY[mode].title}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {backend === 'firebase' ? (
                  <>
                    <Cloud className="size-3.5" /> Synced securely to your Stiamo cloud
                  </>
                ) : (
                  <>
                    <HardDrive className="size-3.5" /> Offline mode — demo: <span className="font-medium text-foreground">demo@stiamo.app / password123</span>
                  </>
                )}
              </p>
            </motion.div>

            {mode !== 'reset' && (
              <motion.div variants={fadeUp} role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-sm">
                {(['signin', 'signup'] as const).map((m) => (
                  <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)} className={cn('relative rounded-md py-1.5 font-medium', mode === m ? 'text-foreground' : 'text-muted-foreground')}>
                    {mode === m && <motion.span layoutId="auth-tab" transition={spring.snappy} className="absolute inset-0 rounded-md bg-background shadow-float" />}
                    <span className="relative">{m === 'signin' ? 'Sign in' : 'Create account'}</span>
                  </button>
                ))}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} noValidate className="grid gap-4">
              <AnimatePresence initial={false}>
                {mode === 'signup' && (
                  <motion.div key="name" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid gap-2 overflow-hidden">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" autoComplete="name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" inputMode="email" className="h-10" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {mode !== 'reset' && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === 'signin' && backend === 'firebase' && (
                      <button type="button" onClick={() => switchMode('reset')} className="text-xs text-muted-foreground hover:text-foreground">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="h-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {mode === 'signup' && <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>}
                </div>
              )}
              <motion.p role="alert" initial={false} animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }} className="-my-2 overflow-hidden text-sm text-destructive">
                {error}
              </motion.p>
              {notice && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                  <MailCheck className="size-4" /> {notice}
                </motion.p>
              )}
              <Button type="submit" disabled={submitting} className="group h-10 w-full">
                {submitting ? <Loader2 className="animate-spin" /> : COPY[mode].cta}
                {!submitting && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
              </Button>
              {mode === 'reset' && (
                <button type="button" onClick={() => switchMode('signin')} className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back to sign in
                </button>
              )}
            </form>
          </motion.div>
        </motion.div>
      </section>
    </main>
  )
}
