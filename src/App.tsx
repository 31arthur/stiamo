import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { container } from '@/di/container'
import { AuthProvider } from '@/presentation/auth/AuthProvider'
import { ProtectedRoute } from '@/presentation/auth/ProtectedRoute'
import { HomePage } from '@/presentation/pages/HomePage'
import { LoginPage } from '@/presentation/pages/LoginPage'

export default function App() {
  return (
    <AuthProvider auth={container.auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
