// -----------------------------------------------------------------------------
// 설정 변수 (사용자 환경에 맞게 수정해주세요)
// -----------------------------------------------------------------------------

/**
 * GEMINI API 키를 입력하세요.
 * @type {string}
 */
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); 
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * 메인 함수: 주간 박스오피스 리포트 생성 (최종 분리 버전)
 */
function generateWeeklyReport() {

  try {
    // 스프레드시트와 시트 가져오기
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log("Read Sheets.");
    const boxofficeSheet = ss.getSheetByName("WeeklyBoxoffice");
    const movieListSheet = ss.getSheetByName("MovieList");
    const promptSheet = ss.getSheetByName("Prompt");
    const reportSheet = ss.getSheetByName("Report") || createReportSheet(ss);

    // 데이터 가져오기
    // console.log("get data from WeeklyBoxoffice sheet");
    const boxofficeData = getBoxofficeData_(boxofficeSheet);
    // console.log("get data from MovieList sheet");
    const upcomingMovies = getUpcomingMovies_(movieListSheet);

    // 1. TOP 10 분석 파트 생성
    const top10Prompt = createTop10AnalysisPrompt_(boxofficeData);
    // 프롬프트 기록
    saveReport_(promptSheet, `--- TOP 10 프롬프트 ---\n\n${top10Prompt}`); 
    // 리포트 전반부 (오프닝과 지난주 박스 오피스 TOP 10) 생성
    const top10ReportPart = generateReportWithGemini_(top10Prompt);
    
    // 2. 도입부 및 개봉작 파트 생성
    const trendAndUpcomingPrompt = createTrendAndUpcomingPrompt_(upcomingMovies);
    // 프롬프트 기록
    saveReport_(promptSheet, `--- 이번주 개봉작 프롬프트 ---\n\n${trendAndUpcomingPrompt}`); 
    // 리포트 후반부 (이번주 개봉작과 클로징) 생성
    const trendAndUpcomingReportPart = generateReportWithGemini_(trendAndUpcomingPrompt);

    // 3. 두 파트를 합쳐서 최종 리포트 완성
    const finalReport = top10ReportPart.replace(
      '## 🎟️ 이번 주, 당신의 티켓은?', 
      trendAndUpcomingReportPart
    ); 

    // 리포트 저장
    saveReport_(reportSheet, finalReport);
    
    // 성공 메시지
    // SpreadsheetApp.getUi().alert('주간 박스오피스 리포트가 성공적으로 생성되었습니다!');

  } catch (error) {
    console.error('리포트 생성 중 오류 발생:', error);
    // SpreadsheetApp.getUi().alert('오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * AI 프롬프트 생성 리포트 전반부 (오프닝, 주간 박스 오피스 TOP 10)
 */
function createTop10AnalysisPrompt_(boxofficeData) {
  const prompt = `
**[역할]**
당신은 20년 경력의 영화 전문 기자이자, 독자의 마음을 사로잡는 글쓰기 전문가입니다.

**[작성 목표]**
아래 입력된 박스오피스 TOP 10 데이터를 바탕으로, 각 영화에 대한 전문적이고 매력적인 분석을 마크다운 형식으로 작성해주세요.

**[글쓰기 원칙]**
* **데이터에 감성 입히기**: '누적 관객수 00명'에 '00만 관객의 마음을 훔친'과 같이 감성과 의미를 부여해주세요.
* **스토리텔링**: 데이터를 하나의 흥미로운 이야기로 엮어서 설명해주세요.
* **깊이 있는 분석**: 각 영화의 흥행 요인, 관객 반응, 비하인드 스토리(TMI) 등을 풍부하게 담아주세요.

**[콘텐츠 구성 및 마크다운 형식]**
# 📽️ [YYYY년 MM월 N주차] 박스오피스 분석: [이번 주 극장가의 가장 흥미로운 현상을 담은 헤드라인]

## 📈 뜨거웠던 극장가, 승자는 누구?
[단순 요약이 아닌, 'A와 B의 격돌', '새로운 강자의 등장' 등 하나의 이야기처럼 지난 주 박스오피스 트렌드를 흥미롭게 묘사]

## 🏆 TOP 10, 관객의 선택을 받은 영화들
### **[순위]. [영화 제목]**
    * **📅개봉일:** [개봉일 ('2025년 8월 6일' 포맷)]  **📈관객수:** 지난주 [주간 관객수, 만명 단위] 명, 누적 [누적 관객수, 만명 단위] 명
    * **🎥감독:** [감독의 이름] **👥출연진:** [출연 배우들의 이름]
    [영화의 핵심 매력, 관람 포인트, 아쉬운 점 등을 솔직하고 깊이 있게 분석. 실제 관객 반응(SNS, 커뮤니티 등)을 인용하여 생동감을 더하고, 전문적인 식견을 바탕으로 흥행 요인을 설명]

---
## 🎟️ 이번 주, 당신의 티켓은?

---
**[입력 데이터]**
* **주간 박스오피스 TOP 10 목록**:
\`\`\`json
${JSON.stringify({ movies: boxofficeData }, null, 2)}
\`\`\`

위 데이터를 바탕으로, 리포트의 도입부(헤드라인, 오프닝)와 TOP 10 영화 분석 파트를 완성해주세요.
`;
  return prompt;
}

/**
 * AI 프롬프트 생성 2: 리포트 후반부 (개봉작, 클로징)
 */
function createTrendAndUpcomingPrompt_(upcomingMovies) {
  const prompt = `
**[역할]**
당신은 20년 경력의 영화 전문 기자이자, 트렌드 분석가입니다.

**[작성 목표]**
다가오는 개봉작 정보와 극장가의 전반적인 트렌드를 분석하여, 독자들의 영화 선택을 돕는 가이드 글을 마크다운 형식으로 작성해주세요.

**[글쓰기 원칙]**
* **인사이트 제공**: 개봉작들을 비교 분석하거나, 특정 트렌드와 연결하여 독자에게 새로운 시각을 제공해주세요.
* **기대감 조성**: 독자들이 영화를 보고 싶게 만드는 매력적인 표현을 사용해주세요.

**[콘텐츠 구성 및 마크다운 형식]**
## 🎟️ 이번 주, 당신의 티켓은? (개봉 예정작)

### **[영화 제목]** - [기대감을 한껏 끌어올리는 짧은 태그라인]
    * **📅개봉일:** [개봉일 ('2025년 8월 6일' 포맷)]
    * **🎥감독:** [감독의 이름] **👥출연진:** [출연 배우들의 이름]
    * **체크 포인트:** [이 영화를 '반드시 극장에서 봐야 하는' 혹은 '이런 점은 고려해야 하는' 이유를 명확하게 제시. (예: '믿고 보는 OOO 감독의 신작', '호불호가 갈릴 수 있는 파격적 소재')]
    * **이런 분께 추천해요!:** [타겟 관객층을 구체적으로 명시하여 독자의 영화 선택을 도움]

[다음 주 리포트를 기대하게 만들고, 영화에 대한 여운을 남기는 클로징 멘트]

---
**[입력 데이터]**
* **이번 주 개봉 예정 영화 목록**:
\`\`\`json
${JSON.stringify({ upcoming: upcomingMovies }, null, 2)}
\`\`\`

위 데이터를 바탕으로, 리포트의 후반부(개봉 예정작, 클로징)를 완성해주세요.
`;
  return prompt;
}
/**
 * 박스오피스 데이터 가져오기 (최신 10개)
 */
function getBoxofficeData_(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const totalRows = data.length;

  // 가장 아래쪽 10개 데이터 가져오기 (최신 데이터)
  const startRow = Math.max(1, totalRows - 10); // 헤더 제외하고 마지막 10개
  const movies = [];

  // 필요한 컬럼 인덱스 찾기
  const columnIndexes = {
    movieNm: headers.indexOf('movieNm'),
    movieNmEn: headers.indexOf('movieNmEn'),
    rank: headers.indexOf('rank'),
    openDt: headers.indexOf('openDt'),
    audiCnt: headers.indexOf('audiCnt'),
    audiAcc: headers.indexOf('audiAcc'),
    directors: headers.indexOf('directors'),
    actors: headers.indexOf('actors'),
    showTm: headers.indexOf('showTm')
  };

  // 인덱스 유효성 검사
  for (let key in columnIndexes) {
    if (columnIndexes[key] === -1) {
      console.error(`컬럼 '${key}'를 찾을 수 없습니다.`);
    }
  }

  // 최신 10개 데이터 추출
  for (let i = startRow; i < totalRows; i++) {
    const movie = {
      movieNm: data[i][columnIndexes.movieNm] || '',
      movieNmEn: data[i][columnIndexes.movieNmEn] || '',
      rank: data[i][columnIndexes.rank] || '',
      openDt: '', // 초기화
      audiCnt: data[i][columnIndexes.audiCnt] || '',
      audiAcc: data[i][columnIndexes.audiAcc] || '',
      directors: data[i][columnIndexes.directors] || '',
      actors: data[i][columnIndexes.actors] || '',
      showTm: data[i][columnIndexes.showTm] || ''
    };
    
    // openDt를 "yyyy-mm-dd" 포맷으로 변환
    if (columnIndexes.openDt !== -1 && data[i][columnIndexes.openDt]) {
      const openDate = new Date(data[i][columnIndexes.openDt]);
      if (!isNaN(openDate.getTime())) { // 유효한 날짜인지 확인
        const year = openDate.getFullYear();
        const month = String(openDate.getMonth() + 1).padStart(2, '0');
        const day = String(openDate.getDate()).padStart(2, '0');
        movie.openDt = `${year}-${month}-${day}`;
      } else {
        console.error(`날짜 데이터 변환 오류: ${data[i][columnIndexes.openDt]}`);
      }
    }

    movies.push(movie);
  }

  // 랭크 순으로 정렬 (1위부터 10위까지)
  movies.sort((a, b) => parseInt(a.rank) - parseInt(b.rank));

  return movies;
}

/**
 * 박스오피스 데이터 가져오기 (최신 10개)
 */
function getBoxofficeData_(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const totalRows = data.length;

  // 가장 아래쪽 10개 데이터 가져오기 (최신 데이터)
  const startRow = Math.max(1, totalRows - 10); // 헤더 제외하고 마지막 10개
  const movies = [];

  // 필요한 컬럼 인덱스 찾기
  const columnIndexes = {
    movieNm: headers.indexOf('movieNm'),
    movieNmEn: headers.indexOf('movieNmEn'),
    rank: headers.indexOf('rank'),
    openDt: headers.indexOf('openDt'),
    audiCnt: headers.indexOf('audiCnt'),
    audiAcc: headers.indexOf('audiAcc'),
    directors: headers.indexOf('directors'),
    actors: headers.indexOf('actors'),
    showTm: headers.indexOf('showTm')
  };

  // 인덱스 유효성 검사
  for (let key in columnIndexes) {
    if (columnIndexes[key] === -1) {
      console.error(`컬럼 '${key}'를 찾을 수 없습니다.`);
    }
  }

  // 최신 10개 데이터 추출
  for (let i = startRow; i < totalRows; i++) {
    const movie = {
      movieNm: data[i][columnIndexes.movieNm] || '',
      movieNmEn: data[i][columnIndexes.movieNmEn] || '',
      rank: data[i][columnIndexes.rank] || '',
      openDt: '', // 초기화
      audiCnt: data[i][columnIndexes.audiCnt] || '',
      audiAcc: data[i][columnIndexes.audiAcc] || '',
      directors: data[i][columnIndexes.directors] || '',
      actors: data[i][columnIndexes.actors] || '',
      showTm: data[i][columnIndexes.showTm] || ''
    };
    
    // openDt를 "yyyy-mm-dd" 포맷으로 변환
    if (columnIndexes.openDt !== -1 && data[i][columnIndexes.openDt]) {
      const openDate = new Date(data[i][columnIndexes.openDt]);
      if (!isNaN(openDate.getTime())) { // 유효한 날짜인지 확인
        const year = openDate.getFullYear();
        const month = String(openDate.getMonth() + 1).padStart(2, '0');
        const day = String(openDate.getDate()).padStart(2, '0');
        movie.openDt = `${year}-${month}-${day}`;
      } else {
        console.error(`날짜 데이터 변환 오류: ${data[i][columnIndexes.openDt]}`);
      }
    }

    movies.push(movie);
  }

  // 랭크 순으로 정렬 (1위부터 10위까지)
  movies.sort((a, b) => parseInt(a.rank) - parseInt(b.rank));

  return movies;
}

/**
 * 이번 주 개봉 예정 영화 가져오기
 */
function getUpcomingMovies_(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const today = new Date();
  
  // 이번 주 월요일 날짜 계산
  const dayOfWeek = today.getDay(); // 0은 일요일, 1은 월요일
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0); // 시간 초기화

  // 이번 주 일요일 날짜 계산
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999); // 시간 초기화

  const upcomingMovies = [];
  const openDtIndex = headers.indexOf('openDt');

  // 'openDt' 컬럼이 없는 경우 에러 처리
  if (openDtIndex === -1) {
    console.error('\'openDt\' 컬럼을 찾을 수 없습니다.');
    return [];
  }

  for (let i = 1; i < data.length; i++) {
    const openDate = new Date(data[i][openDtIndex]);

    // 유효한 날짜인지 확인 후 이번 주 범위에 포함되는지 체크
    if (!isNaN(openDate.getTime()) && openDate >= monday && openDate <= sunday) {
      const movie = {};
      headers.forEach((header, index) => {
        // 'openDt'는 포맷팅된 문자열로 저장
        if (header === 'openDt') {
          const year = openDate.getFullYear();
          const month = String(openDate.getMonth() + 1).padStart(2, '0');
          const day = String(openDate.getDate()).padStart(2, '0');
          movie[header] = `${year}-${month}-${day}`;
        } else {
          movie[header] = data[i][index];
        }
      });
      upcomingMovies.push(movie);
    }
  }

  return upcomingMovies;
}

