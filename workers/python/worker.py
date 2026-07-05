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
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional
from uuid import uuid4
from xml.etree import ElementTree

SourceFileType = Literal["pdf", "docx", "pptx", "image"]

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

WORD_NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}

PPT_NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

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
    if explicit_type in {"pdf", "docx", "pptx", "image"}:
        return explicit_type  # type: ignore[return-value]

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix == ".pptx":
        return "pptx"
    if suffix in IMAGE_EXTENSIONS:
        return "image"

    raise ValueError("Unsupported file type. Expected PDF, DOCX, PPTX, PNG, or JPG.")


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


def convert_office_to_pdf(input_path: Path, output_dir: Path) -> tuple[Optional[Path], list[str]]:
    warnings: list[str] = []

    if not command_exists("soffice"):
        return None, ["Office rendering requires the soffice command."]

    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        run_command(
            [
                "soffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(input_path),
            ]
        )
    except subprocess.CalledProcessError as exc:
        message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        return None, [f"Office to PDF conversion failed: {message}"]

    pdf_path = output_dir / f"{input_path.stem}.pdf"
    if not pdf_path.exists():
        matches = sorted(output_dir.glob("*.pdf"))
        if matches:
            pdf_path = matches[0]
        else:
            return None, ["Office to PDF conversion did not produce a PDF."]

    return pdf_path, warnings


def w_tag(name: str) -> str:
    return f"{{{WORD_NS['w']}}}{name}"


def word_text(element: ElementTree.Element) -> str:
    return "".join(text.text or "" for text in element.iter(w_tag("t"))).strip()


def word_paragraph_style(paragraph: ElementTree.Element) -> Optional[str]:
    style = paragraph.find("./w:pPr/w:pStyle", WORD_NS)
    if style is None:
        return None
    return style.attrib.get(w_tag("val"))


def format_docx_paragraph(paragraph: ElementTree.Element) -> str:
    text = word_text(paragraph)
    if not text:
        return ""

    style = word_paragraph_style(paragraph) or ""
    match = re.match(r"Heading(\d+)", style, flags=re.IGNORECASE)
    if match:
        level = max(1, min(6, int(match.group(1))))
        return f"{'#' * level} {text}"

    return text


def markdown_table(rows: list[list[str]]) -> str:
    if not rows:
        return ""

    width = max(len(row) for row in rows)
    padded_rows = [row + [""] * (width - len(row)) for row in rows]
    header = padded_rows[0]
    separator = ["---" for _ in range(width)]
    body = padded_rows[1:]

    def render_row(row: list[str]) -> str:
        cells = [cell.replace("|", "\\|").replace("\n", " ").strip() for cell in row]
        return "| " + " | ".join(cells) + " |"

    return "\n".join([render_row(header), render_row(separator), *[render_row(row) for row in body]])


def extract_docx_native(input_path: Path, assets_dir: Path) -> tuple[str, list[str], list[NormalizedAsset], list[str]]:
    warnings: list[str] = []
    text_blocks: list[str] = []
    tables: list[str] = []
    assets: list[NormalizedAsset] = []

    try:
        with zipfile.ZipFile(input_path) as archive:
            document_xml = archive.read("word/document.xml")
            root = ElementTree.fromstring(document_xml)
            body = root.find("w:body", WORD_NS)

            if body is not None:
                for child in body:
                    if child.tag == w_tag("p"):
                        paragraph = format_docx_paragraph(child)
                        if paragraph:
                            text_blocks.append(paragraph)
                    elif child.tag == w_tag("tbl"):
                        rows: list[list[str]] = []
                        for row in child.findall("w:tr", WORD_NS):
                            cells = [word_text(cell) for cell in row.findall("w:tc", WORD_NS)]
                            if any(cells):
                                rows.append(cells)
                        table = markdown_table(rows)
                        if table:
                            tables.append(table)

            for name in archive.namelist():
                if not name.startswith("word/media/"):
                    continue

                source = Path(name)
                asset_path = assets_dir / f"embedded-{len(assets) + 1:03d}{source.suffix}"
                with archive.open(name) as src, asset_path.open("wb") as dst:
                    shutil.copyfileobj(src, dst)

                mime_type = mimetypes.guess_type(asset_path.name)[0] or "application/octet-stream"
                width, height = image_size(asset_path)
                assets.append(
                    NormalizedAsset(
                        id=f"asset_{uuid4().hex}",
                        kind="embedded-image",
                        path=str(asset_path),
                        mimeType=mime_type,
                        width=width,
                        height=height,
                    )
                )
    except KeyError:
        warnings.append("DOCX did not contain word/document.xml.")
    except zipfile.BadZipFile:
        raise RuntimeError("DOCX file is not a valid Office Open XML archive.")

    return "\n\n".join(text_blocks), tables, assets, warnings


def slide_sort_key(name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def drawing_text(element: ElementTree.Element) -> str:
    lines = [
        text.text.strip()
        for text in element.iter(f"{{{PPT_NS['a']}}}t")
        if text.text and text.text.strip()
    ]
    return "\n".join(lines)


def extract_pptx_tables(root: ElementTree.Element) -> list[str]:
    tables: list[str] = []

    for table_element in root.findall(".//a:tbl", PPT_NS):
        rows: list[list[str]] = []
        for row in table_element.findall("a:tr", PPT_NS):
            cells = [drawing_text(cell) for cell in row.findall("a:tc", PPT_NS)]
            if any(cells):
                rows.append(cells)
        table = markdown_table(rows)
        if table:
            tables.append(table)

    return tables


def extract_pptx_native(
    input_path: Path,
    assets_dir: Path,
) -> tuple[dict[int, str], dict[int, list[str]], list[NormalizedAsset], list[str]]:
    warnings: list[str] = []
    slide_texts: dict[int, str] = {}
    slide_tables: dict[int, list[str]] = {}
    assets: list[NormalizedAsset] = []

    try:
        with zipfile.ZipFile(input_path) as archive:
            slide_names = sorted(
                [name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name)],
                key=slide_sort_key,
            )

            if not slide_names:
                warnings.append("PPTX did not contain slide XML files.")

            for index, name in enumerate(slide_names, start=1):
                root = ElementTree.fromstring(archive.read(name))
                slide_texts[index] = drawing_text(root)
                slide_tables[index] = extract_pptx_tables(root)

            for name in archive.namelist():
                if not name.startswith("ppt/media/"):
                    continue

                source = Path(name)
                asset_path = assets_dir / f"embedded-{len(assets) + 1:03d}{source.suffix}"
                with archive.open(name) as src, asset_path.open("wb") as dst:
                    shutil.copyfileobj(src, dst)

                mime_type = mimetypes.guess_type(asset_path.name)[0] or "application/octet-stream"
                width, height = image_size(asset_path)
                assets.append(
                    NormalizedAsset(
                        id=f"asset_{uuid4().hex}",
                        kind="embedded-image",
                        path=str(asset_path),
                        mimeType=mime_type,
                        width=width,
                        height=height,
                    )
                )
    except zipfile.BadZipFile:
        raise RuntimeError("PPTX file is not a valid Office Open XML archive.")

    return slide_texts, slide_tables, assets, warnings


def normalize_pptx_document(
    input_path: Path,
    output_dir: Path,
    document_id: str,
    source_file_name: Optional[str],
) -> NormalizedDocument:
    assets_dir = output_dir / "assets"
    render_dir = output_dir / "rendered"
    output_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    slide_texts, slide_tables, assets, warnings = extract_pptx_native(input_path, assets_dir)
    rendered_pdf, render_warnings = convert_office_to_pdf(input_path, render_dir)
    warnings.extend(render_warnings)

    page_images: list[Path] = []
    page_count = max(len(slide_texts), 1)
    if rendered_pdf is not None:
        try:
            rendered_page_count = pdf_page_count(rendered_pdf)
            page_count = max(page_count, rendered_page_count)
            page_images, page_warnings = render_pdf_pages(rendered_pdf, assets_dir, rendered_page_count)
            warnings.extend(page_warnings)
        except Exception as exc:
            warnings.append(f"PPTX slide rendering failed: {exc}")

    pages: list[NormalizedPage] = []
    page_assets_by_page: dict[int, list[NormalizedAsset]] = {}

    for image_index, image_path in enumerate(page_images):
        page_number = image_index + 1
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
        page_assets_by_page.setdefault(page_number, []).append(asset)

    for page_number in range(1, page_count + 1):
        image_path = page_images[page_number - 1] if page_number <= len(page_images) else None
        pages.append(
            NormalizedPage(
                pageNumber=page_number,
                text=slide_texts.get(page_number, ""),
                markdownTables=slide_tables.get(page_number, []),
                imagePath=str(image_path) if image_path is not None else None,
                assets=page_assets_by_page.get(page_number, []),
            )
        )

    return NormalizedDocument(
        id=document_id,
        sourceFileName=source_file_name or input_path.name,
        fileType="pptx",
        createdAt=utc_now(),
        pages=pages,
        assets=assets,
        warnings=warnings,
    )


def normalize_docx_document(
    input_path: Path,
    output_dir: Path,
    document_id: str,
    source_file_name: Optional[str],
) -> NormalizedDocument:
    assets_dir = output_dir / "assets"
    render_dir = output_dir / "rendered"
    output_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    text, markdown_tables, assets, warnings = extract_docx_native(input_path, assets_dir)
    rendered_pdf, render_warnings = convert_office_to_pdf(input_path, render_dir)
    warnings.extend(render_warnings)

    page_images: list[Path] = []
    page_count = 1
    if rendered_pdf is not None:
        try:
            page_count = pdf_page_count(rendered_pdf)
            page_images, page_warnings = render_pdf_pages(rendered_pdf, assets_dir, page_count)
            warnings.extend(page_warnings)
        except Exception as exc:
            warnings.append(f"DOCX page rendering failed: {exc}")

    pages: list[NormalizedPage] = []
    page_assets_by_page: dict[int, list[NormalizedAsset]] = {}

    for image_index, image_path in enumerate(page_images):
        page_number = image_index + 1
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
        page_assets_by_page.setdefault(page_number, []).append(asset)

    for page_number in range(1, page_count + 1):
        image_path = page_images[page_number - 1] if page_number <= len(page_images) else None
        pages.append(
            NormalizedPage(
                pageNumber=page_number,
                text=text if page_number == 1 else "",
                markdownTables=markdown_tables if page_number == 1 else [],
                imagePath=str(image_path) if image_path is not None else None,
                assets=page_assets_by_page.get(page_number, []),
            )
        )

    return NormalizedDocument(
        id=document_id,
        sourceFileName=source_file_name or input_path.name,
        fileType="docx",
        createdAt=utc_now(),
        pages=pages,
        assets=assets,
        warnings=warnings,
    )


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


def normalize_image_document(
    input_path: Path,
    output_dir: Path,
    document_id: str,
    source_file_name: Optional[str],
) -> NormalizedDocument:
    assets_dir = output_dir / "assets"
    output_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    suffix = input_path.suffix.lower()
    mime_type = IMAGE_MIME_TYPES.get(suffix, "image/png")
    image_path = assets_dir / f"page-001{suffix}"
    shutil.copyfile(input_path, image_path)

    width, height = image_size(image_path)
    asset = NormalizedAsset(
        id=f"asset_{uuid4().hex}",
        kind="page-image",
        path=str(image_path),
        mimeType=mime_type,
        sourcePage=1,
        width=width,
        height=height,
    )

    page = NormalizedPage(
        pageNumber=1,
        text="",
        markdownTables=[],
        imagePath=str(image_path),
        assets=[asset],
    )

    return NormalizedDocument(
        id=document_id,
        sourceFileName=source_file_name or input_path.name,
        fileType="image",
        createdAt=utc_now(),
        pages=[page],
        assets=[asset],
        warnings=[],
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
    if file_type == "docx":
        return normalize_docx_document(
            input_path=input_path,
            output_dir=output_dir,
            document_id=document_id,
            source_file_name=source_file_name,
        )
    if file_type == "pptx":
        return normalize_pptx_document(
            input_path=input_path,
            output_dir=output_dir,
            document_id=document_id,
            source_file_name=source_file_name,
        )
    if file_type == "image":
        return normalize_image_document(
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
    parser.add_argument(
        "--file-type",
        choices=["pdf", "docx", "pptx", "image"],
        help="Source file type override.",
    )
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
