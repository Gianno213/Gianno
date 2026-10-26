#!/usr/bin/env bash
# Isolated development only. Never overwrites application .env.local or prints keys.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
version=2.75.0
tool_dir="${GIANNO_TOOLS_DIR:-/workspace/.tools}/supabase-$version"
status_file="${GIANNO_LOCAL_STATUS:-/tmp/gianno-supabase-status.json}"
log_file=/tmp/gianno-supabase-runtime.log
install_cli() {
  case "$(uname -s)/$(uname -m)" in
    Linux/x86_64) arch=amd64; checksum=e5597462f865d5ac72af0453358e37ecb0d85962ad6914a114a53de847303bde ;;
    Linux/aarch64) arch=arm64; checksum=b551c2f8e03715be428d2592765200a9e371168fc36ec2646a84ecc530d3120e ;;
    *) echo 'Use an official Supabase CLI installation for this platform.' >&2; exit 1 ;;
  esac
  mkdir -p "$tool_dir"
  archive="$tool_dir/supabase_linux_$arch.tar.gz"
  if [ ! -f "$archive" ]; then
    curl --fail --show-error --location --max-time 180 \
      "https://github.com/supabase/cli/releases/download/v$version/supabase_linux_$arch.tar.gz" -o "$archive.download"
    mv "$archive.download" "$archive"
  fi
  if ! echo "$checksum  $archive" | sha256sum --check --status; then
    echo "Supabase archive checksum mismatch; refusing to execute it. Replace $archive from the official release." >&2
    exit 1
  fi
  # Extract only the verified executable, not arbitrary archive paths.
  tar -xzf "$archive" -C "$tool_dir" supabase
  "$tool_dir/supabase" --version
}
refresh_status() {
  "$tool_dir/supabase" status -o json > "$status_file" 2>> "$log_file"
  chmod 600 "$status_file" "$log_file"
}
case "${1:-start}" in
  install) install_cli ;;
  start)
    install_cli
    echo 'Starting isolated Supabase services; initial Docker image downloads can take several minutes.'
    if ! SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io "$tool_dir/supabase" start \
      --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor > "$log_file" 2>&1; then
      echo "Supabase startup failed. Inspect $log_file privately; it may contain local keys." >&2
      exit 1
    fi
    refresh_status
    GIANNO_LOCAL_STATUS="$status_file" node --input-type=module <<'JS'
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
const status=JSON.parse(readFileSync(process.env.GIANNO_LOCAL_STATUS,'utf8'));
if(!status.API_URL||!status.ANON_KEY) throw new Error('Local status does not contain API URL/public key.');
if(!['127.0.0.1','localhost'].includes(new URL(status.API_URL).hostname))throw new Error('Refusing nonlocal configuration.');
if(existsSync('.env.local')) console.log('Existing .env.local preserved.');
else { writeFileSync('.env.local',`# Isolated local development; no service-role key.\nNEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000\n`,{flag:'wx',mode:0o600});console.log('Created ignored .env.local with local URL and public key only.'); }
console.log('Local Supabase healthy. Authentication, REST and private Storage available.');
JS
    ;;
  status)
    if [ ! -x "$tool_dir/supabase" ]; then echo 'Supabase CLI not installed.' >&2; exit 1; fi
    refresh_status
    GIANNO_LOCAL_STATUS="$status_file" node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
const s=JSON.parse(readFileSync(process.env.GIANNO_LOCAL_STATUS,'utf8'));
console.log(JSON.stringify({localSupabaseReady:Boolean(s.API_URL&&s.ANON_KEY),credentials:'not displayed'}));
JS
    ;;
  stop)
    if [ ! -x "$tool_dir/supabase" ]; then echo 'Supabase CLI not installed.' >&2; exit 1; fi
    "$tool_dir/supabase" stop > "$log_file" 2>&1
    echo 'Local Supabase stopped; persistent local data retained.'
    ;;
  *) echo 'Usage: scripts/local-supabase.sh [install|start|status|stop]' >&2; exit 2 ;;
esac
