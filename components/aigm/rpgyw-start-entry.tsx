'use client'

import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { AuthPrompt } from '@/components/AuthPrompt'
import { StartOnboarding } from '@/components/start/StartOnboarding'
import { CampaignHub } from '@/components/start/CampaignHub'

export function RpgywStartEntry({ addCharacterMode = false, multiplayerCode = '' }: { addCharacterMode?: boolean; multiplayerCode?: string }) {
  return (
    <div className="site-frame site-frame-play site-frame-start">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="inner-main play-entry-main start-page-main">
        <div className="shell start-page-shell">
          <h1 className="sr-only">{addCharacterMode ? 'Add characters to the current campaign' : 'Start a new campaign or manage your current campaigns'}</h1>
          {!addCharacterMode ? <CampaignHub /> : null}
          <StartOnboarding mode={addCharacterMode ? 'add-character' : 'new-campaign'} multiplayerCode={multiplayerCode} />
        </div>
      </main>
      <SiteFooter />
      <AuthPrompt />
    </div>
  )
}
