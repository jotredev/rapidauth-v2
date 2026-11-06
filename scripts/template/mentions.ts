import { buildMentionPattern } from './forms';
import { MENTIONS_SKIPPED_PATHS, decodeText, type SourceFile } from './files';
import { METADATA_PATH, type TemplateIdentity } from './metadata';

export interface Mention {
  path: string;
  /** 1-based line, or null when the mention is in the file path itself. */
  line: number | null;
  /** The text that matched. */
  match: string;
  /** The trimmed line (or the path) where it appears. */
  excerpt: string;
}

/**
 * In the metadata file the `template` object is the stored identity (name, slug, aliases and origin URL) that
 * `template:pull` reads, so it is not scanned. The rest of that file is.
 */
function maskTemplateIdentity(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'template' in parsed) {
      return JSON.stringify({ ...parsed, template: {} }, null, 2);
    }
  } catch {
    // Not valid JSON: scan it as plain text.
  }
  return text;
}

/**
 * Finds every remaining spelling of the template name (case-insensitive, with or without separators) in the content
 * and the paths of the given files. Binary files are only checked by path.
 */
export function findMentions(template: TemplateIdentity, files: SourceFile[]): Mention[] {
  const pattern = buildMentionPattern(template);
  const mentions: Mention[] = [];

  for (const file of files) {
    for (const match of file.path.matchAll(pattern)) {
      mentions.push({ path: file.path, line: null, match: match[0], excerpt: file.path });
    }
    if (MENTIONS_SKIPPED_PATHS.has(file.path)) continue;
    let text = decodeText(file.content);
    if (text === null) continue;
    if (file.path === METADATA_PATH) text = maskTemplateIdentity(text);

    text.split(/\r?\n/).forEach((lineText, index) => {
      for (const match of lineText.matchAll(pattern)) {
        mentions.push({ path: file.path, line: index + 1, match: match[0], excerpt: lineText.trim() });
      }
    });
  }
  return mentions;
}

export function formatMentions(mentions: Mention[]): string {
  return mentions
    .map((m) => `${m.path}${m.line === null ? ' (path)' : `:${m.line}`}  ${m.match}  |  ${m.excerpt.slice(0, 120)}`)
    .join('\n');
}
