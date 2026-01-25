const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 설정
const PORT = 3000;

// 미들웨어
app.use(express.static('public'));
app.use('/img', express.static('img')); // 기존 영웅 이미지 폴더
app.use('/fonts', express.static('fonts')); // 폰트 폴더
app.use('/uploads', express.static('uploads')); // 업로드된 로고 폴더
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 파일 업로드 설정 (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // 파일명 중복 방지를 위해 timestamp 추가
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 초기 상태 데이터 (메모리 저장)
let currentState = {
    matchName: 'KHU Espers', // [추가] 경기 이름
    matchSet: 'SET 1 ㅣ MAP',       // [추가] 세트 수
    leftTeam: {
        name: 'TEAM A',
        score: 0,
        ban: '', // ban 이미지 파일명 (예: ana.png)
        logo: '', // 로고 이미지 경로
        role: 'attack', // attack 또는 defend
        roleColor: '#02f7f8',
        showBan: true,
        showLogo: true,
        showRole: true
    },
    rightTeam: {
        name: 'TEAM B',
        score: 0,
        ban: '',
        logo: '',
        role: 'defend',
        roleColor: '#e6335a',
        showBan: true,
        showLogo: true,
        showRole: true
    }
};

// 라우팅
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get('/master', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'master.html'));
});

// 예시 화면 라우팅
app.get('/example', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'example.html'));
});

// 영웅 리스트 API
app.get('/api/heroes', (req, res) => {
    const heroDir = path.join(__dirname, 'img', 'hero');
    fs.readdir(heroDir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json([]);
        }
        // 이미지 파일만 필터링
        const images = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
        res.json(images);
    });
});

// 로고 업로드 API
app.post('/api/upload', upload.single('logoFile'), (req, res) => {
    if (req.file) {
        res.json({ path: '/uploads/' + req.file.filename });
    } else {
        res.status(400).send('No file uploaded');
    }
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
    console.log('A user connected');

    // 새로 접속한 클라이언트에게 현재 상태 전송
    socket.emit('updateState', currentState);

    // 마스터 페이지에서 상태 업데이트 요청 시
    socket.on('updateState', (newState) => {
        currentState = newState;
        // 모든 클라이언트(오버레이)에 변경된 상태 전송
        io.emit('updateState', currentState);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

http.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
