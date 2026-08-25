# SEO: выпуск и дальнейшая работа

Дата проверки: 2026-08-25.

Этот файл разделяет то, что сайт делает сам, и действия владельца в поисковых
кабинетах. Sitemap помогает обнаружить страницы, но не гарантирует индексацию
или позиции.

## 1. Инварианты production-сборки

- Публичный origin: `https://wfeels.site`.
- Canonical, `hreflang`, Open Graph, Twitter Card и Schema.org используют
  только этот origin.
- `robots.txt` объявляет `https://wfeels.site/sitemap-index.xml`.
- В sitemap входят главные, каталог услуг, страницы услуг, каталог кейсов и
  страницы кейсов. Юридические и служебные страницы исключены.
- `/case-galleries.json` отдаётся с `X-Robots-Tag: noindex, nofollow`.
- URL с `/index.html` и лишним завершающим `/` перенаправляются на один
  канонический адрес.

## 2. Проверка после каждого выпуска

```bash
curl -fsSL https://wfeels.site/ | grep -F '<link rel="canonical" href="https://wfeels.site/">'
curl -fsSL https://wfeels.site/sitemap-index.xml | grep -F 'https://wfeels.site/sitemap-0.xml'
curl -fsSL https://wfeels.site/sitemap-0.xml | grep -F 'https://wfeels.site/services/website'
curl -fsSL https://wfeels.site/robots.txt | grep -F 'Sitemap: https://wfeels.site/sitemap-index.xml'
curl -fsSI https://wfeels.site/case-galleries.json | grep -i '^x-robots-tag: noindex, nofollow'
curl -fsSI https://wfeels.site/services/website/ | grep -E '^HTTP/|^location:'
curl -fsSI https://wfeels.site/net-takoy | grep -E '^HTTP/'
```

Ожидания: canonical найден; sitemap содержит только production origin;
JSON закрыт от индексации; адрес с завершающим `/` перенаправляется; неизвестный
адрес возвращает 404.

## 3. Google Search Console — действия владельца

1. Добавить Domain property `wfeels.site` и подтвердить владение через DNS TXT.
2. Отправить `https://wfeels.site/sitemap-index.xml` в разделе Sitemaps.
3. Через URL Inspection запросить первичный обход:
   - `/`;
   - `/services`;
   - `/services/website`;
   - `/services/telegram-bot`;
   - `/services/telegram-miniapp`;
   - `/cases`.
4. После появления данных проверять Pages, Core Web Vitals, HTTPS и Search
   results: запросы, показы, CTR и среднюю позицию.

Официальные инструкции:

- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl

## 4. Яндекс Вебмастер — действия владельца

1. Добавить `wfeels.site` и подтвердить права через DNS TXT.
2. Добавить `https://wfeels.site/sitemap-index.xml` в разделе «Файлы Sitemap».
3. Проверить важные страницы через «Проверку URL» и заказать переобход.
4. Контролировать исключённые страницы, диагностику сайта, поисковые запросы
   и региональность. Указывать Санкт-Петербург только как подтверждённый город
   исполнителя; не создавать фиктивные региональные страницы.

Официальная инструкция:

- https://yandex.ru/support/webmaster/ru/indexing-options/sitemap

## 5. Первые четыре недели

Раз в неделю фиксировать:

- сколько URL отправлено и сколько проиндексировано;
- какие страницы получают первые показы;
- запрос, показы, клики, CTR и среднюю позицию;
- ошибки обхода и canonical, Core Web Vitals;
- страницы с показами, но низким CTR — кандидаты на уточнение title/description;
- запросы на позициях 8–30 — кандидаты на усиление кейсом, FAQ и внутренними
  ссылками.

Не менять заголовки каждую неделю без данных: поисковику нужно время на обход,
а частые правки уничтожают базовую линию сравнения.

## 6. Следующий контентный цикл

Приоритет — существующие коммерческие страницы и доказательства, не общий блог:

1. Дополнять кейсы подтверждёнными решениями, ограничениями и изображениями.
2. Связывать каждую услугу с релевантным кейсом, а кейс — с услугой и формой.
3. После появления первых запросов выпускать материалы выбора:
   - Telegram-бот или Mini App;
   - из чего складывается стоимость Telegram-бота;
   - доставка заявок в CRM и Telegram без потерь;
   - что проверяет технический аудит сайта;
   - что фиксируется в договоре на разработку.
4. Получать честные внешние ссылки из профессиональных профилей, каталогов и
   публикаций. Не покупать массовые ссылки и не создавать страницы-клоны под
   города, где нет фактического присутствия.

## 7. Аналитика и персональные данные

Сторонняя поведенческая аналитика намеренно не добавлена этим выпуском. Перед
Google Analytics, Яндекс Метрикой, рекламными пикселями или session replay нужно
отдельно определить состав данных, правовое основание, сроки хранения, обновить
Политику и при необходимости механизм согласия. Search Console и Яндекс Вебмастер
можно подключить без внедрения браузерных трекеров на страницы.
