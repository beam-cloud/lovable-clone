import os

from beam import Image, PythonVersion, asgi
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

build_dir = os.path.join(os.path.dirname(__file__), "dist")
app.mount(
    "/assets", StaticFiles(directory=os.path.join(build_dir, "assets")), name="assets"
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/{full_path:path}")
async def serve_react_app(full_path: str, request: Request):
    # Serve root-level static files (e.g., /vite.svg)
    file_path = os.path.join(build_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # Fallback to index.html for SPA
    index_path = os.path.join(build_dir, "index.html")
    return FileResponse(index_path)


image = Image(
    python_version=PythonVersion.Python311,
)


@asgi(
    image=image,
    authorized=False,
    concurrent_requests=1000,
)
def handler():
    return app
