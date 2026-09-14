import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import {
    canPerformAdminPermissionAction,
    extractAdminPermissions,
    extractAdminRoleId,
    fetchAdminRolePermissions,
} from "@food/utils/adminPermissions";

export function useAdminPermissions(permissionKey) {
    const { user: authUser } = useAuth();
    const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
    const [resolvedPermissions, setResolvedPermissions] = useState({});

    useEffect(() => {
        let isMounted = true;

        const resolvePermissions = async () => {
            if (!currentUser || currentUser.role === "ADMIN") {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            const existingPermissions = extractAdminPermissions(currentUser);
            if (Object.keys(existingPermissions).length > 0) {
                if (isMounted) setResolvedPermissions(existingPermissions);
                return;
            }

            const roleId = extractAdminRoleId(currentUser);
            if (!roleId) {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            try {
                const rolePermissions = await fetchAdminRolePermissions(roleId);
                if (isMounted) setResolvedPermissions(rolePermissions);
            } catch {
                if (isMounted) setResolvedPermissions({});
            }
        };

        resolvePermissions();
        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    return {
        currentUser,
        canView: canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "view"),
        canCreate: canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create"),
        canEdit: canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit"),
        canDelete: canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete"),
    };
}
