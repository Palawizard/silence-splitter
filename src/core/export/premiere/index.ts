import type { XmlExporter } from '../types'
import { generatePremiereXml } from './generate'

export { generatePremiereOtio } from './generate-otio'
export { generatePremiereXml } from './generate'

export const premiereProExporter: XmlExporter = {
  format: 'premiere-pro',
  label: 'Adobe Premiere Pro',
  fileExtension: 'xml',
  generate: generatePremiereXml
}
