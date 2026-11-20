#!/usr/bin/env python3
"""Fixed SSH deployment command for the public CodingProdige/homzie main branch.

Install this file root-owned at /usr/local/sbin/homzie-github-deploy and constrain
its SSH key with restrict,command="/usr/local/sbin/homzie-github-deploy".
"""

from __future__ import annotations

import copy
import fcntl
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import time
import traceback
from datetime import datetime, timezone
from urllib.request import Request, urlopen


REPOSITORY = "CodingProdige/homzie"
MAIN_REF_URL = "https://api.github.com/repos/" + REPOSITORY + "/git/ref/heads/main"
SITE_URL = "https://homzie.co.za"
APP_PATH = Path("/srv/homzie/app")
RELEASES_PATH = Path("/srv/homzie/releases")
CONFIG_PATH = Path("/srv/homzie/config")
ENV_PATH = CONFIG_PATH / "homzie.env"
MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
MAX_SOURCE_BYTES = 2 * MAX_ARCHIVE_BYTES
SERVICES = ("web", "worker", "realtime")


class DeploymentError(RuntimeError):
    pass


def requested_commit(command: str) -> str:
    match = re.fullmatch(r"deploy ([0-9a-f]{40})", command)
    if not match:
        raise DeploymentError("Only 'deploy <40 lowercase hexadecimal commit SHA>' is accepted.")
    return match.group(1)


def assert_current_main(sha: str) -> None:
    request = Request(MAIN_REF_URL, headers={"User-Agent": "HomzieDeployment/1.0", "Accept": "application/vnd.github+json"})
    with urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if payload.get("ref") != "refs/heads/main" or payload.get("object", {}).get("sha") != sha:
        raise DeploymentError("Requested commit is no longer the current main branch. Deploy the latest push.")


