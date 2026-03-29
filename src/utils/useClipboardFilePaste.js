import { useEffect } from "react";

const isTextInputTarget = (target) => {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = String(target.type || "text").toLowerCase();
    return type !== "checkbox" && type !== "radio" && type !== "button";
  }
  return Boolean(target.isContentEditable);
};

const extractPastedFiles = (event, { allowImage = true, allowVideo = false } = {}) => {
  const items = Array.from(event?.clipboardData?.items || []);
  if (!items.length) return [];

  const files = items
    .map((item) => (item.kind === "file" ? item.getAsFile() : null))
    .filter(Boolean);

  if (!files.length) return [];

  return files.filter((file) => {
    const mime = String(file.type || "").toLowerCase();
    if (allowImage && mime.startsWith("image/")) return true;
    if (allowVideo && mime.startsWith("video/")) return true;
    return false;
  });
};

export function useClipboardFilePaste({
  enabled = true,
  allowImage = true,
  allowVideo = false,
  maxFiles = 1,
  onFiles,
}) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof onFiles !== "function") {
      return undefined;
    }

    const onPaste = (event) => {
      const target = event.target;
      if (isTextInputTarget(target)) return;

      const acceptedFiles = extractPastedFiles(event, { allowImage, allowVideo });
      if (!acceptedFiles.length) return;

      event.preventDefault();

      const filesToUse =
        Number.isFinite(maxFiles) && maxFiles > 0
          ? acceptedFiles.slice(0, maxFiles)
          : acceptedFiles;

      onFiles(filesToUse, { totalAccepted: acceptedFiles.length });
    };

    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("paste", onPaste);
    };
  }, [enabled, allowImage, allowVideo, maxFiles, onFiles]);
}
