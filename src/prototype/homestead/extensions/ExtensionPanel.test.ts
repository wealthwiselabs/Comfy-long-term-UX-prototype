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
import { useToastStore } from '@/platform/updates/common/toastStore'
import ExtensionPanel from './ExtensionPanel.vue'
import ExtensionManagerButton from './ExtensionManagerButton.vue'
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
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('dialog', { name: 'Models & LoRAs' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
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
      screen.queryByText('RTX PRO 6000 · $3.49/hour (sample)')
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Estimated environment package size')
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
    await user.click(
      within(impact).getByRole('button', { name: 'Update ComfyUI Impact Pack' })
    )
    expect(within(impact).getByRole('combobox')).toHaveValue('8.29.1')
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

  it('keeps workflow and inherited defaults deduplicated, adds a LoRA, and derives read-only storage through back/reopen', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.state.draft.models = ['sdxl', 'private-workflow.gguf']
    s.workflowModelIds = ['sdxl', 'private-workflow.gguf']
    s.state.environments.studio.models = ['sdxl', 'private-workflow.gguf']
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass(
      'bg-primary-background',
      'h-10'
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('dialog', { name: 'Models & LoRAs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Include Stable Diffusion XL' })
    ).toBeChecked()
    const privateModel = screen.getByRole('checkbox', {
      name: 'Include private-workflow.gguf'
    })
    expect(privateModel).toBeChecked()
    await user.click(privateModel)
    expect(
      screen.getByRole('checkbox', { name: 'Include private-workflow.gguf' })
    ).not.toBeChecked()
    await user.click(privateModel)
    await user.click(screen.getByRole('button', { name: 'LoRAs' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Include Detail Tweaker XL' })
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('dialog', { name: 'Environment Settings' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Models (comma-separated IDs)' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('At least 11.25 GB')).toBeInTheDocument()
    expect(
      screen.getByText('Estimated storage: $1.02+ / month')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Build environment' })
    ).toHaveClass('bg-primary-background', 'h-10')
    await user.click(
      screen.getByRole('radio', { name: 'RTX PRO 6000 MIG · 48 GB' })
    )
    expect(
      screen.queryByText('RTX PRO 6000 MIG · $1.75/hour (sample)')
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit models' }))
    expect(
      screen.getByRole('checkbox', { name: 'Include Detail Tweaker XL' })
    ).toBeChecked()
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    s.edit()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('checkbox', { name: 'Include Detail Tweaker XL' })
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Include private-workflow.gguf' })
    ).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('radio', { name: 'RTX PRO 6000 MIG · 48 GB' })
    ).toBeChecked()
  })

  it('does not quote an unsupported GPU or a complete storage total when all model sizes are unknown', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.state.draft.models = ['private.gguf']
    s.state.draft.gpu = 'unsupported-gpu'
    s.panel = 'review'
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog', { name: 'Environment Settings' })
    expect(
      screen.getByRole('button', { name: 'Build environment' })
    ).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'not in the sample priced catalog'
    )
    expect(screen.getByText('At least 5.00 GB')).toBeInTheDocument()
    expect(
      screen.getByText('Estimated storage: $0.46+ / month')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'H100 SXM · 80 GB' }))
    expect(
      screen.getByRole('button', { name: 'Build environment' })
    ).toBeEnabled()
    expect(
      screen.queryByText('H100 SXM · $6.23/hour (sample)')
    ).not.toBeInTheDocument()
  })

  it('dismisses with Escape and returns focus to the Extensions opener', async () => {
    const user = userEvent.setup()
    render(
      {
        components: { ExtensionManagerButton, ExtensionPanel },
        template: '<ExtensionManagerButton /><ExtensionPanel />'
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
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('dialog', { name: 'Environment Settings' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Build environment' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('complementary', { name: 'Extensions' })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preparing in background'
    )
    expect(s.locked).toBe(false)
  })

  it('sends a two-step member request with a note and keeps settings in preselected admin review', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.reset('member')
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await screen.findByRole('dialog', { name: 'Node packs' })
    expect(
      screen.getByText('Step 1 of 2 · Studio production')
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Update ComfyUI Impact Pack' })
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByText('Step 2 of 2 · Studio production')
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('checkbox', { name: 'Include Detail Tweaker XL' })
    )
    await user.click(screen.getByText('Requested changes', { exact: true }))
    const summary = screen.getByRole('region', { name: 'Requested changes' })
    expect(
      within(summary).getByText('ComfyUI Impact Pack: 8.28.3 → 8.29.1')
    ).toBeInTheDocument()
    expect(within(summary).getByText(/Detail Tweaker XL/)).toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: 'Update this environment' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Review estimated costs' })
    ).not.toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'Note to admins (optional)' }),
      'Needed for the new campaign workflow.'
    )
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    s.edit()
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByText('Requested changes', { exact: true }))
    expect(
      screen.getByRole('textbox', { name: 'Note to admins (optional)' })
    ).toHaveValue('Needed for the new campaign workflow.')
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(useToastStore().messagesToAdd.at(-1)?.summary).toBe(
      'Request emailed to workspace admins'
    )
    expect(s.state.phase).toBe('idle')
    s.reviewRequest()
    await nextTick()
    const adminReview = await screen.findByRole('dialog', {
      name: 'Environment Settings'
    })
    expect(adminReview).toHaveTextContent(
      'ComfyUI Impact Pack: 8.28.3 → 8.29.1'
    )
    expect(adminReview).toHaveTextContent('Detail Tweaker XL')
    expect(adminReview).toHaveTextContent(
      'Needed for the new campaign workflow.'
    )
    expect(
      within(adminReview).getByRole('heading', {
        name: 'Review estimated costs'
      })
    ).toBeInTheDocument()
    expect(
      within(adminReview).getByRole('button', { name: 'Build environment' })
    ).toBeEnabled()
  })

  it.for([
    {
      addNodes: true,
      addModels: false,
      name: 'Node packs',
      other: 'Models & LoRAs'
    },
    {
      addNodes: false,
      addModels: true,
      name: 'Models & LoRAs',
      other: 'Node packs'
    }
  ])(
    'shows only the enabled enterprise selection step: $name',
    async ({ addNodes, addModels, name, other }) => {
      const user = userEvent.setup()
      const s = useExtensionManagerStore()
      s.reset('member')
      s.setEnterpriseCapabilities({ addNodes, addModels })
      s.edit()
      render(ExtensionPanel, { global: { plugins: [i18n] } })
      await screen.findByRole('dialog', { name })
      expect(
        screen.getByText('Step 1 of 1 · Studio production')
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('table', { name: other })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Next' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Back' })
      ).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Send request' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
      expect(useToastStore().messagesToAdd.at(-1)?.summary).toBe(
        'Request emailed to workspace admins'
      )
    }
  )

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
    expect(screen.getByRole('status')).toHaveTextContent('Environment is ready')
    expect(
      screen.getByRole('button', { name: 'Apply environment' })
    ).toHaveClass('bg-primary-background', 'h-10')
    expect(
      screen.queryByText('Accepted jobs · revision preserved')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Shared session preview')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply environment' }))
    expect(s.state.phase).toBe('waiting')
    expect(s.locked).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for existing jobs'
    )
  })

  it('does not show an old success aside or insertion controls after activation', () => {
    const s = useExtensionManagerStore()
    s.state.phase = 'updated'
    s.panel = 'status'
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Manage packs' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Insert RMBG node' })
    ).not.toBeInTheDocument()
  })

  it('creates the first environment in Cloud with empty packs and editable model-based review', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.reset('first')
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    const intro = await screen.findByRole('dialog', {
      name: 'Custom environment'
    })
    expect(intro).not.toHaveClass('h-[min(85vh,50rem)]', 'sm:max-w-6xl')
    expect(
      within(intro).getByText(
        'Run community node packs and your own private nodes in a custom environment.'
      )
    ).toBeInTheDocument()
    expect(
      within(intro).getByText('Your nodes. Powerful Cloud GPUs.')
    ).toBeInTheDocument()
    expect(
      within(intro).getByText(
        'Only pay for GPU seconds while jobs run, plus storage for your environment.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      'https://comfy.org/pricing'
    )
    expect(screen.getByRole('button', { name: 'Get started' })).toHaveClass(
      'bg-primary-background',
      'h-10'
    )
    await user.click(screen.getByRole('button', { name: 'Get started' }))
    expect(
      await screen.findByRole('dialog', { name: 'Node packs' })
    ).toHaveTextContent('Choose packs for your first custom environment.')
    expect(
      screen.queryByRole('link', { name: 'Create a custom environment' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Installed · 0' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Include ComfyUI Impact Pack' })
    ).not.toBeChecked()
    await user.click(
      screen.getByRole('checkbox', { name: 'Include ComfyUI Impact Pack' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Close Extensions panel' })
    )
    s.edit()
    expect(
      await screen.findByRole('dialog', { name: 'Node packs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Include ComfyUI Impact Pack' })
    ).toBeChecked()
    expect(
      screen.queryByRole('button', { name: 'Get started' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('radio', { name: 'Create a new environment' })
    ).toBeChecked()
    expect(
      screen.queryByRole('radio', { name: 'Update this environment' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Environment name' })
    ).toHaveValue('My custom environment')
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'RTX PRO 6000 · 96 GB' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'RTX PRO 6000 MIG · 48 GB' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'H100 SXM · 80 GB' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Illustrative suggestion:/)).toHaveTextContent(
      'This demo does not measure VRAM or validate capacity'
    )
    await user.click(screen.getByRole('button', { name: 'Build environment' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('complementary')).toHaveTextContent(
      'Preparing in background'
    )
    expect(s.state.draft.mode).toBe('new')
    expect(s.locked).toBe(false)
  })
})
