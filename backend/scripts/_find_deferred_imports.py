"""Scans Python package trees for third-party packages imported inside a
function body (deferred imports — e.g. the `# noqa: PLC0415` lazy-import
pattern used around this codebase to avoid circular imports at module load).

Module-scope imports are already exercised by `import app.main` in
check_prod_imports.sh; this finds the ones that AREN'T — a package missing
from requirements.txt but only reachable this way boots clean and only
fails on a live request that happens to hit that one code path (the
anthropic/stream_chat/pywebpush/resend blind spot).

Scans every directory passed in, not just app/ — the import chain Vercel
actually executes starts at backend/api/index.py, so api/ is included too:
a wrapper import added there later (it's currently a two-line shim, but
nothing guarantees it stays that way) would otherwise be invisible to this
check.

Prints one line per distinct top-level import root, tab-separated:
    <root>\t<file1>,<file2>,...

Run from the backend directory:
    python3 scripts/_find_deferred_imports.py app api
"""

import ast
import sys
from pathlib import Path

# Python stdlib modules only — excluded because they're never a
# requirements.txt concern. This is not the "don't hardcode" list the
# preflight is about; that's about not hardcoding which THIRD-PARTY
# packages to check, which this script derives from the code instead.
_STDLIB = frozenset("""
os sys re json math time uuid datetime decimal pathlib typing collections
itertools functools logging secrets hashlib hmac base64 io contextlib
dataclasses enum abc copy urllib http email mimetypes string random
subprocess shutil tempfile glob csv sqlite3 threading asyncio queue
warnings traceback inspect importlib pkgutil ast textwrap unicodedata
numbers statistics array bisect heapq weakref gc platform socket ssl
struct zlib gzip bz2 lzma tarfile zipfile configparser argparse getpass
__future__
""".split())

# This repo's own top-level packages — never third-party, regardless of
# which of them is currently being scanned (api/index.py imports app.main,
# for instance, when scanning api/).
_OWN_PACKAGES = frozenset({"app", "api"})


def find_deferred_imports(package_dirs: list[Path]) -> dict[str, list[str]]:
    by_root: dict[str, set[str]] = {}

    for package_dir in package_dirs:
        for path in sorted(package_dir.rglob("*.py")):
            try:
                tree = ast.parse(path.read_text(), filename=str(path))
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                for inner in ast.walk(node):
                    root = None
                    if isinstance(inner, ast.Import):
                        for alias in inner.names:
                            root = alias.name.split(".")[0]
                    elif isinstance(inner, ast.ImportFrom):
                        if inner.level == 0 and inner.module:
                            root = inner.module.split(".")[0]
                    if root and root not in _STDLIB and root not in _OWN_PACKAGES:
                        by_root.setdefault(root, set()).add(str(path))

    return {root: sorted(files) for root, files in sorted(by_root.items())}


if __name__ == "__main__":
    targets = [Path(p) for p in sys.argv[1:]] or [Path("app")]
    for root, files in find_deferred_imports(targets).items():
        print(f"{root}\t{','.join(files)}")
