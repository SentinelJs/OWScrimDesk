const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { JSDOM } = require('jsdom');

async function downloadImage(url, filepath) {
    const writer = fs.createWriteStream(filepath);
    
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
         headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
             'referer': 'https://namu.wiki/'
        }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function convertWebpToPng(inputPath, outputPath) {
    await sharp(inputPath)
        .png()
        .toFile(outputPath);
    fs.unlinkSync(inputPath); // remove temp file
}

function getSafeMapName(name) {
    return name.replace(/[\\/:*?"<>|]/g, ""); // Remove invalid filename chars
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

        let dom_list = [found.parentNode]

        while (dom_list.length < 3) {
            let last = dom_list.pop();
            if (last && last.children) {
                 dom_list = [...last.children];
            } else {
                break;
            }
        }

        // Slice logic from user: dom_list = dom_list.slice(1,6)
        // Adjust if needed based on actual structure. Assuming user logic is correct for 5 modes.
        dom_list = dom_list.slice(1, 6);

        const modeDirMap = {
            "쟁탈": "쟁탈",
            "호위": "호위",
            "혼합": "하이브리드",
            "밀기": "밀기",
            "플래시포인트": "플래시포인트",
            "격돌": "격돌"
        };

        for (let dom of dom_list) {
            dom = [dom];

            while (dom.length < 2) {
                let last = dom.pop();
                if (last && last.children) dom = [...last.children];
                else break;
            }
            
            if (dom.length < 2) continue;

            let maps = [dom[1]]; // The list of maps for this mode

            while(maps.length < 2) {
                let last = maps.pop();
                if (last && last.children) maps = [...last.children];
                else break;
            }

            let modeName = dom[0].textContent.trim();
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
                // User logic: let pop_ = [...map.children].pop()
                let children = [...map.children];
                if (children.length === 0) continue;
                
                let pop_ = children.pop(); // The last child usually contains the link
                if (!pop_) continue;

                // Sometimes pop_ might not be an anchor (<a>), it might be inside. 
                // But following user logic: pop_.title, pop_.href
                // In jsdom, if it's not <a>, href undefined.
                
                // If pop_ is not <a>, try to find <a> inside ? 
                // User script implies pop_ is the 'a' tag or closest to it.
                // Namuwiki list items usually <li><a ...>Name</a></li> or <li>... <a ...>Name</a></li>
                
                // If pop_ is NOT an anchor tag, find one inside?
                let linkElement = pop_;
                if (pop_.tagName !== 'A') {
                    const foundA = pop_.querySelector ? pop_.querySelector('a') : null;
                    if (foundA) linkElement = foundA;
                }

                if (!linkElement || !linkElement.href) continue;

                let map_name = (linkElement.title || linkElement.textContent).split("(")[0].trim();
                let map_link = linkElement.href; // likely relative: /w/...

                if(map_name) map_name = map_name.normalize('NFC');
                
                // Fix map_link if relative
                if (map_link.startsWith('/')) {
                    map_link = 'https://namu.wiki' + map_link;
                }

                const fileName = `${map_name}.png`;
                const filePath = path.join(baseDir, fileName);

                if (existingFiles.has(fileName)) {
                    console.log(`  Skipping ${map_name} (Already exists)`);
                    continue;
                }

                console.log(`  Visiting ${map_name} -> ${map_link}`);
                
                try {
                    // Visit map page to find image
                    const mapPageResponse = await axios.get(map_link, {
                        headers: {
                            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                        }
                    });

                    const mapDom = new JSDOM(mapPageResponse.data);
                    const mapDoc = mapDom.window.document;
                    
                    // const keyword = map_name
                    // const img = document.querySelector(`img[alt*="${keyword}"]`);
                    
                    // Note: alt attribute might be slightly different or contain special chars.
                    // Namuwiki images typically have alt which is the filename.
                    // We try to match keyword.
                    
                    // Using attribute selector with contains (*=)
                    // We need to escape quotes in map_name if any.
                    const safeKeyword = map_name.replace(/"/g, '\\"');
                    // Actually querySelector might fail if map_name has complex chars.
                    // Let's iterate images to be safer or try selector.
                    
                    let img = mapDoc.querySelector(`img[alt*="${safeKeyword}"]`);

                    // Try without optional parts? 
                    // Sometimes map_name is "King's Row", alt is "King's Row.jpg"
                    
                    if (!img) {
                        // Fallback: look for images in the "infobox" or "table" commonly used
                        // Or try stricter match
                        // console.log("    Image not found by querySelector, trying loose loop...");
                        const allImgs = [...mapDoc.querySelectorAll('img')];
                        img = allImgs.find(i => i.alt && i.alt.includes(map_name) && !i.alt.includes('프로그램 아이콘'));
                    }

                    if (img) {
                        let src = img.dataset.src || img.src; // namu wiki often lazy loads with data-src
                        if (src) {
                            if (src.startsWith('//')) src = 'https:' + src;
                            else if (src.startsWith('/')) src = 'https://namu.wiki' + src;
                            
                            console.log(`    Downloading image from ${src}`);
                            const tempFile = path.join(baseDir, `${map_name}.temp`);
                            await downloadImage(src, tempFile);
                            await convertWebpToPng(tempFile, filePath);
                            console.log(`    Saved ${fileName}`);
                        } else {
                            console.log(`    Image src not found for ${map_name}`);
                        }
                    } else {
                        console.log(`    Image element not found for ${map_name}`);
                    }
                    
                    // Respectful delay
                    await new Promise(r => setTimeout(r, 500));

                } catch (err) {
                    console.error(`    Failed to process ${map_name}:`, err.message);
                }
            }
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchMaps();