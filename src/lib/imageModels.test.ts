import { describe, expect, it } from 'vitest'
import { createDefaultFalProfile, createDefaultOpenAIProfile } from './apiProfiles'
import {
  CUSTOM_IMAGE_MODEL_VALUE,
  applyImageGenerationModel,
  getImageGenerationModel,
  getImageModelSelectOptions,
  getImageModelSelectValue,
  isPresetImageModel,
  usesImageGenerationModelField,
} from './imageModels'

describe('image model presets', () => {
  it('uses the image generation field for Responses API profiles', () => {
    const profile = createDefaultOpenAIProfile({ apiMode: 'responses', imageGenerationModel: 'gpt-image-2.5-flare' })
    expect(usesImageGenerationModelField(profile)).toBe(true)
    expect(getImageGenerationModel(profile)).toBe('gpt-image-2.5-flare')
    expect(applyImageGenerationModel(profile, 'gpt-image-2')).toEqual({ imageGenerationModel: 'gpt-image-2' })
  })

  it('uses the profile model for Images API and fal profiles', () => {
    const openAI = createDefaultOpenAIProfile({ model: 'gpt-image-2' })
    const fal = createDefaultFalProfile({ model: 'openai/gpt-image-2.5/sunburst' })
    expect(usesImageGenerationModelField(openAI)).toBe(false)
    expect(applyImageGenerationModel(openAI, 'gpt-image-2.5-flare')).toEqual({ model: 'gpt-image-2.5-flare' })
    expect(applyImageGenerationModel(fal, 'openai/gpt-image-2')).toEqual({ model: 'openai/gpt-image-2' })
  })

  it('treats unknown IDs as custom while keeping them selectable', () => {
    const profile = createDefaultOpenAIProfile({ model: 'vendor/gpt-image-2' })
    expect(isPresetImageModel(profile, profile.model)).toBe(false)
    expect(getImageModelSelectValue(profile, profile.model)).toBe(CUSTOM_IMAGE_MODEL_VALUE)
    expect(getImageModelSelectOptions(profile, profile.model)).toEqual([
      { label: 'gpt-image-2', value: 'gpt-image-2' },
      { label: 'gpt-image-2.5-sunburst', value: 'gpt-image-2.5-sunburst' },
      { label: 'gpt-image-2.5-flare', value: 'gpt-image-2.5-flare' },
      { label: 'vendor/gpt-image-2', value: 'vendor/gpt-image-2' },
      { label: '自定义', value: CUSTOM_IMAGE_MODEL_VALUE },
    ])
  })

  it('uses fal path presets', () => {
    const profile = createDefaultFalProfile({ model: 'openai/gpt-image-2.5/flare' })
    expect(getImageModelSelectValue(profile, profile.model)).toBe('openai/gpt-image-2.5/flare')
    expect(getImageModelSelectOptions(profile, profile.model).map((option) => option.value)).toEqual([
      'openai/gpt-image-2',
      'openai/gpt-image-2.5/sunburst',
      'openai/gpt-image-2.5/flare',
      CUSTOM_IMAGE_MODEL_VALUE,
    ])
  })

  it('treats an empty model as custom', () => {
    const profile = createDefaultOpenAIProfile({ model: 'gpt-image-2' })
    expect(getImageModelSelectValue(profile, '')).toBe(CUSTOM_IMAGE_MODEL_VALUE)
    expect(getImageModelSelectOptions(profile, '').map((option) => option.value)).toEqual([
      'gpt-image-2',
      'gpt-image-2.5-sunburst',
      'gpt-image-2.5-flare',
      CUSTOM_IMAGE_MODEL_VALUE,
    ])
  })
})
