import { lazy } from 'react'
import { MotionConfig } from 'motion/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import type { Container } from '@/di/container'
import { ServicesProvider } from '@/presentation/app/services'
import { AuthProvider } from '@/presentation/auth/AuthProvider'
import { ProtectedRoute } from '@/presentation/auth/ProtectedRoute'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { HomeRedirect, WorkspaceShell } from '@/presentation/routing/WorkspaceShell'

// Each section is its own chunk; the shell and login load first.
const CalendarPage = lazy(() => import('@/presentation/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const CaseDetailPage = lazy(() => import('@/presentation/pages/CaseDetailPage').then((m) => ({ default: m.CaseDetailPage })))
const ClientsPage = lazy(() => import('@/presentation/pages/ClientsPage').then((m) => ({ default: m.ClientsPage })))
const ProjectsPage = lazy(() => import('@/presentation/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ClientDetailPage = lazy(() => import('@/presentation/pages/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })))
const ProjectDetailPage = lazy(() => import('@/presentation/pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const DiaryPage = lazy(() => import('@/presentation/pages/DiaryPage').then((m) => ({ default: m.DiaryPage })))
const CounselPage = lazy(() => import('@/presentation/pages/CounselPage').then((m) => ({ default: m.CounselPage })))
const CounselDetailPage = lazy(() => import('@/presentation/pages/CounselDetailPage').then((m) => ({ default: m.CounselDetailPage })))
const CasesPage = lazy(() => import('@/presentation/pages/CasesPage').then((m) => ({ default: m.CasesPage })))
const LettersPage = lazy(() => import('@/presentation/pages/LettersPage').then((m) => ({ default: m.LettersPage })))
const OverviewPage = lazy(() => import('@/presentation/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const AiLayout = lazy(() => import('@/presentation/ai/AiLayout').then((m) => ({ default: m.AiLayout })))
const AgentPage = lazy(() => import('@/presentation/ai/AgentPage').then((m) => ({ default: m.AgentPage })))
const PromptPage = lazy(() => import('@/presentation/ai/PromptPage').then((m) => ({ default: m.PromptPage })))
const DecisionsPage = lazy(() => import('@/presentation/ai/DecisionsPage').then((m) => ({ default: m.DecisionsPage })))
const ChannelsPage = lazy(() => import('@/presentation/ai/ChannelsPage').then((m) => ({ default: m.ChannelsPage })))
const ProvidersPage = lazy(() => import('@/presentation/ai/ProvidersPage').then((m) => ({ default: m.ProvidersPage })))
const FollowUpsPage = lazy(() => import('@/presentation/pages/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })))
const GoalDetailPage = lazy(() => import('@/presentation/pages/GoalDetailPage').then((m) => ({ default: m.GoalDetailPage })))
const GoalsPage = lazy(() => import('@/presentation/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const MeetingDetailPage = lazy(() => import('@/presentation/pages/MeetingDetailPage').then((m) => ({ default: m.MeetingDetailPage })))
const MeetingsPage = lazy(() => import('@/presentation/pages/MeetingsPage').then((m) => ({ default: m.MeetingsPage })))
const PlanDetailPage = lazy(() => import('@/presentation/pages/PlanDetailPage').then((m) => ({ default: m.PlanDetailPage })))
const PlansPage = lazy(() => import('@/presentation/pages/PlansPage').then((m) => ({ default: m.PlansPage })))
const TasksPage = lazy(() => import('@/presentation/pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const TodayPage = lazy(() => import('@/presentation/pages/TodayPage').then((m) => ({ default: m.TodayPage })))

export default function App({ container }: { container: Container }) {
  return (
    <MotionConfig reducedMotion="user">
      <ServicesProvider container={container}>
        <AuthProvider auth={container.auth}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route index element={<HomeRedirect />} />
                <Route path="/:ws" element={<WorkspaceShell />}>
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="ai" element={<AiLayout />}>
                    <Route index element={<AgentPage />} />
                    <Route path="prompt" element={<PromptPage />} />
                    <Route path="decisions" element={<DecisionsPage />} />
                    <Route path="channels" element={<ChannelsPage />} />
                    <Route path="providers" element={<ProvidersPage />} />
                  </Route>
                  <Route path="today/:date?" element={<TodayPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="follow-ups" element={<FollowUpsPage />} />
                  <Route path="meetings" element={<MeetingsPage />} />
                  <Route path="meetings/:id" element={<MeetingDetailPage />} />
                  <Route path="cases" element={<CasesPage />} />
                  <Route path="cases/:id" element={<CaseDetailPage />} />
                  <Route path="letters" element={<LettersPage />} />
                  <Route path="diary" element={<DiaryPage />} />
                  <Route path="counsel" element={<CounselPage />} />
                  <Route path="counsel/:id" element={<CounselDetailPage />} />
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="clients/:id" element={<ClientDetailPage />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="projects/:id" element={<ProjectDetailPage />} />
                  <Route path="plans" element={<PlansPage />} />
                  <Route path="plans/:id" element={<PlanDetailPage />} />
                  <Route path="goals" element={<GoalsPage />} />
                  <Route path="goals/:id" element={<GoalDetailPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        <Toaster position="bottom-center" theme="system" />
      </ServicesProvider>
    </MotionConfig>
  )
}
