import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import HomesteadDesktopForm from './HomesteadDesktopForm.vue'
import HomesteadCloudButton from './HomesteadCloudButton.vue'
import HomesteadMemoryBanner from './HomesteadMemoryBanner.vue'
import { useHomesteadStore } from './store'

function setup() {
  const s = useHomesteadStore()
  s.entry = 'desktop'
  s.activeId = 'matte'
  s.dialog = 'desktop'
  return { s, global: { plugins: [i18n] } }
}

describe('Desktop cloud controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    window.history.replaceState({}, '', '/prototype/homestead?v=1')
    i18n.global.locale.value = 'en'
  })

  it('hands off the workflow without creating a build or requiring build choices', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const { s, global } = setup()
    render(HomesteadDesktopForm, { global })
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Let’s go' }))
    expect(s.dialog).toBeNull()
    expect(s.agentOpen).toBe(true)
    expect(s.build.phase).toBe('idle')
    expect(s.agentRun).toBeNull()
    expect(s.agentHandoff?.workflow.id).toBe('matte')
    s.activeId = 'product'
    expect(s.agentHandoff?.workflow.id).toBe('matte')
  })

  it('opens the same form from the secondary Run on cloud action', async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      applyAccept: false
    })
    const { s, global } = setup()
    s.dialog = null
    render(HomesteadCloudButton, { global })
    await user.click(screen.getByRole('button', { name: 'Run on cloud' }))
    expect(s.dialog).toBe('desktop')
  })

  it('offers memory recovery only after the simulated OOM instead of predicting it', async () => {
    const { s, global } = setup()
    render(HomesteadMemoryBanner, { global })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    s.oom = true
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'This run ran out of memory'
    )
  })
})
