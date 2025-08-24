import tempfile
from pathlib import Path

from beam import Image, Sandbox

image = (
    Image()
    .from_registry("node:20")
    .add_commands(
        [
            "apt-get update && apt-get install -y git curl",
            "git clone https://github.com/beam-cloud/react-vite-shadcn-ui.git /app",
            "cd /app && rm -f pnpm-lock.yaml && npm install && echo 'npm install done........'",
            "cd /app && npm install @tanstack/react-query react-router-dom recharts sonner zod react-hook-form @hookform/resolvers date-fns uuid",
        ]
    )
)

DEFAULT_CODE_PATH = "/app/src"
DEFAULT_PROJECT_ROOT = "/app"


def create_app_environment() -> dict:
    print("Creating app environment...")

    sandbox = Sandbox(
        name="lovable-clone",
        cpu=1,
        memory=1024,
        image=image,
        keep_warm_seconds=300,
    ).create()

    url = sandbox.expose_port(3000)
    print(f"React app created and started successfully! Access it at: {url}")
    sandbox.process.exec(
        "sh",
        "-c",
        "cd /app && __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.beam.cloud npm run dev -- --host :: --port 3000",
    )

    print("Created app environment...")
    return {
        "url": url,
        "sandbox_id": sandbox.sandbox_id(),
    }


def load_code(sandbox_id: str) -> tuple[dict, str]:
    print(f"Loading code for sandbox {sandbox_id}")

    sandbox = Sandbox().connect(sandbox_id)
    sandbox.update_ttl(300)

    file_map = {}

    def _process_directory(dir_path: str):
        for file in sandbox.fs.list_files(dir_path):
            full_path = Path(dir_path) / file.name

            if file.is_dir:
                # Recursively process subdirectories
                _process_directory(str(full_path))
            else:
                # Download file
                with tempfile.NamedTemporaryFile() as temp_file:
                    sandbox.fs.download_file(str(full_path), temp_file.name)
                    temp_file.seek(0)
                    file_content = temp_file.read()
                    file_map[str(full_path)] = file_content

    _process_directory(DEFAULT_CODE_PATH)

    package_json = "{}"
    with tempfile.NamedTemporaryFile() as temp_file:
        sandbox.fs.download_file(f"{DEFAULT_PROJECT_ROOT}/package.json", temp_file.name)
        temp_file.seek(0)
        package_json = temp_file.read().decode("utf-8")

    return file_map, package_json


def edit_code(sandbox_id: str, code_map: dict) -> dict:
    print(f"Editing code for sandbox {sandbox_id}")

    sandbox = Sandbox().connect(sandbox_id)
    sandbox.update_ttl(300)

    for sandbox_path, content in code_map.items():
        with tempfile.NamedTemporaryFile() as temp_file:
            temp_file.write(content.encode("utf-8"))
            temp_file.seek(0)

            # Get parent directory and check if it exists
            parent_dir = str(Path(sandbox_path).parent)
            try:
                sandbox.fs.stat_file(parent_dir)
            except BaseException:
                # Parent directory doesn't exist, create it
                print(f"Creating parent directory: {parent_dir}")
                sandbox.process.exec("mkdir", "-p", parent_dir).wait()

            sandbox.fs.upload_file(temp_file.name, sandbox_path)

    return {"sandbox_id": sandbox.sandbox_id()}
