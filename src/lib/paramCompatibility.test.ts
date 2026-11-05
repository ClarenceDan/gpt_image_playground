import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { createDefaultFalProfile, createDefaultOpenAIProfile, DEFAULT_SETTINGS, normalizeSettings } from './apiProfiles'
import {
  DEFAULT_GIF_FRAME_COUNT,
  DEFAULT_GIF_FRAME_DURATION_MS,
  DEFAULT_GIF_IMAGE_SIZE,
  getOutputImageLimitForSettings,
  normalizeParamsForSettings,
} from './paramCompatibility'

describe('parameter compatibility', () => {
  it('limits OpenAI output count to 10', () => {
    const openAIProfile = createDefaultOpenAIProfile({ apiKey: 'test-key', streamImages: false })
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [openAIProfile],
      activeProfileId: openAIProfile.id,
    })

    expect(getOutputImageLimitForSettings(settings)).toBe(10)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 12 }, settings).n).toBe(10)
  })

  it('limits fal.ai output count to 4', () => {
    const falProfile = createDefaultFalProfile({ apiKey: 'fal-key' })
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [falProfile],
      activeProfileId: falProfile.id,
    })

    expect(getOutputImageLimitForSettings(settings)).toBe(4)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 8 }, settings).n).toBe(4)
  })

  it('keeps OpenAI streaming output count so the request can disable streaming', () => {
    const openAIProfile = createDefaultOpenAIProfile({ apiKey: 'test-key', streamImages: true })
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [openAIProfile],
      activeProfileId: openAIProfile.id,
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 4 }, settings).n).toBe(4)
  })

  it('only replaces fal.ai auto size in text-to-image mode', () => {
    const falProfile = createDefaultFalProfile({ apiKey: 'fal-key' })
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [falProfile],
      activeProfileId: falProfile.id,
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: 'auto' }, settings).size).toBe('1360x1024')
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: 'auto' }, settings, { hasInputImages: true }).size).toBe('auto')
  })

  it('limits Codex CLI custom sizes to 1K while preserving auto', () => {
    const profile = createDefaultOpenAIProfile({ apiKey: 'test-key', codexCli: true })
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      profiles: [profile],
      activeProfileId: profile.id,
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: '2048x2048' }, settings).size).toBe('1024x1024')
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: 'auto' }, settings).size).toBe('auto')
  })

  it('applies Codex CLI parameter limits to custom providers', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      customProviders: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        submit: { path: 'images/generations' },
      }],
      profiles: [{
        ...createDefaultOpenAIProfile(),
        provider: 'custom-provider',
        codexCli: true,
      }],
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: '2048x2048', quality: 'high' }, settings)).toMatchObject({
      size: '1024x1024',
      quality: DEFAULT_PARAMS.quality,
    })
  })

  it('does not apply Codex CLI parameter limits to fal.ai', () => {
    const profile = createDefaultFalProfile({ codexCli: true })
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      codexCli: true,
      profiles: [profile],
      activeProfileId: profile.id,
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, size: '2048x2048' }, settings).size).toBe('2048x2048')
  })

  it.each(['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const)('keeps 2.5 quality levels for %s', (model) => {
    const profile = createDefaultOpenAIProfile({ model })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile] })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'xhigh' }, settings).quality).toBe('xhigh')
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'max' }, settings).quality).toBe('max')
  })

  it.each(['openai/gpt-image-2.5/sunburst', 'openai/gpt-image-2.5/flare'] as const)('keeps fal.ai 2.5 quality levels for %s', (model) => {
    const profile = createDefaultFalProfile({ model })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'xhigh' }, settings).quality).toBe('xhigh')
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'max' }, settings).quality).toBe('max')
  })

  it.each(['vendor/gpt-image-2.5-custom', 'my-gpt-image-2.5-proxy'])('keeps 2.5 quality levels for a custom provider model %s', (model) => {
    const profile = { ...createDefaultOpenAIProfile({ model }), provider: 'custom-provider' }
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      customProviders: [{ id: 'custom-provider', name: 'Custom Provider', submit: { path: 'images/generations' } }],
      profiles: [profile],
      activeProfileId: profile.id,
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'xhigh' }, settings).quality).toBe('xhigh')
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'max' }, settings).quality).toBe('max')
  })

  it('applies GIF defaults for frame count, frame duration and size', () => {
    const profile = createDefaultOpenAIProfile({ model: 'gpt-image-2.6-sunburst' })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile] })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif' }, settings)).toMatchObject({
      output_format: 'gif',
      size: DEFAULT_GIF_IMAGE_SIZE,
      frame_count: DEFAULT_GIF_FRAME_COUNT,
      frame_duration_ms: DEFAULT_GIF_FRAME_DURATION_MS,
      output_compression: null,
      transparent_output: false,
    })
  })

  it('clamps GIF frame params to the API ranges and rounds the duration to 10ms', () => {
    const profile = createDefaultOpenAIProfile({ model: 'gpt-image-2.6-sunburst' })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile] })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', frame_count: 999 }, settings).frame_count).toBe(64)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', frame_count: 1 }, settings).frame_count).toBe(2)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', frame_duration_ms: 5 }, settings).frame_duration_ms).toBe(20)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', frame_duration_ms: 9999 }, settings).frame_duration_ms).toBe(2000)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', frame_duration_ms: 147 }, settings).frame_duration_ms).toBe(150)
  })

  it('drops GIF params and restores png when the model cannot output GIF', () => {
    const profile = createDefaultOpenAIProfile({ model: 'gpt-image-2.5-sunburst' })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile] })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', frame_count: 12, frame_duration_ms: 150 }, settings)).toMatchObject({
      output_format: 'png',
      frame_count: null,
      frame_duration_ms: null,
    })
  })

  it('falls back to png when GIF is requested with input images', () => {
    const profile = createDefaultOpenAIProfile({ model: 'gpt-image-2.6-sunburst' })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile] })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif' }, settings, { hasInputImages: true }).output_format).toBe('png')
  })

  it('falls back to high when an older image model receives a 2.5 quality level', () => {
    const profile = createDefaultOpenAIProfile({ model: 'gpt-image-2' })
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [profile] })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, quality: 'max' }, settings).quality).toBe('high')
  })
})
