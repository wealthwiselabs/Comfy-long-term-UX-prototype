import { describe, expect, it } from 'vitest'
import {
  environmentPackageStorage,
  normalizeModels,
  selectedModelStorage
} from './catalog'

describe('selected environment models', () => {
  it('deduplicates catalog IDs, names and file paths without dropping unknown private models', () => {
    expect(
      normalizeModels([
        'flux1-dev-fp8',
        'FLUX.1 dev',
        'models/flux1-dev-fp8.safetensors',
        'private/model-v2.gguf'
      ])
    ).toEqual(['flux1-dev-fp8', 'private/model-v2.gguf'])
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
