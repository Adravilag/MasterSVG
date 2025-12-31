/**
 * Commands index file
 * Re-exports all command registration functions
 */

export {
  registerTreeViewCommands,
  type TreeViews,
  type TreeProviders,
  type TreeViewState,
} from './treeViewCommands';
export {
  registerBuildCommands,
  type WorkspaceSvgProviderLike,
  type BuiltIconsProviderLike,
  type SvgFilesProviderLike,
} from './buildCommands';
export { registerRefreshCommands, type RefreshableProviders } from './refreshCommands';
export { registerNavigationCommands } from './navigationCommands';
export { registerPanelCommands, type ScanProvider } from './panelCommands';
export { registerConfigCommands } from './configCommands';
export { registerIconCommands, type IconCommandProviders } from './iconCommands';
export { registerTransformCommands, type TransformCommandProviders } from './transformCommands';
export {
  registerIconifyCommands,
  showIconifyReplacementPicker,
  showIconPickerPanel,
  type IconifyCommandProviders,
} from './iconifyCommands';
export { registerEditorCommands, type EditorCommandProviders } from './editorCommands';
export {
  registerSpriteCommands,
  getSpritePreviewHtml,
  type SpriteCommandProviders,
} from './spriteCommands';
export { registerMiscCommands, type MiscCommandProviders } from './miscCommands';
export { registerImportCommands, type ImportCommandProviders } from './importCommands';
export { registerReferenceCommands, type ReferenceCommandProviders } from './referenceCommands';
export { registerLicenseCommands } from './licenseCommands';
