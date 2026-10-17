#!/usr/bin/env bash
set -euo pipefail

target_root="${1:-portal}"
vendor_root="${target_root}/vendor/mediapipe"
package_version="0.10.21"
package_sha256="343736570f433c0100ffc360dbe70f09cc502a5fc573f5cd95954692edc9cfde"
model_sha256="59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
model_url="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

(
  cd "$work_dir"
  npm pack "@mediapipe/tasks-vision@${package_version}" --silent >/dev/null
  printf '%s  %s\n' "$package_sha256" "mediapipe-tasks-vision-${package_version}.tgz" | sha256sum -c -
  tar -xzf "mediapipe-tasks-vision-${package_version}.tgz"
  curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 --output pose_landmarker_lite.task "$model_url"
  printf '%s  %s\n' "$model_sha256" pose_landmarker_lite.task | sha256sum -c -
)

mkdir -p "$vendor_root/wasm" "$vendor_root/models"
cp "$work_dir/package/vision_bundle.mjs" "$vendor_root/vision_bundle.mjs"
cp "$work_dir/package/wasm/vision_wasm_internal.js" "$vendor_root/wasm/vision_wasm_internal.js"
cp "$work_dir/package/wasm/vision_wasm_internal.wasm" "$vendor_root/wasm/vision_wasm_internal.wasm"
cp "$work_dir/package/wasm/vision_wasm_nosimd_internal.js" "$vendor_root/wasm/vision_wasm_nosimd_internal.js"
cp "$work_dir/package/wasm/vision_wasm_nosimd_internal.wasm" "$vendor_root/wasm/vision_wasm_nosimd_internal.wasm"
cp "$work_dir/pose_landmarker_lite.task" "$vendor_root/models/pose_landmarker_lite.task"

test -s "$vendor_root/vision_bundle.mjs"
test -s "$vendor_root/wasm/vision_wasm_internal.wasm"
test -s "$vendor_root/wasm/vision_wasm_nosimd_internal.wasm"
test -s "$vendor_root/models/pose_landmarker_lite.task"
echo "A01_MEDIAPIPE_VENDOR_READY ${package_version}"
