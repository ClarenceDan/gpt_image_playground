function getImageExtension(type: string) {
  const subtype = type.split('/')[1]?.split(';')[0]?.trim().toLowerCase()
  if (!subtype) return 'png'
  if (subtype === 'jpeg') return 'jpg'
  if (subtype === 'svg+xml') return 'svg'
  return subtype
}

export async function downloadImage(src: string, filenamePrefix = 'image') {
  const response = await fetch(src)
  if (!response.ok) throw new Error('图片读取失败')

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filenamePrefix}-${Date.now()}.${getImageExtension(blob.type)}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}