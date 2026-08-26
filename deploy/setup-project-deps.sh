#!/usr/bin/env bash
set -Eeuo pipefail

# Системные и JavaScript-зависимости для сборки wfeels.site на Ubuntu VPS.
# Запускать обычным пользователем deploy, а не через sudo:
#   ./deploy/setup-project-deps.sh
#   ./deploy/setup-project-deps.sh --with-e2e  # дополнительно Chromium для Playwright

NODE_VERSION="${NODE_VERSION:-24.19.0}"
WITH_E2E=false
TEMP_DIR=""

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd)
WEB_DIR="$PROJECT_ROOT/web"

log() { printf '\n[+] %s\n' "$*"; }
warn() { printf '\n[!] %s\n' "$*" >&2; }
die() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

cleanup() {
    [[ -n ${TEMP_DIR:-} && -d $TEMP_DIR ]] || return 0
    rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

usage() {
    cat <<EOF
Использование: $0 [--with-e2e]

Без параметров:
  - устанавливает системные инструменты сборки;
  - устанавливает Node.js $NODE_VERSION LTS из официального архива;
  - проверяет Docker и Docker Compose;
  - выполняет npm ci по package-lock.json.

--with-e2e дополнительно устанавливает системные библиотеки и Chromium для
Playwright. Для обычной сборки и публикации сайта браузер не нужен.

Переменная NODE_VERSION позволяет явно выбрать другую версию Node.js.
EOF
}

parse_args() {
    case "${1:-}" in
        "") ;;
        --with-e2e) WITH_E2E=true ;;
        -h|--help|help) usage; exit 0 ;;
        *) die "Неизвестный параметр: $1" ;;
    esac
    [[ $# -le 1 ]] || die "Допустим только один параметр: --with-e2e."
    [[ $NODE_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Некорректный NODE_VERSION: $NODE_VERSION"
}

require_deploy_user() {
    (( EUID != 0 )) || die "Не запускай скрипт через sudo. Запусти его пользователем deploy."
    command -v sudo >/dev/null 2>&1 || die "Не найден sudo."
    sudo -n true 2>/dev/null || die "Пользователь $(id -un) не может выполнить sudo без запроса пароля."
}

require_ubuntu() {
    [[ -r /etc/os-release ]] || die "Не найден /etc/os-release."
    # shellcheck disable=SC1091
    . /etc/os-release
    [[ ${ID:-} == ubuntu ]] || die "Скрипт рассчитан на Ubuntu; обнаружено: ${ID:-unknown}."
}

check_project() {
    [[ -f "$WEB_DIR/package.json" ]] || die "Не найден $WEB_DIR/package.json."
    [[ -f "$WEB_DIR/package-lock.json" ]] || die "Не найден $WEB_DIR/package-lock.json."
    [[ -f "$PROJECT_ROOT/api/Dockerfile" ]] || die "Не найден api/Dockerfile."
    [[ -f "$PROJECT_ROOT/deploy/docker-compose.yml" ]] || die "Не найден deploy/docker-compose.yml."

    local available_kb
    available_kb=$(df -Pk "$PROJECT_ROOT" | awk 'NR == 2 {print $4}')
    (( available_kb >= 2 * 1024 * 1024 )) || die "Для установки нужно минимум 2 ГБ свободного места."

    local ram_kb swap_kb
    ram_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
    swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
    if (( ram_kb < 1500 * 1024 && swap_kb == 0 )); then
        die "На VPS меньше 1,5 ГБ RAM и нет swap. Сначала выполни bootstrap-vps.sh prepare."
    fi
}

install_system_packages() {
    log "Устанавливаю системные инструменты сборки"
    sudo apt-get update
    sudo env DEBIAN_FRONTEND=noninteractive apt-get \
        -o Dpkg::Options::="--force-confold" \
        install -y --no-install-recommends \
        build-essential ca-certificates curl git pkg-config python3 rsync time xz-utils
}

node_architecture() {
    case "$(dpkg --print-architecture)" in
        amd64) printf 'x64\n' ;;
        arm64) printf 'arm64\n' ;;
        *) die "Нет готовой схемы установки Node.js для архитектуры $(dpkg --print-architecture)." ;;
    esac
}

