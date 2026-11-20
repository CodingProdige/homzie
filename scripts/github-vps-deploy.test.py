import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch


specification = importlib.util.spec_from_file_location(
    "homzie_github_deploy", Path(__file__).with_name("github-vps-deploy.py")
)
deploy = importlib.util.module_from_spec(specification)
sys.modules[specification.name] = deploy
specification.loader.exec_module(deploy)

SHA = "a" * 40
OTHER_SHA = "b" * 40


def write_archive(path, entries):
    with tarfile.open(path, "w:gz") as archive:
        root = tarfile.TarInfo("homzie-" + SHA)
        root.type = tarfile.DIRTYPE
        archive.addfile(root)
        for name, contents, kind in entries:
            member = tarfile.TarInfo(name)
            member.type = kind
            if kind == tarfile.REGTYPE:
                member.size = len(contents)
                archive.addfile(member, io.BytesIO(contents))
            else:
                member.linkname = "../../outside"
                archive.addfile(member)


class Response(io.BytesIO):
    status = 200


class DeploymentCommandTests(unittest.TestCase):
    def test_only_exact_sha_command_is_accepted(self):
        self.assertEqual(deploy.requested_commit("deploy " + SHA), SHA)
        for value in ("", "bash", "deploy main", "deploy " + SHA.upper(),
                      "deploy " + SHA + "\n", "deploy " + SHA + "; id",
                      "deploy " + SHA + " extra", " deploy " + SHA,
                      "deploy\t" + SHA, "deploy " + SHA[:-1]):
            with self.subTest(command=value):
                with self.assertRaises(deploy.DeploymentError):
                    deploy.requested_commit(value)

    def test_main_identity_is_verified_from_fixed_repository(self):
        payload = {"ref": "refs/heads/main", "object": {"sha": SHA}}
        with patch.object(deploy, "urlopen", return_value=Response(json.dumps(payload).encode())) as opener:
            deploy.assert_current_main(SHA)
            self.assertEqual(opener.call_args.args[0].full_url, deploy.MAIN_REF_URL)
        for payload in ({"ref": "refs/heads/main", "object": {"sha": OTHER_SHA}},
                        {"ref": "refs/heads/feature", "object": {"sha": SHA}}):
            with patch.object(deploy, "urlopen", return_value=Response(json.dumps(payload).encode())):
                with self.assertRaises(deploy.DeploymentError):
                    deploy.assert_current_main(SHA)

    def test_release_identity_overrides_inherited_environment(self):
        with patch.dict(deploy.os.environ, {"NEXT_DEPLOYMENT_ID": "stale", "SSH_ORIGINAL_COMMAND": "deploy " + SHA}):
            result = deploy.deployment_environment(SHA, Path("/private/config/homzie.env"))
        self.assertEqual(result["NEXT_DEPLOYMENT_ID"], SHA)
        self.assertEqual(result["HOMZIE_ENV_FILE"], "/private/config/homzie.env")
        self.assertNotIn("SSH_ORIGINAL_COMMAND", result)


