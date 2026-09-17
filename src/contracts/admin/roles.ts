/**
 * Admin V1 role contract.
 *
 * Database enum still contains unused compatibility values (`operations`,
 * `support`) because Postgres cannot drop enum labels. Application staff
 * roles are exactly these two.
 */

export const ADMIN_V1_ROLES = ["admin", "superadmin"] as const;
export type AdminV1Role = (typeof ADMIN_V1_ROLES)[number];

export const LEGACY_NON_V1_ADMIN_ROLES = ["operations", "support"] as const;
export type LegacyNonV1AdminRole = (typeof LEGACY_NON_V1_ADMIN_ROLES)[number];

export type DatabaseAdminRole = AdminV1Role | LegacyNonV1AdminRole;

export function isAdminV1Role(value: string | null | undefined): value is AdminV1Role {
  return value === "admin" || value === "superadmin";
}

export function toAdminV1Role(value: string | null | undefined): AdminV1Role | null {
  return isAdminV1Role(value) ? value : null;
}

export function isSuperadmin(role: AdminV1Role | null | undefined): boolean {
  return role === "superadmin";
}

export function isStaffAdmin(role: AdminV1Role | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

export function canAccessAdmin(role: AdminV1Role | null | undefined): boolean {
  return isStaffAdmin(role);
}

export function canAccessSettings(role: AdminV1Role | null | undefined): boolean {
  return isSuperadmin(role);
}

export function canAccessMerchandising(role: AdminV1Role | null | undefined): boolean {
  return isSuperadmin(role);
}

export function canArchiveProduct(role: AdminV1Role | null | undefined): boolean {
  return isSuperadmin(role);
}

export function canDeleteProduct(role: AdminV1Role | null | undefined): boolean {
  return isSuperadmin(role);
}

export function canManageCollections(role: AdminV1Role | null | undefined): boolean {
  return isStaffAdmin(role);
}

export function canArchiveCollection(role: AdminV1Role | null | undefined): boolean {
  return isSuperadmin(role);
}

export function canDeleteCollection(role: AdminV1Role | null | undefined): boolean {
  return isSuperadmin(role);
}

export function canPublishProduct(role: AdminV1Role | null | undefined): boolean {
  return isStaffAdmin(role);
}

export function canUnpublishProduct(role: AdminV1Role | null | undefined): boolean {
  return isStaffAdmin(role);
}

/**
 * Authenticated app sessions cannot assign or change admin_users.role.
 * First Superadmin is created by owner SQL / service-role with no JWT.
 */
export const AUTHENTICATED_ROLE_ASSIGNMENT_ALLOWED = false;

export function canAssignAdminRole(
  actorRole: AdminV1Role | null | undefined,
  nextRole: string,
): boolean {
  void actorRole;
  void nextRole;
  return AUTHENTICATED_ROLE_ASSIGNMENT_ALLOWED;
}

export function adminRoleLabel(role: AdminV1Role): "Admin" | "Superadmin" {
  return role === "superadmin" ? "Superadmin" : "Admin";
}
