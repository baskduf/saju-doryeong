export function truncateAdminIdentifier(value: string, options?: { head?: number; tail?: number }): string {
  const head = options?.head ?? 6;
  const tail = options?.tail ?? 4;

  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}
