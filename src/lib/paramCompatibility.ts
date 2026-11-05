import { DEFAULT_PARAMS, type AppSettings, type TaskParams } from '../types'
import { getActiveApiProfile, isOpenAICompatibleProvider } from './apiProfiles'
import { getImageGenerationModel, supportsExtendedQuality, supportsGifOutput } from './imageModels'
import { normalizeCodexCliImageSize, normalizeImageSize } from './size'

export const DEFAULT_FAL_IMAGE_SIZE = '1360x1024'
export const MAX_FAL_OUTPUT_IMAGES = 4
export const MAX_OPENAI_OUTPUT_IMAGES = 10
export const GIF_MIN_FRAME_COUNT = 2
export const GIF_MAX_FRAME_COUNT = 64
export const GIF_MIN_FRAME_DURATION_MS = 20
export const GIF_MAX_FRAME_DURATION_MS = 2000

export function getOutputImageLimitForSettings(settings: AppSettings) {
  return getActiveApiProfile(settings).provider === 'fal' ? MAX_FAL_OUTPUT_IMAGES : MAX_OPENAI_OUTPUT_IMAGES
}

export function normalizeParamsForSettings(
  params: TaskParams,
  settings: AppSettings,
  options: { hasInputImages?: boolean } = {},
): TaskParams {
  const activeProfile = getActiveApiProfile(settings)
  const outputImageLimit = getOutputImageLimitForSettings(settings)
  const nextParams: TaskParams = {
    ...params,
    size: normalizeImageSize(params.size) || DEFAULT_PARAMS.size,
    n: Math.min(outputImageLimit, Math.max(1, params.n || DEFAULT_PARAMS.n)),
  }

  // GIF 只在 Images 生成接口可用，编辑请求和不支持的模型回退为 png
  if (nextParams.output_format === 'gif' && (options.hasInputImages || !supportsGifOutput(activeProfile))) {
    nextParams.output_format = 'png'
  }
  if (nextParams.output_format !== 'gif') {
    nextParams.frame_count = null
    nextParams.frame_duration_ms = null
  } else {
    // GIF 不支持透明背景
    nextParams.transparent_output = false
  }

  if (isOpenAICompatibleProvider(settings, activeProfile.provider) && activeProfile.codexCli) {
    nextParams.size = normalizeCodexCliImageSize(nextParams.size)
    nextParams.quality = DEFAULT_PARAMS.quality
  }

  if (activeProfile.provider === 'fal') {
    if (!options.hasInputImages && nextParams.size === 'auto') nextParams.size = DEFAULT_FAL_IMAGE_SIZE
    if (nextParams.quality === 'auto') nextParams.quality = 'high'
    nextParams.moderation = DEFAULT_PARAMS.moderation
    nextParams.output_compression = DEFAULT_PARAMS.output_compression
  }

  if ((nextParams.quality === 'xhigh' || nextParams.quality === 'max') && !supportsExtendedQuality(getImageGenerationModel(activeProfile))) {
    nextParams.quality = 'high'
  }

  if (nextParams.frame_count != null) {
    nextParams.frame_count = Math.min(GIF_MAX_FRAME_COUNT, Math.max(GIF_MIN_FRAME_COUNT, Math.round(nextParams.frame_count)))
  }
  if (nextParams.frame_duration_ms != null) {
    nextParams.frame_duration_ms = Math.min(
      GIF_MAX_FRAME_DURATION_MS,
      Math.max(GIF_MIN_FRAME_DURATION_MS, Math.round(nextParams.frame_duration_ms / 10) * 10),
    )
  }

  if (nextParams.output_format === 'png' || nextParams.output_format === 'gif') {
    nextParams.output_compression = DEFAULT_PARAMS.output_compression
  }

  return nextParams
}

export function getChangedParams(current: TaskParams, next: TaskParams): Partial<TaskParams> {
  const patch: Partial<TaskParams> = {}
  for (const key of Object.keys(next) as Array<keyof TaskParams>) {
    if (current[key] !== next[key]) {
      ;(patch as Record<keyof TaskParams, TaskParams[keyof TaskParams]>)[key] = next[key]
    }
  }
  return patch
}
