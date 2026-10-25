import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { Logo } from '@/presentation/layout/AppShell'
import { fadeUp, stagger } from '@/presentation/motion/presets'

const SAMPLE_BLOCKS = [
  { title: 'Design review', time: '09:30', tone: 'bg-meeting-soft text-meeting border-meeting/30', x: '8%', y: '18%', d: 0 },
  { title: 'Write launch brief', time: '11:00', tone: 'bg-task-soft text-task border-task/30', x: '38%', y: '34%', d: 1.2 },
  { title: 'Follow up with Priya', time: '14:15', tone: 'bg-follow-up-soft text-follow-up border-follow-up/30', x: '14%', y: '54%', d: 0.6 },
  { title: '1:1 with Sam', time: '16:00', tone: 'bg-meeting-soft text-meeting border-meeting/30', x: '44%', y: '70%', d: 1.8 },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
  const shake = useAnimationControls()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={redirectTo} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate(redirectTo, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-ambient grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r bg-muted/30 lg:block">
        <motion.div variants={stagger(0.1, 0.1)} initial="hidden" animate="show" className="relative z-10 flex h-full flex-col justify-between p-12">
          <motion.div variants={fadeUp}>
            <Logo />
          </motion.div>
          <div className="max-w-md">
            <motion.h1 variants={fadeUp} className="font-display text-6xl leading-[1.02] tracking-tight">
              Plan the day <em className="text-task">you meant</em> to have.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 text-muted-foreground">
              Tasks, follow-ups and meetings on one calm canvas. Drag your day into shape, then let it flow.
            </motion.p>
          </div>
          <motion.p variants={fadeUp} className="text-xs text-muted-foreground">
            stiamo — <span className="italic">“we are”</span>, together, on time.
          </motion.p>
        </motion.div>

        {SAMPLE_BLOCKS.map((b) => (
          <motion.div
            key={b.title}
            className={cn('absolute z-0 w-56 rounded-xl border px-3 py-2 shadow-float backdrop-blur-sm', b.tone)}
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

      <section className="flex items-center justify-center p-6">
        <motion.div animate={shake} className="w-full max-w-sm">
          <motion.form
            onSubmit={handleSubmit}
            noValidate
            variants={stagger(0.07, 0.15)}
            initial="hidden"
            animate="show"
            className="grid gap-5"
          >
            <motion.div variants={fadeUp} className="lg:hidden">
              <Logo />
            </motion.div>
            <motion.div variants={fadeUp}>
              <h2 className="font-display text-4xl tracking-tight">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Demo account: <span className="font-medium text-foreground">demo@stiamo.app</span> /{' '}
                <span className="font-medium text-foreground">password123</span>
              </p>
            </motion.div>
            <motion.div variants={fadeUp} className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" className="h-10" value={email} onChange={(e) => setEmail(e.target.value)} />
            </motion.div>
            <motion.div variants={fadeUp} className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </motion.div>
            <motion.p
              role="alert"
              initial={false}
              animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
              className="-my-2 overflow-hidden text-sm text-destructive"
            >
              {error}
            </motion.p>
            <motion.div variants={fadeUp}>
              <Button type="submit" disabled={submitting} className="group h-10 w-full">
                {submitting ? <Loader2 className="animate-spin" /> : 'Sign in'}
                {!submitting && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
              </Button>
            </motion.div>
          </motion.form>
        </motion.div>
      </section>
    </main>
  )
}
