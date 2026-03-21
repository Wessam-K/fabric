import { useAuth } from '../context/AuthContext';

/** Renders children only if the user has the specified permission */
export default function PermissionGuard({ module, action, children, fallback = null }) {
  const { can } = useAuth();
  return can(module, action) ? children : fallback;
}