class ArchiveTests(unittest.TestCase):
    def test_clean_source_is_extracted_without_archive_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.tar.gz"
            write_archive(archive, [("homzie-" + SHA + "/src/app/page.tsx", b"valid source", tarfile.REGTYPE)])
            deploy.extract_source(archive, root / "app", SHA)
            self.assertEqual((root / "app/src/app/page.tsx").read_bytes(), b"valid source")

    def test_unsafe_entries_are_rejected_before_any_output(self):
        unsafe = [
            ("/outside", tarfile.REGTYPE),
            ("homzie-" + SHA + "/../outside", tarfile.REGTYPE),
            ("another-root/file", tarfile.REGTYPE),
            ("homzie-" + SHA + "/.env.production", tarfile.REGTYPE),
            ("homzie-" + SHA + "/.git/config", tarfile.REGTYPE),
            ("homzie-" + SHA + "/node_modules/package/index.js", tarfile.REGTYPE),
            ("homzie-" + SHA + "/storage/media/photo.jpg", tarfile.REGTYPE),
            ("homzie-" + SHA + "/DEMO_ACCOUNTS.md", tarfile.REGTYPE),
            ("homzie-" + SHA + "/link", tarfile.SYMTYPE),
            ("homzie-" + SHA + "/link", tarfile.LNKTYPE),
            ("homzie-" + SHA + "/device", tarfile.CHRTYPE),
        ]
        for name, kind in unsafe:
            with self.subTest(path=name, kind=kind), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                archive = root / "source.tar.gz"
                write_archive(archive, [
                    ("homzie-" + SHA + "/safe.txt", b"safe", tarfile.REGTYPE),
                    (name, b"unsafe", kind),
                ])
                with self.assertRaises(deploy.DeploymentError):
                    deploy.extract_source(archive, root / "app", SHA)
                self.assertFalse((root / "app").exists())
                self.assertFalse((root / "outside").exists())


class SourceActivationTests(unittest.TestCase):
    def test_first_activation_retains_the_original_source_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "app"
            app.mkdir()
            (app / "existing.txt").write_text("retain me")
            releases = root / "releases"
            source = releases / SHA / "app"
            source.mkdir(parents=True)
            (source / "new.txt").write_text("new release")
            previous = deploy.activate_source(source, app, releases, "first")
            self.assertTrue(app.is_symlink())
            self.assertEqual(app.resolve(), source.resolve())
            self.assertEqual((previous / "existing.txt").read_text(), "retain me")
            self.assertEqual(previous, releases / "pre-github-first")

    def test_later_activation_replaces_only_the_pointer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            releases = root / "releases"
            old = releases / "old" / "app"
            new = releases / "new" / "app"
            old.mkdir(parents=True)
            new.mkdir(parents=True)
            app = root / "app"
            app.symlink_to(old)
            previous = deploy.activate_source(new, app, releases, "later")
            self.assertEqual(previous, old.resolve())
            self.assertTrue(old.is_dir())
            self.assertEqual(app.resolve(), new.resolve())

    def test_activation_refuses_source_outside_release_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "source").mkdir()
            (root / "app").mkdir()
            (root / "releases").mkdir()
            with self.assertRaises(deploy.DeploymentError):
                deploy.activate_source(root / "source", root / "app", root / "releases", "bad")
            self.assertFalse((root / "app").is_symlink())


