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
interface ModelEntry {
  id: string
  name: string
  fileName: string
  publisher: string
  kind: 'checkpoint' | 'lora' | 'encoder' | 'vae' | 'unknown'
  sizeBytes: number | null
  aliases: string[]
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
export const modelCatalogFixture: ModelEntry[] = policyCatalog
  .filter((item) => item.kind === 'models' && item.allowed)
  .flatMap((item) =>
    (item.files ?? []).map((fileName, index) => ({
      id: index === 0 ? item.id : `${item.id}:${fileName}`,
      name: item.files?.length === 1 ? item.name : `${item.name} · ${fileName}`,
      fileName,
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
      aliases: index === 0 ? [item.id, item.name, fileName] : [fileName]
    }))
  )
export function modelEntry(value: string): ModelEntry {
  const name = value.trim()
  const fileName = name.split(/[\\/]/).at(-1) ?? name
  return (
    modelCatalogFixture.find(
      (item) =>
        item.id.toLowerCase() === name.toLowerCase() ||
        item.aliases.some(
          (alias) =>
            alias.toLowerCase() === name.toLowerCase() ||
            alias.toLowerCase() === fileName.toLowerCase()
        )
    ) ?? {
      id: name,
      name: fileName,
      fileName,
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
  rate: number | null = null
) {
  const entries = normalizeModels(values).map(modelEntry)
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
export function environmentPackageStorage(
  models: string[],
  packs: Record<string, string>,
  rate: number | null = null
) {
  const modelStorage = selectedModelStorage(models)
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
