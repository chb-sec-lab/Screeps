#!/usr/bin/env python3

from __future__ import annotations

import html
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = REPO_ROOT / "docs"

PAGES = [
    {
        "source": "index.md",
        "output": "overview.html",
        "title": "Overview",
        "lead": "Operational snapshot, mission status, and documentation map.",
    },
    {
        "source": "manifest.md",
        "output": "manifest.html",
        "title": "System Manifest",
        "lead": "Source of truth for room policy, quotas, and operating constraints.",
    },
    {
        "source": "principles.md",
        "output": "principles.html",
        "title": "Engineering Principles",
        "lead": "Design standards for stable, explainable, and maintainable automation.",
    },
    {
        "source": "architecture.md",
        "output": "architecture.html",
        "title": "Architecture",
        "lead": "System layers, control model, and delivery contract.",
    },
    {
        "source": "recue-commands.md",
        "output": "runbook.html",
        "title": "Operational Runbook",
        "lead": "Live checks and recovery procedures for day-to-day operation.",
    },
    {
        "source": "observations.md",
        "output": "observations.html",
        "title": "Observations",
        "lead": "Concise non-urgent findings and follow-up actions.",
    },
    {
        "source": "alerts.md",
        "output": "alerts.html",
        "title": "Alerts",
        "lead": "Incident-focused records with response and prevention actions.",
    },
]

NAV = [
    ("index.html", "Portfolio"),
    ("overview.html", "Overview"),
    ("manifest.html", "Manifest"),
    ("principles.html", "Principles"),
    ("architecture.html", "Architecture"),
    ("runbook.html", "Runbook"),
    ("observations.html", "Observations"),
    ("alerts.html", "Alerts"),
    ("../index.html", "Hub"),
]


def map_href(href: str) -> str:
    normalized = href.replace("\\", "/")
    if not normalized.endswith(".md"):
        return normalized
    if normalized == "index.md":
        return "overview.html"
    if normalized == "recue-commands.md":
        return "runbook.html"
    return re.sub(r"\.md$", ".html", normalized, flags=re.IGNORECASE)


def render_inline(text: str) -> str:
    escaped = html.escape(text, quote=False)

    escaped = re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", lambda m: f"<strong>{m.group(1)}</strong>", escaped)

    def replace_link(match: re.Match[str]) -> str:
        label, href = match.group(1), match.group(2).strip()
        return f'<a href="{html.escape(map_href(href), quote=True)}">{label}</a>'

    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace_link, escaped)
    return escaped


def parse_markdown(markdown: str) -> list[dict]:
    lines = markdown.replace("\r", "").split("\n")
    sections: list[dict] = []
    current = {"title": "Summary", "blocks": []}
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if not paragraph:
            return
        text = " ".join(paragraph).strip()
        if text:
            current["blocks"].append({"type": "p", "value": text})
        paragraph = []

    def flush_section() -> None:
        flush_paragraph()
        if current["blocks"]:
            sections.append(current.copy())

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line:
            flush_paragraph()
            i += 1
            continue

        if i == 0 and line.startswith("# "):
            i += 1
            continue

        if re.match(r"^\[[^\]]+\]\([^)]*\)(\s*\|\s*\[[^\]]+\]\([^)]*\))+$$", line):
            i += 1
            continue

        if line.startswith("## "):
            flush_section()
            current = {"title": line[3:].strip(), "blocks": []}
            i += 1
            continue

        if line.startswith("### "):
            flush_paragraph()
            current["blocks"].append({"type": "h3", "value": line[4:].strip()})
            i += 1
            continue

        if line.startswith("- "):
            flush_paragraph()
            items = [line[2:].strip()]
            i += 1
            while i < len(lines) and lines[i].strip().startswith("- "):
                items.append(lines[i].strip()[2:].strip())
                i += 1
            current["blocks"].append({"type": "ul", "items": items})
            continue

        paragraph.append(line)
        i += 1

    flush_section()
    if sections:
        return sections
    return [{"title": "Content", "blocks": [{"type": "p", "value": "No content available."}]}]


def render_blocks(blocks: list[dict]) -> str:
    rendered: list[str] = []
    for block in blocks:
        if block["type"] == "p":
            rendered.append(f"<p>{render_inline(block['value'])}</p>")
        elif block["type"] == "h3":
            rendered.append(f"<h3>{html.escape(block['value'])}</h3>")
        elif block["type"] == "ul":
            items = "".join(f"<li>{render_inline(item)}</li>" for item in block["items"])
            rendered.append(f"<ul>{items}</ul>")
    return "\n".join(rendered)


def render_page(page: dict, markdown: str) -> str:
    sections = parse_markdown(markdown)
    nav_html = "".join(f'<a href="{href}">{label}</a>' for href, label in NAV)

    cards: list[str] = []
    for idx, section in enumerate(sections):
        wide = " wide" if idx == 0 or len(section["blocks"]) > 2 else ""
        cards.append(
            f'<section class="card{wide}"><h2>{html.escape(section["title"])}</h2>{render_blocks(section["blocks"])}</section>'
        )

    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>SCOS | {html.escape(page['title'])}</title>
  <link rel=\"stylesheet\" href=\"site.css\">
</head>
<body>
  <div class=\"bg-orb orb-a\"></div>
  <div class=\"bg-orb orb-b\"></div>
  <header class=\"shell hero\">
    <p class=\"kicker\">SCOS Documentation</p>
    <h1>{html.escape(page['title'])}</h1>
    <p class=\"lead\">{html.escape(page['lead'])}</p>
    <nav class=\"doc-links\" aria-label=\"Docs navigation\">{nav_html}</nav>
  </header>
  <main class=\"shell grid\">
    {'\n    '.join(cards)}
  </main>
</body>
</html>
"""


def build_docs() -> None:
    for page in PAGES:
        source = DOCS_DIR / page["source"]
        output = DOCS_DIR / page["output"]
        markdown = source.read_text(encoding="utf-8")
        rendered = render_page(page, markdown)
        output.write_text(rendered, encoding="utf-8")
        print(f"built {output.relative_to(REPO_ROOT)} from {source.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    build_docs()
