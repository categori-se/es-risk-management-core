# Linux Docker and Podman

Build from the **generated community source directory**, which excludes operational configurations and client data:

```sh
export ESIA_COMMUNITY_SOURCE_TREE_SHA256="$(node -p "JSON.parse(require('node:fs').readFileSync('community-source-manifest.json','utf8')).sourceTreeSha256")"
podman build --build-arg COMMUNITY_SOURCE_TREE_SHA256="$ESIA_COMMUNITY_SOURCE_TREE_SHA256" \
  --file deploy/community/Containerfile --tag esia-community:preview .
mkdir -m 700 /absolute/private/esia-data
podman run --rm --name esia-review --network host \
  --userns keep-id:uid=1000,gid=1000 --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 128 --memory 1g \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777 \
  --volume /absolute/private/esia-data:/data:Z esia-community:preview
```

Open `http://127.0.0.1:4173`. Linux host networking preserves the existing loopback-only listener and exact Host/Origin checks. It also allows access to host network services; a container is not a separate confidentiality boundary against its operator or host. Use host firewall and independent OS/customer boundaries where needed. Do not publish the listener through a reverse proxy or expose host ports on a public interface.

For Docker on Linux, run as a non-root operator. Omit `--userns keep-id:uid=1000,gid=1000` and add `--user YOUR_UID:YOUR_GID`, using the numbers reported by `id -u` and `id -g`. Create the private directory as that same operator with mode 0700. This preserves private ownership even when the host user is 1001 or another ID. The image defaults to UID/GID 1000; Docker's explicit non-root override matches the volume owner. Do not make client data world-writable to work around a user mismatch.

On SELinux hosts the `:Z` mount label is required; do not relabel an existing shared home directory. Docker Compose is supplied in `deploy/community/compose.yaml`; retain `ESIA_COMMUNITY_SOURCE_TREE_SHA256` from the command above, set `ESIA_PRIVATE_DATA` to that prepared private directory and set `ESIA_UID`/`ESIA_GID` to its non-root owner IDs (the defaults are 1000/1000). Then run `docker compose --file deploy/community/compose.yaml up --build`. Compose requires the source fingerprint explicitly. The app keeps all capabilities dropped. Restart is deliberately manual. Stop with `podman stop --time 15 esia-review` or the corresponding Docker command. The dedicated AWS reference deliberately provisions its private data owner as 1000/1000 and uses that same runtime ID.

Before distributing or accepting the image, compare `io.categori.esia.community-source-tree-sha256` in `podman image inspect esia-community:preview` (or Docker's corresponding command) with that exact manifest fingerprint. The build rejects an absent, malformed or mismatched fingerprint. A fingerprint binds source identity; ownership, content rights, file verification and a trusted release signature remain separate checks. The installed checker verifies every listed source file; CI binds its independently exercised runtime image and vulnerability scan to that source tree.

The build and runtime stages pin the official Node 24.22.1 Alpine image and the exact npm lock, with install scripts disabled. npm, yarn and corepack are removed from the runtime because installation is a build task. The musl-based runtime avoids the affected Debian glibc/GCC packages found during the first image scan; OS package metadata remains intact for vulnerability inspection. The base container does not install the optional Python, PDF, OCR, Office or spatial toolchains; unsupported previews report their missing capability. Container build acceptance exercises actual HTTP writes, exact evidence, reporting, account denial, persistence after restart and portable source-package restore separately. Optional native tooling requires its own pinned image and acceptance before claiming support.

Data is mounted at `/data`, outside the image; temporary processing uses bounded `/tmp` tmpfs. Stop the app before taking a consistent encrypted volume backup. Replace the image to upgrade, retain the old digest and stopped data backup for rollback, and verify reports and source hashes. Removing a container must not remove the data directory. Never bake private data or credentials into an image.

Run `node tools/check-community-container.mjs .` for bounded synthetic build/run/restart acceptance. The tool pulls no base image automatically (`--pull=never`); fetch the pinned `FROM` image first. Set `ESIA_CONTAINER_ENGINE=docker` for Docker. Isolated Podman store arguments may be supplied as a JSON array in `ESIA_CONTAINER_ENGINE_ARGS_JSON`. This check starts no cloud resources or idle background consumer.

Windows/macOS container networking through a VM has not been accepted. Use the Node installation path there. A signed image/provenance receipt must be verified against a trusted release key before treating any image as an approved release; a locally successful build alone is not a signed release.

The runtime flags follow the official [Podman run documentation](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
