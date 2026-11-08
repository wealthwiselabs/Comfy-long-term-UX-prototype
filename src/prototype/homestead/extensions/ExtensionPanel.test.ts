import '@testing-library/jest-dom/vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import ExtensionPanel from './ExtensionPanel.vue'
import ExtensionToolbar from './ExtensionToolbar.vue'
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
    await screen.findByRole('dialog', { name: 'Node packs' })
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Version for ComfyUI Impact Pack' }),
      '8.29.1'
    )
    await user.click(screen.getByRole('button', { name: 'Add your own' }))
    await user.upload(
      screen.getByLabelText('Browse ZIP files'),
      new File(['demo'], 'studio-nodes.zip', { type: 'application/zip' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    s.edit()
    await nextTick()
    expect(
      await screen.findByRole('combobox', {
        name: 'Version for ComfyUI Impact Pack'
      })
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

  it('filters installed upgrades with descriptions and keeps pending changes distinct from installed versions', async () => {
    const user = userEvent.setup()
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    expect(
      await screen.findByRole('dialog', { name: 'Node packs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'All packs · 7' })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(
      screen.getByRole('button', { name: 'Updates available · 2' })
    )
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(
      screen.queryByRole('row', { name: /ComfyUI-RMBG/ })
    ).not.toBeInTheDocument()
    const impact = screen.getByRole('row', { name: /ComfyUI Impact Pack/ })
    expect(
      within(impact).getByText(
        'Detection, segmentation, and detail refinement.'
      )
    ).toBeInTheDocument()
    expect(within(impact).getByText('Installed 8.28.3')).toBeInTheDocument()
    expect(within(impact).getByText('Available 8.29.1')).toBeInTheDocument()
    await user.selectOptions(within(impact).getByRole('combobox'), '8.29.1')
    expect(within(impact).getByText('Pending update')).toBeInTheDocument()
    expect(within(impact).getByText('Installed 8.28.3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All packs · 7' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Search node packs' }),
      'remove backgrounds'
    )
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(
      screen.getByRole('row', { name: /ComfyUI-RMBG/ })
    ).toBeInTheDocument()
  })

  it('keeps checkbox inclusion independent from version choices across pages, search, and reopening', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog')
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    const impactIncluded = screen.getByRole('checkbox', {
      name: 'Include ComfyUI Impact Pack'
    })
    expect(impactIncluded).toBeChecked()
    await user.click(impactIncluded)
    expect(screen.getByText('Pending removal')).toBeInTheDocument()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Version for ComfyUI Impact Pack' }),
      '8.29.1'
    )
    expect(s.state.draft.packs['impact-pack']).toBeUndefined()
    await user.click(impactIncluded)
    expect(s.state.draft.packs['impact-pack']).toBe('8.29.1')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Showing 6–7 of 7 packs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Version for ComfyUI-RMBG' }),
      '1.9.3'
    )
    expect(s.state.draft.packs['comfyui-rmbg']).toBeUndefined()
    await user.click(
      screen.getByRole('checkbox', { name: 'Include ComfyUI-RMBG' })
    )
    expect(s.state.draft.packs['comfyui-rmbg']).toBe('1.9.3')
    await user.type(
      screen.getByRole('textbox', { name: 'Search node packs' }),
      'Impact'
    )
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Include ComfyUI Impact Pack' })
    ).toBeChecked()
    expect(
      screen.getByRole('combobox', { name: 'Version for ComfyUI Impact Pack' })
    ).toHaveValue('8.29.1')
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    s.edit()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(
      screen.getByRole('checkbox', { name: 'Include ComfyUI-RMBG' })
    ).toBeChecked()
    expect(
      screen.getByRole('combobox', { name: 'Version for ComfyUI-RMBG' })
    ).toHaveValue('1.9.3')
    await user.click(
      screen.getByRole('checkbox', { name: 'Include ComfyUI-RMBG' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    s.edit()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(
      screen.getByRole('checkbox', { name: 'Include ComfyUI-RMBG' })
    ).not.toBeChecked()
    expect(
      screen.getByRole('combobox', { name: 'Version for ComfyUI-RMBG' })
    ).toHaveValue('1.9.3')
    await user.click(
      screen.getByRole('button', { name: 'Updates available · 2' })
    )
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Version for ComfyUI Impact Pack' })
    ).toHaveValue('8.29.1')
  })

  it('accepts ZIP browse/drop metadata and retains valid choices after invalid files or GitHub URLs', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const s = useExtensionManagerStore()
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Add your own' }))
    await user.upload(
      screen.getByLabelText('Browse ZIP files'),
      new File(['private content'], 'private.zip', { type: 'application/zip' })
    )
    expect(screen.getByText('private.zip')).toBeInTheDocument()
    await user.upload(
      screen.getByLabelText('Browse ZIP files'),
      new File(['bad'], 'invalid.txt')
    )
    expect(screen.getByRole('alert')).toHaveTextContent('invalid.txt')
    expect(s.state.draft.packs['private.zip']).toBe('demo')
    const transfer = new DataTransfer()
    transfer.items.add(
      new File(['other'], 'second.ZIP', { type: 'application/zip' })
    )
    transfer.items.add(new File(['bad'], 'wrong.tar'))
    await fireEvent.drop(
      screen.getByRole('group', { name: 'ZIP file drop zone' }),
      { dataTransfer: transfer }
    )
    expect(screen.getByText('second.ZIP')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('wrong.tar')
    expect(s.state.draft.packs['private.zip']).toBe('demo')
    expect(s.state.draft.packs['wrong.tar']).toBeUndefined()
    await user.type(
      screen.getByRole('textbox', { name: 'GitHub repository URL' }),
      'https://github.com/studio/nodes'
    )
    await user.click(screen.getByRole('button', { name: 'Add GitHub pack' }))
    expect(
      screen.getByText('https://github.com/studio/nodes')
    ).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'GitHub repository URL' }),
      'not-a-repository'
    )
    await user.click(screen.getByRole('button', { name: 'Add GitHub pack' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a GitHub repository URL'
    )
    expect(s.state.draft.packs['https://github.com/studio/nodes']).toBe('demo')
    await user.click(screen.getByRole('button', { name: 'Add your own' }))
    expect(screen.getByText('private.zip')).toBeInTheDocument()
    expect(screen.getByText('second.ZIP')).toBeInTheDocument()
  })

  it('dismisses with Escape and returns focus to the Extensions opener', async () => {
    const user = userEvent.setup()
    render(
      {
        components: { ExtensionToolbar, ExtensionPanel },
        template: '<ExtensionToolbar /><ExtensionPanel />'
      },
      { global: { plugins: [i18n] } }
    )
    await screen.findByRole('dialog', { name: 'Node packs' })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close Extensions panel' })
      ).toHaveFocus()
    )
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Extensions' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Extensions' }))
    expect(
      await screen.findByRole('dialog', { name: 'Node packs' })
    ).toBeInTheDocument()
  })

  it('closes modal review and opens a nonblocking status panel when preparing', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog', { name: 'Node packs' })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Version for ComfyUI-RMBG' }),
      '2.0.0'
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Include ComfyUI-RMBG' })
    )
    await user.click(screen.getByRole('button', { name: 'Review changes · 1' }))
    expect(
      screen.getByRole('dialog', { name: 'Review environment' })
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Prepare environment' })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('complementary', { name: 'Extensions' })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preparing in background'
    )
    expect(s.locked).toBe(false)
  })

  it('closes the request modal and opens request status before preselected admin review', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.reset('member')
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog', { name: 'Node packs' })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Version for ComfyUI-RMBG' }),
      '2.0.0'
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Include ComfyUI-RMBG' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Request selected changes' })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('complementary')).toHaveTextContent(
      'Request sent to workspace admins'
    )
    s.reviewRequest()
    await nextTick()
    expect(
      await screen.findByRole('dialog', { name: 'Review environment' })
    ).toHaveTextContent('ComfyUI-RMBG: Not installed → 2.0.0')
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

  it('sends first-time users to the existing build UI without showing a creation wizard', async () => {
    const s = useExtensionManagerStore()
    s.reset('first')
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    expect(
      await screen.findByRole('link', { name: 'Create a custom environment' })
    ).toHaveAttribute('href', 'https://platform.comfy.org/profile/builds/new')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Prepare environment' })
    ).not.toBeInTheDocument()
  })
})
