import { clsx, type ClassValue } from "clsx"
import { ConvexError } from "convex/values"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The string code of a `throw new ConvexError("code")`, or null otherwise. */
export function errorCode(error: unknown): string | null {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : null
}
