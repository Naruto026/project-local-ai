import re

WHITESPACE_RE = re.compile(r'[ \t]+')
MULTI_NEWLINE_RE = re.compile(r'\n{3,}')


def clean_text(text):
    if not text:
        return ''
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = WHITESPACE_RE.sub(' ', text)
    text = MULTI_NEWLINE_RE.sub('\n\n', text)
    return text.strip()


def truncate_text(text, max_chars):
    if len(text) <= max_chars:
        return text, False
    cut = text[:max_chars]
    last_break = cut.rfind('\n', max(0, len(cut) - 200))
    if last_break > max_chars // 2:
        cut = cut[:last_break]
    return cut.rstrip() + '\n\n[... content truncated ...]', True


def build_file_context_block(file_entries, max_chars=8000):
    """Combine multiple file texts into one system context block."""
    if not file_entries:
        return None

    header = (
        '## Attached documents (you have full access to the text below)\n'
        'The user uploaded these files. Answer using this content. '
        'Do not say you lack access to attachments. '
        'If the answer is not in the documents, say so clearly.\n\n'
    )
    budget = max_chars - len(header)
    if budget < 500:
        budget = max_chars

    per_file = max(400, budget // len(file_entries))
    parts = []
    total = 0
    any_truncated = False

    for entry in file_entries:
        name = entry.get('filename', 'file')
        text = entry.get('extracted_text', '')
        chunk, truncated = truncate_text(text, per_file)
        if truncated:
            any_truncated = True
        section = f'--- File: {name} ---\n{chunk}\n'
        if total + len(section) > budget:
            remaining = budget - total
            if remaining > 100:
                section = section[:remaining] + '\n[... truncated ...]\n'
                parts.append(section)
            any_truncated = True
            break
        parts.append(section)
        total += len(section)

    body = '\n'.join(parts)
    full, truncated = truncate_text(body, budget)
    if truncated:
        any_truncated = True

    return {
        'content': header + full,
        'truncated': any_truncated,
    }
