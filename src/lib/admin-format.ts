import { ADMIN_DASHBOARD_TIME_ZONE } from "@/contracts/admin/dashboard";

export function formatAdminDateTime(
  iso: string,
  timeZone = ADMIN_DASHBOARD_TIME_ZONE,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function formatAdminCustomerName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
