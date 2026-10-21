import { existingTarget, stockCovers, requiredUploads } from './skillFlowModel'
import type { SkillActivity, SkillSession, SkillStep } from './skillFlowModel'
import { skillCommand } from './skillFlowSteps'

function detailFor(step: SkillStep, s: SkillSession) {
  switch (step) {
    case 'cloud':
      return stockCovers(s)
        ? 'cloudCovered'
        : s.scenario === 'lossless'
          ? 'cloudLossless'
          : s.scenario === 'lossy'
            ? 'cloudLossy'
            : 'cloudMissing'
    case 'convert':
      return s.lossyApproved ? 'convertLossy' : 'convertLossless'
    case 'existing':
      return s.request
        ? 'existingApproved'
        : existingTarget(s)
          ? 'existingFound'
          : 'existingMissing'
    case 'manifest':
      return s.request?.mode === 'update'
        ? 'manifestUpdate'
        : s.request?.scope === 'instance'
          ? 'manifestInstance'
          : 'manifestWorkflow'
    case 'repair':
      return s.route === 'existing' ? 'repairExisting' : 'repair'
    case 'save':
      return s.route === 'stock' ? 'saveCloud' : 'saveArchive'
    case 'conversionApproved':
      return s.lossyApproved ? 'conversionYes' : 'conversionNo'
    default:
      return step
  }
}

export function skillActivity(
  step: SkillStep,
  s: SkillSession,
  files: string[],
  id: number,
  status: SkillActivity['status']
): SkillActivity {
  return {
    id,
    step,
    status,
    detail: detailFor(step, s),
    command: skillCommand(step, s),
    values: {
      workflow: s.workflow.name,
      workspace: s.workspace,
      packs: s.requirements.packs.join(', ') || 'ComfyUI core',
      models: s.requirements.models.join(', ') || 'Default models',
      target: s.target?.name ?? existingTarget(s)?.name ?? '',
      name: s.request?.name ?? s.workflow.name,
      gpu: s.request?.gpu ?? s.target?.gpu ?? 'Comfy Cloud',
      region: s.request?.region ?? '',
      scope: s.request?.scope ?? 'workflow',
      files: files.join(', ') || '—',
      inputs: requiredUploads(s)
        .filter((file) => file.kind === 'asset')
        .map((file) => `${file.name} (${file.size})`)
        .join(', '),
      buildId:
        s.request?.mode === 'update'
          ? s.request.sourceId
          : (s.target?.buildId ?? s.target?.id ?? 'demo-build')
    }
  }
}
