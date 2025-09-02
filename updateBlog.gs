// 구글 블로그 업로드 Apps Script
// 사용 전 설정 필요사항:
// 1. "권한 설정" 메뉴를 먼저 실행하여 OAuth 권한 승인
// 2. 아래 BLOG_ID 변수에 블로그 ID 입력

// ========== 설정 영역 ==========
const BLOG_ID = PropertiesService.getScriptProperties().getProperty('BLOG_ID'); ; // 여기에 블로그 ID를 입력하세요
const SHEET_NAME = 'Report'; // 시트 이름

/**
 * OAuth 권한 설정 및 권한 요청
 * 이 함수를 먼저 실행하여 필요한 권한을 승인받으세요
 */
function setupOAuthPermissions_() {
  try {
    Logger.log('OAuth 권한 설정을 시작합니다...');
    
    // OAuth 토큰 가져오기 (권한 요청 트리거)
    const token = ScriptApp.getOAuthToken();
    Logger.log('OAuth 토큰이 성공적으로 생성되었습니다.');
    
    // 블로그 ID가 설정되어 있다면 블로그 정보 확인
    if (BLOG_ID && BLOG_ID !== 'YOUR_BLOG_ID_HERE') {
      Logger.log('설정된 블로그 ID로 연결을 확인합니다...');
      const blogInfo = getBlogInfo_(BLOG_ID);
      if (blogInfo) {
        Logger.log(`설정 확인 완료: 블로그 연결이 확인되었습니다.\n블로그 이름: ${blogInfo.name}\n블로그 URL: ${blogInfo.url}`);
      } else {
        Logger.log('블로그 ID 확인 필요: OAuth 권한은 설정되었지만 블로그 ID를 확인할 수 없습니다. 블로그 ID가 올바른지 확인해주세요.');
      }
    } else {
      Logger.log('권한 설정 완료: OAuth 권한이 설정되었습니다. 이제 BLOG_ID를 설정해주세요.');
    }
    
  } catch (error) {
    Logger.log('OAuth 설정 오류: ' + error.toString());
    Logger.log('권한 설정 오류: 권한 설정 중 오류가 발생했습니다. 다시 시도해주세요.\n오류: ' + error.toString());
  }
}

/**
 * 메인 함수: 최신 리포트를 블로그에 업로드
 */
function uploadLatestReportToBlog() {
  try {
    // 블로그 ID 확인
    if (!BLOG_ID || BLOG_ID === 'YOUR_BLOG_ID_HERE') {
      Logger.log('설정 필요: 먼저 코드에서 BLOG_ID를 설정해주세요.');
      return;
    }
    
    // 1. 스프레드시트에서 최신 데이터 가져오기
    Logger.log('최신 리포트 데이터를 가져옵니다...');
    const latestData = getLatestReportData_();
    if (!latestData) {
      Logger.log('업로드할 데이터가 없습니다.');
      Logger.log('데이터 없음: 업로드할 리포트 데이터가 없습니다.');
      return;
    }
    
    Logger.log(`날짜: ${latestData.date}, 리포트 길이: ${latestData.report.length}자`);
    
    // 2. 마크다운을 HTML로 변환
    Logger.log('마크다운을 HTML로 변환합니다...');
    let htmlContent = convertMarkdownToHtml_(latestData.report);
   
    // 3. WBTable 시트의 테이블을 HTML로 변환하여 삽입
    Logger.log('WBTable 시트의 테이블을 변환합니다...');
    const tableHtml = convertWBTableToHtml_();
    if (tableHtml) {
      htmlContent = insertTableIntoContent_(htmlContent, tableHtml);
      Logger.log('테이블이 성공적으로 삽입되었습니다.');
    }

    // 4. footer
    htmlContent += "<hr style=\"margin: 40px 0; border: 1px solid #eee;\">"
    htmlContent += "<p style=\"font-size: 14px; color: #666; text-align: center;\">이 리포트는 자동으로 생성되었습니다.<br>🎬 매주 업데이트되는 박스오피스 정보를 확인하세요!</p>"
    
    // 3. 블로그에 포스트 작성
    const postData = {
      kind: 'blogger#post',
      title: `${getThisMondayDateString_()} 주간 박스오피스 리포트 `,
      content: htmlContent,
      labels: ['영화', '리포트', '영화소식', '박스오피스', '개봉작', '자동업로드' ]
    };
    
    // 4. Blogger API를 통해 포스트 업로드
    Logger.log('블로그에 포스트를 업로드합니다...');
    const response = createBlogPost_(BLOG_ID, postData);
    
    Logger.log('블로그 포스트가 성공적으로 업로드되었습니다.');
    Logger.log(`포스트 URL: ${response.url}`);
    
    // 5. 사용자에게 알림
    Logger.log(`업로드 완료: 블로그 포스트가 성공적으로 업로드되었습니다.\n\n제목: ${response.title}\n포스트 URL: ${response.url}`);
    
    return response;
    
  } catch (error) {
    Logger.log('오류 발생: ' + error.toString());
    Logger.log('업로드 오류: 업로드 중 오류가 발생했습니다.\n' + error.toString());
  }
}

