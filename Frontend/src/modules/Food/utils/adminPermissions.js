import axiosInstance from "@core/api/axios";
import { adminSidebarMenu } from "@food/utils/adminSidebarMenu";
import { quickAdminSidebarMenu } from "@food/utils/quickAdminSidebarMenu";
import { commonAdminSidebarMenu } from "@food/utils/commonAdminSidebarMenu";

const rolePermissionCache = new Map();

const normalizePermissions = (permissions) => {
  if (!permissions || typeof permissions !== "object") return {};
  return permissions;
};

const ACTIONS = ["view", "create", "edit", "delete"];

const normalizeAction = (action = "view") =>
  ACTIONS.includes(action) ? action : "view";

export const extractAdminRoleId = (user) => {
  if (!user) return null;

  const adminRole = user.adminRoleId;
  if (!adminRole) return null;

  if (typeof adminRole === "string") return adminRole;
  if (typeof adminRole === "object") return adminRole._id || adminRole.id || null;

  return null;
};

export const extractAdminPermissions = (user) => {
  if (!user || user.role === "ADMIN") return {};

  const directPermissions = normalizePermissions(user.permissions);
  if (Object.keys(directPermissions).length > 0) return directPermissions;

  return {};
};

export const fetchAdminRolePermissions = async (roleId) => {
  const normalizedRoleId = String(roleId || "").trim();
  if (!normalizedRoleId) return {};

  const response = await axiosInstance.get(`/food/admin/roles/${normalizedRoleId}`);
  const permissions = normalizePermissions(response?.data?.data?.permissions);
  return permissions;
};

export const resolveAdminPermissionsForUser = async (user) => {
  if (!user || user.role === "ADMIN") return {};

  const existingPermissions = extractAdminPermissions(user);
  if (Object.keys(existingPermissions).length > 0) {
    return existingPermissions;
  }

  const roleId = extractAdminRoleId(user);
  if (!roleId) return {};

  try {
    return await fetchAdminRolePermissions(roleId);
  } catch {
    return {};
  }
};

export const getAdminModuleConfig = (pathname = "") => {
  const normalizedPath = String(pathname || "").replace(/\/+$/, "");

  if (normalizedPath.startsWith("/ecs/quick-commerce")) {
    return { rootKey: "quick", menu: quickAdminSidebarMenu };
  }

  if (normalizedPath.startsWith("/ecs/global-settings")) {
    return { rootKey: "global", menu: commonAdminSidebarMenu };
  }

  return { rootKey: "food", menu: adminSidebarMenu };
};

const isModuleDashboardPath = (pathname = "", rootKey = "") => {
  const normalizedPath = String(pathname || "").replace(/\/+$/, "") || "/";
  if (rootKey === "food") return normalizedPath === "/ecs/food";
  if (rootKey === "quick") return normalizedPath === "/ecs/quick-commerce";
  if (rootKey === "global") return normalizedPath === "/ecs/global-settings";
  return false;
};

export const hasPermissionEntry = (permissions, permissionKey, action = "view") => {
  const normalizedAction = normalizeAction(action);
  if (!permissionKey || !permissions) return false;

  // 1. Direct key match
  const entry = permissions[permissionKey];
  if (entry) {
    if (normalizedAction === "view") return entry.view === true;
    return entry.view === true && entry[normalizedAction] === true;
  }

  // 2. Child key union/wildcard match
  const subKeyPrefix = permissionKey + "::";
  return Object.entries(permissions).some(([key, val]) => {
    if (!key.startsWith(subKeyPrefix) || !val) return false;
    if (normalizedAction === "view") return val.view === true;
    return val.view === true && val[normalizedAction] === true;
  });
};

export const hasAnyRootAccess = (permissions, rootKey) => {
  const entries = Object.entries(permissions || {});
  return entries.some(([key, value]) => {
    if (!value?.view) return false;
    return key === rootKey || key.startsWith(`${rootKey}::`);
  });
};