class LifecycleTests(unittest.TestCase):
    def make_deployer(self, root):
        (root / "app").mkdir()
        (root / "app/original.txt").write_text("original")
        (root / "config").mkdir()
        return deploy.Deployer(SHA, root / "app", root / "releases", root / "config")

    def extract_fake_release(self, archive, destination, sha):
        destination.mkdir()
        (destination / "scripts").mkdir()
        for name in ("scripts/deploy-vps.mjs", "Dockerfile", "docker-compose.vps.yml", "Caddyfile.vps"):
            (destination / name).write_text("test source")

    def test_validation_precedes_deployment_and_activation_follows_health(self):
        events = []
        images = {service: "sha256:old-" + service for service in deploy.SERVICES}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deployment = self.make_deployer(root)
            with patch.object(deploy, "assert_current_main", side_effect=lambda sha: events.append("validate-main")), \
                 patch.object(deploy, "download_archive", side_effect=lambda sha, path: events.append("download")), \
                 patch.object(deploy, "extract_source", side_effect=self.extract_fake_release), \
                 patch.object(deployment, "snapshot_images", return_value=images), \
                 patch.object(deployment, "run_deployment", side_effect=lambda: events.append("deploy")), \
                 patch.object(deployment, "verify_health", side_effect=lambda: events.append("health")), \
                 patch.object(deployment, "image_ids", return_value={"web": "sha256:new"}), \
                 patch.object(deployment, "stage"):
                deployment.deploy()
            self.assertEqual(events, ["validate-main", "download", "validate-main", "deploy", "health", "validate-main"])
            self.assertTrue((root / "app").is_symlink())
            record_path = root / "config/github-deployment.json"
            record = json.loads(record_path.read_text())
            self.assertEqual(record["sha"], SHA)
            self.assertEqual(Path(record["releasedir"]), deployment.source)
            self.assertEqual(record_path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(deployment.log_path.stat().st_mode & 0o777, 0o600)

    def test_failed_deploy_or_health_keeps_old_source_and_attempts_image_rollback(self):
        for failed_stage in ("run_deployment", "verify_health"):
            with self.subTest(stage=failed_stage), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                deployment = self.make_deployer(root)
                images = {"web": "sha256:old-web"}
                failure = deploy.DeploymentError("isolated failure")
                with patch.object(deploy, "assert_current_main"), \
                     patch.object(deploy, "download_archive"), \
                     patch.object(deploy, "extract_source", side_effect=self.extract_fake_release), \
                     patch.object(deployment, "snapshot_images", return_value=images), \
                     patch.object(deployment, "run_deployment", side_effect=failure if failed_stage == "run_deployment" else None), \
                     patch.object(deployment, "verify_health", side_effect=failure if failed_stage == "verify_health" else None), \
                     patch.object(deployment, "rollback_images") as rollback, \
                     patch.object(deployment, "stage"):
                    with self.assertRaises(deploy.DeploymentError):
                        deployment.deploy()
                rollback.assert_called_once_with(images)
                self.assertFalse((root / "app").is_symlink())
                self.assertEqual((root / "app/original.txt").read_text(), "original")
                self.assertFalse((root / "config/github-deployment.json").exists())

    def test_main_advancing_during_build_prevents_activation_and_rolls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deployment = self.make_deployer(root)
            with patch.object(deploy, "assert_current_main", side_effect=[None, None, deploy.DeploymentError("main advanced")]), \
                 patch.object(deploy, "download_archive"), \
                 patch.object(deploy, "extract_source", side_effect=self.extract_fake_release), \
                 patch.object(deployment, "snapshot_images", return_value={"web": "old"}), \
                 patch.object(deployment, "run_deployment"), \
                 patch.object(deployment, "verify_health"), \
                 patch.object(deployment, "rollback_images") as rollback, \
                 patch.object(deployment, "stage"):
                with self.assertRaises(deploy.DeploymentError):
                    deployment.deploy()
            rollback.assert_called_once_with({"web": "old"})
            self.assertFalse((root / "app").is_symlink())

    def test_health_requires_the_exact_running_deployment_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            deployment = self.make_deployer(Path(directory))
            with patch.object(deploy, "urlopen", side_effect=lambda *args, **kwargs: Response(b"{}")), \
                 patch.object(deployment, "run", return_value=SHA):
                deployment.verify_health(timeout=0)
            with patch.object(deploy, "urlopen", side_effect=lambda *args, **kwargs: Response(b"{}")), \
                 patch.object(deployment, "run", return_value=OTHER_SHA):
                with self.assertRaises(deploy.DeploymentError):
                    deployment.verify_health(timeout=0)

    def test_rollback_restores_service_images_and_the_old_caddy_config_mount(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deployment = self.make_deployer(root)
            images = {service: "sha256:old-" + service for service in deploy.SERVICES}
            with patch.object(deployment, "run") as run:
                deployment.rollback_images(images)
            self.assertEqual(run.call_count, 4)
            for call, (service, image_id) in zip(run.call_args_list[:3], images.items()):
                self.assertEqual(call.args[0], ["docker", "image", "tag", image_id, "homzie-vps-" + service + ":latest"])
            restart = run.call_args_list[-1]
            self.assertEqual(restart.kwargs["cwd"], root / "app")
            self.assertEqual(restart.args[0][-4:], ["web", "worker", "realtime", "caddy"])
            self.assertIn("--no-build", restart.args[0])
            self.assertIn("--no-deps", restart.args[0])


if __name__ == "__main__":
    unittest.main()
