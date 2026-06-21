import { UserRole } from "@/types/types";

export const isAdminRole = (role?: string | null): role is UserRole =>
  role === "admin";

export const canCreateProductsRole = (role?: string | null): role is UserRole =>
  role === "seller" || role === "admin";
