/**
 * Save a file to the user's device.
 *
 * We fetch the bytes and trigger a programmatic blob download instead of
 * relying on a plain <a download> link — anchor clicks inside dropdown menus
 * (and inside sandboxed preview iframes) are frequently swallowed. If the
 * blob path fails, we fall back to letting the browser handle the
 * attachment response directly in a new tab.
 *
 * Returns "saved" when the blob download was triggered, "opened" when the
 * new-tab fallback was used.
 */
export async function saveFileFromUrl(
  url: string,
  filename: string,
): Promise<"saved" | "opened"> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return "saved";
  } catch {
    // Fallback: let the browser handle the attachment response directly.
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  }
}

/** Strip characters that are invalid in file names across platforms. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "download"
  );
}
