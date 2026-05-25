"""Backward-compatible re-exports — prefer services.extract."""
from services.extract.documents import FileExtractError, extract_file

__all__ = ['FileExtractError', 'extract_file']
