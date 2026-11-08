import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
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

  it('creates first in Cloud after failure/retry and approval without moving a different active workflow', () => {
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    homestead.active.models = ['z_image_turbo_bf16.safetensors']
    s.reset('first')
    const initiator = homestead.active
    const source = structuredClone(
      toRaw(s.state.environments['dep-comfy-cloud'])
    )
    expect(s.state.draft).toMatchObject({
      mode: 'new',
      packs: {},
      models: ['z_image_turbo_bf16.safetensors'],
      gpu: 'L40S · 48 GB',
      storage: 16
    })
    expect(initiator.environmentId).toBe('dep-comfy-cloud')
    homestead.workflows.push({ ...initiator, id: 'another-cloud-workflow' })
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    s.holdJobs = true
    s.failure = true
    s.prepare()
    expect(s.run()).toBe(true)
    vi.advanceTimersByTime(5500)
    expect(s.state.phase).toBe('failed')
    expect(initiator.environmentId).toBe('dep-comfy-cloud')
    expect(s.state.environments['dep-comfy-cloud']).toEqual(source)
    expect(s.state.draft.packs['comfyui-rmbg']).toBe('2.0.0')
    homestead.activeId = 'another-cloud-workflow'
    s.failure = false
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.state.phase).toBe('ready')
    expect(initiator.environmentId).toBe('dep-comfy-cloud')
    expect(s.run()).toBe(true)
    s.dispatch({ type: 'approve' })
    expect(s.state.phase).toBe('applying')
    expect(s.locked).toBe(false)
    vi.advanceTimersByTime(1600)
    expect(initiator.environmentId).toBe('dep-comfy-cloud-copy-2')
    expect(homestead.active.environmentId).toBe('dep-comfy-cloud')
    expect(s.state.environments['dep-comfy-cloud']).toEqual(source)
    expect(s.state.jobs.map((job) => job.environmentId)).toEqual([
      'dep-comfy-cloud',
      'dep-comfy-cloud'
    ])
    expect(s.state.environments['dep-comfy-cloud-copy-2'].packs).toEqual({
      'comfyui-rmbg': '2.0.0'
    })
    expect(s.firstSetup).toBe(false)
    s.edit()
    expect(s.state.targetId).toBe('dep-comfy-cloud-copy-2')
    expect(s.state.draft.mode).toBe('update')
    expect(s.state.draft.packs['comfyui-rmbg']).toBe('2.0.0')
    s.prepare()
    vi.advanceTimersByTime(5500)
    s.dispatch({ type: 'approve' })
    vi.advanceTimersByTime(1600)
    expect(s.state.environments['dep-comfy-cloud']).toEqual(source)
    expect(s.state.environments['dep-comfy-cloud-copy-2'].revision).toBe(2)
    s.edit()
    expect(s.state.targetId).toBe('dep-comfy-cloud')
    expect(s.firstSetup).toBe(true)
    expect(s.state.draft.mode).toBe('new')
    s.state.draft.mode = 'update'
    s.prepare()
    expect(s.state.draft.mode).toBe('new')
    vi.advanceTimersByTime(5500)
    s.dispatch({ type: 'approve' })
    vi.advanceTimersByTime(1600)
    expect(s.state.environments['dep-comfy-cloud']).toEqual(source)
  })

  it('initializes the shareable first scenario from the active workflow fixture models', () => {
    window.history.replaceState(
      {},
      '',
      '/prototype/homestead?v=2&flow=extensions&scenario=first'
    )
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    homestead.active.models = []
    s.initialize()
    expect(s.firstSetup).toBe(true)
    expect(s.state.targetId).toBe('dep-comfy-cloud')
    expect(s.state.draft.models.length).toBeGreaterThan(0)
    expect(s.state.draft.packs).toEqual({})
    expect(s.state.environments.studio).toBeUndefined()
    expect(homestead.environment.id).toBe('dep-comfy-cloud')
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
