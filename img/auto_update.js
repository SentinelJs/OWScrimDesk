const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { JSDOM } = require('jsdom');

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
            
            let hero_json = []
        
            for (let hero_data of heroes) {
                hero_data = [hero_data]
        
                while(hero_data.length < 2) {
                    let last = hero_data.pop();
                    if (last && last.children) hero_data = [...last.children];
                    else break;
                }
                
                if (hero_data.length < 1) continue;

                let imgElement = hero_data[0].getElementsByClassName("MyRowAll")[0];
                let name = hero_data[1].textContent.trim(); // used textContent instead of innerText for safety in Node

                if (imgElement && !imgElement.alt.includes("프로그램 아이콘")) {
                     hero_json.push({
                        "img": "https:" + imgElement.dataset.src,
                        "name": name
                    })
                }
            }
        
            console.log("Role:", roleName);
            console.log(hero_json);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchHeroes();