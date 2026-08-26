#!/usr/bin/env bash
set -Eeuo pipefail

# Подготовка Ubuntu VPS для wfeels.site.
#
# Скрипт намеренно разделяет подготовку и блокировку SSH:
#   sudo ./bootstrap-vps.sh prepare
#   # проверить НОВУЮ SSH-сессию под deploy
#   sudo ./bootstrap-vps.sh lockdown
#
# После запуска приложения и переноса DNS:
#   sudo ./bootstrap-vps.sh activate
#   sudo ./bootstrap-vps.sh verify

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SITE_DOMAIN="${SITE_DOMAIN:-wfeels.site}"
APP_UPSTREAM="${APP_UPSTREAM:-127.0.0.1:8088}"
SWAP_SIZE_MB="${SWAP_SIZE_MB:-1024}"

SSH_DROP_IN="/etc/ssh/sshd_config.d/00-wfeels-hardening.conf"
CADDYFILE="/etc/caddy/Caddyfile"
CADDY_SITE="/etc/caddy/sites-enabled/wfeels.caddy"

log() { printf '\n[+] %s\n' "$*"; }
warn() { printf '\n[!] %s\n' "$*" >&2; }
die() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

on_error() {
    local exit_code=$?
    printf '\n[ERROR] Строка %s, код %s. Исправь причину и запусти команду повторно.\n' \
        "${BASH_LINENO[0]}" "$exit_code" >&2
    exit "$exit_code"
}
trap on_error ERR

require_root() {
    [[ $EUID -eq 0 ]] || die "Запусти скрипт через sudo или из root-сессии."
}

require_ubuntu() {
    [[ -r /etc/os-release ]] || die "Не найден /etc/os-release."
    # shellcheck disable=SC1091
    . /etc/os-release
    [[ ${ID:-} == "ubuntu" ]] || die "Поддерживается только Ubuntu; обнаружено: ${ID:-unknown}."
    case "${VERSION_ID:-}" in
        22.04|24.04|26.04) ;;
        *) warn "Ubuntu ${VERSION_ID:-unknown} не проходила проверку этим скриптом." ;;
    esac
}

