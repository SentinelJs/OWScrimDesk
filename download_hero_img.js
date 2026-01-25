const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');

// 설정
const HTML_FILE_PATH = 'ow_hero_namu.html'; // 저장한 HTML 파일명
const OUTPUT_DIR = path.join(__dirname, 'img', 'hero');

// 폴더가 없으면 생성
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📂 '${OUTPUT_DIR}' 폴더가 생성되었습니다.`);
}

// 파일명에 사용할 수 없는 문자 제거 및 유니코드 공백 제거 함수
function sanitizeFilename(name) {
    return name
        .replace(/\u200B/g, '') // 폭 없는 공백(Zero Width Space) 제거
        .replace(/[<>:"/\\|?*]/g, '') // 윈도우/리눅스 파일명 금지 문자 제거
        .replace(/\s+/g, ' ') // 연속된 공백을 하나로
        .trim();
}

async function main() {
    try {
        // 1. HTML 파일 읽기
        const html = fs.readFileSync(HTML_FILE_PATH, 'utf-8');
        const $ = cheerio.load(html);
        
        const heroes = [];

        // 2. 영웅 정보 추출
        // a 태그 중 영웅 카드 역할을 하는 요소 선택
        $('a.UfAmwWvl').each((index, element) => {
            const $el = $(element);
            const titleAttr = $el.attr('title');

            // "오버워치 2/영웅"과 같은 헤더 아이콘은 제외
            if (!titleAttr || titleAttr.includes('오버워치 2/영웅')) return;

            // 이름 추출 (span 태그 내부 텍스트)
            // 제공된 HTML의 클래스명: _0b705aa6354582f4a03e30e3bc5fb47a
            let name = $el.find('span._0b705aa6354582f4a03e30e3bc5fb47a').text();
            
            // 만약 span에서 이름을 못 찾으면 title 속성 사용 (괄호 내용 제거)
            if (!name) {
                name = titleAttr.split('(')[0];
            }

            name = sanitizeFilename(name);

            // 이미지 URL 추출
            // lazy loading 때문에 data-src가 있을 수 있고, 이미 로드된 경우 src일 수 있음
            const $img = $el.find('img._0H0W0QPU');
            let imgUrl = $img.attr('data-src') || $img.attr('src');

            if (name && imgUrl) {
                // 프로토콜이 없는 경우 (//i.namu.wiki...) https: 추가
                if (imgUrl.startsWith('//')) {
                    imgUrl = 'https:' + imgUrl;
                }
                heroes.push({ name, url: imgUrl });
            }
        });

        console.log(`🔍 총 ${heroes.length}명의 영웅 정보를 찾았습니다.`);

        // 3. 이미지 다운로드 및 변환 저장
        for (const hero of heroes) {
            try {
                const response = await axios({
                    url: hero.url,
                    responseType: 'arraybuffer', // 바이너리 데이터로 받기
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                const outputPath = path.join(OUTPUT_DIR, `${hero.name}.png`);

                // Sharp를 사용하여 버퍼를 PNG로 변환 후 저장
                await sharp(response.data)
                    .png()
                    .toFile(outputPath);

                console.log(`✅ 저장 완료: ${hero.name}.png`);
            } catch (err) {
                console.error(`❌ 실패 (${hero.name}):`, err.message);
            }
        }

        console.log('\n🎉 모든 작업이 완료되었습니다!');

    } catch (error) {
        console.error('치명적인 오류 발생:', error);
    }
}

main();