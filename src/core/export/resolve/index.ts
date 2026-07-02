import type { XmlExporter } from '../types'
import { generateResolveXml } from './generate'

export { generateResolveXml } from './generate'
export { generateResolveOtio } from './generate-otio'
export { filePathToUrl, premiereFilePathToUrl } from './path-url'

export const davinciResolveExporter: XmlExporter = {
  format: 'davinci-resolve',
  label: 'DaVinci Resolve',
  fileExtension: 'xml',
  generate: generateResolveXml
}
