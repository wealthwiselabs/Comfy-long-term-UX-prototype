import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useHomesteadStore } from '../store'
import ExtensionEnvironmentPicker from './ExtensionEnvironmentPicker.vue'
import { useExtensionManagerStore } from './store'

describe('editor environment picker', () => {
  it('lists the current environment and switches through the icon without changing workflow edits or a pending build', async () => {
    const user = userEvent.setup()
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    s.reset('first')
    s.reset('existing')
    homestead.active.prompt = 'Keep this unsaved workflow prompt'
    s.prepare()
    const generation = s.state.generation
    render(ExtensionEnvironmentPicker, { global: { plugins: [i18n] } })

    await user.click(
      screen.getByRole('button', {
        name: 'Running on Studio production. Switch environment'
      })
    )
    expect(
      await screen.findByRole('menuitemradio', {
        name: 'Run on Studio production'
      })
    ).toHaveAttribute('aria-checked', 'true')
    await user.click(
      screen.getByRole('menuitemradio', { name: 'Run on Comfy Cloud' })
    )

    expect(homestead.environment.id).toBe('dep-comfy-cloud')
    expect(homestead.active.prompt).toBe('Keep this unsaved workflow prompt')
    expect(['preparing', 'ready']).toContain(s.state.phase)
    expect(s.state.generation).toBe(generation)
    expect(s.state.targetId).toBe('studio')
    expect(useToastStore().messagesToAdd.at(-1)?.summary).toBe(
      'Running on Comfy Cloud'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Running on Comfy Cloud. Switch environment'
      })
    )
    expect(
      await screen.findByRole('menuitemradio', { name: 'Run on Comfy Cloud' })
    ).toHaveAttribute('aria-checked', 'true')
    await user.click(
      screen.getByRole('menuitemradio', { name: 'Run on Studio production' })
    )
    expect(homestead.environment.id).toBe('studio')
    expect(homestead.active.prompt).toBe('Keep this unsaved workflow prompt')
  })
})
