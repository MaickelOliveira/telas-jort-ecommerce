#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="${TELAS_JORT_PROJECT_DIR:-/opt/telas-jort}"
host_backup_dir="${TELAS_JORT_BACKUP_DIR:-/var/backups/telas-jort}"

if [[ ! -f "${project_dir}/docker-compose.yml" ]]; then
  echo "Projeto não encontrado em ${project_dir}." >&2
  exit 1
fi

install -d -m 700 "${host_backup_dir}"
cd "${project_dir}"
container_file="$(docker compose exec -T app node scripts/backup-database.mjs | tr -d '\r' | tail -n 1)"
case "${container_file}" in
  /app/data/backups/telas-jort-*.sqlite) ;;
  *) echo "O contêiner retornou um caminho de backup inesperado." >&2; exit 1 ;;
esac

filename="${container_file##*/}"
docker compose cp "app:${container_file}" "${host_backup_dir}/${filename}"
chmod 600 "${host_backup_dir}/${filename}"
find "${host_backup_dir}" -maxdepth 1 -type f -name 'telas-jort-*.sqlite' -mtime +30 -delete
echo "Backup copiado para ${host_backup_dir}/${filename}"
