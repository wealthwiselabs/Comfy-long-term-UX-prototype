import { cloudReadyModel, normalizeModels, recommendGpu } from './catalog'

export interface ExtensionEnvironment {
  id: string
  name: string
  revision: number
  packs: Record<string, string>
  models: string[]
  gpu: string
}
interface ExtensionDraft extends Omit<ExtensionEnvironment, 'id' | 'revision'> {
  mode: 'update' | 'new'
}
interface ExtensionJob {
  id: number
  environmentId: string
  revision: number
  status: 'running' | 'queued' | 'completed'
}
export interface ExtensionState {
  phase:
    | 'idle'
    | 'preparing'
    | 'ready'
    | 'waiting'
    | 'applying'
    | 'updated'
    | 'failed'
  targetId: string
  environments: Record<string, ExtensionEnvironment>
  draft: ExtensionDraft
  jobs: ExtensionJob[]
  sessions: Record<string, string>
  generation: number
}
export type ExtensionEvent =
  | { type: 'prepare' | 'ready' | 'approve' | 'finishJob' | 'apply' | 'fail' }
  | { type: 'run'; environmentId: string }

export function initialState(): ExtensionState {
  const source: ExtensionEnvironment = {
    id: 'studio',
    name: 'Studio production',
    revision: 12,
    packs: { 'impact-pack': '8.28.3', 'comfyui-kjnodes': '1.4.2' },
    models: ['flux1-dev-fp8', 'acme_hero_lora_v5'],
    gpu: 'rtx-pro-6000-server'
  }
  return {
    phase: 'idle',
    targetId: source.id,
    generation: 0,
    environments: {
      studio: source,
      fast: {
        id: 'fast',
        name: 'Lightweight preview',
        revision: 4,
        packs: { 'rgthree-comfy': '1.0.2' },
        models: ['sdxl'],
        gpu: 'rtx-pro-6000-mig-2g-48gb'
      }
    },
    draft: { ...structuredClone(source), mode: 'update' },
    jobs: [],
    sessions: { you: 'studio', teammate: 'studio', unrelated: 'other' }
  }
}
function suggestedGpu(models: string[]) {
  return recommendGpu(models).gpu?.gpuClass ?? 'rtx-pro-6000-mig-2g-48gb'
}
export function firstEnvironmentState(models: string[]): ExtensionState {
  const cloud: ExtensionEnvironment = {
    id: 'dep-comfy-cloud',
    name: 'Comfy Cloud',
    revision: 1,
    packs: {},
    models: [],
    gpu: 'Comfy Cloud'
  }
  return {
    phase: 'idle',
    targetId: cloud.id,
    generation: 0,
    environments: { [cloud.id]: cloud },
    draft: {
      name: 'My custom environment',
      mode: 'new',
      packs: {},
      models: normalizeModels(models).filter((value) => cloudReadyModel(value)),
      gpu: suggestedGpu(models)
    },
    jobs: [],
    sessions: { you: cloud.id, teammate: cloud.id, unrelated: 'other' }
  }
}
export function canRun(state: ExtensionState, environmentId: string) {
  return !(
    ['waiting', 'applying'].includes(state.phase) &&
    state.draft.mode === 'update' &&
    environmentId === state.targetId
  )
}
export function transition(
  state: ExtensionState,
  event: ExtensionEvent
): ExtensionState {
  switch (event.type) {
    case 'prepare':
      if (!['idle', 'failed', 'updated'].includes(state.phase)) return state
      return {
        ...state,
        phase: 'preparing',
        generation: state.generation + 1,
        draft:
          state.targetId === 'dep-comfy-cloud'
            ? { ...state.draft, mode: 'new' }
            : state.draft
      }
    case 'ready':
      return state.phase === 'preparing' ? { ...state, phase: 'ready' } : state
    case 'fail':
      return state.phase === 'preparing' ? { ...state, phase: 'failed' } : state
    case 'approve':
      if (state.phase !== 'ready') return state
      return {
        ...state,
        phase:
          state.draft.mode === 'update' &&
          state.jobs.some(
            (job) =>
              job.environmentId === state.targetId && job.status !== 'completed'
          )
            ? 'waiting'
            : 'applying'
      }
    case 'run': {
      if (!canRun(state, event.environmentId)) return state
      if (!Object.hasOwn(state.environments, event.environmentId)) return state
      const environment = state.environments[event.environmentId]
      const busy = state.jobs.some(
        (job) =>
          job.environmentId === environment.id && job.status !== 'completed'
      )
      return {
        ...state,
        jobs: [
          ...state.jobs,
          {
            id: state.jobs.length + 1,
            environmentId: environment.id,
            revision: environment.revision,
            status: busy ? 'queued' : 'running'
          }
        ]
      }
    }
    case 'finishJob': {
      const running = state.jobs.find((job) => job.status === 'running')
      if (!running) return state
      const next = state.jobs.find(
        (job) =>
          job.environmentId === running.environmentId && job.status === 'queued'
      )
      const jobs = state.jobs.map((job) =>
        job.id === running.id
          ? { ...job, status: 'completed' as const }
          : job.id === next?.id
            ? { ...job, status: 'running' as const }
            : job
      )
      const pending = jobs.some(
        (job) =>
          job.environmentId === state.targetId && job.status !== 'completed'
      )
      return {
        ...state,
        jobs,
        phase: state.phase === 'waiting' && !pending ? 'applying' : state.phase
      }
    }
    case 'apply': {
      if (
        state.phase !== 'applying' ||
        (state.targetId === 'dep-comfy-cloud' && state.draft.mode === 'update')
      )
        return state
      const source = state.environments[state.targetId]
      const id =
        state.draft.mode === 'new'
          ? `${state.targetId}-copy-${state.generation}`
          : state.targetId
      const { mode, ...settings } = state.draft
      const environment = {
        ...settings,
        id,
        revision: mode === 'new' ? 1 : source.revision + 1
      }
      return {
        ...state,
        phase: 'updated',
        environments: { ...state.environments, [id]: environment },
        sessions:
          mode === 'new' ? { ...state.sessions, you: id } : state.sessions
      }
    }
  }
}
