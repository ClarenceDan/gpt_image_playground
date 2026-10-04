import type { ApiProfile } from '../types'

export const DEFAULT_IMAGES_MODEL = 'gpt-image-2.5-sunburst'
export const CUSTOM_IMAGE_MODEL_VALUE = '__custom_image_model__'

const OPENAI_IMAGE_MODEL_PRESETS = [
  { value: 'gpt-image-2', label: 'gpt-image-2' },
  { value: 'gpt-image-2.5-sunburst', label: 'gpt-image-2.5-sunburst' },
  { value: 'gpt-image-2.5-flare', label: 'gpt-image-2.5-flare' },
] as const

const FAL_IMAGE_MODEL_PRESETS = [
  { value: 'openai/gpt-image-2', label: 'gpt-image-2' },
  { value: 'openai/gpt-image-2.5/sunburst', label: 'gpt-image-2.5-sunburst' },
  { value: 'openai/gpt-image-2.5/flare', label: 'gpt-image-2.5-flare' },
] as const

export function getImageGenerationModel(profile: ApiProfile) {
  return profile.provider === 'openai' && profile.apiMode === 'responses'
    ? profile.imageGenerationModel?.trim() ?? ''
    : profile.model
}

export function isGptImage25Model(model: string) {
  return model.trim().toLowerCase().includes('gpt-image-2.5')
}

export function usesImageGenerationModelField(profile: Pick<ApiProfile, 'provider' | 'apiMode'>) {
  return profile.provider === 'openai' && profile.apiMode === 'responses'
}

export function getImageModelPresets(profile: Pick<ApiProfile, 'provider'>) {
  return profile.provider === 'fal' ? [...FAL_IMAGE_MODEL_PRESETS] : [...OPENAI_IMAGE_MODEL_PRESETS]
}

export function isPresetImageModel(profile: Pick<ApiProfile, 'provider'>, model: string) {
  const value = model.trim()
  return getImageModelPresets(profile).some((preset) => preset.value === value)
}

export function getImageModelSelectValue(profile: Pick<ApiProfile, 'provider'>, model: string) {
  const value = model.trim()
  if (!value) return CUSTOM_IMAGE_MODEL_VALUE
  return isPresetImageModel(profile, value) ? value : CUSTOM_IMAGE_MODEL_VALUE
}

export function getImageModelSelectOptions(profile: Pick<ApiProfile, 'provider'>, model: string) {
  const value = model.trim()
  const options: Array<{ label: string; value: string }> = getImageModelPresets(profile).map((preset) => ({
    label: preset.label,
    value: preset.value,
  }))
  if (value && !isPresetImageModel(profile, value)) {
    options.push({ label: value, value })
  }
  options.push({ label: '自定义', value: CUSTOM_IMAGE_MODEL_VALUE })
  return options
}

export function applyImageGenerationModel(profile: ApiProfile, model: string): Partial<ApiProfile> {
  return usesImageGenerationModelField(profile)
    ? { imageGenerationModel: model }
    : { model }
}
