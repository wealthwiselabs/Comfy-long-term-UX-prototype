import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
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

  it('closes progress and emits one brief native toast only after running and queued jobs drain and activation finishes', () => {
    const s = useExtensionManagerStore()
    const toast = useToastStore()
    s.initialize()
    s.holdJobs = true
    s.run()
    s.run()
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.panel).toBe('status')
    expect(toast.messagesToAdd).toEqual([])
    s.dispatch({ type: 'approve' })
    expect(s.state.phase).toBe('waiting')
    s.dispatch({ type: 'finishJob' })
    expect(s.state.phase).toBe('waiting')
    expect(toast.messagesToAdd).toEqual([])
    s.dispatch({ type: 'finishJob' })
    expect(s.state.phase).toBe('applying')
    vi.advanceTimersByTime(1599)
    expect(s.panel).toBe('status')
    expect(toast.messagesToAdd).toEqual([])
    vi.advanceTimersByTime(1)
    expect(s.state.phase).toBe('updated')
    expect(s.panel).toBeNull()
    expect(toast.messagesToAdd).toEqual([
      {
        severity: 'success',
        summary: 'Running on Studio production',
        life: 3000
      }
    ])
    s.dispatch({ type: 'apply' })
    expect(toast.messagesToAdd).toHaveLength(1)
  })

  it('keeps failure recovery open without a success toast', () => {
    const s = useExtensionManagerStore()
    s.failure = true
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.state.phase).toBe('failed')
    expect(s.panel).toBe('status')
    expect(useToastStore().messagesToAdd).toEqual([])
  })

  it('exposes only managed environments plus standard Cloud and preserves an ongoing target when manually switching', () => {
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    s.reset('first')
    expect(
      s.availableEnvironments.map((environment) => environment.id)
    ).toEqual(['dep-comfy-cloud'])
    expect(s.selectEnvironment('studio')).toBe(false)
    s.reset('existing')
    s.prepare()
    const draft = structuredClone(toRaw(s.state.draft))
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(true)
    expect(homestead.active.environmentId).toBe('dep-comfy-cloud')
    expect(s.state.sessions.you).toBe('dep-comfy-cloud')
    expect(s.state.targetId).toBe('studio')
    expect(s.state.draft).toEqual(draft)
    expect(s.state.phase).toBe('preparing')
    expect(useToastStore().messagesToAdd).toEqual([
      { severity: 'success', summary: 'Running on Comfy Cloud', life: 3000 }
    ])
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(false)
    expect(s.selectEnvironment('unknown')).toBe(false)
    expect(useToastStore().messagesToAdd).toHaveLength(1)
    vi.advanceTimersByTime(5500)
    s.dispatch({ type: 'approve' })
    expect(s.selectEnvironment('studio')).toBe(false)
    vi.advanceTimersByTime(1600)
    expect(homestead.active.environmentId).toBe('dep-comfy-cloud')
    expect(s.state.environments.studio.revision).toBe(13)
    expect(useToastStore().messagesToAdd[1]).toMatchObject({
      summary: 'Environment applied: Studio production'
    })
  })

  it('keeps new-environment activation pinned to its initiator after a manual picker choice', () => {
    const s = useExtensionManagerStore()
    const homestead = useHomesteadStore()
    s.reset('first')
    s.reset('existing')
    const initiator = homestead.active
    s.state.draft.mode = 'new'
    s.prepare()
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(true)
    vi.advanceTimersByTime(5500)
    s.dispatch({ type: 'approve' })
    vi.advanceTimersByTime(1600)
    expect(initiator.environmentId).toBe('studio-copy-1')
    expect(s.panel).toBeNull()
  })

  it('retargets a clean idle draft to standard Cloud as new-only, then back to the selected custom environment', () => {
    const s = useExtensionManagerStore()
    s.reset('first')
    s.reset('existing')
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(true)
    s.edit()
    expect(s.state.targetId).toBe('dep-comfy-cloud')
    expect(s.firstSetup).toBe(true)
    expect(s.panel).toBe('packs')
    expect(s.state.draft.mode).toBe('new')
    expect(s.state.draft.packs).toEqual({})
    expect(s.selectEnvironment('studio')).toBe(true)
    s.edit()
    expect(s.state.targetId).toBe('studio')
    expect(s.firstSetup).toBe(false)
    expect(s.state.draft.mode).toBe('update')
    expect(s.state.draft.name).toBe('Studio production')
  })

  it('preserves an edited named draft when the active picker environment changes', () => {
    const s = useExtensionManagerStore()
    s.reset('first')
    s.reset('existing')
    s.state.draft.name = 'Studio experiment'
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    s.state.draft.models = ['sdxl', 'detail-tweaker']
    s.state.draft.gpu = 'h100-sxm'
    const draft = structuredClone(toRaw(s.state.draft))
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(true)
    s.edit()
    expect(s.state.targetId).toBe('studio')
    expect(s.state.draft).toEqual(draft)
  })

  it('preserves pending requests and excluded-pack version prechoices on picker changes', () => {
    const s = useExtensionManagerStore()
    s.reset('first')
    s.reset('existing')
    s.request()
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(true)
    s.edit()
    expect(s.state.targetId).toBe('studio')
    expect(s.requestPending).toBe(true)
    s.reset('existing')
    s.excludedVersions['comfyui-rmbg'] = '1.9.3'
    expect(s.selectEnvironment('dep-comfy-cloud')).toBe(true)
    s.edit()
    expect(s.state.targetId).toBe('studio')
    expect(s.excludedVersions['comfyui-rmbg']).toBe('1.9.3')
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
    expect(s.panel).toBeNull()
    expect(useToastStore().messagesToAdd).toEqual([
      {
        severity: 'success',
        summary: 'Environment applied: Studio production',
        life: 3000
      }
    ])
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
      models: ['z-image'],
      gpu: 'rtx-pro-6000-mig-2g-48gb'
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
    expect(s.panel).toBe('packs')
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
    expect(s.panel).toBe('intro')
    expect(s.state.targetId).toBe('dep-comfy-cloud')
    expect(s.state.draft.models.length).toBeGreaterThan(0)
    expect(s.state.draft.packs).toEqual({})
    expect(s.state.environments.studio).toBeUndefined()
    expect(homestead.environment.id).toBe('dep-comfy-cloud')
  })

  it('shows the no-custom-environment intro until Create is accepted, then retains an unfinished draft on reopen', () => {
    const s = useExtensionManagerStore()
    s.reset('first')
    expect(s.panel).toBe('intro')
    s.panel = null
    s.edit()
    expect(s.panel).toBe('intro')
    s.continueFromIntro()
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    s.panel = null
    s.edit()
    expect(s.panel).toBe('packs')
    expect(s.state.draft.packs['comfyui-rmbg']).toBe('2.0.0')
  })

  it('unions inherited models with workflow requirements, normalizes aliases and preserves explicit model edits on retry', () => {
    const homestead = useHomesteadStore()
    homestead.active.models = [
      'FLUX.1 dev',
      'models/flux1-dev-fp8.safetensors',
      'private.gguf'
    ]
    const s = useExtensionManagerStore()
    s.initialize()
    expect(s.state.draft.models).toEqual([
      'flux1-dev-fp8',
      'acme_hero_lora_v5',
      'private.gguf'
    ])
    s.state.draft.models = ['private.gguf', 'detail-tweaker']
    s.failure = true
    s.prepare()
    vi.advanceTimersByTime(5500)
    s.edit()
    expect(s.state.draft.models).toEqual(['private.gguf', 'detail-tweaker'])
    s.failure = false
    s.prepare()
    vi.advanceTimersByTime(5500)
    expect(s.state.draft.models).toEqual(['private.gguf', 'detail-tweaker'])
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
  it('preserves installed dependencies and blocks requests when enterprise additions are disabled', () => {
    const s = useExtensionManagerStore()
    s.reset('member')
    const installedPacks = { ...s.target.packs }
    const installedModels = [...s.target.models]
    s.state.draft.packs['comfyui-rmbg'] = '2.0.0'
    s.state.draft.models.push('detail-tweaker')
    s.setEnterpriseCapabilities({ addNodes: false, addModels: false })
    expect(s.state.draft.packs).toEqual(installedPacks)
    expect(s.state.draft.models).toEqual(installedModels)
    s.edit()
    s.request()
    expect(s.panel).toBeNull()
    expect(s.inbox).toEqual([])
    expect(s.requestPending).toBe(false)
  })
})
