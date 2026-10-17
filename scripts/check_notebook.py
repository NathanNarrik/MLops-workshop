"""Execute the teaching notebook without modifying its saved outputs."""

from pathlib import Path

import nbformat
from nbclient import NotebookClient

root = Path(__file__).resolve().parents[1]
notebook = nbformat.read(root / "notebooks/01_train.ipynb", as_version=4)
NotebookClient(
    notebook, timeout=120, kernel_name="python3", resources={"metadata": {"path": str(root)}}
).execute()
print("PASS: every notebook cell executed")
