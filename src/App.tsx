import { PagesProvider } from '@/presentation/app/pages'
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
const WorkspacePagesPage = lazy(() => import('@/presentation/pages/WorkspacePagesPage').then((m) => ({ default: m.WorkspacePagesPage })))
const NewsPage = lazy(() => import('@/presentation/agents/NewsPage').then((m) => ({ default: m.NewsPage })))
const AttentionPage = lazy(() => import('@/presentation/agents/AttentionPage').then((m) => ({ default: m.AttentionPage })))
const UsagePage = lazy(() => import('@/presentation/agents/UsagePage').then((m) => ({ default: m.UsagePage })))
const ExecutionsTab = lazy(() => import('@/presentation/agents/ExecutionsTab').then((m) => ({ default: m.ExecutionsTab })))
const ExecutionPage = lazy(() => import('@/presentation/agents/ExecutionPage').then((m) => ({ default: m.ExecutionPage })))
const MailPage = lazy(() => import('@/presentation/mail/MailPage').then((m) => ({ default: m.MailPage })))
const LettersPage = lazy(() => import('@/presentation/pages/LettersPage').then((m) => ({ default: m.LettersPage })))
const OverviewPage = lazy(() => import('@/presentation/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const AgentsLayout = lazy(() => import('@/presentation/agents/AgentsLayout').then((m) => ({ default: m.AgentsLayout })))
const AgentsHome = lazy(() => import('@/presentation/agents/AgentsHome').then((m) => ({ default: m.AgentsHome })))
const AgentLayout = lazy(() => import('@/presentation/agents/AgentLayout').then((m) => ({ default: m.AgentLayout })))
const OverviewTab = lazy(() => import('@/presentation/agents/OverviewTab').then((m) => ({ default: m.OverviewTab })))
const TryTab = lazy(() => import('@/presentation/agents/TryTab').then((m) => ({ default: m.TryTab })))
const SettingsTab = lazy(() => import('@/presentation/agents/SettingsTab').then((m) => ({ default: m.SettingsTab })))
const ChannelsTab = lazy(() => import('@/presentation/agents/ChannelsTab').then((m) => ({ default: m.ChannelsTab })))
const HistoryTab = lazy(() => import('@/presentation/agents/HistoryTab').then((m) => ({ default: m.HistoryTab })))
const NewAgentPage = lazy(() => import('@/presentation/agents/NewAgentPage').then((m) => ({ default: m.NewAgentPage })))
const WorkflowRunTab = lazy(() => import('@/presentation/agents/WorkflowRunTab').then((m) => ({ default: m.WorkflowRunTab })))
const ReviewTab = lazy(() => import('@/presentation/agents/ReviewTab').then((m) => ({ default: m.ReviewTab })))
const AgentsSettingsPage = lazy(() => import('@/presentation/agents/AgentsSettingsPage').then((m) => ({ default: m.AgentsSettingsPage })))
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
        <PagesProvider>
        <AuthProvider auth={container.auth}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route index element={<HomeRedirect />} />
                <Route path="/:ws" element={<WorkspaceShell />}>
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="agents" element={<AgentsLayout />}>
                    <Route index element={<AgentsHome />} />
                    <Route path="usage" element={<UsagePage />} />
                    <Route path="settings" element={<AgentsSettingsPage />} />
                    <Route path="new" element={<NewAgentPage />} />
                    <Route path=":agentId" element={<AgentLayout />}>
                      <Route index element={<OverviewTab />} />
                      <Route path="try" element={<TryTab />} />
                      <Route path="run" element={<WorkflowRunTab />} />
                      <Route path="executions" element={<ExecutionsTab />} />
                      <Route path="executions/:runId" element={<ExecutionPage />} />
                      <Route path="review" element={<ReviewTab />} />
                      <Route path="settings" element={<SettingsTab />} />
                      <Route path="channels" element={<ChannelsTab />} />
                      <Route path="history" element={<HistoryTab />} />
                    </Route>
                  </Route>
                  <Route path="today/:date?" element={<TodayPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="follow-ups" element={<FollowUpsPage />} />
                  <Route path="meetings" element={<MeetingsPage />} />
                  <Route path="meetings/:id" element={<MeetingDetailPage />} />
                  <Route path="cases" element={<CasesPage />} />
                  <Route path="cases/:id" element={<CaseDetailPage />} />
                  <Route path="mail" element={<MailPage />} />
                  <Route path="attention" element={<AttentionPage />} />
                  <Route path="news" element={<NewsPage />} />
                  <Route path="pages" element={<WorkspacePagesPage />} />
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
        </PagesProvider>
        <Toaster position="bottom-center" theme="system" />
      </ServicesProvider>
    </MotionConfig>
  )
}
