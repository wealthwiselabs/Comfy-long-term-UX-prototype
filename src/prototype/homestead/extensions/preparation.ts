export const preparationStages = [
  { id: 'configuration', section: 'build', phases: ['start', 'freeze'] },
  { id: 'nodePacks', section: 'build', phases: ['assemble'] },
  { id: 'package', section: 'build', phases: ['validate', 'hash', 'bake'] },
  { id: 'models', section: 'deploy', phases: ['staging_models'] },
  { id: 'endpoint', section: 'deploy', phases: ['creating_endpoint'] },
  { id: 'worker', section: 'deploy', phases: ['waiting_for_worker'] }
] as const
