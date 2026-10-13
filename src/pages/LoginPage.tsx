import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogIn } from 'lucide-react'
import { Button, Field, Input } from '@/ui'

/**
 * Login screen (shared password).
 *
 * Browsing is public; only editing needs a password, so this is a small,
 * focused surface. The parent supplies `onLogin`, which owns the actual auth
 * call and token storage — this component only handles the form state.
 */
export default function LoginPage({
  onLogin,
  description = '浏览无需登录，编辑卡片需要密码。',
}: {
  onLogin: (password: string) => Promise<void>
  description?: string
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || password === '') return
    setSubmitting(true)
    setError(null)
    try {
      await onLogin(password)
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-8 sm:py-14">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">
          登录以编辑
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">{description}</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
      >
        <Field label="访问密码" htmlFor="kc-password" error={error ?? undefined}>
          <Input
            id="kc-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="请输入密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="mt-4 w-full"
          disabled={submitting || password === ''}
        >
          <LogIn />
          {submitting ? '登录中…' : '登录'}
        </Button>
      </form>
    </div>
  )
}
