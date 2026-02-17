const fs = require('fs');
const path = require('path');

const imgHeroDir = path.join(__dirname, '../img/hero');
const videosDir = path.join(__dirname, '../videos');
const targetBaseDir = path.join(__dirname, 'hero');

// Ensure target directories exist
['공격', '돌격', '지원'].forEach(role => {
    const dir = path.join(targetBaseDir, role);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Build map from cleaned hero name to role
const heroRoleMap = {};

// Manual mappings for cases where image name differs significantly from video name
const manualMappings = {
    '디바': '돌격',
    '솔저76': '공격', 
    '위도우메이커': '공격',
    '라인하르트': '돌격',
    '라이프위버': '지원',
    '제트팩캣': '지원',
    // Add others if needed based on inspection
};
// Note: While manual mappings are good, I'll try to automate derived names too.

function cleanName(name) {
    // Remove extension
    const base = path.parse(name).name;
    // Remove all characters except hangul, alphanumeric, dots, and spaces
    return base.replace(/[^가-힣a-zA-Z0-9.\s]/g, ''); 
}

// 1. Scan img/hero to build the map
if (fs.existsSync(imgHeroDir)) {
    const roles = fs.readdirSync(imgHeroDir);
    roles.forEach(role => {
        const roleDir = path.join(imgHeroDir, role);
        if (fs.statSync(roleDir).isDirectory()) {
            const files = fs.readdirSync(roleDir);
            files.forEach(file => {
                if (file.startsWith('.')) return; // skip .DS_Store etc
                
                const cleaned = cleanName(file);
                heroRoleMap[cleaned] = role;
                console.log(`Mapped Image: ${file} (Cleaned: ${cleaned}) -> ${role}`);
            });
        }
    });
} else {
    console.error(`Directory not found: ${imgHeroDir}`);
}

// Add/Overwrite manual mappings if necessary
// Manual fix for hero names that don't match cleanly between image (English/Complex) and video (Korean/Clean)
const manualFixes = {
    '루시우': '지원',     // Just in case
    '토르비욘': '공격'    // Just in case
};
Object.assign(heroRoleMap, manualFixes); 


console.log('--- Hero Role Map Built ---');

// 2. Scan videos/ and move files
if (fs.existsSync(videosDir)) {
    const videoFiles = fs.readdirSync(videosDir);
    videoFiles.forEach(file => {
        if (file.startsWith('.')) return;
        
        const sourcePath = path.join(videosDir, file);
        // Clean video filename to match key
        const videoNameCleaned = cleanName(file);
        
        const role = heroRoleMap[videoNameCleaned];
        
        if (role) {
            const destDir = path.join(targetBaseDir, role);
            const destPath = path.join(destDir, file);
            
            // Move file
            // fs.renameSync(sourcePath, destPath); // Uncomment to actually move
            // For safety, let's copy then delete, or just rename if on same volume.
            // renameSync is atomic on POSIX.
            
            try {
                fs.renameSync(sourcePath, destPath);
                console.log(`Moved: ${file} -> ${role}/${file}`);
            } catch (err) {
                console.error(`Failed to move ${file}: ${err.message}`);
            }
        } else {
            console.warn(`Skipped: ${file} (No matching role found for cleaned name: ${videoNameCleaned})`);
        }
    });
} else {
    console.error(`Directory not found: ${videosDir}`);
}
