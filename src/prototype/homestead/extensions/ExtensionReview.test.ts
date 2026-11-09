import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import ExtensionReview from './ExtensionReview.vue'
import { useExtensionManagerStore } from './store'
import { useHomesteadStore } from '../store'

describe('environment update destination', () => {
  it('defaults to the current environment and changes only the draft destination', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    s.state.environments.staging = {
      id: 'staging',
      name: 'Studio staging',
      revision: 3,
      packs: { essentials: '1.1.0', 'impact-pack': '8.28.3' },
      models: ['t5'],
      gpu: 'rtx-pro-6000-mig-2g-48gb'
    }
    s.workflowModelIds = []
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    delete s.state.draft.packs['impact-pack']
    s.state.draft.models.push('detail-tweaker')
    render(ExtensionReview, { global: { plugins: [i18n] } })
    const destination = screen.getByRole('combobox', {
      name: 'Environment to update'
    })
    expect(destination).toHaveValue('studio')
    expect(
      screen.getByRole('option', { name: /Studio production.*Current/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Comfy Cloud/ })
    ).not.toBeInTheDocument()
    await user.selectOptions(destination, 'staging')
    expect(s.state.targetId).toBe('staging')
    expect(s.state.draft).toMatchObject({
      name: 'Studio staging',
      mode: 'update',
      packs: { essentials: '1.1.0', 'comfyui-rmbg': '2.0.0' },
      models: ['t5', 'detail-tweaker'],
      gpu: 'rtx-pro-6000-mig-2g-48gb'
    })
    expect(homestead.environment.id).toBe('studio')
    expect(s.state.sessions.you).toBe('studio')
    expect(s.state.environments.staging.packs).toHaveProperty('impact-pack')
    expect(
      screen.queryByRole('textbox', { name: 'Environment name' })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('radio', { name: 'Create a new environment' })
    )
    expect(
      screen.queryByRole('combobox', { name: 'Environment to update' })
    ).not.toBeInTheDocument()
    expect(s.state.draft.mode).toBe('new')
    const name = screen.getByRole('textbox', { name: 'Environment name' })
    await user.clear(name)
    await user.type(name, 'New custom environment')
    await user.click(
      screen.getByRole('radio', { name: 'Update an existing environment' })
    )
    expect(
      screen.queryByRole('textbox', { name: 'Environment name' })
    ).not.toBeInTheDocument()
    expect(s.state.draft.name).toBe('Studio staging')
  })
})

describe('workflow-sized GPU recommendation', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('tags the GPU based on workflow sizes while preserving an editable GPU choice', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    s.workflowModelIds = ['sdxl']
    s.state.draft.models = ['hidream', 'flux1-dev-fp8', 'sdxl']
    render(ExtensionReview, { global: { plugins: [i18n] } })
    expect(screen.getByText('Recommended')).toBeVisible()
    const recommended = screen.getByRole('radio', {
      name: 'RTX PRO 6000 MIG · 48 GB (Recommended)'
    })
    expect(recommended).not.toBeChecked()
    expect(
      screen.getByText(/Based on 6.00 GB of workflow models/)
    ).toBeVisible()
    await user.click(recommended)
    expect(recommended).toBeChecked()
    expect(s.state.draft.gpu).toBe('rtx-pro-6000-mig-2g-48gb')
  })

  it('uses an imported workflow file size and withholds the tag when that size is unknown', async () => {
    const s = useExtensionManagerStore()
    s.workflowModelIds = ['loras/private.gguf']
    s.addModelImport({
      mode: 'file',
      directory: 'loras',
      filename: '',
      url: '',
      file: new File(['weights'], 'private.gguf')
    })
    s.importedModels[0].sizeBytes = 36 * 1024 ** 3
    render(ExtensionReview, { global: { plugins: [i18n] } })
    expect(
      screen.getByRole('radio', {
        name: 'RTX PRO 6000 · 96 GB (Recommended)'
      })
    ).toBeVisible()
    s.importedModels[0].sizeBytes = null
    expect(
      await screen.findByText(/Some workflow model sizes are unknown/)
    ).toBeVisible()
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
  })
})
