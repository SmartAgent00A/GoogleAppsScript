/**
 * @fileoverview 지난주 주간 박스오피스 정보를 KOBIS API를 통해 가져와서
 * 'WeeklyBoxoffice', 'MovieList' 시트에 저장하는 스크립트입니다.
 * @version 1.1.0
 * @author Gemini (20-year Apps Script Expert)
 * 
 * # 영화진흥위원회 영화관입장권통합전산망에서 제공하는 오픈API 서비스
 * ## 주간/주말 박스오피스 API 서비스
 * https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do?serviceId=searchWeeklyBoxOffice
 * 
 * ## 영화목록 조회 API 서비스
 * https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do?serviceId=searchMovieList
 * 
 * ## 영화상세정보 조회 API 서비스
 * https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do?serviceId=searchMovieInfo
 */

// -----------------------------------------------------------------------------
// 설정 변수 (사용자 환경에 맞게 수정해주세요)
// -----------------------------------------------------------------------------

/**
 * 영화진흥위원회(KOBIS)에서 발급받은 API 키를 입력하세요.
 * @type {string}
 */
const API_KEY = PropertiesService.getScriptProperties().getProperty('KOBIS_API_KEY'); // << 중요: 여기에 발급받은 API 키를 입력하세요.


/**
 * 주간 박스오피스 영화 목록을 저장할 시트의 이름을 지정합니다.
 * @type {string}
 */
const SHEET_WEEKLYBOXOFFICE = "WeeklyBoxoffice";

/**
 * 영화 목록을 저장할 시트의 이름을 지정합니다.
 * @type {string}
 */
const SHEET_MOVIELIST = "MovieList";

/**
 * 메인 실행 함수입니다.
 * 이 함수를 실행하면 모든 프로세스가 시작됩니다.
 * 트리거에 등록할 함수입니다. 
 */
function getKOBISdata(){

  fetchAndSaveWeeklyBoxOffice();

  fetchAndSaveUpcomingMovies();
}

/**
 * 주간 박스오피스 데이터를 가져옵니다.
 * 
 */
function fetchAndSaveWeeklyBoxOffice() {
  if (API_KEY === "YOUR_KOBIS_API_KEY" || API_KEY.trim() === "") {
    // SpreadsheetApp.getUi().alert("API 키가 설정되지 않았습니다. 스크립트 상단의 API_KEY 변수에 발급받은 키를 입력해주세요.");
    return;
  }

  try {
    // 1. 지난주 박스오피스 목록 및 주차 정보 가져오기
    const boxOfficeResult = getWeeklyBoxOfficeList_();
    if (!boxOfficeResult || !boxOfficeResult.weeklyBoxOfficeList || boxOfficeResult.weeklyBoxOfficeList.length === 0) {
      Logger.log("주간 박스오피스 데이터가 없습니다.");
      return;
    }

    const { yearWeekTime, showRange, weeklyBoxOfficeList } = boxOfficeResult;
    
    // 2. 각 영화의 상세 정보 가져오기
    const moviesData = getMovieDetails_(weeklyBoxOfficeList, yearWeekTime, showRange);

    // 3. 스프레드시트에 데이터 저장하기
    saveToSheet_(moviesData);

  } catch (e) {
    Logger.log(`오류가 발생했습니다: ${e.toString()}\nStack: ${e.stack}`);
    // SpreadsheetApp.getUi().alert(`스크립트 실행 중 오류가 발생했습니다. 자세한 내용은 로그를 확인하세요.`);
  }
}

/**
 * KOBIS API를 호출하여 주간 박스오피스 목록과 관련 정보를 가져옵니다.
 * @returns {Object|null} 주간 박스오피스 결과 객체 또는 실패 시 null
 * @private
 */
function getWeeklyBoxOfficeList_() {
  const targetDt = getTargetDate_();
  const url = `http://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchWeeklyBoxOfficeList.json?key=${API_KEY}&targetDt=${targetDt}&weekGb=0`;
  
  Logger.log(`주간 박스오피스 API 호출: ${url}`);
  const response = UrlFetchApp.fetch(url, {'muteHttpExceptions': true});
  const json = JSON.parse(response.getContentText());

  if (json.boxOfficeResult && json.boxOfficeResult.weeklyBoxOfficeList) {
    Logger.log(`성공: ${json.boxOfficeResult.weeklyBoxOfficeList.length}개의 박스오피스 데이터를 가져왔습니다.`);
    Logger.log(`주차 정보: ${json.boxOfficeResult.yearWeekTime}, 대상 기간: ${json.boxOfficeResult.showRange}`);
    return {
      yearWeekTime: json.boxOfficeResult.yearWeekTime,
      showRange: json.boxOfficeResult.showRange.replace(/~/g, ' ~ '), // 가독성을 위해 '~' 앞뒤에 공백 추가
      weeklyBoxOfficeList: json.boxOfficeResult.weeklyBoxOfficeList
    };
  } else {
    Logger.log(`주간 박스오피스 데이터를 가져오는데 실패했습니다. 응답: ${response.getContentText()}`);
    return null;
  }
}