export const findMatchingPermission = (menuList, pathname, parentKey) => {
  let bestMatch = null;

  for (const item of menuList || []) {
    if (item.type === "section" && item.items) {
      const match = findMatchingPermission(
        item.items,
        pathname,
        item.permissionKey ? `${parentKey}::${item.permissionKey}` : parentKey,
      );
      if (match) {
        const matchLen = match.path.length;
        const bestLen = bestMatch ? bestMatch.path.length : -1;
        if (matchLen > bestLen) bestMatch = match;
      }
      continue;
    }

    if (item.type === "expandable" && item.subItems) {
      const match = findMatchingPermission(
        item.subItems,
        pathname,
        item.permissionKey ? `${parentKey}::${item.permissionKey}` : parentKey,
      );
      if (match) {
        const matchLen = match.path.length;
        const bestLen = bestMatch ? bestMatch.path.length : -1;
        if (matchLen > bestLen) bestMatch = match;
      }
      continue;
    }

    if (!item.path) continue;

    const currentKey = item.permissionKey ? `${parentKey}::${item.permissionKey}` : parentKey;
    const itemPath = item.path.replace(/\/+$/, "");
    const currentPath = String(pathname || "").replace(/\/+$/, "");

    if (currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)) {
      const match = { path: item.path, permissionKey: currentKey };
      const matchLen = match.path.length;
      const bestLen = bestMatch ? bestMatch.path.length : -1;
      if (matchLen > bestLen) bestMatch = match;
    }
  }

  return bestMatch;
};

export const getFirstAccessibleAdminPath = (menuList, permissions, parentKey) => {
  for (const item of menuList || []) {
    if (!item.permissionKey) continue;

    const currentKey = `${parentKey}::${item.permissionKey}`;

    if (item.type === "section" && item.items) {
      if (permissions?.[currentKey]?.view !== true) continue;
      const nestedPath = getFirstAccessibleAdminPath(item.items, permissions, currentKey);
      if (nestedPath) return nestedPath;
      continue;
    }

    if (item.type === "expandable" && item.subItems) {
      if (permissions?.[currentKey]?.view !== true) continue;
      const nestedPath = getFirstAccessibleAdminPath(item.subItems, permissions, currentKey);
      if (nestedPath) return nestedPath;
      continue;
    }

    if (item.path && permissions?.[currentKey]?.view === true) {
      return item.path;
    }
  }

  return null;
};

export const getDefaultAdminLandingPath = (user, permissions = {}) => {
  if (!user) return "/ecs/food";
  if (user.role === "ADMIN") return "/ecs/food";

  const moduleConfigs = [
    { rootKey: "food", menu: adminSidebarMenu },
    { rootKey: "quick", menu: quickAdminSidebarMenu },
    { rootKey: "global", menu: commonAdminSidebarMenu },
  ];

  for (const config of moduleConfigs) {
    if (!hasAnyRootAccess(permissions, config.rootKey)) continue;

    const accessiblePath = getFirstAccessibleAdminPath(
      config.menu,
      permissions,
      config.rootKey,
    );

    if (accessiblePath) return accessiblePath;
  }

  return "/ecs/food";
};

export const inferAdminActionFromPath = (pathname, match) => {
  const currentPath = String(pathname || "").replace(/\/+$/, "");
  const matchedPath = String(match?.path || "").replace(/\/+$/, "");

  if (!matchedPath || currentPath === matchedPath) {
    return "view";
  }

  const suffix = currentPath.slice(matchedPath.length).replace(/^\/+/, "");
  const segments = suffix.split("/").filter(Boolean);
  if (segments.length === 0) return "view";

  const actionSegment = segments[0]?.toLowerCase();

  if (["add", "create", "new"].includes(actionSegment)) {
    return "create";
  }

  if (["edit", "update"].includes(actionSegment) || segments.includes("edit") || segments.includes("update")) {
    return "edit";
  }

  if (["delete", "remove"].includes(actionSegment) || segments.includes("delete") || segments.includes("remove")) {
    return "delete";
  }

  return "view";
};

export const canPerformAdminPermissionAction = (user, permissions, permissionKey, action = "view") => {
  if (!user || user.role === "ADMIN") return true;

  const rootKey = String(permissionKey || "").split("::")[0];
  if (!rootKey || !hasAnyRootAccess(permissions, rootKey)) return false;

  return hasPermissionEntry(permissions, permissionKey, action);
};

export const canAccessAdminPath = (user, permissions, pathname) => {
  if (!user || user.role === "ADMIN") return true;

  const { rootKey, menu } = getAdminModuleConfig(pathname);
  if (!hasAnyRootAccess(permissions, rootKey)) return false;
  if (isModuleDashboardPath(pathname, rootKey)) {
    const dashboardKey = `${rootKey}::dashboard`;
    return !!(permissions && permissions[dashboardKey]?.view === true);
  }

  const match = findMatchingPermission(menu, pathname, rootKey);
  if (!match) return false;

  const requiredAction = inferAdminActionFromPath(pathname, match);
  return hasPermissionEntry(permissions, match.permissionKey, requiredAction);
};
