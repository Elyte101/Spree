import sys
from pathlib import Path

# Ensure the backend root is on sys.path so `app` is importable
# regardless of the working directory Vercel uses at runtime.
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
