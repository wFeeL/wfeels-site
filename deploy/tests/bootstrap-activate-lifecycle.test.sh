#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BOOTSTRAP_SCRIPT=$(cd -- "$SCRIPT_DIR/.." && pwd)/bootstrap-vps.sh

# Загружаем реальные функции скрипта, не вызывая его main.
# shellcheck disable=SC1090
bootstrap_copy=$(mktemp)
sed '$d' "$BOOTSTRAP_SCRIPT" > "$bootstrap_copy"
source "$bootstrap_copy"
rm -f -- "$bootstrap_copy"

require_root() { :; }
validate_settings() { :; }
# Адрес из документационного диапазона RFC 5737 (TEST-NET-3), а не боевой IP
# сервера: это заглушка подменённой функции, ей важен только формат. До правки
# 2026-08-26 здесь стоял реальный адрес VPS, и вместе с выходом каталога deploy/
# в публичный репозиторий он уехал бы наружу без всякой нужды.
primary_ipv4() { printf '203.0.113.10\n'; }
curl() { :; }
dns_has_ip() { :; }
caddy() { :; }

run_scenario() {
    local service_state=$1 expected=$2 log_file
    log_file=$(mktemp)

    systemctl() {
        if [[ $* == 'is-active --quiet caddy' ]]; then
            [[ $service_state == active ]]
            return
        fi
        if [[ $* == '--no-pager --full status caddy' ]]; then
            printf 'mock caddy status\n'
            return 0
        fi
        printf '%s\n' "$*" >> "$log_file"
    }

    activate >/dev/null

    local lifecycle
    lifecycle=$(grep -E '^(enable --now caddy|reload caddy)$' "$log_file" || true)
    rm -f -- "$log_file"

    if [[ $lifecycle != "$expected" ]]; then
        printf 'FAIL state=%s\nexpected: %s\nactual:   %s\n' \
            "$service_state" "$expected" "${lifecycle:-<empty>}" >&2
        return 1
    fi
    printf 'PASS state=%s action=%s\n' "$service_state" "$expected"
}

run_scenario inactive 'enable --now caddy'
run_scenario active 'reload caddy'
