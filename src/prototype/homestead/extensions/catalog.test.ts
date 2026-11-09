import { describe, expect, it } from 'vitest'
import {
  environmentPackageStorage,
  cloudReadyModel,
  modelCatalogFixture,
  modelEntry,
  normalizeModels,
  recommendGpu,
  selectedModelStorage
} from './catalog'

describe('workflow GPU recommendation', () => {
  it.for([
    { sizeGb: 6, gpu: 'rtx-pro-6000-mig-2g-48gb' },
    { sizeGb: 36, gpu: 'rtx-pro-6000-server' },
    { sizeGb: 80, gpu: undefined },
    { sizeGb: null, gpu: undefined }
  ])(
    'uses model size and memory headroom for $sizeGb GB',
    ({ sizeGb, gpu }) => {
      const imported = [
        {
          ...modelEntry('workflow.gguf'),
          sizeBytes: sizeGb === null ? null : sizeGb * 1024 ** 3
        }
      ]
      expect(recommendGpu(['workflow.gguf'], imported).gpu?.gpuClass).toBe(gpu)
    }
  )

  it('counts workflow aliases once and does not recommend without model sizes', () => {
    expect(recommendGpu(['sdxl', 'sd_xl_base_1.0.safetensors']).knownGb).toBe(6)
    expect(recommendGpu([]).gpu).toBeUndefined()
    expect(recommendGpu(['sdxl', 'private.gguf']).gpu).toBeUndefined()
  })
})

describe('selected environment models', () => {
  it('offers only explicit Cloud fixture files and keeps private installed metadata distinct', () => {
    expect(cloudReadyModel('acme_hero_lora_v5')).toBeUndefined()
    expect(cloudReadyModel('not-on-cloud.safetensors')).toBeUndefined()
    expect(cloudReadyModel('sdxl')?.directory).toBe('checkpoints')
    expect(
      modelCatalogFixture.every(
        (entry) => entry.sourceUri?.startsWith('https://') && entry.directory
      )
    ).toBe(true)
  })
  it('deduplicates catalog IDs, names and file paths without dropping unknown private models', () => {
    expect(
      normalizeModels([
        'flux1-dev-fp8',
        'FLUX.1 dev',
        'models/checkpoints/flux1-dev-fp8.safetensors',
        'private/model-v2.gguf'
      ])
    ).toEqual(['flux1-dev-fp8', 'private/model-v2.gguf'])
  })
  it('requires the exact Cloud filename and destination instead of replacing aliases or private paths', () => {
    for (const value of [
      'detail_tweaker_xl.safetensors',
      'private/sd_xl_base_1.0.safetensors',
      'models/private/sd_xl_base_1.0.safetensors'
    ]) {
      expect(cloudReadyModel(value)).toBeUndefined()
      expect(normalizeModels([value])).toEqual([value])
    }
    expect(
      cloudReadyModel('loras/sdxl-detail_tweaker_xl.safetensors')?.id
    ).toBe('detail-tweaker')
    expect(
      cloudReadyModel('models/checkpoints/sd_xl_base_1.0.safetensors')?.id
    ).toBe('sdxl')
  })
  it('sums sample file bytes once and reports a known cost lower bound for unknown files', () => {
    expect(
      selectedModelStorage(
        [
          'sdxl',
          'sd_xl_base_1.0.safetensors',
          'detail-tweaker',
          'private.gguf'
        ],
        0.091
      )
    ).toEqual({
      knownBytes: 6.25 * 1024 ** 3,
      knownGb: 6.25,
      knownCount: 2,
      unknownCount: 1,
      monthlyUsd: 0.56875
    })
  })
  it.for([undefined, null, 0, -1, Number.NaN])(
    'reports unavailable pricing for missing or invalid rate %s',
    (rate) => {
      expect(selectedModelStorage(['sdxl'], rate).monthlyUsd).toBeNull()
    }
  )
})

describe('environment package storage estimate', () => {
  it('includes runtime and pack dependencies even without models, and updates with selected content', () => {
    expect(environmentPackageStorage([], {}, 0.091)).toEqual({
      knownGb: 4,
      unknownCount: 0,
      monthlyUsd: 0.364
    })
    const withContent = environmentPackageStorage(
      ['sdxl', 'sd_xl_base_1.0.safetensors', 'private.gguf'],
      { 'impact-pack': '8.29.1', 'studio.zip': 'demo' },
      0.091
    )
    expect(withContent.knownGb).toBe(10.75)
    expect(withContent.unknownCount).toBe(2)
    expect(withContent.monthlyUsd).toBeCloseTo(0.97825)
  })
})
