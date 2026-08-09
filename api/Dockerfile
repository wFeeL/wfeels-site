FROM python:3.14-slim

WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN useradd --system --uid 1001 wfeels

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Код копируется владением root и читается процессом только на чтение.
# `chown -R wfeels /srv` отдавал бы приложению право переписать собственный код:
# пробой в приложении тогда превращается в закрепление, а ради этого запуск не
# от root и делается. Права на запись не выдаются нигде: приложение ничего не
# пишет на диск — заявка уходит в Telegram, состояние лимитера живёт в памяти.
COPY app ./app

USER wfeels

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
