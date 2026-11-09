# hodoostudio.github.io

Hodoo Studio 개발자 웹사이트. App Store · Google Play 등록정보의 개발자 웹사이트(마케팅 URL)로 쓴다.

- `app-ads.txt` — AdMob 앱 인증(판매자 인증) 한 줄
- `index.html` — 멍날씨 소개 페이지(Notion)로 넘겨준다
- `download/` — 멍날씨 받기 페이지. 들어오면 OS 를 보고 App Store(아이폰 · 아이패드) · Google Play(안드로이드)로 넘기고, 못 넘어가거나 그 밖의 기기면 두 스토어 배지가 남는다. `?c=<캠페인>` 은 App Store 캠페인 값(`ct`, 스크립트의 `PT` 를 넣어야 붙는다)과 Play `utm_campaign` 에, `?s=<출처>` 는 Play `utm_source`(없으면 instagram)에 붙는다 — 영문 · 숫자 · `._-` 40자까지
