import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import HomesteadAgentSetup from './HomesteadAgentSetup.vue'
import { useHomesteadStore } from './store'

describe('Agent route and approval decisions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    window.history.replaceState({}, '', '/prototype/homestead?v=1')
    i18n.global.locale.value = 'en'
  })

  it('offers a compatible workspace environment without build configuration', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const s = useHomesteadStore()
    s.activeId = 'matte'
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    expect(
      screen.queryByRole('textbox', { name: 'Build name' })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Use this environment' })
    )
    expect(
      screen.queryByRole('button', { name: 'Open in ComfyUI' })
    ).not.toBeInTheDocument()
    expect(s.agentOpen).toBe(true)
    await vi.advanceTimersByTimeAsync(3000)
    await user.click(screen.getByRole('button', { name: 'Open in ComfyUI' }))
    expect(s.environment.id).toBe('studio')
    expect(s.build.phase).toBe('idle')
  })

  it('retains an approved named-update plan when reopening the same workflow', () => {
    const s = useHomesteadStore()
    s.activeId = 'matte'
    s.failure = 'build'
    s.startBuild('agent', {
      mode: 'update',
      sourceId: 'studio',
      name: 'My build',
      gpu: 'B200',
      region: 'us-west',
      scope: 'workflow',
      instructions: ''
    })
    vi.advanceTimersByTime(18000)
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    expect(
      screen.getByRole('radio', { name: 'Update existing build' })
    ).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'GPU' })).toHaveValue('B200')
    expect(screen.getByRole('textbox', { name: 'Region' })).toHaveValue(
      'us-west'
    )
    expect(screen.getByRole('textbox', { name: 'Build name' })).toHaveValue(
      'My build'
    )
  })

  it('blocks the custom build until its simulated local upload is approved', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const s = useHomesteadStore()
    s.activeId = 'matte'
    s.active.packs.push('Local studio pack')
    s.importCase = 'missing'
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    await user.click(screen.getByRole('button', { name: 'Confirm build plan' }))
    expect(s.build.phase).toBe('idle')
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    expect(s.build.phase).toBe('idle')
    expect(screen.getByRole('alert')).toHaveTextContent('prepared, not run')
    await user.click(screen.getByRole('button', { name: 'Upload assets' }))
    expect(s.build.phase).toBe('building')
    expect(s.agentRun?.workflow.id).toBe('matte')
  })
})
