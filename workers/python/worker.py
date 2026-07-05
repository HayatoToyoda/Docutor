#!/usr/bin/env python3
"""Docutor Python Worker entrypoint.

The worker normalizes source documents into a JSON contract that the Next.js
backend can pass to LLM/VLM providers. Parser-specific extraction is added in
small slices; this scaffold keeps the CLI contract stable.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional
from uuid import uuid4

SourceFileType = Literal["pdf", "docx", "pptx"]


@dataclass
class NormalizedAsset:
    id: str
    kind: str
    path: str
    mimeType: str
    sourcePage: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


@dataclass
class NormalizedPage:
    pageNumber: int
    text: str
    markdownTables: list[str] = field(default_factory=list)
    imagePath: Optional[str] = None
    assets: list[NormalizedAsset] = field(default_factory=list)


@dataclass
class NormalizedDocument:
    id: str
    sourceFileName: str
    fileType: SourceFileType
    createdAt: str
    pages: list[NormalizedPage]
    assets: list[NormalizedAsset]
    warnings: list[str]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def detect_file_type(path: Path, explicit_type: Optional[str]) -> SourceFileType:
    if explicit_type in {"pdf", "docx", "pptx"}:
        return explicit_type  # type: ignore[return-value]

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix == ".pptx":
        return "pptx"

    raise ValueError("Unsupported file type. Expected PDF, DOCX, or PPTX.")


def normalize_document(
    input_path: Path,
    output_dir: Path,
    document_id: str,
    source_file_name: Optional[str],
    file_type: SourceFileType,
) -> NormalizedDocument:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "assets").mkdir(parents=True, exist_ok=True)

    guessed_mime_type = mimetypes.guess_type(input_path.name)[0] or "application/octet-stream"
    source_name = source_file_name or input_path.name

    placeholder_asset = NormalizedAsset(
        id=f"asset_{uuid4().hex}",
        kind="embedded-image",
        path=str(input_path),
        mimeType=guessed_mime_type,
    )

    page = NormalizedPage(
        pageNumber=1,
        text="",
        markdownTables=[],
        assets=[],
    )

    return NormalizedDocument(
        id=document_id,
        sourceFileName=source_name,
        fileType=file_type,
        createdAt=utc_now(),
        pages=[page],
        assets=[placeholder_asset],
        warnings=[
            "Python Worker scaffold completed. Parser-specific extraction is not implemented in this slice."
        ],
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize a Docutor source document.")
    parser.add_argument("--input", required=True, help="Path to the source document.")
    parser.add_argument("--output-dir", required=True, help="Directory for extracted assets.")
    parser.add_argument("--document-id", required=True, help="Stable Docutor document id.")
    parser.add_argument("--source-file-name", help="Original uploaded file name.")
    parser.add_argument("--file-type", choices=["pdf", "docx", "pptx"], help="Source file type override.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()

    if not input_path.exists():
        print(json.dumps({"error": f"Input file does not exist: {input_path}"}), file=sys.stderr)
        return 2

    try:
        file_type = detect_file_type(input_path, args.file_type)
        document = normalize_document(
            input_path=input_path,
            output_dir=output_dir,
            document_id=args.document_id,
            source_file_name=args.source_file_name,
            file_type=file_type,
        )
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1

    print(json.dumps(asdict(document), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
