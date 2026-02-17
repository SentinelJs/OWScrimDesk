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

function getSafeMapName(name) {
    return name.replace(/[\\/:*?"<>|]/g, "").replace(/[^가-힣a-zA-Z0-9.]/g, ''); // Remove invalid filename chars
}

async function fetchMaps() {
    try {
        const response = await axios.get('https://namu.wiki/w/%EC%98%A4%EB%B2%84%EC%9B%8C%EC%B9%98/%EC%A0%84%EC%9E%A5', {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
            }
        });
        
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        const NodeFilter = dom.window.NodeFilter;

        const target = "모드별 전장";
        const IMG_DOMAIN = "namu";
        const EXCLUDE = "일반전";

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
            console.log("Target header not found");
            return;
        }

        let dom_list = [found.parentNode];

        while (dom_list.length < 3) {
            let last = dom_list.pop();
            if (last && last.children) {
                 dom_list = [...last.children];
            } else {
                break;
            }
        }

        dom_list = dom_list.slice(1, 6);

        function getMapSrc(NAME) {
            const table = [...document.querySelectorAll("table")].find(t => {
                const txt = t.textContent || "";
                return txt.includes(NAME) && !txt.includes(EXCLUDE) && t.querySelectorAll("table").length > 1;
            });

            const link = table && [...table.querySelectorAll("a")]
                .find(a => (a.textContent || "").includes(NAME));

            const img = link && [...link.querySelectorAll("img")]
                .find(img => {
                    const s = img.getAttribute('data-src') || img.src || "";
                    return s.includes(IMG_DOMAIN);
                });

            const src = img ? (img.getAttribute('data-src') || img.src) : null;
            return src || null;
        }

        const modeDirMap = {
            "쟁탈": "쟁탈",
            "호위": "호위",
            "혼합": "하이브리드",
            "밀기": "밀기",
            "플래시포인트": "플래시포인트",
            "격돌": "격돌"
        };

        for (let dom of dom_list) {
            let domArr = [dom];

            while (domArr.length < 2) {
                 let last = domArr.pop();
                if (last && last.children) domArr = [...last.children];
                else break;
            }
            
            if (domArr.length < 2) continue;

            let maps = [domArr[1]]; 

            while(maps.length < 2) {
                 let last = maps.pop();
                if (last && last.children) maps = [...last.children];
                else break;
            }

            let modeName = domArr[0].textContent.trim();
            console.log(`Processing Mode: ${modeName}`);
            
            let dirName = modeDirMap[modeName] || modeName;
            const baseDir = path.join(__dirname, 'maps', dirName);
            
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }

            // macOS safe check
            const existingFiles = new Set(
                fs.readdirSync(baseDir).map(file => file.normalize('NFC'))
            );

            for (let map of maps) {
                let children = [...map.children];
                if (children.length === 0) continue;
                
                let pop_ = children.pop(); 
                if (!pop_) continue;

                let title = pop_.getAttribute ? pop_.getAttribute('title') : null;
                // Fallback if title attribute is missing but text exists (common in list items)
                if (!title && pop_.textContent) title = pop_.textContent;
                
                if (!title) continue;

                let map_name = title.split("(")[0].trim();
                if(map_name) map_name = map_name.normalize('NFC');
                
                let map_src = getMapSrc(map_name);
                map_name = getSafeMapName(map_name);

                if (map_src) {
                    if (map_src.startsWith('//')) map_src = 'https:' + map_src;
                    else if (map_src.startsWith('/')) map_src = 'https://namu.wiki' + map_src;
                    
                    const fileName = `${map_name}.png`;
                    const filePath = path.join(baseDir, fileName);

                    if (existingFiles.has(fileName)) {
                        console.log(`  Skipping ${map_name} (Already exists)`);
                        continue;
                    }

                    console.log(`  Downloading image for ${map_name} from ${map_src}`);
                    // Removed temp file logic, stream directly
                    try {
                        await saveImageDirectly(map_src, filePath);
                        console.log(`    Saved ${fileName}`);
                        existingFiles.add(fileName);
                    } catch (err) {
                        console.error(`    Failed to download ${map_name}:`, err.message);
                        if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
                             fs.unlinkSync(filePath); // Delete empty file on error
                        }
                    }
                } else {
                    console.log(`  Image source not found for ${map_name}`);
                }
            }
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchMaps();