import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import HomesteadAgentSetup from './HomesteadAgentSetup.vue'
import HomesteadPanels from './HomesteadPanels.vue'
import { useSkillFlowStore } from './skillFlowStore'
import { useHomesteadStore } from './store'

describe('Agent route and approval decisions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    window.history.replaceState({}, '', '/prototype/homestead?v=1')
    i18n.global.locale.value = 'en'
  })

  it('shows discovery and test/save steps before offering the simulated canvas', async () => {
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
    expect(screen.getByText('Load Run on Cloud skill')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Open in ComfyUI' })
    ).not.toBeInTheDocument()
    expect(s.agentOpen).toBe(true)
    await vi.runAllTimersAsync()
    expect(
      screen.getByText('Check existing workspace Builds')
    ).toBeInTheDocument()
    expect(screen.getByText('Run one test job')).toBeInTheDocument()
    expect(screen.getByText('Verify sidebar read-back')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Open preview canvas' })
    )
    expect(s.environment.id).toBe('studio')
    expect(s.build.phase).toBe('idle')
  })

  it('retains an approved named-update plan when reopening the same workflow', async () => {
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
    s.failure = 'none'
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    await vi.runAllTimersAsync()
    expect(
      screen.queryByRole('textbox', { name: 'Build name' })
    ).not.toBeInTheDocument()
    expect(useSkillFlowStore().session?.request).toMatchObject({
      mode: 'update',
      sourceId: 'studio',
      name: 'My build',
      gpu: 'B200',
      region: 'us-west'
    })
    expect(
      screen.getByText('Simulated workflow test passed')
    ).toBeInTheDocument()
  })

  it('asks for a GPU and lists both private models when whole-instance scope is chosen', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const s = useHomesteadStore()
    s.agentScenario = 'custom'
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    await vi.runAllTimersAsync()
    expect(
      screen.getByRole('button', { name: 'Confirm build plan' })
    ).toBeDisabled()
    expect(screen.getByText(/8 packs.*9 models.*36 GB/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Whole instance' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'GPU' }),
      'H100 SXM'
    )
    await user.click(screen.getByRole('button', { name: 'Confirm build plan' }))
    await vi.runAllTimersAsync()
    expect(useSkillFlowStore().session?.request).toMatchObject({
      scope: 'instance',
      gpu: 'H100 SXM'
    })
    expect(
      screen.getByText('acme_hero_lora_v5.safetensors · 128 MB')
    ).toBeInTheDocument()
    expect(
      screen.getByText('studio_materials_v2.safetensors · 256 MB')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    expect(
      useSkillFlowStore().events.some((event) => event.step === 'push')
    ).toBe(false)
    expect(screen.getByRole('alert')).toHaveTextContent(/prepared, not run/i)
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
    s.agentScenario = 'custom'
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    await vi.runAllTimersAsync()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'GPU' }),
      'RTX PRO 6000'
    )
    await user.click(screen.getByRole('button', { name: 'Confirm build plan' }))
    await vi.runAllTimersAsync()
    expect(s.build.phase).toBe('idle')
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    expect(s.build.phase).toBe('idle')
    expect(screen.getByRole('alert')).toHaveTextContent(/prepared, not run/i)
    await user.click(
      screen.getByRole('button', { name: 'Review upload request' })
    )
    await user.click(screen.getByRole('button', { name: 'Upload models' }))
    await vi.runAllTimersAsync()
    expect(
      screen.getByText('Simulated workflow test passed')
    ).toBeInTheDocument()
    expect(screen.getByText('Push build')).toBeInTheDocument()
  })

  it('keeps an unsubmitted build draft when the agent panel is closed and reopened', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const s = useHomesteadStore()
    s.agentScenario = 'custom'
    s.startAgentHandoff()
    render(HomesteadPanels, { global: { plugins: [i18n] } })
    await vi.runAllTimersAsync()
    await user.clear(screen.getByRole('textbox', { name: 'Build name' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Build name' }),
      'My draft'
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('textbox', { name: 'Build name' })
    ).not.toBeInTheDocument()
    s.startAgentHandoff()
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByRole('textbox', { name: 'Build name' })).toHaveValue(
      'My draft'
    )
  })

  it('opens the new update revision while preserving its working source', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const s = useHomesteadStore()
    s.activeId = 'matte'
    s.agentScenario = 'custom'
    s.availableEnvironments.push({
      ...s.availableEnvironments[0],
      id: 'revision-13',
      buildId: 'studio',
      revision: 'v13'
    })
    s.startAgentHandoff()
    render(HomesteadAgentSetup, { global: { plugins: [i18n] } })
    await vi.runAllTimersAsync()
    await user.click(
      screen.getByRole('radio', { name: 'Update existing build' })
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Existing build' }),
      'revision-13'
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'GPU' }),
      'B200'
    )
    await user.click(screen.getByRole('button', { name: 'Confirm build plan' }))
    await vi.runAllTimersAsync()
    await user.click(screen.getByRole('button', { name: 'Upload models' }))
    await vi.runAllTimersAsync()
    await user.click(
      screen.getByRole('button', { name: 'Open preview canvas' })
    )
    expect(s.environment).toMatchObject({
      buildId: 'studio',
      revision: 'v14',
      gpu: 'B200'
    })
    expect(s.compatible.status).toBe('compatible')
    expect(
      s.availableEnvironments.find((env) => env.id === 'revision-13')?.revision
    ).toBe('v13')
  })
})