/**
 * 현재 날짜를 기준으로 이번 주 월요일의 날짜를 "yyyy년 m월 d일" 형식으로 반환합니다.
 */
function getThisMondayDateString_() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0은 일요일, 1은 월요일
  
  // 현재 날짜를 기준으로 이번 주 월요일 날짜를 계산
  // 일요일(0)인 경우 6을 빼서 이전 주의 월요일이 아닌 현재 주의 월요일로 계산
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diffToMonday));
  
  const year = monday.getFullYear();
  const month = monday.getMonth() + 1;
  const day = monday.getDate();
  
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * Blogger API를 통해 블로그 포스트 생성
 */
function createBlogPost_(blogId, postData) {
  try {
    // OAuth 토큰 가져오기
    const token = ScriptApp.getOAuthToken();
    
    // Blogger API 엔드포인트
    const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`;
    
    // HTTP 요청 옵션
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(postData)
    };
    
    // API 호출
    Logger.log('Blogger API를 호출합니다...');
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`API 응답 코드: ${responseCode}`);
    
    if (responseCode === 200 || responseCode === 201) {
      return JSON.parse(responseText);
    } else {
      Logger.log(`API 오류 응답: ${responseText}`);
      throw new Error(`API 호출 실패: ${responseCode} - ${responseText}`);
    }
    
  } catch (error) {
    throw new Error(`블로그 포스트 생성 실패: ${error.toString()}`);
  }
}

/**
 * 블로그 정보 가져오기 (블로그 ID 확인용)
 */
function getBlogInfo_(blogId) {
  try {
    const token = ScriptApp.getOAuthToken();
    const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true  // 전체 오류 응답을 확인하기 위해 추가
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`API 응답 코드: ${responseCode}`);
    Logger.log(`API 응답 내용: ${responseText}`);
    
    if (responseCode === 200) {
      const blogInfo = JSON.parse(responseText);
      Logger.log(`블로그 이름: ${blogInfo.name}`);
      Logger.log(`블로그 URL: ${blogInfo.url}`);
      return blogInfo;
    } else {
      // 자세한 오류 정보 출력
      Logger.log(`블로그 정보 가져오기 실패: ${responseCode}`);
      Logger.log(`오류 응답: ${responseText}`);
      
      // 403 오류인 경우 특별한 메시지
      if (responseCode === 403) {
        const errorInfo = JSON.parse(responseText);
        if (errorInfo.error && errorInfo.error.message.includes('Blogger API has not been used')) {
          throw new Error('Blogger API가 활성화되지 않았습니다. Google Cloud Console에서 Blogger API를 활성화해주세요.');
        }
      }
      
      return null;
    }
    
  } catch (error) {
    Logger.log(`블로그 정보 확인 오류: ${error.toString()}`);
    throw error;  // 오류를 다시 던져서 호출하는 함수에서 처리하도록 함
  }
}

/**
 * 스프레드시트에서 가장 아래(최신) 리포트 데이터 가져오기
 */
function getLatestReportData_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    throw new Error(`'${SHEET_NAME}' 시트를 찾을 수 없습니다.`);
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return null; // 헤더만 있고 데이터가 없음
  }
  
  // 헤더 행에서 컬럼 위치 찾기
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dateCol = headers.indexOf('date') + 1;
  const reportCol = headers.indexOf('report') + 1;
  
  if (dateCol === 0 || reportCol === 0) {
    throw new Error('date 또는 report 컬럼을 찾을 수 없습니다.');
  }
  
  // 마지막 행의 데이터 가져오기
  const dateValue = sheet.getRange(lastRow, dateCol).getValue();
  const reportValue = sheet.getRange(lastRow, reportCol).getValue();
  
  return {
    date: Utilities.formatDate(new Date(dateValue), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    report: reportValue
  };
}


/**
 * 마크다운을 HTML로 변환 (기능 강화 버전 - 테이블/수평선 인식)
 */
function convertMarkdownToHtml_(markdown) {
  let html = markdown;

  // 제목 태그 변환 (h1~h4)
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  // html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="white-space: normal; word-break: keep-all; overflow-wrap: break-word; line-height: 1.2;">$1</h1>');

  // ** 굵게 변환
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 수평선 변환
  html = html.replace(/^---\s*$/gm, '<hr>');

  // 리스트 항목을 <ul> 블록으로 묶기
  // 들여쓰기된 리스트(spaces followed by *)도 인식
  html = html.replace(/^(?:\s{4})?[\s]*[-*] (.*)/gim, '<li>$1</li>');
  
  // 연속되는 <li> 태그들을 하나의 <ul> 블록으로 묶기
  // 마지막 항목까지 포함하도록 정규식을 더 유연하게 수정
  html = html.replace(/((?:<li>.*<\/li>(?:\s*\n?)*)+)/g, '<ul>$1</ul>');

  // 연속되는 <li> 태그들을 하나의 <ul> 블록으로 묶고, 줄 간격 스타일 추가
  // li 항목간의 거리를 지금의 1.2배정도로 늘리기 위해 line-height를 1.2로 지정
  // html = html.replace(/((?:<li>.*<\/li>(?:\s*\n?)*)+)/g, '<ul style="line-height: 1.5;">$1</ul>');
  
  // 문단을 <p> 태그로 변환
  html = html.split(/\n\s*\n/).map(paragraph => {
    // 이미 <ul>, <h1> 등의 블록 태그로 변환된 부분은 <p>로 감싸지 않음
    if (paragraph.trim().length > 0 && !paragraph.match(/<h[1-4]>|<ul>|<hr>/)) {
      return '<p>' + paragraph.trim().replace(/\n/g, '<br>') + '</p>';
    }
    return paragraph;
  }).join('');
  
  // 불필요한 빈 <p> 태그 제거
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

// /**
//  * 마크다운을 HTML로 변환
//  * 기본적인 마크다운 문법을 지원합니다.
//  */
// function convertMarkdownToHtml_(markdown) {
//   if (!markdown) return '';
  
//   let html = markdown;
  
//   // 코드 블록 (```)
//   html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
//   // 인라인 코드 (`)
//   html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
//   // 헤더 (# ## ###)
//   html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
//   html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
//   html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
//   // 볼드 (**text** 또는 __text__)
//   html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
//   html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
//   // 이탤릭 (*text* 또는 _text_)
//   html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
//   html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
//   // 링크 [text](url)
//   html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
//   // 이미지 ![alt](url)
//   html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
//   // 순서 없는 리스트 (- 또는 *)
//   html = html.replace(/^[\s]*[-*] (.*)$/gm, '<li>$1</li>');
//   html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
//   // // 순서 있는 리스트 (1. 2. 3.)
//   // html = html.replace(/^[\s]*\d+\. (.*)$/gm, '<li>$1</li>');
//   // html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
  
//   // 인용 (>)
//   html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  
//   // 수평선 (--- 또는 ***)
//   html = html.replace(/^---$/gm, '<hr>');
//   html = html.replace(/^\*\*\*$/gm, '<hr>');
  
//   // 줄바꿈을 <br>로 변환 (두 번의 줄바꿈은 <p>로)
//   html = html.replace(/\n\n/g, '</p><p>');
//   html = html.replace(/\n/g, '<br>');
//   html = '<p>' + html + '</p>';
  
//   // 빈 p 태그 제거
//   html = html.replace(/<p><\/p>/g, '');
  
//   return html;
// }

/**
 * 블로그 ID 설정 함수
 */
function setBlogId_() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    '블로그 ID 설정',
    '구글 블로그 ID를 입력하세요:\n(예: 1234567890123456789)',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() === ui.Button.OK) {
    const blogId = result.getResponseText();
    ui.alert(`설정 완료: 블로그 ID: ${blogId}\n\n스크립트 코드에서 BLOG_ID 변수를 다음과 같이 수정해주세요:\nconst BLOG_ID = '${blogId}';`);
  }
}


