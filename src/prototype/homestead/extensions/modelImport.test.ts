import { describe, expect, it } from 'vitest'
import {
  importFilename,
  isModelDirectory,
  isModelFilename,
  modelImportUrl
} from './modelImport'

describe('model imports follow Platform file and folder rules', () => {
  it('accepts weights in varied formats rather than an extension whitelist', () => {
    for (const name of [
      'model.safetensors',
      'model.ckpt',
      'model.gguf',
      'model.bin',
      'model.pt'
    ])
      expect(isModelFilename(name)).toBe(true)
    for (const name of ['../model.gguf', 'bad name.bin', 'weights', 'a..bin'])
      expect(isModelFilename(name)).toBe(false)
  })
  it('supports nested model folders and rejects reserved and traversal paths', () => {
    expect(isModelDirectory('insightface/models/antelopev2')).toBe(true)
    for (const path of [
      '',
      '../loras',
      '/loras',
      'loras/',
      'configs',
      'custom_nodes/x',
      'loras/con',
      'vae\n'
    ])
      expect(isModelDirectory(path)).toBe(false)
  })
  it('derives a safe filename and handles malformed encoded paths without throwing', () => {
    expect(
      importFilename(
        'https://huggingface.co/owner/repo/resolve/main/model.gguf?download=true'
      )
    ).toBe('model.gguf')
    expect(
      importFilename('https://huggingface.co/owner/repo/resolve/main/%E0%A4%A')
    ).toBe('')
    expect(importFilename('https://civitai.com/api/download/models/123')).toBe(
      ''
    )
  })
  it('accepts HTTPS model links, canonicalizes Hugging Face file pages, and rejects repository pages', () => {
    expect(
      modelImportUrl('https://huggingface.co/owner/repo/blob/main/model.gguf')
    ).toBe('https://huggingface.co/owner/repo/resolve/main/model.gguf')
    expect(modelImportUrl('https://huggingface.co/owner/repo')).toBeNull()
    expect(
      modelImportUrl('https://huggingface.co/owner/repo/tree/main')
    ).toBeNull()
    expect(
      modelImportUrl('https://civitai.com/api/download/models/123')
    ).not.toBeNull()
    expect(
      modelImportUrl('http://huggingface.co/owner/repo/resolve/main/model.gguf')
    ).toBeNull()
    expect(modelImportUrl('garbage')).toBeNull()
  })
})
