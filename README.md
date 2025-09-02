## 🤖 Google Apps Script를 활용한 블로그 자동 포스팅 README

이 프로젝트는 Google Apps Script를 사용하여 영화진흥위원회(KOBIS) API에서 주간 박스오피스 데이터를 자동으로 가져오고, Gemini AI 모델을 통해 블로그 포스팅을 생성한 후, Blogger.com에 자동으로 업로드하는 일련의 과정을 자동화합니다.

---

### ✨ 주요 기능

* **🎬 KOBIS API 데이터 수집**: 지난주 주간 박스오피스 및 이번 주 개봉 예정 영화 정보를 KOBIS API로 조회하여 Google 스프레드시트에 저장합니다.
* **✍️ Gemini AI 기반 포스팅 생성**: 스프레드시트의 데이터를 활용하여 프롬프트를 작성하고, Gemini 2.5 Flash 모델로 블로그 포스팅을 자동으로 생성합니다.
* **📝 Blogger.com 업로드**: 생성된 포스팅 내용을 HTML로 변환하여 Blogger 블로그에 자동으로 게시합니다.
* **🗓️ 주간 자동화**: 매주 정해진 요일과 시간에 전체 과정을 자동으로 실행하도록 설정할 수 있습니다.

---

### ⚙️ 설정 방법 및 스크립트 설명

#### 1. 필수 API 키 및 ID 설정

스크립트가 정상적으로 작동하려면 다음의 API 키와 블로그 ID를 설정해야 합니다.

1.  **KOBIS API 키**: 영화진흥위원회 오픈API 서비스에서 발급받아 `getKOBISdata.gs` 파일에 있는 `KOBIS_API_KEY` 변수에 직접 입력하거나, 스크립트 속성(Script properties)에 `KOBIS_API_KEY`로 등록합니다.
2.  **Gemini API 키**: Google AI Studio에서 발급받아 `makeReport.gs` 파일에 있는 `GEMINI_API_KEY` 변수에 직접 입력하거나, 스크립트 속성(Script properties)에 `GEMINI_API_KEY`로 등록합니다.
3.  **Blogger ID**: `updateBlog.gs` 파일에 있는 `BLOG_ID` 변수에 본인의 블로그 ID를 입력합니다.

#### 2. 스크립트 파일별 역할

* **`getKOBISdata.gs`**:
    * **함수**: `getKOBISdata()`
    * **역할**: KOBIS API를 호출하여 주간 박스오피스 데이터와 개봉 예정 영화 목록 데이터를 가져옵니다.
    * **결과 시트**:
        * **WeeklyBoxoffice**: 주간 박스오피스 데이터 저장
        * **MovieList**: 개봉 예정 영화 목록 저장
* **`makeReport.gs`**:
    * **함수**: `generateWeeklyReport()`
    * **역할**: `WeeklyBoxoffice`와 `MovieList` 시트의 데이터를 바탕으로 Gemini AI 모델용 프롬프트를 작성하고, 포스팅 내용을 생성합니다. **최대 토큰 크기 문제 해결을 위해** 포스팅을 `지난주 주간 박스오피스 분석`과 `이번주 새로 개봉하는 영화`의 두 파트로 나누어 생성한 후 하나로 합칩니다.
    * **결과 시트**:
        * **Prompt**: 생성에 사용된 프롬프트 저장
        * **Report**: 최종 생성된 포스팅 내용 저장
* **`updateBlog.gs`**:
    * **함수**: `uploadLatestReportToBlog()`
    * **역할**: `Report` 시트에 저장된 포스팅 내용을 HTML로 변환하여 Blogger.com에 게시합니다.

---

### 🚀 사용법

#### 1. OAuth 권한 설정

`updateBlog.gs` 파일에 있는 `setupOAuthPermissions_()` 함수를 실행하여 필요한 OAuth 권한을 승인합니다.

#### 2. 트리거 설정 (자동화)

매주 자동으로 포스팅이 업로드되도록 Google Apps Script의 `트리거` 메뉴에서 다음을 설정합니다.

* **실행할 함수 선택**: `getKOBISdata`, `generateWeeklyReport`, `uploadLatestReportToBlog`를 순차적으로 실행하는 **래퍼(Wrapper) 함수**를 만들어서 트리거를 설정하거나, 각 함수에 대해 순차적인 트리거를 설정합니다.
* **실행 방식**: `시간 기반 트리거`
* **실행 시간**: `주간 타이머`, `매주 월요일`, `오전 시간대` 등으로 설정하여 원하는 시간에 자동 실행되도록 합니다.

이러한 설정을 완료하면 매주 월요일 아침에 자동으로 영화 관련 블로그 포스팅이 업로드됩니다.