/**
 * WBTable 시트의 C1:F11 범위를 배경색 포함하여 HTML 테이블로 변환
 */
function convertWBTableToHtml_() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const wbSheet = spreadsheet.getSheetByName('WBTable');
    
    if (!wbSheet) {
      Logger.log('WBTable 시트를 찾을 수 없습니다.');
      return null;
    }
    
    // C1:F11 범위 데이터 가져오기
    const range = wbSheet.getRange('C1:F11');
    const values = range.getValues();
    const backgrounds = range.getBackgrounds();
    const fontColors = range.getFontColors();
    const fontWeights = range.getFontWeights();
    
    let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">\n';
    
    for (let i = 0; i < values.length; i++) {
      tableHtml += '  <tr>\n';
      
      for (let j = 0; j < values[i].length; j++) {
        const cellValue = values[i][j];
        const bgColor = backgrounds[i][j];
        const fontColor = fontColors[i][j];
        const fontWeight = fontWeights[i][j];
        
        // 셀 스타일 생성
        let cellStyle = 'border: 1px solid #ddd; padding: 8px; text-align: center;';
        
        // 배경색 추가 (흰색이 아닌 경우에만)
        if (bgColor && bgColor !== '#ffffff' && bgColor !== '#FFFFFF') {
          cellStyle += ` background-color: ${bgColor};`;
        }
        
        // 폰트 색상 추가 (검은색이 아닌 경우에만)
        if (fontColor && fontColor !== '#000000' && fontColor !== '#000') {
          cellStyle += ` color: ${fontColor};`;
        }
        
        // 폰트 굵기 추가
        if (fontWeight === 'bold') {
          cellStyle += ' font-weight: bold;';
        }
        
        // 첫 번째 행은 헤더로 처리
        const cellTag = i === 0 ? 'th' : 'td';
        const headerStyle = i === 0 ? ' font-weight: bold; background-color: #434343;' : '';
        
        tableHtml += `    <${cellTag} style="${cellStyle}${headerStyle}">${cellValue}</${cellTag}>\n`;
      }
      
      tableHtml += '  </tr>\n';
    }
    
    tableHtml += '</table>\n';
    
    Logger.log('WBTable HTML 변환 완료');
    return tableHtml;
    
  } catch (error) {
    Logger.log('WBTable 변환 오류: ' + error.toString());
    return null;
  }
}

