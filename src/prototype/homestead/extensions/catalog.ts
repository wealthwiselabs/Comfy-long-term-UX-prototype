import { policyCatalog } from '../../fixtures/policyCatalog'

const GB = 1024 ** 3
export const computeCatalogFixture = [
  {
    gpuClass: 'rtx-pro-6000-server',
    label: 'RTX PRO 6000',
    vramGb: 96,
    pricePerHourUsd: 3.49
  },
  {
    gpuClass: 'rtx-pro-6000-mig-2g-48gb',
    label: 'RTX PRO 6000 MIG',
    vramGb: 48,
    pricePerHourUsd: 1.75
  },
  { gpuClass: 'h100-sxm', label: 'H100 SXM', vramGb: 80, pricePerHourUsd: 6.23 }
]
export const storageCatalogFixture = {
  storageClass: 'network_standard',
  pricePerGbMonthUsd: 0.091
}
const packageSizeFixture = {
  runtimeBytes: 4 * GB,
  packGb: {
    'comfyui-kjnodes': 0.25,
    'rgthree-comfy': 0.125,
    'video-helper': 0.5,
    'impact-pack': 0.75,
    essentials: 0.125,
    'layer-style': 0.5,
    'comfyui-rmbg': 0.75
  } satisfies Record<string, number>
}
export interface ModelEntry {
  id: string
  name: string
  fileName: string
  publisher: string
  kind: 'checkpoint' | 'lora' | 'encoder' | 'vae' | 'unknown'
  sizeBytes: number | null
  aliases: string[]
  directory?: string
  sourceUri?: string
}
const sampleFileGb: Record<string, number> = {
  'z_image_turbo_bf16.safetensors': 8,
  'flux1-dev-fp8.safetensors': 12,
  'hidream_i1_dev_fp8.safetensors': 16,
  'sd_xl_base_1.0.safetensors': 6,
  'v1-5-pruned-emaonly-fp16.safetensors': 2,
  'detail_tweaker_xl.safetensors': 0.25,
  'qwen_3_4b.safetensors': 4,
  't5xxl_fp8_e4m3fn.safetensors': 5,
  'clip_l.safetensors': 0.5,
  'ae.safetensors': 0.25,
  'sdxl_vae.safetensors': 0.375
}
const modelDefinitions: ModelEntry[] = policyCatalog
  .filter((item) => item.kind === 'models')
  .flatMap((item) =>
    (item.files ?? []).map((fileName, index) => ({
      id: index === 0 ? item.id : `${item.id}:${fileName}`,
      name: item.files?.length === 1 ? item.name : `${item.name} · ${fileName}`,
      fileName:
        item.id === 'detail-tweaker'
          ? 'sdxl-detail_tweaker_xl.safetensors'
          : fileName,
      publisher: item.publisher,
      kind:
        item.version === 'LoRA' || item.id === 'acme_hero_lora_v5'
          ? 'lora'
          : item.id === 'vae'
            ? 'vae'
            : ['t5', 'clip', 'qwen'].includes(item.id)
              ? 'encoder'
              : 'checkpoint',
      sizeBytes: Object.hasOwn(sampleFileGb, fileName)
        ? sampleFileGb[fileName] * GB
        : null,
      aliases:
        index === 0
          ? [
              item.id,
              item.name,
              fileName,
              ...(item.id === 'detail-tweaker'
                ? ['sdxl-detail_tweaker_xl.safetensors']
                : [])
            ]
          : [fileName]
    }))
  )
// A small simulated assets response, independent of workspace policy. Platform's
// catalog picker only offers OSS rows with a fetchable source (DES-971).
const cloudModelSources: Record<string, string> = {
  'z_image_turbo_bf16.safetensors': 'diffusion_models',
  'flux1-dev-fp8.safetensors': 'checkpoints',
  'hidream_i1_dev_fp8.safetensors': 'diffusion_models',
  'sd_xl_base_1.0.safetensors': 'checkpoints',
  'v1-5-pruned-emaonly-fp16.safetensors': 'checkpoints',
  'sdxl-detail_tweaker_xl.safetensors': 'loras',
  'qwen_3_4b.safetensors': 'text_encoders',
  't5xxl_fp8_e4m3fn.safetensors': 'text_encoders',
  'clip_l.safetensors': 'text_encoders',
  'ae.safetensors': 'vae',
  'sdxl_vae.safetensors': 'vae'
}
export const modelCatalogFixture: ModelEntry[] = modelDefinitions.flatMap(
  (entry) => {
    const directory = cloudModelSources[entry.fileName]
    return directory
      ? [
          {
            ...entry,
            directory,
            sourceUri: `https://models.example/${directory}/${entry.fileName}`
          }
        ]
      : []
  }
)
function matchesModel(value: string, entry: ModelEntry) {
  const path = value.trim().replaceAll('\\', '/').toLowerCase()
  const identities = [entry.id, entry.name, entry.fileName]
  if (entry.directory) {
    identities.push(
      `${entry.directory}/${entry.fileName}`,
      `models/${entry.directory}/${entry.fileName}`
    )
  }
  // A basename or display alias must never erase a workflow's directory or
  // substitute a differently named file. Suggestions need an explicit choice.
  return identities.some((identity) => identity.toLowerCase() === path)
}
export function cloudReadyModel(value: string) {
  return modelCatalogFixture.find((entry) => matchesModel(value, entry))
}
export function modelEntry(
  value: string,
  imported: ModelEntry[] = []
): ModelEntry {
  const name = value.trim()
  const path = name.replaceAll('\\', '/')
  const fileName = path.split('/').at(-1) ?? name
  return (
    imported.find((item) => item.id === name) ??
    cloudReadyModel(name) ??
    modelDefinitions.find((entry) => matchesModel(name, entry)) ?? {
      id: name,
      name: fileName,
      fileName,
      directory:
        path.includes('/') && !path.startsWith('import:')
          ? path
              .replace(/^models\//, '')
              .split('/')
              .slice(0, -1)
              .join('/')
          : undefined,
      publisher: '',
      kind: 'unknown',
      sizeBytes: null,
      aliases: [name]
    }
  )
}
export function normalizeModels(values: string[]) {
  return [
    ...new Set(
      values
        .filter((value) => value.trim())
        .map((value) => modelEntry(value).id)
    )
  ]
}
export function selectedModelStorage(
  values: string[],
  rate: number | null = null,
  imported: ModelEntry[] = []
) {
  const entries = normalizeModels(values).map((value) =>
    modelEntry(value, imported)
  )
  const known = entries.filter(
    (item) =>
      item.sizeBytes !== null &&
      Number.isFinite(item.sizeBytes) &&
      item.sizeBytes > 0
  )
  const knownBytes = known.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0)
  const knownGb = knownBytes / GB
  return {
    knownBytes,
    knownGb,
    knownCount: known.length,
    unknownCount: entries.length - known.length,
    monthlyUsd:
      rate !== null && Number.isFinite(rate) && rate > 0 ? knownGb * rate : null
  }
}
export function catalogGpu(value: string) {
  return computeCatalogFixture.find(
    (item) => item.gpuClass === value || item.label === value
  )
}
export function recommendGpu(models: string[], imported: ModelEntry[] = []) {
  const storage = selectedModelStorage(models, null, imported)
  const estimatedVramGb = storage.knownCount ? storage.knownGb * 1.5 + 8 : null
  const gpu =
    estimatedVramGb !== null && !storage.unknownCount
      ? computeCatalogFixture
          .filter((option) => option.vramGb >= estimatedVramGb)
          .sort(
            (left, right) => left.pricePerHourUsd - right.pricePerHourUsd
          )[0]
      : undefined
  return { ...storage, estimatedVramGb, gpu }
}
export function environmentPackageStorage(
  models: string[],
  packs: Record<string, string>,
  rate: number | null = null,
  imported: ModelEntry[] = []
) {
  const modelStorage = selectedModelStorage(models, null, imported)
  const packSizes: Record<string, number> = packageSizeFixture.packGb
  const packIds = Object.keys(packs)
  const knownPacks = packIds.filter((id) => Object.hasOwn(packSizes, id))
  const knownBytes =
    packageSizeFixture.runtimeBytes +
    knownPacks.reduce((sum, id) => sum + packSizes[id] * GB, 0) +
    modelStorage.knownBytes
  const knownGb = knownBytes / GB
  return {
    knownGb,
    unknownCount:
      modelStorage.unknownCount + packIds.length - knownPacks.length,
    monthlyUsd:
      rate !== null && Number.isFinite(rate) && rate > 0 ? knownGb * rate : null
  }
}
