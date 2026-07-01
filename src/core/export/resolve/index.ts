import type { XmlExporter } from '../types'

export const davinciResolveExporter: XmlExporter = {
  format: 'davinci-resolve',
  label: 'DaVinci Resolve',
  fileExtension: 'xml',
  generate() {
    throw new Error('DaVinci Resolve export not implemented yet')
  }
}
