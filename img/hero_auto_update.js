const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
sharp.cache(false); // Windows 파일 잠금(EBUSY) 방지
const { JSDOM } = require('jsdom');

async function saveImageDirectly(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
         headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
             'referer': 'https://namu.wiki/'
        }
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        const transformer = sharp().png();

        response.data
            .pipe(transformer)
            .pipe(writer);

        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
        transformer.on('error', reject);
    });
}

function getSafeName(name) {
    return name.replace(/[\\/:*?"<>|]/g, "").replace(/[^가-힣a-zA-Z0-9.\s]/g, ''); // Remove invalid filename chars
}

async function fetchHeroes() {
    try {
        const response = await axios.get('https://namu.wiki/w/%EC%98%A4%EB%B2%84%EC%9B%8C%EC%B9%98/%EC%98%81%EC%9B%85', {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
            }
        });
        
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        const NodeFilter = dom.window.NodeFilter;

        const target = "일반전·경쟁전";

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null
        );

        let found = null;

        while (walker.nextNode()) {
            if (walker.currentNode.textContent.includes(target)) {
                found = walker.currentNode.parentElement;
                break;
            }
        }

        if (!found) {
            console.log("Target not found");
            return;
        }

        let hero_list = [found.parentNode];

        while(hero_list.length < 3) {
            let last = hero_list.pop();
            if (last && last.children) {
                hero_list = [...last.children];
            } else {
                break;
            }
        }

        for (let hero of hero_list) { 
            hero = [hero]
            while(hero.length < 2) { 
                 let last = hero.pop();
                 if (last && last.children) {
                    hero = [...last.children];
                 } else {
                    break;
                 }
            }
        
            if (hero.length < 2) continue;

            let role = [hero[0]]
            let heroes = [hero[1]]
        
            while(role.length < 2) {
                let last = role.pop();
                if (last && last.children) role = [...last.children];
                else break;
            }
        
            while(heroes.length < 2) {
                let last = heroes.pop();
                if (last && last.children) heroes = [...last.children];
                else break;
            }
            
            if (role.length < 2 || heroes.length < 2) continue;

            // role check logic from user code: role = role[1].alt
            // In jsdom/HTML, alt is attribute of img. Ensure role[1] is img or has alt.
            // But looking at code: role = [...children]. So role[1] is an element.
            let roleName = role[1].getAttribute('alt') || role[1].alt;
            roleName = roleName.split(' ')[1]; // get first word
            
            // Map roleName to directory name
            const roleDirectoryMap = {
                '공격': '공격',
                '돌격': '돌격',
                '지원': '지원'
            };
            
            const directoryName = roleDirectoryMap[roleName];
            if (!directoryName) {
                console.log(`Unknown role: ${roleName}`);
                continue;
            }

            const baseDir = path.join(__dirname, 'hero', directoryName);
            if (!fs.existsSync(baseDir)) {
                 fs.mkdirSync(baseDir, { recursive: true });
            }

            // macOS 한글 자소 분리(NFD) 문제 해결을 위해 파일 목록을 미리 읽어 NFC로 정규화
            const existingFiles = new Set(
                fs.readdirSync(baseDir).map(file => file.normalize('NFC'))
            );

            let hero_json = []
        
            for (let hero_data of heroes) {
                hero_data = [hero_data]
        
                while(hero_data.length < 2) {
                    let last = hero_data.pop();
                    if (last && last.children) hero_data = [...last.children];
                    else break;
                }
                
                if (hero_data.length < 1) continue;

                let imgElement = hero_data[0].querySelector('img[src*="namu.wiki"]')
                let name = hero_data[1].textContent.trim(); 
                if (name) name = name.normalize('NFC'); // 텍스트도 NFC 정규화

                if (imgElement && !imgElement.alt.includes("프로그램 아이콘")) {
                    const imgUrl = "https:" + imgElement.src;
                     hero_json.push({
                        "img": imgUrl,
                        "name": name
                    });

                    // Check and Download
                    name = getSafeName(name);
                    const fileName = `${name}.png`;
                    const filePath = path.join(baseDir, fileName);
                    
                    if (!existingFiles.has(fileName)) {
                        console.log(`Downloading ${name} (${roleName})...`);
                        // Removed temp file logic, stream directly
                        try {
                            await saveImageDirectly(imgUrl, filePath);
                            console.log(`Saved ${name}.png`);
                            existingFiles.add(fileName); // 목록에 추가
                        } catch (err) {
                            console.error(`Failed to download ${name}:`, err.message);
                            if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
                                fs.unlinkSync(filePath);
                            }
                        }
                    } else {
                        console.log(`Skipping ${name} (Already exists)`);
                    }
                }
            }
        
            console.log("Role:", roleName);
            // console.log(hero_json);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchHeroes();