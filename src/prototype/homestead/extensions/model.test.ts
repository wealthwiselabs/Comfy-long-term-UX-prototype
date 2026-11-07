import { describe, expect, it } from 'vitest'
import { initialState, transition, canRun } from './model'

describe('extension environment approval', () => {
  it.for(['unknown-environment', 'toString'])(
    'rejects Run when %s is not an owned environment',
    (environmentId) => {
      const start = initialState()
      expect(transition(start, { type: 'run', environmentId })).toBe(start)
    }
  )

  it('readiness never switches environments or blocks new jobs', () => {
    const start = initialState()
    const ready = transition(transition(start, { type: 'prepare' }), {
      type: 'ready'
    })
    expect(ready.phase).toBe('ready')
    expect(ready.environments).toEqual(start.environments)
    expect(canRun(ready, 'studio')).toBe(true)
    expect(transition(ready, { type: 'apply' })).toEqual(ready)
  })

  it('approval locks the shared target, drains running AND queued old jobs, then switches', () => {
    const start = initialState()
    const running = transition(start, { type: 'run', environmentId: 'studio' })
    const queued = transition(running, { type: 'run', environmentId: 'studio' })
    const ready = transition(transition(queued, { type: 'prepare' }), {
      type: 'ready'
    })
    const approved = transition(ready, { type: 'approve' })
    expect(approved.phase).toBe('waiting')
    expect(canRun(approved, 'studio')).toBe(false)
    expect(canRun(approved, 'other')).toBe(true)
    expect(
      transition(approved, { type: 'run', environmentId: 'studio' }).jobs
    ).toHaveLength(2)
    const firstDone = transition(approved, { type: 'finishJob' })
    expect(firstDone.phase).toBe('waiting')
    expect(firstDone.jobs.map((job) => job.status)).toEqual([
      'completed',
      'running'
    ])
    expect(
      transition(firstDone, { type: 'apply' }).environments.studio.revision
    ).toBe(12)
    const drained = transition(firstDone, { type: 'finishJob' })
    expect(drained.phase).toBe('applying')
    const updated = transition(drained, { type: 'apply' })
    expect(updated.environments.studio.revision).toBe(13)
    expect(updated.sessions).toEqual({
      you: 'studio',
      teammate: 'studio',
      unrelated: 'other'
    })
    expect(updated.jobs.map((job) => job.revision)).toEqual([12, 12])
    expect(canRun(updated, 'studio')).toBe(true)
  })

  it('failure preserves the working environment, chosen versions and settings for retry', () => {
    const start = initialState()
    const prepared = transition(start, { type: 'prepare' })
    const failed = transition(prepared, { type: 'fail' })
    expect(failed.phase).toBe('failed')
    expect(failed.environments).toEqual(start.environments)
    expect(failed.draft).toEqual(start.draft)
    expect(canRun(failed, 'studio')).toBe(true)
    expect(transition(failed, { type: 'prepare' }).draft).toEqual(start.draft)
  })

  it('creating new preserves source and source users and only selects the initiating session', () => {
    const start = initialState()
    start.draft.mode = 'new'
    const running = transition(start, { type: 'run', environmentId: 'studio' })
    const ready = transition(transition(running, { type: 'prepare' }), {
      type: 'ready'
    })
    const approved = transition(ready, { type: 'approve' })
    expect(approved.phase).toBe('applying')
    expect(canRun(approved, 'studio')).toBe(true)
    const updated = transition(approved, { type: 'apply' })
    expect(updated.environments.studio).toEqual(start.environments.studio)
    expect(updated.sessions).toEqual({
      you: 'studio-copy-1',
      teammate: 'studio',
      unrelated: 'other'
    })
    expect(updated.jobs[0]).toMatchObject({
      environmentId: 'studio',
      revision: 12,
      status: 'running'
    })
  })
})