validate_settings() {
    local upstream_port
    [[ $DEPLOY_USER =~ ^[a-z_][a-z0-9_-]*$ ]] || die "Некорректный DEPLOY_USER: $DEPLOY_USER"
    [[ $SITE_DOMAIN =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Некорректный SITE_DOMAIN: $SITE_DOMAIN"
    [[ $APP_UPSTREAM =~ ^127\.0\.0\.1:[0-9]{1,5}$ ]] || die "APP_UPSTREAM обязан иметь вид 127.0.0.1:PORT."
    upstream_port=${APP_UPSTREAM##*:}
    (( upstream_port >= 1 && upstream_port <= 65535 )) || die "Некорректный порт APP_UPSTREAM: $upstream_port"
    [[ $SWAP_SIZE_MB =~ ^[0-9]+$ ]] || die "SWAP_SIZE_MB обязан быть целым числом."
    (( SWAP_SIZE_MB >= 256 && SWAP_SIZE_MB <= 8192 )) || die "SWAP_SIZE_MB обязан быть от 256 до 8192."
}

detect_ssh_port() {
    local detected=""

    if [[ -n ${SSH_CONNECTION:-} ]]; then
        detected=$(awk '{print $4}' <<<"$SSH_CONNECTION")
    fi
    if [[ -z $detected ]]; then
        detected=$(/usr/sbin/sshd -T 2>/dev/null | awk '$1 == "port" {print $2; exit}')
    fi

    [[ $detected =~ ^[0-9]+$ ]] || die "Не удалось определить порт SSH."
    (( detected >= 1 && detected <= 65535 )) || die "Некорректный порт SSH: $detected"
    printf '%s\n' "$detected"
}

backup_file() {
    local path=$1
    [[ -e $path ]] || return 0
    local stamp
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    cp -a -- "$path" "${path}.backup-${stamp}"
}

apt_install() {
    DEBIAN_FRONTEND=noninteractive apt-get \
        -o Dpkg::Options::="--force-confold" \
        install -y --no-install-recommends "$@"
}

install_base_packages() {
    log "Устанавливаю базовые пакеты без повторного apt upgrade"
    apt_install ca-certificates curl gnupg sudo ufw fail2ban unattended-upgrades \
        debian-keyring debian-archive-keyring apt-transport-https
}

copy_authorized_keys() {
    local target_home target_keys source_keys=""
    target_home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
    target_keys="$target_home/.ssh/authorized_keys"

    install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$target_home/.ssh"
    touch "$target_keys"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$target_keys"
    chmod 0600 "$target_keys"

    if [[ -s /root/.ssh/authorized_keys ]]; then
        source_keys=/root/.ssh/authorized_keys
    elif [[ -n ${SUDO_USER:-} && ${SUDO_USER:-} != root ]]; then
        local source_home
        source_home=$(getent passwd "$SUDO_USER" | cut -d: -f6)
        [[ -s "$source_home/.ssh/authorized_keys" ]] && source_keys="$source_home/.ssh/authorized_keys"
    fi

    if [[ -n $source_keys ]]; then
        while IFS= read -r key; do
            [[ -n $key ]] || continue
            grep -qxF -- "$key" "$target_keys" || printf '%s\n' "$key" >> "$target_keys"
        done < "$source_keys"
    fi

    [[ -s $target_keys ]] || die \
        "У $DEPLOY_USER нет SSH-ключа. Сначала добавь публичный ключ в $target_keys."
}

configure_user() {
    log "Создаю административного пользователя $DEPLOY_USER"
    if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
        adduser --disabled-password --gecos "" "$DEPLOY_USER"
    fi

    usermod -aG sudo "$DEPLOY_USER"
    printf '%s ALL=(ALL:ALL) NOPASSWD:ALL\n' "$DEPLOY_USER" \
        > "/etc/sudoers.d/90-$DEPLOY_USER"
    chmod 0440 "/etc/sudoers.d/90-$DEPLOY_USER"
    visudo -cf "/etc/sudoers.d/90-$DEPLOY_USER" >/dev/null
    copy_authorized_keys
}

configure_firewall() {
    local ssh_port=$1
    log "Включаю UFW: SSH $ssh_port/tcp, HTTP 80/tcp, HTTPS 443/tcp"
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow "$ssh_port/tcp" comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    ufw --force enable
}

configure_fail2ban() {
    local ssh_port=$1
    log "Настраиваю Fail2ban для SSH"
    install -d -m 0755 /etc/fail2ban/jail.d
    cat > /etc/fail2ban/jail.d/wfeels-sshd.local <<EOF
[sshd]
enabled = true
port = $ssh_port
backend = systemd
findtime = 10m
maxretry = 5
bantime = 1h
EOF
    systemctl enable --now fail2ban
    systemctl restart fail2ban
}

install_docker() {
    log "Устанавливаю Docker Engine из подписанного официального APT-репозитория"
    install -d -m 0755 /etc/apt/keyrings
    curl --proto '=https' --tlsv1.2 -fsSL \
        https://download.docker.com/linux/ubuntu/gpg \
        -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # shellcheck disable=SC1091
    . /etc/os-release
    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

    apt-get update
    apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    if [[ ! -e /etc/docker/daemon.json ]]; then
        install -d -m 0755 /etc/docker
        cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
    else
        warn "/etc/docker/daemon.json уже существует — не перезаписываю его."
    fi

    usermod -aG docker "$DEPLOY_USER"
    systemctl enable --now docker
    systemctl restart docker
}

install_caddy() {
    log "Устанавливаю Caddy из подписанного официального APT-репозитория"
    local key_tmp list_tmp
    key_tmp=$(mktemp)
    list_tmp=$(mktemp)

    curl --proto '=https' --tlsv1.2 -1fsSL \
        https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o "$key_tmp"
    gpg --batch --yes --dearmor \
        -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg "$key_tmp"

    curl --proto '=https' --tlsv1.2 -1fsSL \
        https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o "$list_tmp"
    install -m 0644 "$list_tmp" /etc/apt/sources.list.d/caddy-stable.list
    chmod a+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg

    apt-get update
    apt_install caddy
    rm -f -- "$key_tmp" "$list_tmp"
    systemctl disable --now caddy
}

write_caddy_config() {
    log "Записываю внешний Caddy: TLS -> $APP_UPSTREAM"
    install -d -m 0755 /etc/caddy/sites-enabled
    backup_file "$CADDYFILE"

    cat > "$CADDYFILE" <<'EOF'
{
	admin 127.0.0.1:2019
}

import /etc/caddy/sites-enabled/*.caddy
EOF

    cat > "$CADDY_SITE" <<EOF
www.$SITE_DOMAIN {
	redir https://$SITE_DOMAIN{uri} permanent
}

$SITE_DOMAIN {
	encode zstd gzip
	reverse_proxy $APP_UPSTREAM {
		transport http {
			dial_timeout 3s
			response_header_timeout 30s
		}
	}
}
EOF

    chown root:caddy "$CADDYFILE" "$CADDY_SITE"
    chmod 0644 "$CADDYFILE" "$CADDY_SITE"
    caddy validate --config "$CADDYFILE" --adapter caddyfile

    warn "Caddy установлен, но пока остановлен: сначала приложение и DNS, затем команда activate."
}

configure_auto_updates() {
    log "Включаю автоматические обновления безопасности без автоперезагрузки"
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
    cat > /etc/apt/apt.conf.d/52wfeels-unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
EOF
    systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
}

configure_swap() {
    if swapon --show=NAME --noheadings | grep -q .; then
        log "Swap уже настроен — новый swapfile не создаю"
    else
        log "Создаю ${SWAP_SIZE_MB} МБ swap для VPS с 1 ГБ RAM"
        if [[ ! -e /swapfile ]]; then
            if ! fallocate -l "${SWAP_SIZE_MB}M" /swapfile; then
                dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_SIZE_MB" status=progress
            fi
        fi
        chmod 0600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        grep -qF '/swapfile none swap sw 0 0' /etc/fstab || \
            printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
    fi

    cat > /etc/sysctl.d/99-wfeels-memory.conf <<'EOF'
vm.swappiness=10
EOF
    sysctl --system >/dev/null
}

install_motd() {
    log "Устанавливаю компактный MOTD без сетевых запросов"
    cat > /etc/update-motd.d/99-wfeels-status <<'MOTD'
#!/usr/bin/env bash

host=$(hostname)
uptime_text=$(uptime -p 2>/dev/null || true)
load=$(awk '{print $1, $2, $3}' /proc/loadavg 2>/dev/null || true)
ram=$(free -h | awk '/^Mem:/ {print $3 " / " $2}')
swap=$(free -h | awk '/^Swap:/ {print $3 " / " $2}')
disk=$(df -h / | awk 'NR == 2 {print $3 " / " $2 " (" $5 ")"}')

docker_state="not installed"
docker_containers="-"
if command -v docker >/dev/null 2>&1; then
    docker_state=$(systemctl is-active docker 2>/dev/null || true)
    docker_containers=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
fi
caddy_state=$(systemctl is-active caddy 2>/dev/null || true)

printf '\n=== %s / wfeels.site ===\n' "$host"
printf 'Uptime:  %s\n' "$uptime_text"
printf 'Load:    %s\n' "$load"
printf 'RAM:     %s\n' "$ram"
printf 'Swap:    %s\n' "$swap"
printf 'Disk:    %s\n' "$disk"
printf 'Docker:  %s, running containers: %s\n' "$docker_state" "$docker_containers"
printf 'Caddy:   %s\n' "${caddy_state:-inactive}"
printf '=============================\n\n'
MOTD
    chmod 0755 /etc/update-motd.d/99-wfeels-status
}

prepare() {
    require_root
    require_ubuntu
    validate_settings
    local ssh_port
    ssh_port=$(detect_ssh_port)

    install_base_packages
    configure_user
    configure_firewall "$ssh_port"
    configure_fail2ban "$ssh_port"
    install_docker
    install_caddy
    write_caddy_config
    configure_auto_updates
    configure_swap
    install_motd

    log "Подготовка завершена"
    printf '%s\n' \
        "1. НЕ закрывай текущую root-сессию." \
        "2. В другом терминале проверь: ssh $DEPLOY_USER@SERVER_IP" \
        "3. Только после успешного входа: sudo $0 lockdown" \
        "4. Caddy будет включён позже командой: sudo $0 activate"
}

restore_ssh_drop_in() {
    local backup_path=$1
    if [[ -n $backup_path && -f $backup_path ]]; then
        cp -a "$backup_path" "$SSH_DROP_IN"
    else
        rm -f "$SSH_DROP_IN"
    fi
    /usr/sbin/sshd -t || warn "После отката sshd_config всё ещё не проходит проверку. Не закрывай текущую сессию."
}

lockdown() {
    require_root
    require_ubuntu
    validate_settings

    local target_home target_keys answer backup_path=""
    target_home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
    target_keys="$target_home/.ssh/authorized_keys"
    [[ -s $target_keys ]] || die "У $DEPLOY_USER нет authorized_keys; SSH не блокирую."
    grep -qE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' \
        /etc/ssh/sshd_config || die "sshd_config не подключает drop-in файлы; SSH не изменён."

    printf '\nПроверь во ВТОРОМ терминале вход: ssh %s@SERVER_IP\n' "$DEPLOY_USER"
    read -r -p "Если вход успешен, введи LOCKDOWN: " answer
    [[ $answer == "LOCKDOWN" ]] || die "Отмена: SSH-конфигурация не изменена."

    if [[ -e $SSH_DROP_IN ]]; then
        backup_path="${SSH_DROP_IN}.pre-lockdown"
        cp -a "$SSH_DROP_IN" "$backup_path"
    fi

    cat > "$SSH_DROP_IN" <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF
    chmod 0644 "$SSH_DROP_IN"

    if ! /usr/sbin/sshd -t; then
        restore_ssh_drop_in "$backup_path"
        die "Новая SSH-конфигурация невалидна и была отменена."
    fi

    local effective
    effective=$(/usr/sbin/sshd -T -C "user=$DEPLOY_USER,host=localhost,addr=127.0.0.1")
    grep -q '^passwordauthentication no$' <<<"$effective" || {
        restore_ssh_drop_in "$backup_path"
        die "PasswordAuthentication фактически не отключилась; конфигурация отменена."
    }
    grep -q '^pubkeyauthentication yes$' <<<"$effective" || {
        restore_ssh_drop_in "$backup_path"
        die "PubkeyAuthentication фактически не включилась; конфигурация отменена."
    }
    grep -q '^permitrootlogin no$' <<<"$effective" || {
        restore_ssh_drop_in "$backup_path"
        die "PermitRootLogin фактически не отключился; конфигурация отменена."
    }
    grep -q '^kbdinteractiveauthentication no$' <<<"$effective" || {
        restore_ssh_drop_in "$backup_path"
        die "KbdInteractiveAuthentication фактически не отключилась; конфигурация отменена."
    }
    grep -q '^authenticationmethods publickey$' <<<"$effective" || {
        restore_ssh_drop_in "$backup_path"
        die "AuthenticationMethods фактически не ограничен publickey; конфигурация отменена."
    }

    systemctl reload ssh
    log "Root-вход и парольная аутентификация отключены"
    printf 'Аварийный откат из ТЕКУЩЕЙ root-сессии:\n'
    printf 'rm -f %q && systemctl reload ssh\n' "$SSH_DROP_IN"
}

primary_ipv4() {
    ip -4 -o addr show scope global \
        | awk '$2 !~ /^(docker|br-|veth)/ {split($4, parts, "/"); print parts[1]; exit}'
}

dns_has_ip() {
    local name=$1 expected=$2
    getent ahostsv4 "$name" 2>/dev/null \
        | awk '{print $1}' \
        | grep -qxF "$expected"
}

activate() {
    require_root
    validate_settings

    local server_ip
    server_ip=$(primary_ipv4)
    [[ -n $server_ip ]] || die "Не удалось определить публичный IPv4 VPS."

    curl -fsS -o /dev/null -H "Host: $SITE_DOMAIN" \
        "http://$APP_UPSTREAM/" || die "Приложение не отвечает на http://$APP_UPSTREAM/."
    curl -fsS -o /dev/null -H "Host: $SITE_DOMAIN" \
        "http://$APP_UPSTREAM/api/health" || die "API healthcheck не отвечает через внутренний Caddy."

    dns_has_ip "$SITE_DOMAIN" "$server_ip" || \
        die "DNS A для $SITE_DOMAIN ещё не указывает на $server_ip."
    dns_has_ip "www.$SITE_DOMAIN" "$server_ip" || \
        die "DNS A для www.$SITE_DOMAIN ещё не указывает на $server_ip."

    caddy validate --config "$CADDYFILE" --adapter caddyfile
    if systemctl is-active --quiet caddy; then
        # При повторном запуске перечитываем конфигурацию без остановки сервиса.
        systemctl reload caddy
    else
        # Первый start уже загружает актуальный Caddyfile. Немедленный reload здесь
        # отменяет начавшийся ACME-запрос и оставляет в журнале context canceled.
        systemctl enable --now caddy
    fi

    log "Caddy включён; он запросит TLS-сертификаты автоматически"
    systemctl --no-pager --full status caddy | sed -n '1,18p'
}

verify() {
    require_root
    validate_settings

    printf '\n=== Проверка VPS ===\n'
    printf 'User %-12s: ' "$DEPLOY_USER"
    if id "$DEPLOY_USER" >/dev/null 2>&1; then echo OK; else echo FAIL; fi

    printf 'SSH key          : '
    local target_home
    target_home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
    if [[ -s "$target_home/.ssh/authorized_keys" ]]; then echo OK; else echo FAIL; fi

    printf 'SSH lockdown     : '
    if [[ -f $SSH_DROP_IN ]]; then echo enabled; else echo pending; fi

    printf 'UFW              : %s\n' "$(ufw status | awk 'NR == 1 {print $2}')"
    printf 'Fail2ban         : %s\n' "$(systemctl is-active fail2ban 2>/dev/null || true)"
    printf 'Docker           : %s\n' "$(systemctl is-active docker 2>/dev/null || true)"
    printf 'Docker Compose   : %s\n' "$(docker compose version --short 2>/dev/null || echo unavailable)"
    printf 'Caddy            : %s\n' "$(systemctl is-active caddy 2>/dev/null || true)"
    printf 'Swap             : %s\n' "$(swapon --show=SIZE --noheadings | xargs || true)"
    printf 'Auto updates     : %s\n' "$(systemctl is-enabled apt-daily-upgrade.timer 2>/dev/null || true)"
    printf 'Backend %s: ' "$APP_UPSTREAM"
    if curl -fsS -o /dev/null -H "Host: $SITE_DOMAIN" "http://$APP_UPSTREAM/"; then
        echo OK
    else
        echo pending
    fi
    printf '=====================\n'
}

usage() {
    cat <<EOF
Использование: sudo $0 COMMAND

Команды:
  prepare   Настроить user, UFW, Fail2ban, Docker, Caddy, updates, swap и MOTD.
            Не отключает root/password SSH и не запускает публичный Caddy.
  lockdown  После проверки входа под $DEPLOY_USER отключить root/password SSH.
  activate  После запуска приложения и переноса DNS включить Caddy и HTTPS.
  verify    Показать состояние всех компонентов.

Переменные: DEPLOY_USER, SITE_DOMAIN, APP_UPSTREAM, SWAP_SIZE_MB.
EOF
}

main() {
    case "${1:-}" in
        prepare) prepare ;;
        lockdown) lockdown ;;
        activate) activate ;;
        verify) verify ;;
        -h|--help|help|"") usage ;;
        *) die "Неизвестная команда: $1" ;;
    esac
}

main "$@"