def download_archive(sha: str, destination: Path) -> None:
    request = Request("https://codeload.github.com/" + REPOSITORY + "/tar.gz/" + sha,
                      headers={"User-Agent": "HomzieDeployment/1.0"})
    count = 0
    with urlopen(request, timeout=120) as response, destination.open("xb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            count += len(chunk)
            if count > MAX_ARCHIVE_BYTES:
                raise DeploymentError("Source archive exceeds the deployment size limit.")
            output.write(chunk)


def extract_source(archive_path: Path, destination: Path, sha: str) -> None:
    """Validate every entry before extracting; links and private output paths fail closed."""
    expected_root = "homzie-" + sha
    members = []
    total_size = 0
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive.getmembers():
            path = PurePosixPath(member.name)
            parts = path.parts
            if (not parts or path.is_absolute() or parts[0] != expected_root
                    or ".." in parts or "\\" in member.name
                    or not (member.isdir() or member.isfile())):
                raise DeploymentError("Source archive contains an unsafe path or entry type.")
            relative = parts[1:]
            if not relative:
                if not member.isdir():
                    raise DeploymentError("Source archive root must be a directory.")
                continue
            if any(part in {".git", "storage", "node_modules", ".next", "DEMO_ACCOUNTS.md"}
                   or part.startswith(".env") for part in relative):
                raise DeploymentError("Source archive contains a private or generated path.")
            total_size += member.size
            if total_size > MAX_SOURCE_BYTES or len(members) >= 100000:
                raise DeploymentError("Expanded source exceeds the deployment size limit.")
            mapped = copy.copy(member)
            mapped.name = PurePosixPath(*relative).as_posix()
            members.append(mapped)

        destination.mkdir(mode=0o755)
        if hasattr(tarfile, "data_filter"):
            archive.extractall(destination, members=members, filter="data")
        else:
            # Compatibility for local Python 3.9 tests. Production Ubuntu uses
            # Python 3.12's data filter; both paths reject all archive links.
            for member in members:
                target = destination / member.name
                target.parent.mkdir(parents=True, exist_ok=True)
                if member.isdir():
                    target.mkdir(exist_ok=True)
                else:
                    with archive.extractfile(member) as source, target.open("xb") as output:
                        while True:
                            chunk = source.read(1024 * 1024)
                            if not chunk:
                                break
                            output.write(chunk)
                    target.chmod(0o755 if member.mode & 0o111 else 0o644)

        # The SSH command uses umask 077 for credentials and logs. Source is
        # public Git content: normalize permissions after either extraction
        # path so Docker's unprivileged app user can read copied static assets.
        file_modes = {member.name: 0o755 if member.mode & 0o111 else 0o644
                      for member in members if member.isfile()}
        destination.chmod(0o755)
        for target in destination.rglob("*"):
            if target.is_dir():
                target.chmod(0o755)
            else:
                target.chmod(file_modes[target.relative_to(destination).as_posix()])


def deployment_environment(sha: str, env_path: Path) -> dict:
    environment = dict(os.environ)
    environment.pop("SSH_ORIGINAL_COMMAND", None)
    environment["HOMZIE_ENV_FILE"] = str(env_path)
    environment["NEXT_DEPLOYMENT_ID"] = sha
    return environment


def activate_source(source: Path, app_path: Path, releases_path: Path, stamp: str) -> Path:
    source = source.resolve(strict=True)
    if not source.is_dir() or releases_path.resolve() not in source.parents:
        raise DeploymentError("Activation source must be inside the releases directory.")
    temporary_link = app_path.parent / (".homzie-app-" + stamp)
    temporary_link.symlink_to(source, target_is_directory=True)
    previous = app_path.resolve(strict=True)
    moved = None
    try:
        if not app_path.is_symlink():
            moved = releases_path / ("pre-github-" + stamp)
            app_path.rename(moved)
            previous = moved
        os.replace(temporary_link, app_path)
    except Exception:
        if moved is not None and not app_path.exists():
            moved.rename(app_path)
        temporary_link.unlink(missing_ok=True)
        raise
    return previous


class Deployer:
    def __init__(self, sha: str, app_path: Path = APP_PATH,
                 releases_path: Path = RELEASES_PATH, config_path: Path = CONFIG_PATH):
        self.sha = sha
        self.app_path = app_path
        self.releases_path = releases_path
        self.config_path = config_path
        self.env_path = config_path / "homzie.env"
        self.stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        self.release = releases_path / (sha + "-" + self.stamp)
        self.source = self.release / "app"
        self.log_path = config_path / "github-deployments" / (sha + "-" + self.stamp + ".log")
        self.environment = deployment_environment(sha, self.env_path)
        self.log = None

    def stage(self, message: str) -> None:
        print(message, flush=True)

    def run(self, command, cwd=None, capture=False):
        result = subprocess.run(command, cwd=cwd, env=self.environment, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE if capture else self.log,
                                stderr=self.log, text=True, check=False)
        if result.returncode:
            raise DeploymentError("A deployment operation failed. Details are retained in the private log.")
        return result.stdout.strip() if capture else None

    def image_ids(self) -> dict:
        return {service: self.run(["docker", "image", "inspect", "homzie-vps-" + service + ":latest",
                                   "--format", "{{.Id}}"], capture=True) for service in SERVICES}

    def snapshot_images(self) -> dict:
        images = self.image_ids()
        for service, image_id in images.items():
            self.run(["docker", "image", "tag", image_id,
                      "homzie-vps-" + service + ":rollback-" + self.stamp])
        return images

    def run_deployment(self) -> None:
        # Docker build arguments can include private settings. Child output goes
        # only to the private log, never to GitHub Actions or the SSH client.
        process = subprocess.Popen(["node", "scripts/deploy-vps.mjs", str(self.env_path)],
                                   cwd=self.source, env=self.environment, stdin=subprocess.DEVNULL,
                                   stdout=self.log, stderr=subprocess.STDOUT)
        next_progress = time.monotonic() + 30
        while process.poll() is None:
            if time.monotonic() >= next_progress:
                self.stage("Production build and deployment are still running.")
                next_progress += 30
            time.sleep(2)
        if process.returncode:
            raise DeploymentError("Production build or deployment failed. Details are in the private log.")

    def verify_health(self, timeout=90) -> None:
        deadline = time.monotonic() + timeout
        attempt = 0
        last_reason = "No health probe completed."
        while True:
            attempt += 1
            try:
                for path in ("/", "/listings", "/api/auth/session"):
                    with urlopen(Request(SITE_URL + path, headers={"User-Agent": "HomzieDeployment/1.0"}), timeout=8) as response:
                        if response.status != 200:
                            raise DeploymentError("Public health path " + path + " returned HTTP " + str(response.status) + ".")
                deployed_sha = self.run([
                    "docker", "exec", "homzie_vps-web-1", "node", "-e",
                    "process.stdout.write(JSON.parse(require('fs').readFileSync('.next/required-server-files.json','utf8')).config.deploymentId || '')",
                ], capture=True)
                if deployed_sha == self.sha:
                    return
                raise DeploymentError("Running deployment ID " + repr(deployed_sha) + " does not match requested SHA " + self.sha + ".")
            except Exception as error:
                last_reason = type(error).__name__ + ": " + str(error)
                if self.log is not None and not self.log.closed:
                    self.log.write("Health probe " + str(attempt) + " failed: " + last_reason + "\n")
                    self.log.flush()
            if time.monotonic() >= deadline:
                if self.log is not None and not self.log.closed:
                    self.log.write("Final health failure: " + last_reason + "\n")
                    self.log.flush()
                raise DeploymentError("Live health or deployment identity checks failed.")
            time.sleep(3)

    def rollback_images(self, images: dict) -> None:
        for service, image_id in images.items():
            self.run(["docker", "image", "tag", image_id, "homzie-vps-" + service + ":latest"])
        self.run(["docker", "compose", "--env-file", str(self.env_path), "-f", "docker-compose.vps.yml",
                  "-p", "homzie_vps", "up", "-d", "--no-build", "--no-deps", *SERVICES, "caddy"], cwd=self.app_path)

    def capture_service_logs(self) -> None:
        if self.log is not None and not self.log.closed:
            self.log.write("\nFailed deployment service logs before rollback:\n")
            self.log.flush()
        self.run(["docker", "compose", "--env-file", str(self.env_path), "-f", "docker-compose.vps.yml",
                  "-p", "homzie_vps", "logs", "--no-color", "--tail", "80", *SERVICES, "caddy"], cwd=self.source)

    def deploy(self) -> None:
        self.releases_path.mkdir(parents=True, exist_ok=True)
        self.log_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor = os.open(self.log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as self.log:
            self.stage("Validating the requested main commit.")
            assert_current_main(self.sha)
            self.release.mkdir()
            archive = self.release / "source.tar.gz"
            self.stage("Downloading and validating clean source.")
            download_archive(self.sha, archive)
            extract_source(archive, self.source, self.sha)
            for required in ("scripts/deploy-vps.mjs", "docker-compose.vps.yml", "Dockerfile", "Caddyfile.vps"):
                if not (self.source / required).is_file():
                    raise DeploymentError("Release is missing a required VPS deployment file.")
            assert_current_main(self.sha)
            self.stage("Retaining previous web and worker images for rollback.")
            images = self.snapshot_images()
            self.stage("Building images, backing up the database, migrating, and starting services.")
            try:
                self.run_deployment()
                self.stage("Verifying public HTTPS and the running commit.")
                self.verify_health()
                assert_current_main(self.sha)
            except Exception:
                self.stage("Deployment checks failed; restoring the previous service images.")
                try:
                    self.capture_service_logs()
                except Exception:
                    self.stage("Service log collection needs operator review.")
                try:
                    self.rollback_images(images)
                    self.stage("Previous images restarted. Database contents were retained.")
                except Exception:
                    self.stage("Image rollback needs operator review; inspect the private deployment log.")
                raise
            current_images = self.image_ids()
            previous_source = activate_source(self.source, self.app_path, self.releases_path, self.stamp)
            record = {
                "sha": self.sha,
                "repository": REPOSITORY,
                "branch": "main",
                "releasedir": str(self.source),
                "previous_source": str(previous_source),
                "image_ids": current_images,
                "previous_image_ids": images,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "log": str(self.log_path),
            }
            record_path = self.config_path / "github-deployment.json"
            temporary = self.config_path / (".github-deployment-" + self.stamp + ".json")
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as output:
                json.dump(record, output, indent=2)
                output.write("\n")
            os.replace(temporary, record_path)
            self.stage("Deployment succeeded for " + self.sha + ". HTTPS and commit identity checks passed.")


def main() -> int:
    os.umask(0o077)
    deployer = None
    try:
        if len(sys.argv) != 1:
            raise DeploymentError("This command does not accept command-line arguments.")
        sha = requested_commit(os.environ.get("SSH_ORIGINAL_COMMAND", ""))
        CONFIG_PATH.mkdir(mode=0o700, parents=True, exist_ok=True)
        lock_descriptor = os.open(CONFIG_PATH / "github-deploy.lock", os.O_WRONLY | os.O_CREAT, 0o600)
        with os.fdopen(lock_descriptor, "w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise DeploymentError("Another production deployment is running. Retry after it completes.")
            deployer = Deployer(sha)
            deployer.deploy()
        return 0
    except DeploymentError as error:
        if deployer is not None and deployer.log_path.exists():
            with deployer.log_path.open("a") as output:
                traceback.print_exc(file=output)
        print("Deployment failed: " + str(error), file=sys.stderr, flush=True)
    except Exception:
        if deployer is not None and deployer.log_path.exists():
            with deployer.log_path.open("a") as output:
                traceback.print_exc(file=output)
        # Tracebacks and subprocess diagnostics may include private settings.
        print("Deployment failed. Inspect the private VPS deployment log.", file=sys.stderr, flush=True)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
