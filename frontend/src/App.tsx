import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

type AuthResponse = {
  access_token: string
  user: {
    id: string
    email: string
    name: string
  }
}

type VideoJob = {
  id: string
  originalFileName: string
  status: string
  progress: number
  createdAt: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type AuthShellProps = Readonly<{
  children: ReactNode
}>

type ProtectedRouteProps = Readonly<{
  children: ReactNode
}>

type SubmitEventLike = {
  preventDefault: () => void
}

function getToken() {
  return localStorage.getItem('fiapx_token')
}

function setToken(token: string) {
  localStorage.setItem('fiapx_token', token)
}

function clearToken() {
  localStorage.removeItem('fiapx_token')
}

async function api(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(data.message || `Request failed (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response
}

function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-page">
      <div className="card">
        <div className="panel-left">{children}</div>
        <div className="panel-right" aria-hidden="true" />
      </div>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (event: SubmitEventLike) => {
    event.preventDefault()
    void (async () => {
      setError('')
      try {
        const data = (await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })) as AuthResponse
        setToken(data.access_token)
        navigate('/dashboard')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha no login')
      }
    })()
  }

  return (
    <AuthShell>
      <h1>Faca seu login<span className="dot">.</span></h1>
      <form onSubmit={onSubmit} className="form-grid">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" className="glow" />

        <label htmlFor="login-password">Senha</label>
        <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />

        <Link to="/forgot-password" className="link-muted">Esqueci minha senha</Link>
        <button type="submit" className="btn-gradient">Entrar</button>
        <Link to="/register" className="link-muted">Ainda nao tenho uma conta</Link>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthShell>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (event: SubmitEventLike) => {
    event.preventDefault()
    void (async () => {
      setError('')
      try {
        const data = (await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, confirmPassword }),
        })) as AuthResponse
        setToken(data.access_token)
        navigate('/dashboard')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha no cadastro')
      }
    })()
  }

  return (
    <AuthShell>
      <h1>Crie sua conta<span className="dot">.</span></h1>
      <form onSubmit={onSubmit} className="form-grid">
        <label htmlFor="register-name">Nome</label>
        <input id="register-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="register-email">Email</label>
        <input id="register-email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
        <label htmlFor="register-password">Senha</label>
        <input id="register-password" value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />
        <label htmlFor="register-confirm-password">Confirmar senha</label>
        <input id="register-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required type="password" />
        <button type="submit" className="btn-gradient">Cadastrar</button>
        <Link to="/" className="link-muted">Ja tenho conta</Link>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthShell>
  )
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (event: SubmitEventLike) => {
    event.preventDefault()
    void (async () => {
      setError('')
      setMessage('')
      try {
        const data = (await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        })) as { message: string }
        setMessage(data.message)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao solicitar link')
      }
    })()
  }

  return (
    <AuthShell>
      <h1>Recuperar senha<span className="dot">.</span></h1>
      <form onSubmit={onSubmit} className="form-grid">
        <label htmlFor="forgot-email">Email cadastrado</label>
        <input id="forgot-email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
        <button type="submit" className="btn-gradient">Enviar link</button>
        <Link to="/" className="link-muted">Voltar ao login</Link>
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthShell>
  )
}

function ResetPasswordPage() {
  const location = useLocation()
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (event: SubmitEventLike) => {
    event.preventDefault()
    void (async () => {
      setError('')
      setMessage('')
      try {
        const data = (await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password, confirmPassword }),
        })) as { message: string }
        setMessage(data.message)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao redefinir senha')
      }
    })()
  }

  return (
    <AuthShell>
      <h1>Nova senha<span className="dot">.</span></h1>
      <form onSubmit={onSubmit} className="form-grid">
        <label htmlFor="reset-password">Nova senha</label>
        <input id="reset-password" value={password} onChange={(e) => setPassword(e.target.value)} required type="password" minLength={6} />
        <label htmlFor="reset-confirm-password">Confirmar nova senha</label>
        <input id="reset-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required type="password" minLength={6} />
        <button type="submit" className="btn-gradient" disabled={!token}>Atualizar senha</button>
        <Link to="/" className="link-muted">Voltar ao login</Link>
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthShell>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function loadJobs() {
    try {
      const data = (await api('/videos/jobs?page=1&limit=20')) as { jobs: VideoJob[] }
      setJobs(data.jobs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar jobs')
    }
  }

  useEffect(() => {
    const bootstrap = setTimeout(() => {
      void loadJobs()
    }, 0)
    const timer = setInterval(loadJobs, 5000)
    return () => {
      clearTimeout(bootstrap)
      clearInterval(timer)
    }
  }, [])

  async function uploadFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      await api('/videos/upload', { method: 'POST', body })
      await loadJobs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  async function download(jobId: string) {
    try {
      const token = getToken()
      const response = await fetch(`${API_BASE}/videos/download/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        throw new Error('Nao foi possivel baixar o arquivo')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${jobId}-frames.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no download')
    }
  }

  async function watch(jobId: string) {
    try {
      const token = getToken()
      const response = await fetch(`${API_BASE}/videos/watch/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        throw new Error('Nao foi possivel assistir o video')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      globalThis.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao abrir video')
    }
  }

  async function removeJob(jobId: string) {
    const confirmed = globalThis.confirm('Deseja realmente excluir este job?')
    if (!confirmed) {
      return
    }
    try {
      await api(`/videos/jobs/${jobId}`, { method: 'DELETE' })
      setJobs((prev) => prev.filter((job) => job.id !== jobId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir job')
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (selectedFile) {
      void uploadFile(selectedFile)
    }
  }

  return (
    <div className="dashboard">
      <header>
        <h2>Painel de Videos</h2>
        <div className="actions">
          <label className="btn-gradient upload-btn">
            {uploading ? 'Enviando...' : 'Enviar video'}
            <input type="file" accept="video/*" hidden disabled={uploading} onChange={onFileChange} />
          </label>
          <button className="btn-ghost" onClick={() => { clearToken(); navigate('/') }}>Sair</button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Status</th>
            <th>Progresso</th>
            <th>Criado em</th>
            <th>Acao</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{job.originalFileName}</td>
              <td>{job.status}</td>
              <td>{job.progress}%</td>
              <td>{new Date(job.createdAt).toLocaleString()}</td>
              <td>
                <div className="row-actions">
                  <button className="btn-ghost" disabled={job.status !== 'COMPLETED'} onClick={() => watch(job.id)}>Assistir</button>
                  <button className="btn-ghost" disabled={job.status !== 'COMPLETED'} onClick={() => download(job.id)}>Baixar</button>
                  <button className="btn-ghost" onClick={() => removeJob(job.id)}>Excluir</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!getToken()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