install_node() {
    local node_arch archive release_url expected_hash install_dir
    node_arch=$(node_architecture)
    archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
    release_url="https://nodejs.org/download/release/v${NODE_VERSION}"
    install_dir="/opt/nodejs/node-v${NODE_VERSION}-linux-${node_arch}"
    TEMP_DIR=$(mktemp -d)

    if [[ ! -x "$install_dir/bin/node" ]]; then
        log "Загружаю официальный Node.js v$NODE_VERSION для $node_arch"
        curl --proto '=https' --tlsv1.2 -fsSLo "$TEMP_DIR/$archive" \
            "$release_url/$archive"
        curl --proto '=https' --tlsv1.2 -fsSLo "$TEMP_DIR/SHASUMS256.txt" \
            "$release_url/SHASUMS256.txt"

        expected_hash=$(awk -v file="$archive" '$2 == file {print $1}' \
            "$TEMP_DIR/SHASUMS256.txt")
        [[ $expected_hash =~ ^[a-f0-9]{64}$ ]] || die "Не найден SHA-256 для $archive."
        (
            cd "$TEMP_DIR"
            printf '%s  %s\n' "$expected_hash" "$archive" | sha256sum --check --strict
            tar -xJf "$archive"
        )

        sudo install -d -m 0755 /opt/nodejs
        [[ ! -e $install_dir ]] || die "$install_dir уже существует, но Node.js в нём повреждён."
        sudo cp -a "$TEMP_DIR/node-v${NODE_VERSION}-linux-${node_arch}" "$install_dir"
        sudo chown -R root:root "$install_dir"
    else
        log "Node.js v$NODE_VERSION уже установлен"
    fi

    local command
    for command in node npm npx corepack; do
        if [[ -x "$install_dir/bin/$command" ]]; then
            if [[ -e "/usr/local/bin/$command" && ! -L "/usr/local/bin/$command" ]]; then
                die "/usr/local/bin/$command уже существует и не является ссылкой; не перезаписываю его."
            fi
            sudo ln -sfn "$install_dir/bin/$command" "/usr/local/bin/$command"
        fi
    done
    hash -r

    [[ $(node --version) == "v$NODE_VERSION" ]] || die "Активировалась неожиданная версия: $(node --version)."
    printf 'Node.js: %s\n' "$(node --version)"
    printf 'npm:     %s\n' "$(npm --version)"
}

check_docker() {
    log "Проверяю Docker"
    command -v docker >/dev/null 2>&1 || die "Docker не установлен. Сначала выполни bootstrap-vps.sh prepare."
    docker compose version >/dev/null 2>&1 || die "Не найден Docker Compose plugin."
    if ! docker info >/dev/null 2>&1; then
        die "Нет доступа к Docker daemon. Переподключись по SSH, чтобы применилась группа docker."
    fi
    printf 'Docker:         %s\n' "$(docker --version)"
    printf 'Docker Compose: %s\n' "$(docker compose version --short)"
}

install_javascript_dependencies() {
    log "Устанавливаю зависимости web строго по package-lock.json"
    cd "$WEB_DIR"
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
        npm_config_jobs="${NPM_JOBS:-1}" \
        npm ci --include=dev --no-audit --no-fund

    [[ -x node_modules/.bin/astro ]] || die "После npm ci не найден Astro."
    printf 'Astro: %s\n' "$(node_modules/.bin/astro --version)"
}

install_e2e_browser() {
    $WITH_E2E || return 0
    log "Устанавливаю Chromium и системные библиотеки Playwright"
    cd "$WEB_DIR"
    npx playwright install --with-deps chromium
}

show_next_steps() {
    cat <<EOF

[+] Зависимости проекта готовы.

Измерить чистое время production-сборки:

  cd $WEB_DIR
  /usr/bin/time -f $'Время: %E\\nМакс. RAM: %M КБ' env SITE_URL=https://wfeels.site npm run build

Затем проверить сборку и поднять контейнеры:

  npm run check:budget
  cd $PROJECT_ROOT/deploy
  docker compose config --quiet
  docker compose up --build -d
EOF
}

main() {
    parse_args "$@"
    require_deploy_user
    require_ubuntu
    check_project
    install_system_packages
    install_node
    check_docker
    install_javascript_dependencies
    install_e2e_browser
    show_next_steps
}

main "$@"
