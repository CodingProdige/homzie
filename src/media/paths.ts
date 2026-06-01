const mediaPathPattern = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+$/i;

export function isSafeMediaPath(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return false;
  }

  const path = value.startsWith("/media/") ? value.slice("/media/".length) : value;

  return (
    mediaPathPattern.test(path) &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !path.includes("//")
  );
}

export function toPublicMediaUrl(value: string | null | undefined) {
  if (!isSafeMediaPath(value)) {
    return null;
  }

  if (value?.startsWith("/media/")) {
    return value;
  }

  return `/media/${value}`;
}

export function toStoredMediaPath(value: string | null | undefined) {
  if (!isSafeMediaPath(value)) {
    return null;
  }

  return value?.startsWith("/media/") ? value.slice("/media/".length) : value;
}
