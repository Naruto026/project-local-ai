"""Image OCR — Tesseract. Future: vision models via Ollama multimodal."""


def tesseract_available():
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def extract_image_ocr(path):
    from services.extract.documents import FileExtractError

    try:
        import pytesseract
        from PIL import Image
    except ImportError as e:
        raise FileExtractError(
            'OCR libraries not installed. Run setup.bat or: pip install Pillow pytesseract'
        ) from e

    if not tesseract_available():
        raise FileExtractError(
            'Tesseract OCR is not installed. '
            'Install from https://github.com/UB-Mannheim/tesseract/wiki and add to PATH.'
        )

    try:
        with Image.open(path) as img:
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            return pytesseract.image_to_string(img)
    except FileExtractError:
        raise
    except Exception as e:
        raise FileExtractError(f'OCR failed: {e}') from e
