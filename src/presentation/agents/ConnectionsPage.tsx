import { PageHeader } from '@/presentation/components/layout'
import { ModelsSection } from './AgentsSettingsPage'
import { CredentialsPage } from './CredentialsPage'

/** Everything your agents connect with, in one place: the accounts (Telegram, WhatsApp, AI keys) and which model each agent uses. */
export function ConnectionsPage() {
  return (
    <>
      <PageHeader eyebrow="Developer" title="Connections" description="Connect an account once, then use it from any agent or workflow. Keys and tokens are kept encrypted on your server and never sent back to the browser." />
      <CredentialsPage embedded />
      <ModelsSection />
    </>
  )
}
