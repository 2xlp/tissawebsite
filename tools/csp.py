#!/usr/bin/env python3
"""Recalcule la ligne Content-Security-Policy de _headers.

Lancé automatiquement par Netlify à chaque build (voir netlify.toml).
Il calcule l'empreinte SHA-256 de chaque <script> en ligne et de chaque
attribut on...="" des pages HTML, pour qu'aucun script du site ne soit bloqué
après une modification. Utilisable aussi en local : python3 tools/csp.py
"""
import base64, hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "tools", ".netlify"}

SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
HANDLER_RE = re.compile(r"""\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')""", re.I)
TAG_RE = re.compile(r"<[a-zA-Z][^>]*>", re.S)
NON_JS = ("application/ld+json", "application/json", "text/template", "text/plain", "text/html")


def h(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


def scan():
    scripts, handlers = set(), set()
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if not f.endswith(".html"):
                continue
            s = open(os.path.join(d, f), encoding="utf-8").read()
            for attrs, body in SCRIPT_RE.findall(s):
                if re.search(r"\bsrc\s*=", attrs, re.I):
                    continue
                t = re.search(r"""type\s*=\s*["']?([^"'\s>]+)""", attrs, re.I)
                if t and t.group(1).lower() in NON_JS:
                    continue
                if body.strip():
                    scripts.add(h(body))
            # attributs on...="" (hors contenu des <script>)
            for tag in TAG_RE.findall(SCRIPT_RE.sub("", s)):
                for a, b in HANDLER_RE.findall(tag):
                    handlers.add(h(a or b))
    return sorted(scripts), sorted(handlers)


def main():
    path = os.path.join(ROOT, "_headers")
    txt = open(path, encoding="utf-8").read()
    scripts, handlers = scan()
    src = "script-src 'self' " + " ".join(scripts)
    if handlers:
        src += " 'unsafe-hashes' " + " ".join(handlers)
    new, n = re.subn(r"script-src [^;]*", src.strip(), txt, count=1)
    if n != 1:
        sys.exit("csp.py : ligne script-src introuvable dans _headers")
    open(path, "w", encoding="utf-8").write(new)
    print(f"csp.py : {len(scripts)} scripts en ligne, {len(handlers)} attributs on...")


if __name__ == "__main__":
    main()
