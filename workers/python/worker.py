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
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional
from uuid import uuid4

SourceFileType = Literal["pdf", "docx", "pptx"]

try:
    import pdfplumber  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    pdfplumber = None

try:
    from PIL import Image
except Exception:  # pragma: no cover - optional dependency
    Image = None


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


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=True, capture_output=True, text=True)


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def image_size(path: Path) -> tuple[Optional[int], Optional[int]]:
    if Image is None:
        return None, None

    try:
        with Image.open(path) as image:
            return image.width, image.height
    except Exception:
        return None, None


def pdf_page_count(input_path: Path) -> int:
    if pdfplumber is not None:
        with pdfplumber.open(str(input_path)) as pdf:
            return len(pdf.pages)

    if not command_exists("pdfinfo"):
        raise RuntimeError("PDF page count requires pdfplumber or the pdfinfo command.")

    result = run_command(["pdfinfo", str(input_path)])
    match = re.search(r"^Pages:\s+(\d+)$", result.stdout, re.MULTILINE)
    if not match:
        raise RuntimeError("Could not determine PDF page count.")
    return int(match.group(1))


def extract_pdf_text(input_path: Path, page_count: int) -> list[str]:
    if pdfplumber is not None:
        texts: list[str] = []
        with pdfplumber.open(str(input_path)) as pdf:
            for page in pdf.pages:
                texts.append(page.extract_text(x_tolerance=1, y_tolerance=3) or "")
        return texts

    if not command_exists("pdftotext"):
        return ["" for _ in range(page_count)]

    texts = []
    for page_number in range(1, page_count + 1):
        result = run_command(
            [
                "pdftotext",
                "-layout",
                "-f",
                str(page_number),
                "-l",
                str(page_number),
                str(input_path),
                "-",
            ]
        )
        texts.append(result.stdout.strip())
    return texts


def render_pdf_pages(input_path: Path, assets_dir: Path, page_count: int) -> tuple[list[Path], list[str]]:
    warnings: list[str] = []
    rendered_paths: list[Path] = []

    if not command_exists("pdftoppm"):
        return rendered_paths, ["PDF page rendering requires the pdftoppm command."]

    for page_number in range(1, page_count + 1):
        output_prefix = assets_dir / f"page-{page_number:03d}"
        run_command(
            [
                "pdftoppm",
                "-png",
                "-r",
                "160",
                "-f",
                str(page_number),
                "-l",
                str(page_number),
                "-singlefile",
                str(input_path),
                str(output_prefix),
            ]
        )
        output_path = output_prefix.with_suffix(".png")
        if output_path.exists():
            rendered_paths.append(output_path)
        else:
            warnings.append(f"PDF page {page_number} did not render to PNG.")

    return rendered_paths, warnings


def normalize_pdf_document(
    input_path: Path,
    output_dir: Path,
    document_id: str,
    source_file_name: Optional[str],
) -> NormalizedDocument:
    assets_dir = output_dir / "assets"
    output_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    page_count = pdf_page_count(input_path)
    page_texts = extract_pdf_text(input_path, page_count)
    page_images, warnings = render_pdf_pages(input_path, assets_dir, page_count)

    assets: list[NormalizedAsset] = []
    pages: list[NormalizedPage] = []

    for index in range(page_count):
        page_number = index + 1
        image_path = page_images[index] if index < len(page_images) else None
        page_assets: list[NormalizedAsset] = []

        if image_path is not None:
            width, height = image_size(image_path)
            asset = NormalizedAsset(
                id=f"asset_{uuid4().hex}",
                kind="page-image",
                path=str(image_path),
                mimeType="image/png",
                sourcePage=page_number,
                width=width,
                height=height,
            )
            assets.append(asset)
            page_assets.append(asset)

        pages.append(
            NormalizedPage(
                pageNumber=page_number,
                text=page_texts[index] if index < len(page_texts) else "",
                markdownTables=[],
                imagePath=str(image_path) if image_path is not None else None,
                assets=page_assets,
            )
        )

    return NormalizedDocument(
        id=document_id,
        sourceFileName=source_file_name or input_path.name,
        fileType="pdf",
        createdAt=utc_now(),
        pages=pages,
        assets=assets,
        warnings=warnings,
    )


def normalize_document(
    input_path: Path,
    output_dir: Path,
    document_id: str,
    source_file_name: Optional[str],
    file_type: SourceFileType,
) -> NormalizedDocument:
    if file_type == "pdf":
        return normalize_pdf_document(
            input_path=input_path,
            output_dir=output_dir,
            document_id=document_id,
            source_file_name=source_file_name,
        )

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
