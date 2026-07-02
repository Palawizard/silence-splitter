import { registerBootstrapHandlers } from './bootstrap-handlers'
import { registerExportHandlers } from './export-handlers'
import { registerMediaHandlers } from './media-handlers'
import { registerSettingsHandlers } from './settings-handlers'

export type {
  PremiereTimelineFormat,
  ResolveTimelineFormat,
  TimelineExportNle
} from './export-handlers'

export function registerIpcHandlers(): void {
  registerBootstrapHandlers()
  registerSettingsHandlers()
  registerMediaHandlers()
  registerExportHandlers()
}
