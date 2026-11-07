import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHomesteadStore } from '../store'
import { useExtensionManagerStore } from './store'

describe('extension prototype commands', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.history.replaceState(
      {},
      '',
      '/prototype/homestead?v=2&flow=extensions'
    )
  })

  it('keeps preparation running after closing its panel and requires approval after its email', () => {
    const s = useExtensionManagerStore()
    s.initialize()
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    s.prepare()
    s.panel = null
    vi.advanceTimersByTime(5500)
    expect(s.state.phase).toBe('ready')
    expect(s.panel).toBeNull()
    expect(s.inbox).toEqual([
      {
        title: 'Studio production',
        recipients: 'initiator@studio.example',
        kind: 'ready'
      }
    ])
    expect(useHomesteadStore().environment.revision).toBe('v12')
    expect(s.run()).toBe(true)
    s.dispatch({ type: 'approve' })
    expect(s.locked).toBe(true)
    expect(s.run()).toBe(false)
    vi.advanceTimersByTime(7000)
    expect(s.state.phase).toBe('applying')
    vi.advanceTimersByTime(1600)
    expect(s.state.phase).toBe('updated')
    expect(useHomesteadStore().environment.packs).toContain('comfyui-rmbg')
    expect(s.locked).toBe(false)
  })

  it('preserves selections on failure and retries with explicit approval still needed', () => {
    const s = useExtensionManagerStore()
    s.state.draft.packs['studio.zip'] = 'demo'
    s.failure = true
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.state.phase).toBe('failed')
    expect(s.repairContext).toContain('studio.zip')
    expect(s.state.environments.studio.revision).toBe(12)
    expect(s.inbox[0].kind).toBe('failed')
    s.failure = false
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.state.phase).toBe('ready')
    expect(s.state.draft.packs['studio.zip']).toBe('demo')
    expect(s.state.environments.studio.revision).toBe(12)
  })

  it('creates new for the initiating workflow even after navigating to an unrelated workflow', () => {
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    s.initialize()
    const initiator = homestead.active
    const metadata = {
      packs: [...initiator.packs],
      models: [...initiator.models]
    }
    homestead.workflows.push({
      ...initiator,
      id: 'unrelated-workflow',
      environmentId: 'fast'
    })
    s.state.draft.mode = 'new'
    s.prepare()
    homestead.activeId = 'unrelated-workflow'
    vi.advanceTimersByTime(5500)
    s.dispatch({ type: 'approve' })
    expect(s.locked).toBe(false)
    vi.advanceTimersByTime(1600)
    expect(initiator.environmentId).toBe('studio-copy-1')
    expect({ packs: initiator.packs, models: initiator.models }).toEqual(
      metadata
    )
    expect(homestead.active.environmentId).toBe('fast')
    expect(s.state.environments.studio.revision).toBe(12)
    expect(s.run()).toBe(true)
    expect(s.state.jobs[0]).toMatchObject({
      environmentId: 'fast',
      revision: 4
    })
  })

  it('blocks admissions on the approved target while unrelated workflow runs continue', () => {
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    s.initialize()
    s.run()
    homestead.workflows.push({
      ...homestead.active,
      id: 'unrelated-workflow',
      environmentId: 'fast'
    })
    s.prepare()
    vi.advanceTimersByTime(5500)
    s.dispatch({ type: 'approve' })
    homestead.activeId = 'unrelated-workflow'
    expect(s.locked).toBe(false)
    expect(s.run('studio')).toBe(false)
    expect(s.run()).toBe(true)
    expect(
      s.state.jobs.map((job) => [job.environmentId, job.revision])
    ).toEqual([
      ['studio', 12],
      ['fast', 4]
    ])
  })

  it('notifies all demo admins and notifies requester only after admin explicitly applies', () => {
    const s = useExtensionManagerStore()
    s.reset('member')
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    s.request()
    expect(s.inbox[0].recipients).toBe(
      'alex@studio.example, sam@studio.example (all workspace admins)'
    )
    s.prepare()
    expect(s.state.phase).toBe('idle')
    s.reviewRequest()
    expect(s.state.draft.packs['comfyui-rmbg']).toBe('2.0.0')
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.inbox.map((email) => email.kind)).toEqual(['request', 'ready'])
    s.dispatch({ type: 'approve' })
    vi.advanceTimersByTime(1600)
    expect(s.inbox.map((email) => email.kind)).toEqual([
      'request',
      'ready',
      'available'
    ])
  })
})
