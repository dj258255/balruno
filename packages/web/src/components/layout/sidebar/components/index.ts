// Sidebar.tsx 가 정적으로 import 하는 컴포넌트만 노출.
// 일부 컴포넌트는 같은 디렉토리 안 (예: ProjectList → EmptyProjectsCTA / FolderItem)
// 에서 직접 import 하므로 이 index 에 노출할 필요 없음.
export { WorkspaceSwitcher } from './WorkspaceSwitcher';
export { PinnedSection } from './PinnedSection';
export { NewProjectForm } from './NewProjectForm';
export { ProjectList } from './ProjectList';
export { default as SidebarQuickAccess } from './SidebarQuickAccess';
export { default as SidebarDocsSection } from './SidebarDocsSection';
export { SidebarFooter, SaveStatus } from './SidebarFooter';
export {
  SheetContextMenu,
  ProjectContextMenu,
  FolderContextMenu,
  ClassNameEditModal,
  ConfirmDialogs,
  KindChangeBlockedDialog,
} from './SidebarContextMenus';
export type { KindChangeBlockedState } from './SidebarContextMenus';
