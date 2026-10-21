import type { DesktopBuildRequest } from './agentModel'
import type { Environment } from './model'
import type { SkillHandoff, SkillSession } from './skillFlowModel'

export function snapshotHandoff(handoff: SkillHandoff): SkillHandoff {
  const workflow = handoff.workflow
  return {
    id: handoff.id,
    workspace: handoff.workspace,
    ...(handoff.request ? { request: { ...handoff.request } } : {}),
    workflow: {
      ...workflow,
      packs: [...workflow.packs],
      models: [...workflow.models],
      positions: workflow.positions.map((point) => ({ x: point.x, y: point.y }))
    }
  }
}

export function snapshotEnvironments(environments: Environment[]) {
  return environments.map((environment) => ({
    ...environment,
    packs: [...environment.packs],
    models: [...environment.models]
  }))
}

export function updateSource(
  session: SkillSession,
  request: DesktopBuildRequest
) {
  if (request.mode !== 'update') return undefined
  const matches = session.environments.filter((env) =>
    request.sourceEnvironmentId
      ? env.id === request.sourceEnvironmentId
      : env.id === request.sourceId || env.buildId === request.sourceId
  )
  return [...matches].sort(
    (a, b) =>
      Number(b.revision.match(/\d+$/)?.[0] ?? 0) -
      Number(a.revision.match(/\d+$/)?.[0] ?? 0)
  )[0]
}

export function plannedTarget(
  session: SkillSession,
  request: DesktopBuildRequest,
  source?: Environment
): Environment {
  const family = source?.buildId ?? source?.id ?? `build-${session.id}`
  const instance = request.scope === 'instance' ? session.environments : []
  return {
    id: `${family}-revision-${session.id}`,
    buildId: family,
    name: request.name,
    revision: `v${source ? Number(source.revision.match(/\d+$/)?.[0] ?? 0) + 1 : 1}`,
    gpu: request.gpu,
    packs: [
      ...new Set([
        ...(source?.packs ?? []),
        ...session.requirements.packs,
        ...instance.flatMap((env) => env.packs)
      ])
    ],
    models: [
      ...new Set([
        ...(source?.models ?? []),
        ...session.requirements.models,
        ...instance.flatMap((env) => env.models),
        ...(request.scope === 'instance'
          ? ['acme_hero_lora_v5.safetensors', 'studio_materials_v2.safetensors']
          : [])
      ])
    ],
    verified: true
  }
}
