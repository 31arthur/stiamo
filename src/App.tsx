import { MotionConfig } from 'motion/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { container } from '@/di/container'
import { AuthProvider } from '@/presentation/auth/AuthProvider'
import { ProtectedRoute } from '@/presentation/auth/ProtectedRoute'
import { AppShell } from '@/presentation/layout/AppShell'
import { CalendarPage } from '@/presentation/pages/CalendarPage'
import { LoginPage } from '@/presentation/pages/LoginPage'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider auth={container.auth}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<CalendarPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  )
}
