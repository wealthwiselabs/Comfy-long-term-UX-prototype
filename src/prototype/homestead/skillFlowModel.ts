import type { DesktopBuildRequest } from './agentModel'
import { compatibility } from './model'
import type { Environment, Workflow } from './model'

export const skillScenarios = [
  'auto',
  'stock',
  'lossless',
  'lossy',
  'existing',
  'custom',
  'assets'
] as const
export type SkillScenario = (typeof skillScenarios)[number]
export type SkillStep =
  | 'skill'
  | 'locate'
  | 'inventory'
  | 'cloud'
  | 'convert'
  | 'existing'
  | 'limits'
  | 'planApproved'
  | 'conversionApproved'
  | 'manifest'
  | 'dryRun'
  | 'inputCheck'
  | 'uploads'
  | 'push'
  | 'release'
  | 'deploy'
  | 'logs'
  | 'assetPlan'
  | 'validate'
  | 'test'
  | 'download'
  | 'save'
  | 'readback'
  | 'handoff'
  | 'repair'
export type SkillRoute = 'stock' | 'existing' | 'custom'
export type UploadKind = 'model' | 'asset'
export interface SkillUpload {
  name: string
  size: string
  kind: UploadKind
  reason: 'style' | 'image' | 'video' | 'audio' | 'instance'
}
export interface SkillHandoff {
  id: string
  workflow: Workflow
  workspace: string
  request?: DesktopBuildRequest
}
export interface SkillSession extends SkillHandoff {
  requirements: Pick<Workflow, 'packs' | 'models'>
  scenario: SkillScenario
  environments: Environment[]
  route: SkillRoute
  target?: Environment
  lossyApproved: boolean
  failure: 'none' | 'build' | 'deployment'
  repairs: number
}
export type SkillState =
  | { phase: 'idle' }
  | { phase: 'running'; step: SkillStep; remaining: SkillStep[] }
  | { phase: 'conversion' }
  | { phase: 'buildPlan' }
  | { phase: 'uploads'; continuation: SkillStep[] }
  | { phase: 'blocked'; continuation: SkillStep[] }
  | { phase: 'failed'; continuation: SkillStep[] }
  | { phase: 'complete' }

export interface SkillActivity {
  id: number
  step: SkillStep
  status: 'running' | 'done' | 'failed'
  command: string
  detail: string
  values: Record<string, string | number>
}

export function stockTarget(workflow: Workflow): Environment {
  return {
    id: 'dep-comfy-cloud',
    name: 'Comfy Cloud',
    revision: 'current',
    gpu: 'Comfy Cloud',
    packs: [...workflow.packs],
    models: [...workflow.models],
    verified: true
  }
}

export function existingTarget(session: SkillSession) {
  if (session.scenario === 'custom' || session.request) return undefined
  return session.environments.find(
    (env) =>
      env.id !== 'dep-comfy-cloud' &&
      compatibility({ ...session.workflow, ...session.requirements }, env)
        .status === 'compatible'
  )
}

export function stockCovers(session: SkillSession) {
  if (session.request) return false
  if (['stock', 'assets'].includes(session.scenario)) return true
  if (session.scenario !== 'auto') return false
  return session.environments.some(
    (env) =>
      env.id === 'dep-comfy-cloud' &&
      compatibility({ ...session.workflow, ...session.requirements }, env)
        .status === 'compatible'
  )
}

export function requiredUploads(session: SkillSession): SkillUpload[] {
  const models: SkillUpload[] =
    session.route === 'custom' &&
    (session.requirements.models.includes('acme_hero_lora_v5.safetensors') ||
      session.request?.scope === 'instance')
      ? [
          {
            name: 'acme_hero_lora_v5.safetensors',
            size: '128 MB',
            kind: 'model',
            reason: 'style'
          }
        ]
      : []
  if (session.request?.scope === 'instance')
    models.push({
      name: 'studio_materials_v2.safetensors',
      size: '256 MB',
      kind: 'model',
      reason: 'instance'
    })
  const assets: SkillUpload[] = [
    { name: 'reference.png', size: '8 MB', kind: 'asset', reason: 'image' },
    ...(session.scenario === 'assets'
      ? [
          {
            name: 'motion.mp4',
            size: '24 MB',
            kind: 'asset' as const,
            reason: 'video' as const
          },
          {
            name: 'voice.wav',
            size: '4 MB',
            kind: 'asset' as const,
            reason: 'audio' as const
          }
        ]
      : [])
  ]
  return [...models, ...assets]
}

export function verificationSteps(route: SkillRoute): SkillStep[] {
  return [
    ...(route === 'stock'
      ? ['validate' as const]
      : ['logs' as const, 'assetPlan' as const]),
    'test',
    'download',
    'save',
    'readback',
    'handoff'
  ]
}
