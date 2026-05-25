import os

from services.extract.ocr import extract_image_ocr
from services.text_utils import clean_text

ALLOWED_EXTENSIONS = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.txt': 'txt',
    '.text': 'txt',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
}


class FileExtractError(Exception):
    pass


def detect_type(filename):
    ext = os.path.splitext(filename or '')[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileExtractError(
            f'Unsupported file type ({ext or "unknown"}). '
            'Use PDF, DOCX, TXT, PNG, or JPG.'
        )
    return ALLOWED_EXTENSIONS[ext]


def extract_pdf(path):
    import fitz
    doc = fitz.open(path)
    try:
        return '\n'.join(page.get_text() for page in doc)
    finally:
        doc.close()


def extract_docx(path):
    from docx import Document
    doc = Document(path)
    return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())


def extract_txt(path):
    for enc in ('utf-8', 'utf-16', 'latin-1'):
        try:
            with open(path, 'r', encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()


def extract_file(path, filename):
    kind = detect_type(filename)
    if kind == 'pdf':
        raw = extract_pdf(path)
    elif kind == 'docx':
        raw = extract_docx(path)
    elif kind == 'txt':
        raw = extract_txt(path)
    elif kind == 'image':
        raw = extract_image_ocr(path)
    else:
        raise FileExtractError('Unsupported file type')

    cleaned = clean_text(raw)
    if not cleaned:
        raise FileExtractError('No text could be extracted from this file.')
    return cleaned
