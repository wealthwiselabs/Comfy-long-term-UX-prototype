import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import ExtensionToolbar from './ExtensionToolbar.vue'
import { useExtensionManagerStore } from './store'

describe('demo scenario controls', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    render(ExtensionToolbar, { global: { plugins: [i18n] } })
  })

  it('dismisses the demo box before opening the selected scenario', async () => {
    const user = userEvent.setup()
    await user.click(
      screen.getByText('Demo scenarios & inbox', { exact: true })
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Scenario' }),
      'first'
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('combobox', { name: 'Scenario' })
      ).not.toBeInTheDocument()
    )
    expect(useExtensionManagerStore().panel).toBe('intro')
    expect(useExtensionManagerStore().scenario).toBe('first')
  })

  it('supports Close, Escape and outside-click dismissal without losing controls', async () => {
    const user = userEvent.setup()
    const trigger = screen.getByText('Demo scenarios & inbox', { exact: true })
    await user.click(trigger)
    await user.click(
      screen.getByRole('button', { name: 'Close demo scenarios' })
    )
    expect(
      screen.queryByRole('combobox', { name: 'Scenario' })
    ).not.toBeInTheDocument()
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('combobox', { name: 'Scenario' })
    ).not.toBeInTheDocument()
    await user.click(trigger)
    await user.click(screen.getByText('Cloud', { exact: true }))
    expect(
      screen.queryByRole('combobox', { name: 'Scenario' })
    ).not.toBeInTheDocument()
    await user.click(trigger)
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toBeVisible()
  })
})