/**
 * 영화 목록을 바탕으로 각 영화의 상세 정보를 조회합니다.
 * @param {Array<Object>} boxOfficeList 박스오피스 목록
 * @param {string} yearWeekTime 주차 정보 (예: "202420")
 * @param {string} showRange 조회 기간 (예: "20240513 ~ 20240519")
 * @returns {Array<Array<string>>} 시트에 저장할 2차원 배열 데이터
 * @private
 */
function getMovieDetails_(boxOfficeList, yearWeekTime, showRange) {
  const moviesData = [];
  
  for (const movie of boxOfficeList) {
    const movieCd = movie.movieCd;
    const movieNm = movie.movieNm;
    const rank = movie.rank;
    const openDt = movie.openDt;
    const audiCnt = movie.audiCnt;
    const audiAcc = movie.audiAcc;

    const detailUrl = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${API_KEY}&movieCd=${movieCd}`;
    
    Utilities.sleep(100); 
    
    Logger.log(`영화 상세정보 API 호출: (코드: ${movieCd})`);
    const response = UrlFetchApp.fetch(detailUrl, {'muteHttpExceptions': true});
    const json = JSON.parse(response.getContentText());

    if (json.movieInfoResult && json.movieInfoResult.movieInfo) {
      const movieInfo = json.movieInfoResult.movieInfo;
      
      const nationAlt = movieInfo.nations ? movieInfo.nations.map(n => n.nationNm).join(', ') : '';
      const genreAlt = movieInfo.genres ? movieInfo.genres.map(g => g.genreNm).join(', ') : '';
      const directors = movieInfo.directors ? movieInfo.directors.map(d => d.peopleNm).join(', ') : '';
      const actors = movieInfo.actors ? movieInfo.actors.slice(0, 10).map(a => `${a.peopleNm} (${a.cast || '주연'})`).join(', ') : '';
      const movieNmEn = movieInfo.movieNmEn || '';
      const showTm = movieInfo.showTm || '';
      const watchGradeNm = movieInfo.watchGradeNm || '';
      

      // 시트 열 순서에 맞게 데이터 배열 생성 (A, B열에 주차/기간 정보 추가)
      moviesData.push([
        yearWeekTime,
        showRange,
        movieCd,
        movieNm,
        rank,
        openDt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        audiCnt, 
        audiAcc,
        directors,
        movieNmEn,
        showTm,
        actors,
        watchGradeNm,
        genreAlt
      ]);
    } else {
      Logger.log(`영화 코드 ${movieCd}의 상세 정보를 가져오는데 실패했습니다.`);
    }
  }
  return moviesData;
}

/**
 * 가공된 영화 데이터를 SHEET_WEEKLYBOXOFFICE 시트에 저장합니다.
 * @param {Array<Array<string>>} data 저장할 2차원 배열 데이터
 * @private
 */
function saveToSheet_(data) {
  if (data.length === 0) {
    Logger.log("시트에 저장할 데이터가 없습니다.");
    return;
  }

  sheet_name = SHEET_WEEKLYBOXOFFICE;

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheet_name);

  if (!sheet) {
    // SpreadsheetApp.getUi().alert(`'${sheet_name}' 시트를 찾을 수 없습니다. 시트 이름을 확인해주세요.`);
    Logger.log(`'${sheet_name}' 시트를 찾을 수 없습니다.`);
    return;
  }

  const startRow = sheet.getLastRow() + 1;
  const numRows = data.length;
  const numCols = data[0].length;

  sheet.getRange(startRow, 1, numRows, numCols).setValues(data);
  
  Logger.log(`${numRows}개의 영화 데이터를 '${sheet_name}' 시트의 ${startRow}행부터 성공적으로 저장했습니다.`);
  // SpreadsheetApp.getUi().alert(`${numRows}개의 영화 데이터를 시트에 추가했습니다.`);
}

/**
 * API 요청에 필요한 targetDt (오늘로부터 7일 전) 날짜를 'yyyymmdd' 형식으로 생성합니다.
 * @returns {string} yyyymmdd 형식의 날짜 문자열
 * @private
 */
function getTargetDate_() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  return `${yyyy}${mm}${dd}`;
}

/**
 * 올해 개봉 예정인 영화 목록을 조회하여 'MovieList' 시트를 초기화하고 저장합니다.
 * 1. 올해 개봉 영화 목록을 가져옵니다.
 * 2. 개봉일이 오늘 이후인 영화만 필터링하고 날짜순으로 정렬합니다.
 * 3. 상위 15개 영화의 상세 정보를 추가로 조회합니다.
 * 4. 'MovieList' 시트를 비우고 새로운 목록을 저장합니다.
 */
function fetchAndSaveUpcomingMovies() {
  if (API_KEY === "YOUR_KOBIS_API_KEY" || API_KEY.trim() === "") {
    // SpreadsheetApp.getUi().alert("API 키가 설정되지 않았습니다. 스크립트 상단의 API_KEY 변수에 발급받은 키를 입력해주세요.");
    return;
  }

  try {
    // 1. 올해 개봉 영화 목록 가져오기
    const allMoviesThisYear = getThisYearMovies_();
    if (!allMoviesThisYear || allMoviesThisYear.length === 0) {
      Logger.log("올해 개봉 영화 데이터를 가져오지 못했습니다.");
      return;
    }

    // 2. 개봉 예정 영화 필터링 및 정렬 후 상위 15개 선택
    const upcomingMovies = filterAndSortUpcomingMovies_(allMoviesThisYear);
    if (upcomingMovies.length === 0) {
      Logger.log("조회 시점 이후 개봉 예정인 영화가 없습니다.");
      // SpreadsheetApp.getUi().alert("조회 가능한 개봉 예정 영화가 없습니다.");
      return;
    }
    
    // 3. 15개 영화의 상세 정보 가져와 최종 데이터 조합
    const finalMovieData = enrichMoviesWithDetails_(upcomingMovies);

    // 4. 시트 초기화 후 데이터 저장
    clearAndSaveToSheet_(finalMovieData);

  } catch (e) {
    Logger.log(`오류가 발생했습니다: ${e.toString()}\nStack: ${e.stack}`);
    // SpreadsheetApp.getUi().alert(`스크립트 실행 중 오류가 발생했습니다. 자세한 내용은 로그를 확인하세요.`);
  }
}


/**
 * searchMovieList API를 호출하여 올해 개봉하는 영화 목록을 가져옵니다.
 * @returns {Array<Object>|null} 영화 목록 또는 실패 시 null
 * @private
 */
function getThisYearMovies_() {
  const currentYear = new Date().getFullYear().toString();
  const url = `http://kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${API_KEY}&itemPerPage=100&openStartDt=${currentYear}`;
  
  Logger.log(`올해 개봉 영화 목록 API 호출: ${url}`);
  const response = UrlFetchApp.fetch(url, {'muteHttpExceptions': true});
  const json = JSON.parse(response.getContentText());

  if (json.movieListResult && json.movieListResult.movieList) {
    Logger.log(`성공: ${json.movieListResult.movieList.length}개의 영화 목록을 가져왔습니다.`);
    return json.movieListResult.movieList;
  } else {
    Logger.log(`영화 목록을 가져오는데 실패했습니다. 응답: ${response.getContentText()}`);
    return null;
  }
}

/**
 * 전체 영화 목록에서 개봉일이 오늘 이후인 영화만 필터링하고,
 * 개봉일 순으로 정렬하여 상위 15개를 반환합니다. 
 * @param {Array<Object>} allMovies 전체 영화 목록
 * @returns {Array<Object>} 필터링 및 정렬된 15개의 영화 목록
 * @private
 */
function filterAndSortUpcomingMovies_(allMovies) {

  // 1. 'Asia/Seoul' 시간대 기준으로 오늘 날짜를 'YYYYMMDD' 형식의 문자열로 가져옵니다.
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  Logger.log(`오늘 날짜 기준(YYYYMMDD): ${todayStr}`);

  // 2. 개봉일(openDt)이 있고, 그 날짜가 오늘보다 크거나 같은 영화만 필터링합니다.
  const filteredMovies = allMovies.filter(movie => {
    // openDt 필드가 존재하고, 값이 비어있지 않은지 확인합니다.
    if (!movie.openDt) {
      return false;
    }
    // 날짜 문자열을 비교하여 오늘 이후의 영화인지 확인합니다.
    return movie.openDt >= todayStr;
  });

  // 3. 필터링된 영화들을 개봉일 순서(오름차순)로 정렬합니다.
  filteredMovies.sort((a, b) => a.openDt.localeCompare(b.openDt));
  
  Logger.log(`필터링 및 정렬 후 ${filteredMovies.length}건의 개봉 예정 영화를 찾았습니다. 이 중 최대 15개를 처리합니다.`);
  
  // 4. 정렬된 목록에서 상위 15개만 잘라서 반환합니다.
  //return filteredMovies.slice(0, 20);
  return filteredMovies.slice(0, 15);
}


/**
 * 15개의 개봉 예정 영화 목록에 상세 정보를 추가합니다. (오류 수정 버전)
 * @param {Array<Object>} upcomingMovies 개봉 예정 영화 15개 목록
 * @returns {Array<Array<string>>} 시트에 저장할 최종 2차원 배열 데이터
 * @private
 */
function enrichMoviesWithDetails_(upcomingMovies) {
  const finalData = [];

  for (const movie of upcomingMovies) {
    // [수정] .map() 사용 전, 해당 필드가 존재하는지 확인하는 방어 코드 추가
    const nationAlt = movie.nations && movie.nations.length > 0 ? movie.nations.map(n => n.nationNm).join(', ') : '정보 없음';
    const genreAlt = movie.genres && movie.genres.length > 0 ? movie.genres.map(g => g.genreNm).join(', ') : '정보 없음';
    const directorNames = movie.directors && movie.directors.length > 0 ? movie.directors.map(d => d.peopleNm).join(', ') : '정보 없음';

    const detailUrl = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${API_KEY}&movieCd=${movie.movieCd}`;
    Utilities.sleep(100);

    Logger.log(`상세 정보 조회 중: ${movie.movieNm} (코드: ${movie.movieCd})`);
    const response = UrlFetchApp.fetch(detailUrl, {'muteHttpExceptions': true});
    const json = JSON.parse(response.getContentText());

    let showTm = '정보 없음';
    let actors = '정보 없음';
    let watchGradeNm = '정보 없음';

    if (json.movieInfoResult && json.movieInfoResult.movieInfo) {
      const movieInfo = json.movieInfoResult.movieInfo;
      showTm = movieInfo.showTm || '정보 없음';
      actors = movieInfo.actors && movieInfo.actors.length > 0 ? movieInfo.actors.slice(0, 5).map(a => a.peopleNm).join(', ') : '정보 없음';
      
      if (movieInfo.audits && movieInfo.audits.length > 0) {
        watchGradeNm = movieInfo.audits[0].watchGradeNm || '정보 없음';
      }
    }

    finalData.push([
      movie.movieCd,
      movie.movieNm,
      movie.openDt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
      movie.nationAlt,
      movie.genreAlt,
      directorNames,   // 수정된 변수 사용
      movie.movieNmEn,
      showTm,
      actors,
      watchGradeNm
    ]);
  }
  return finalData;
}


/**
 * 시트의 내용을 모두 지우고 헤더와 함께 새로운 데이터를 저장합니다.
 * @param {Array<Array<string>>} data 저장할 2차원 배열 데이터
 * @private
 */
function clearAndSaveToSheet_(data) {
  if (data.length === 0) {
    Logger.log("시트에 저장할 데이터가 없습니다.");
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_MOVIELIST);

  if (!sheet) {
    // SpreadsheetApp.getUi().alert(`'${SHEET_MOVIELIST}' 시트를 찾을 수 없습니다. 시트 이름을 확인해주세요.`);
    return;
  }

  // 시트 내용과 형식 모두 초기화
  sheet.clear();
  
  // 헤더(열 제목) 추가
  const headers = [
      'movieCd', 'movieNm', 'openDt', 'nationAlt', 'genreAlt', 
      'director', 'movieNmEn', 'showTm', 'actors', 'watchGradeNm'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // 데이터 저장
  const startRow = 2; // 헤더 다음 행부터
  sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
  sheet.autoResizeColumns(1, headers.length); // 컬럼 너비 자동 조절

  Logger.log(`'${SHEET_MOVIELIST}' 시트를 초기화하고 ${data.length}개의 개봉 예정 영화 데이터를 저장했습니다.`);
  // SpreadsheetApp.getUi().alert(`'${SHEET_MOVIELIST}' 시트를 초기화하고 ${data.length}개의 개봉 예정 영화를 저장했습니다.`);

}
