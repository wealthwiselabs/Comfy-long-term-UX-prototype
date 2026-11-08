import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import PreparationStatus from './PreparationStatus.vue'
import { useExtensionManagerStore } from './store'

describe('candidate environment progress', () => {
  beforeEach(() => vi.useFakeTimers())

  it('shows build then deployment statuses and awaits approval after every candidate step completes', async () => {
    const s = useExtensionManagerStore()
    s.prepare()
    render(PreparationStatus, { global: { plugins: [i18n] } })
    expect(
      screen
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label'))
    ).toEqual([
      'Prepare configuration',
      'Install node packs',
      'Check and package',
      'Copy models',
      'Create environment',
      'Start environment'
    ])
    expect(
      within(
        screen.getByRole('listitem', { name: 'Prepare configuration' })
      ).getByText('In progress')
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('listitem', { name: 'Install node packs' })
      ).getByText('Pending')
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(750)
    expect(
      within(
        screen.getByRole('listitem', { name: 'Prepare configuration' })
      ).getByText('Completed')
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('listitem', { name: 'Install node packs' })
      ).getByText('In progress')
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(3000)
    expect(
      within(
        screen.getByRole('listitem', { name: 'Start environment' })
      ).getByText('In progress')
    ).toBeInTheDocument()
    expect(s.state.phase).toBe('preparing')
    await vi.advanceTimersByTimeAsync(1750)
    expect(screen.getAllByText('Completed')).toHaveLength(6)
    expect(s.state.phase).toBe('ready')
    expect(s.state.environments.studio.revision).toBe(12)
  })

  it('marks the failed node-pack stage and keeps later stages pending', async () => {
    const s = useExtensionManagerStore()
    s.failure = true
    s.prepare()
    render(PreparationStatus, { global: { plugins: [i18n] } })
    await vi.advanceTimersByTimeAsync(5500)
    expect(
      within(
        screen.getByRole('listitem', { name: 'Install node packs' })
      ).getByText('Failed')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Copy models' })).getByText(
        'Pending'
      )
    ).toBeInTheDocument()
    expect(s.state.environments.studio.revision).toBe(12)
  })
})
