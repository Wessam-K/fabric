import { useAuth } from '../context/AuthContext';

export function usePermissions() {
  const { user, permissions, can } = useAuth();

  const canCreate = (module) => can(module, 'create');
  const canEdit = (module) => can(module, 'edit');
  const canDelete = (module) => can(module, 'delete');
  const canView = (module) => can(module, 'view');
  const canExport = (module) => can(module, 'export');

  const isSuperAdmin = user?.role === 'superadmin';

  return { can, canCreate, canEdit, canDelete, canView, canExport, isSuperAdmin, permissions };
}
