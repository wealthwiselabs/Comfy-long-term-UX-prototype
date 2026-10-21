import { beforeEach, describe, expect, it, vi } from 'vitest'
import { environments, seedWorkflows } from './model'
import { useSkillFlowStore } from './skillFlowStore'
import type { SkillScenario } from './skillFlowModel'

function start(scenario: SkillScenario = 'auto') {
  const flow = useSkillFlowStore()
  flow.start(
    { id: 'session-1', workflow: seedWorkflows()[1], workspace: 'Studio' },
    scenario,
    environments,
    'none'
  )
  return flow
}

describe('Run on Cloud skill transcript', () => {
  beforeEach(() => vi.useFakeTimers())

  it.for(['stock', 'lossless', 'existing', 'auto'] as const)(
    'finishes the %s route without creating a build and preserves the original',
    (scenario) => {
      const flow = start(scenario)
      expect(flow.state.phase).toBe('running')
      expect(flow.events.map((event) => event.step)).toEqual(['skill'])
      vi.runAllTimers()
      expect(flow.state.phase).toBe('complete')
      expect(flow.events.some((event) => event.step === 'push')).toBe(false)
      expect(flow.events.map((event) => event.step)).toContain('test')
      expect(flow.events.map((event) => event.step)).toContain('readback')
      expect(flow.session?.workflow).toEqual(seedWorkflows()[1])
    }
  )

  it('pauses before a lossy conversion and checks existing Builds when exact dependencies are chosen', () => {
    const flow = start('lossy')
    vi.runAllTimers()
    expect(flow.state.phase).toBe('conversion')
    expect(flow.events.some((event) => event.step === 'convert')).toBe(false)
    flow.chooseConversion(false)
    vi.runAllTimers()
    expect(flow.events.map((event) => event.step)).toContain('existing')
    expect(flow.state.phase).toBe('buildPlan')
  })

  it('does not run or push after an upload decline; only the named files can be approved', () => {
    const flow = start('assets')
    vi.runAllTimers()
    expect(flow.state.phase).toBe('uploads')
    flow.declineUploads()
    vi.runAllTimers()
    expect(flow.state.phase).toBe('blocked')
    expect(
      flow.events.some(
        (event) => event.step === 'test' || event.step === 'push'
      )
    ).toBe(false)
    flow.reviewUploads()
    flow.approveUploads('asset')
    vi.runAllTimers()
    expect(flow.state.phase).toBe('complete')
    expect(flow.approvedFiles).toEqual([
      'reference.png',
      'motion.mp4',
      'voice.wav'
    ])
  })

  it('checks inventory, existing Builds and limits before asking for a custom build plan', () => {
    const flow = start('custom')
    vi.runAllTimers()
    expect(flow.state.phase).toBe('buildPlan')
    expect(flow.events.map((event) => event.step)).toEqual([
      'skill',
      'locate',
      'inventory',
      'cloud',
      'existing',
      'limits'
    ])
    flow.confirmBuild({
      mode: 'update',
      sourceId: 'studio',
      name: 'Keep my build',
      gpu: 'B200',
      region: 'us-west',
      scope: 'workflow',
      instructions: ''
    })
    vi.runAllTimers()
    expect(flow.state.phase).toBe('uploads')
    expect(flow.events.some((event) => event.step === 'push')).toBe(false)
    flow.approveUploads('model')
    vi.runAllTimers()
    expect(flow.state.phase).toBe('complete')
    expect(flow.session?.request).toMatchObject({
      mode: 'update',
      sourceId: 'studio',
      gpu: 'B200'
    })
    expect(
      flow.events.find((event) => event.step === 'manifest')?.command
    ).toContain('studio')
  })

  it('pushes, rebuilds and redeploys after repairing a failed release', () => {
    const flow = useSkillFlowStore()
    flow.start(
      { id: 'repair-build', workflow: seedWorkflows()[1], workspace: 'Studio' },
      'custom',
      environments,
      'build'
    )
    vi.runAllTimers()
    flow.confirmBuild({
      mode: 'create',
      name: 'Test build',
      gpu: 'B200',
      region: 'us-west',
      scope: 'workflow',
      instructions: ''
    })
    vi.runAllTimers()
    flow.approveUploads('model')
    vi.runAllTimers()
    expect(flow.state.phase).toBe('failed')
    const before = flow.events.length
    flow.retry()
    vi.runAllTimers()
    const retrySteps = flow.events.slice(before).map((event) => event.step)
    expect(retrySteps).toContain('push')
    expect(retrySteps.indexOf('push')).toBeLessThan(
      retrySteps.indexOf('release')
    )
    expect(retrySteps.indexOf('release')).toBeLessThan(
      retrySteps.indexOf('deploy')
    )
    expect(retrySteps.indexOf('deploy')).toBeLessThan(
      retrySteps.indexOf('test')
    )
    expect(flow.state.phase).toBe('complete')
  })

  it('does not restart the same session when the panel reopens', () => {
    const flow = start('custom')
    vi.runAllTimers()
    const before = flow.events.length
    start('custom')
    expect(flow.events).toHaveLength(before)
    expect(flow.state.phase).toBe('buildPlan')
  })

  it('converts for stock Cloud only after an explicit yes and never pushes a custom build', () => {
    const flow = start('lossy')
    vi.runAllTimers()
    flow.chooseConversion(true)
    vi.runAllTimers()
    expect(flow.state.phase).toBe('complete')
    expect(flow.session?.lossyApproved).toBe(true)
    expect(flow.events.map((event) => event.step)).toContain('convert')
    expect(flow.events.some((event) => event.step === 'push')).toBe(false)
  })

  it('stops on an import failure and repairs before retrying the same verified target', () => {
    const flow = useSkillFlowStore()
    flow.start(
      { id: 'retry', workflow: seedWorkflows()[1], workspace: 'Studio' },
      'existing',
      environments,
      'deployment'
    )
    vi.runAllTimers()
    expect(flow.state.phase).toBe('failed')
    expect(flow.events.some((event) => event.step === 'test')).toBe(false)
    const target = flow.session?.target?.id
    flow.retry()
    vi.runAllTimers()
    expect(flow.state.phase).toBe('buildPlan')
    expect(
      flow.session?.environments.find((env) => env.id === target)?.verified
    ).toBe(false)
    expect(flow.session?.repairs).toBe(1)
    expect(flow.events.map((event) => event.step)).toContain('repair')
  })

  it('reuses a verified exact-dependency Build after a lossy conversion is declined', () => {
    const flow = useSkillFlowStore()
    const workspace = structuredClone(environments)
    workspace[0].models.push('acme_hero_lora_v5.safetensors')
    flow.start(
      { id: 'exact', workflow: seedWorkflows()[1], workspace: 'Studio' },
      'lossy',
      workspace,
      'none'
    )
    vi.runAllTimers()
    flow.chooseConversion(false)
    vi.runAllTimers()
    expect(flow.state.phase).toBe('complete')
    expect(flow.session?.route).toBe('existing')
    expect(flow.events.some((event) => event.step === 'push')).toBe(false)
  })

  it('binds an update by Build family and produces a separate preview revision', () => {
    const flow = start('custom')
    vi.runAllTimers()
    flow.session?.environments.push({
      ...environments[0],
      id: 'revision-13',
      buildId: 'studio',
      revision: 'v13'
    })
    flow.confirmBuild({
      mode: 'update',
      sourceId: 'studio',
      sourceEnvironmentId: 'revision-13',
      name: 'New revision',
      gpu: 'B200',
      region: 'us-west',
      instructions: ''
    })
    vi.runAllTimers()
    expect(flow.session?.target).toMatchObject({
      buildId: 'studio',
      revision: 'v14',
      gpu: 'B200'
    })
    expect(flow.session?.target?.id).not.toBe('revision-13')
    expect(
      flow.events.find((event) => event.step === 'manifest')?.command
    ).toContain('--id studio')
  })
})
