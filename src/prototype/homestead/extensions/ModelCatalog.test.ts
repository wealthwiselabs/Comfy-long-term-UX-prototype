import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import ModelCatalog from './ModelCatalog.vue'
import RequestSummary from './RequestSummary.vue'
import ExtensionReview from './ExtensionReview.vue'
import ExtensionPanel from './ExtensionPanel.vue'
import { useExtensionManagerStore } from './store'

describe('Cloud model selection and simulated imports', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })
  it('keeps unmatched workflow files separate from selectable Cloud and inherited models', () => {
    const s = useExtensionManagerStore()
    s.workflowModelIds = ['not-on-cloud.gguf']
    render(ModelCatalog, { global: { plugins: [i18n] } })
    expect(screen.getByText('not-on-cloud.gguf')).toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: 'Include not-on-cloud.gguf' })
    ).not.toBeInTheDocument()
    const inherited = screen.getByRole('checkbox', {
      name: 'Include Acme Hero'
    })
    expect(inherited).toBeChecked()
    expect(
      screen.getByText('Existing environment dependency')
    ).toBeInTheDocument()
    expect(s.state.draft.models).not.toContain('not-on-cloud.gguf')
  })
  it('supports unrestricted browse and drop, retains staged models on remount, and shows duplicate validation', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    const view = render(ModelCatalog, { global: { plugins: [i18n] } })
    await user.click(
      screen.getByRole('button', { name: 'Add your own models' })
    )
    const picker = screen.getByLabelText('Browse model files')
    expect(picker).not.toHaveAttribute('accept')
    await user.upload(picker, new File(['weights'], 'private.bin'))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Model folder' }),
      'loras'
    )
    await user.click(screen.getByRole('button', { name: 'Add to draft' }))
    expect(
      screen.getByRole('checkbox', { name: 'Include private.bin' })
    ).toBeChecked()
    expect(screen.getByText('Added by you · simulated')).toBeInTheDocument()
    view.unmount()
    render(ModelCatalog, { global: { plugins: [i18n] } })
    expect(
      screen.getByRole('checkbox', { name: 'Include private.bin' })
    ).toBeChecked()
    await user.click(
      screen.getByRole('button', { name: 'Add your own models' })
    )
    await fireEvent.drop(
      screen.getByRole('group', { name: 'Model file drop zone' }),
      { dataTransfer: { files: [new File(['weights'], 'private.bin')] } }
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Model folder' }),
      'loras'
    )
    await user.click(screen.getByRole('button', { name: 'Add to draft' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'already uses this file name'
    )
    expect(s.importedModels).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Cancel import' }))
    expect(s.state.draft.models).toContain('import:loras/private.bin')
  })
  it('derives link filenames, preserves an edited filename, and validates repository links before staging', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    render(ModelCatalog, { global: { plugins: [i18n] } })
    await user.click(
      screen.getByRole('button', { name: 'Add your own models' })
    )
    await user.click(screen.getByRole('button', { name: 'Public link' }))
    const link = screen.getByRole('textbox', {
      name: 'Hugging Face or other HTTPS file link'
    })
    await user.type(link, 'https://huggingface.co/studio/hero')
    expect(screen.getByRole('button', { name: 'Add to draft' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'repository or folder page'
    )
    await user.clear(link)
    await user.type(
      link,
      'https://huggingface.co/studio/hero/blob/main/hero.gguf'
    )
    const filename = screen.getByRole('textbox', { name: 'Saved file name' })
    expect(filename).toHaveValue('hero.gguf')
    await user.clear(filename)
    await user.type(filename, 'hero-v2.gguf')
    await user.clear(link)
    await user.type(
      link,
      'https://huggingface.co/studio/hero/resolve/main/hero-remote.gguf'
    )
    expect(filename).toHaveValue('hero-v2.gguf')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Model folder' }),
      'other'
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Custom model folder' }),
      'LLM/Qwen'
    )
    await user.click(screen.getByRole('button', { name: 'Add to draft' }))
    expect(s.importedModels[0]).toMatchObject({
      fileName: 'hero-v2.gguf',
      directory: 'LLM/Qwen',
      sizeBytes: null
    })
    expect(
      screen.getByRole('checkbox', { name: 'Include hero-v2.gguf' })
    ).toBeChecked()
  })
  it('identifies same-name imports by their destination in request, settings and prepared summaries', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.reset('first')
    for (const directory of ['loras', 'LLM']) {
      expect(
        s.addModelImport({
          mode: 'url',
          directory,
          filename: 'shared.gguf',
          url: 'https://models.example/shared.gguf',
          file: null
        })
      ).toBeNull()
    }
    const request = render(RequestSummary, { global: { plugins: [i18n] } })
    await user.click(screen.getByText('Requested changes', { exact: true }))
    expect(
      screen.getByText('Add model: models/loras/shared.gguf')
    ).toBeVisible()
    expect(screen.getByText('Add model: models/LLM/shared.gguf')).toBeVisible()
    request.unmount()
    const settings = render(ExtensionReview, { global: { plugins: [i18n] } })
    expect(
      screen.getByText(/models\/loras\/shared.gguf, models\/LLM\/shared.gguf/)
    ).toBeVisible()
    expect(
      screen.getByText(/Based on .* GB of workflow models/)
    ).not.toHaveTextContent('&#x2F;')
    settings.unmount()
    s.state.phase = 'ready'
    s.panel = 'status'
    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await user.click(
      screen.getByText('Prepared configuration', { exact: true })
    )
    expect(
      screen.getByText(/models\/loras\/shared.gguf, models\/LLM\/shared.gguf/)
    ).toBeVisible()
  })
})
