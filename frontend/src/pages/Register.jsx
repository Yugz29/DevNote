import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../contexts/AuthContext.js'
import '../styles/auth.css'

export default function Register() {
  const { user, signUp } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !password2
    ) {
      setErrorMessage('Please fill in all required fields')
      return
    }

    if (password !== password2) {
      setErrorMessage('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      await signUp({
        email: email.trim(),
        password,
        password2,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const data = error.response?.data

      setErrorMessage(
        data?.email?.[0] ||
          data?.password?.[0] ||
          data?.username?.[0] ||
          data?.non_field_errors?.[0] ||
          'Registration failed. Please try again',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <Link to="/" className="auth-title" style={{ textDecoration: 'none' }}>
            Dev<span style={{ color: 'var(--accent-primary)' }}>Note</span>
          </Link>
          <p className="auth-subtitle">Your dev knowledge, everywhere, instantly</p>
        </div>

        <div className="auth-card">
          <h2 className="auth-card-title">Create an account</h2>

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="first-name">First name</label>
                <input
                  type="text"
                  id="first-name"
                  placeholder="John"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="last-name">Last name</label>
                <input
                  type="text"
                  id="last-name"
                  placeholder="Doe"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="john@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="username">
                Username
                <span className="field-optional">(optional)</span>
              </label>
              <input
                type="text"
                id="username"
                placeholder="johndoe"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="password2">Confirm password</label>
              <input
                type="password"
                id="password2"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={password2}
                onChange={(event) => setPassword2(event.target.value)}
              />
            </div>

            <p className="auth-error">{errorMessage}</p>

            <button type="submit" className="btn-auth" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Connexion</Link>
        </p>
      </div>

      <ThemeToggle />
    </div>
  )
}