/**
 * HTML 콘텐츠에서 특정 제목 아래에 테이블 삽입
 */
function insertTableIntoContent_(htmlContent, tableHtml) {
  // "## 🏆 TOP 10, 관객의 선택을 받은 영화들" 제목을 찾아서 그 아래에 테이블 삽입
  const targetHeader = '<h2>🏆 TOP 10, 관객의 선택을 받은 영화들</h2>';
  const targetHeaderAlt1 = '<h2>🏆 TOP 10, 관객의 선택을 받은 영화들</h2>';
  const targetHeaderAlt2 = '## 🏆 TOP 10, 관객의 선택을 받은 영화들';
  
  // 다양한 형태의 제목을 찾아서 처리
  if (htmlContent.includes(targetHeader)) {
    return htmlContent.replace(targetHeader, targetHeader + '\n\n' + tableHtml);
  } else if (htmlContent.includes(targetHeaderAlt1)) {
    return htmlContent.replace(targetHeaderAlt1, targetHeaderAlt1 + '\n\n' + tableHtml);
  } else if (htmlContent.includes(targetHeaderAlt2)) {
    return htmlContent.replace(targetHeaderAlt2, targetHeaderAlt2 + '\n\n' + tableHtml);
  } else {
    // 제목을 찾지 못한 경우, 콘텐츠 끝에 추가
    Logger.log('타겟 제목을 찾지 못했습니다. 콘텐츠 끝에 테이블을 추가합니다.');
    return htmlContent + '\n\n<h2>🏆 주간 박스오피스</h2>\n' + tableHtml;
  }
}
