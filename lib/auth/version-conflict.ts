/** Shared optimistic-lock conflict code returned to clients. */
export const VERSION_CONFLICT = "VERSION_CONFLICT" as const;

export type VersionConflictError = {
  code: typeof VERSION_CONFLICT;
  message: string;
  status: 409;
};

export function versionConflictError(
  message = "Podaci su promenjeni na drugom uređaju"
): VersionConflictError {
  return {
    code: VERSION_CONFLICT,
    message,
    status: 409,
  };
}

export function isVersionConflict(error: unknown): error is VersionConflictError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === VERSION_CONFLICT
  );
}

/** Detect VERSION_CONFLICT from action results or HTTP-ish errors. */
export function readVersionConflictMessage(error: {
  code?: string;
  message?: string;
  status?: number;
} | null | undefined): string | null {
  if (!error) return null;
  if (error.status === 409 || error.code === VERSION_CONFLICT) {
    return versionConflictError().message;
  }
  const message = error.message ?? "";
  if (message.startsWith(`${VERSION_CONFLICT}:`)) {
    return (
      message.slice(VERSION_CONFLICT.length + 1) ||
      versionConflictError().message
    );
  }
  if (message.includes(VERSION_CONFLICT)) {
    return versionConflictError().message;
  }
  return null;
}
