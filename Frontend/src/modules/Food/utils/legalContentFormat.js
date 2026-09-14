const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const applyInlineFormatting = (escaped) => {
  // Bold: **text**
  return String(escaped).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
};

/**
 * Convert admin editor plain text into HTML for storage + user rendering.
 * Supports:
 * - # / ## / ### headings
 * - - / * bullet lists (basic)
 * - **bold**
 * - blank line => paragraph break
 */
export const plainTextToLegalHtml = (plainText) => {
  const lines = String(plainText ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      // keep spacing like the old implementation
      out.push("<p><br></p>");
      continue;
    }

    // Headings
    const h3 = trimmed.match(/^###\s+(.*)$/);
    const h2 = trimmed.match(/^##\s+(.*)$/);
    const h1 = trimmed.match(/^#\s+(.*)$/);

    if (h1 || h2 || h3) {
      closeList();
      const text = applyInlineFormatting(escapeHtml((h1 || h2 || h3)[1] || ""));
      const tag = h1 ? "h1" : h2 ? "h2" : "h3";
      // Add a highlight background for headings
      const cls =
        tag === "h1"
          ? 'class="bg-amber-100/70 px-2 py-1 rounded-md inline-block"'
          : tag === "h2"
            ? 'class="bg-amber-100/50 px-2 py-0.5 rounded-md inline-block"'
            : 'class="bg-amber-100/30 px-2 py-0.5 rounded-md inline-block"';
      out.push(`<${tag}><span ${cls}>${text}</span></${tag}>`);
      continue;
    }

    // Bullets
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      const text = applyInlineFormatting(escapeHtml(bullet[1] || ""));
      out.push(`<li>${text}</li>`);
      continue;
    }

    // Normal paragraph
    closeList();
    const text = applyInlineFormatting(escapeHtml(trimmed));
    out.push(`<p>${text}</p>`);
  }

  closeList();
  return out.join("");
};

/**
 * Convert HTML (possibly escaped) back into a clean plain text for admin textarea.
 */
export const legalHtmlToPlainText = (html) => {
  if (!html) return "";

  let text = String(html);

  // Replace paragraph/div breaks with newlines
  text = text.replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/(h1|h2|h3)>/gi, "\n");
  text = text.replace(/<(h1|h2|h3)[^>]*>/gi, "");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<\/ul>/gi, "\n").replace(/<ul[^>]*>/gi, "");

  // Strip remaining tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Decode can reintroduce tags; strip again
  text = text.replace(/<[^>]*>/g, "");

  // Clean up multiple newlines (keep max 2 consecutive)
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();

  return text;
};