/**
 * 시트에 기록 저장
 */
function saveReport_(sheet, report) {
  const timestamp = new Date();
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;
  
  sheet.getRange(newRow, 1).setValue(timestamp);
  sheet.getRange(newRow, 2).setValue(report);
  
  // 셀 높이 자동 조정
  sheet.setRowHeight(newRow, 21);
  sheet.getRange(newRow, 2).setWrap(true);
  
  // 포맷팅
  sheet.getRange(newRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  sheet.autoResizeColumn(1);
}

/**
 * Gemini API를 사용하여 리포트 생성
 */
function generateReportWithGemini_(prompt) {

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 8192
    }
  };
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    console.log('Gemini API 호출 중...');
    const response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + GEMINI_API_KEY, options);
    const responseText = response.getContentText();
    console.log('API 응답 상태:', response.getResponseCode());
    console.log('API 응답 길이:', responseText.length);
    console.log('API 응답:', responseText.substring(0, 200) + '...'); // 처음 500자만 로그
    
    const result = JSON.parse(responseText);
    
    // 에러 응답 체크
    if (result.error) {
      console.error('API 에러:', result.error);
      throw new Error(`API 에러: ${result.error.message || '알 수 없는 오류'}`);
    }
    
    // 정상 응답 체크
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        return candidate.content.parts[0].text;
      }
    }
    
    // 응답 구조가 예상과 다른 경우
    console.error('예상치 못한 응답 구조:', JSON.stringify(result, null, 2));
    throw new Error('Gemini API 응답 형식이 올바르지 않습니다.');
    
  } catch (error) {
    console.error('Gemini API 호출 실패:', error);
    
    // 대체 솔루션: 간단한 템플릿 기반 리포트 생성
    console.log('대체 방법으로 리포트 생성 시도...');
    return "리포트 생성 실패";
  }
}

