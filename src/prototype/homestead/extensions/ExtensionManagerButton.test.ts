import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import ExtensionManagerButton from './ExtensionManagerButton.vue'
import ExtensionToolbar from './ExtensionToolbar.vue'
import { useExtensionManagerStore } from './store'

describe('canvas extension manager entry', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    render(ExtensionManagerButton, { global: { plugins: [i18n] } })
  })

  it('uses one entry to reopen the extension manager', async () => {
    render(ExtensionToolbar, { global: { plugins: [i18n] } })
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.panel = null
    expect(screen.getAllByRole('button', { name: 'Extensions' })).toHaveLength(
      1
    )
    await user.click(screen.getByRole('button', { name: 'Extensions' }))
    expect(s.panel).toBe('packs')
  })
  it('disables Extensions with a policy tooltip when both enterprise capabilities are off', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.reset('member')
    s.setEnterpriseCapabilities({ addNodes: false, addModels: false })
    const button = screen.getByRole('button', {
      name: 'Extensions'
    })
    await waitFor(() => expect(button).toBeDisabled())
    await user.tab()
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(
      'Your admin has disabled the ability to add more nodes or models.'
    )
    s.edit()
    expect(s.panel).toBeNull()
  })
})
