interface SpeechChunkOptions {
  minimum?: number
  maximum?: number
}

export function takeSpeechChunks(value: string, final: boolean, options: SpeechChunkOptions = {}) {
  const chunks: string[] = []
  let rest = value
  const minimum = Math.max(45, options.minimum ?? 45)
  const maximum = Math.max(minimum, options.maximum ?? 430)

  while (rest.trim()) {
    const trimmedStart = rest.length - rest.trimStart().length
    if (trimmedStart) rest = rest.slice(trimmedStart)

    const searchArea = rest.slice(0, maximum + 1)
    const sentenceMatches = [...searchArea.matchAll(/[.!?](?:["')\]]{0,2})(?=\s|$)/g)]
    const sentenceEnds = sentenceMatches
      .map((match) => (match.index ?? 0) + match[0].length)
      .filter((end) => end >= minimum)
    const sentenceEnd = sentenceEnds.at(-1) ?? -1

    let cutAt = sentenceEnd
    if (cutAt < 0 && rest.length > maximum) {
      const comma = Math.max(searchArea.lastIndexOf(', '), searchArea.lastIndexOf('; '), searchArea.lastIndexOf(': '))
      const space = searchArea.lastIndexOf(' ')
      cutAt = comma >= minimum ? comma + 1 : space >= minimum ? space : maximum
    }

    if (cutAt < 0) {
      if (final) {
        const finalSearchArea = rest.slice(0, maximum + 1)
        if (rest.length > maximum) {
          const space = finalSearchArea.lastIndexOf(' ')
          cutAt = space >= minimum ? space : maximum
        } else {
          chunks.push(rest.trim())
          rest = ''
        }
      }
      if (cutAt < 0) break
    }

    const chunk = rest.slice(0, cutAt).trim()
    if (chunk) chunks.push(chunk)
    rest = rest.slice(cutAt).trimStart()
  }

  return { chunks, rest }
}

export function decodeJsonStringFieldPrefix(json: string, field: string) {
  const marker = new RegExp(`"${field}"\\s*:\\s*"`).exec(json)
  if (!marker || marker.index === undefined) return ''
  let index = marker.index + marker[0].length
  let result = ''

  while (index < json.length) {
    const character = json[index]
    if (character === '"') return result
    if (character !== '\\') {
      result += character
      index += 1
      continue
    }

    if (index + 1 >= json.length) break
    const escaped = json[index + 1]
    const simpleEscapes: Record<string, string> = {
      '"': '"',
      '\\': '\\',
      '/': '/',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
    }
    if (escaped in simpleEscapes) {
      result += simpleEscapes[escaped]
      index += 2
      continue
    }
    if (escaped === 'u') {
      const hex = json.slice(index + 2, index + 6)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break
      result += String.fromCharCode(Number.parseInt(hex, 16))
      index += 6
      continue
    }
    break
  }

  return result
}
