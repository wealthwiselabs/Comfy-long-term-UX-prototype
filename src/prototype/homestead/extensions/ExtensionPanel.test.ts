import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import ExtensionPanel from './ExtensionPanel.vue'
import { useExtensionManagerStore } from './store'

describe('extension manager panel', () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      '',
      '/prototype/homestead?v=2&flow=extensions'
    )
    i18n.global.locale.value = 'en'
  })

  it('retains a selected installed update and ZIP metadata through close/reopen and reviews the same manifest', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Version for ComfyUI Impact Pack' }),
      '8.29.1'
    )
    await user.click(screen.getByText('Add from GitHub or ZIP'))
    await user.type(
      screen.getByRole('textbox', { name: 'ZIP file name' }),
      'studio-nodes.zip'
    )
    await user.click(screen.getByRole('button', { name: 'Add ZIP pack' }))
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    s.edit()
    await nextTick()
    expect(
      screen.getByRole('combobox', { name: 'Version for ComfyUI Impact Pack' })
    ).toHaveValue('8.29.1')
    expect(screen.getByText('studio-nodes.zip')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review changes · 2' }))
    expect(
      screen.getByRole('radio', { name: 'Update this environment' })
    ).toBeChecked()
    expect(
      screen.getByText('ComfyUI Impact Pack: 8.28.3 → 8.29.1')
    ).toBeInTheDocument()
    expect(
      screen.getByText('studio-nodes.zip: Not installed → demo')
    ).toBeInTheDocument()
    expect(
      screen.getByText('GPU: $0.0012 per second, billed for usage.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Storage: 48 GB × $0.07 / GB-month ≈ $3.36 / month.')
    ).toBeInTheDocument()
  })

  it('requires the approval button before locking Run and waiting for running and queued jobs', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.initialize()
    s.holdJobs = true
    s.run()
    s.run()
    s.dispatch({ type: 'prepare' })
    s.dispatch({ type: 'ready' })
    s.panel = 'status'
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    expect(s.locked).toBe(false)
    await user.click(
      screen.getByRole('button', { name: 'Approve and apply environment' })
    )
    expect(s.state.phase).toBe('waiting')
    expect(s.locked).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for existing jobs'
    )
  })

  it('sends first-time users to the existing build UI without showing a creation wizard', () => {
    const s = useExtensionManagerStore()
    s.reset('first')
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    expect(
      screen.getByRole('link', { name: 'Create a custom environment' })
    ).toHaveAttribute('href', 'https://platform.comfy.org/profile/builds/new')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Prepare environment' })
    ).not.toBeInTheDocument()
  })
})
