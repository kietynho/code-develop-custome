const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// --- CẤU HÌNH ---
let CONFIG = {
    particleSize: 3,      // Kích thước hạt (LED)
    gap: 7,               // Khoảng cách giữa các hạt (độ mịn)
    snapSpeed: 0.1,       // Tốc độ bay của hạt
    matrixSpeed: 16       // Cỡ chữ Matrix rơi
};

let width, height;
let particles = [];
let fireworks = [];
let matrixDrops = [];
let isFireworkStage = false;
let timer = null;
let msgIndex = 0;
const messages = ["3", "2", "1", "HAPPY", "BIRTH DAY", "NgocAnh"];

// Màu sắc Matrix (Cầu vồng tĩnh theo cột)
let matrixColors = [];

// --- KHỞI TẠO & RESPONSIVE ---
function init() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    
    // Cấu hình lại Matrix Rain khi resize
    const columns = Math.floor(width / CONFIG.matrixSpeed);
    matrixDrops = Array(columns).fill(1);
    matrixColors = Array(columns).fill(0).map(() => `hsl(${Math.random() * 360}, 100%, 50%)`);

    // Nếu đang hiện chữ, cần tính toán lại vị trí hạt ngay lập tức
    if (!isFireworkStage && particles.length > 0) {
        // Gọi lại hàm tạo hạt cho chữ hiện tại
        createParticles(messages[msgIndex > 0 ? msgIndex - 1 : 0]); 
    }
}

window.addEventListener('resize', init);
init(); // Chạy lần đầu

// --- XỬ LÝ TEXT THÀNH HẠT (SCAN PIXEL) ---
function createParticles(text) {
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');
    
    offCanvas.width = width;
    offCanvas.height = height;

    // Font chữ TỰ ĐỘNG co giãn theo màn hình
    const fontSize = Math.min(width / (text.length > 2 ? 6 : 3), height / 3);
    
    offCtx.font = `bold ${fontSize}px Arial`;
    offCtx.fillStyle = "white";
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.fillText(text, width / 2, height / 2);

    const data = offCtx.getImageData(0, 0, width, height).data;
    
    // Thuật toán tái sử dụng hạt cũ (để tạo hiệu ứng bay từ chữ này sang chữ kia)
    let newTargets = [];
    
    for (let y = 0; y < height; y += CONFIG.gap) {
        for (let x = 0; x < width; x += CONFIG.gap) {
            if (data[(y * width + x) * 4 + 3] > 128) {
                newTargets.push({ x, y });
            }
        }
    }

    // Đồng bộ số lượng hạt
    if (particles.length < newTargets.length) {
        const diff = newTargets.length - particles.length;
        for (let i = 0; i < diff; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                currX: Math.random() * width, // Vị trí hiện tại
                currY: Math.random() * height,
                targetX: 0,
                targetY: 0
            });
        }
    } else if (particles.length > newTargets.length) {
        particles.splice(newTargets.length);
    }

    // Gán target mới
    newTargets.forEach((t, i) => {
        particles[i].targetX = t.x;
        particles[i].targetY = t.y;
    });
}

function nextMessage() {
    if (msgIndex < messages.length) {
        createParticles(messages[msgIndex]);
        msgIndex++;
        // Số đếm nhanh (1s), chữ dài chậm hơn (2.5s)
        const delay = messages[msgIndex-1].length < 2 ? 1000 : 2500;
        timer = setTimeout(nextMessage, delay);
    } else {
        isFireworkStage = true;
        particles = []; // Xóa hạt chữ để chuyển sang pháo hoa
    }
}

// Bắt đầu chạy chữ
nextMessage();

// --- PHÁO HOA LOGIC ---
class Firework {
    constructor(type) {
        this.type = type; // 'heart', 'name', 'normal'
        this.x = Math.random() * (width - 100) + 50;
        this.y = height;
        this.targetY = height * 0.2 + Math.random() * (height * 0.3);
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -(Math.random() * 3 + 8); // Tốc độ bắn lên
        this.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
        this.exploded = false;
        this.trail = [];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.12; // Trọng lực

        // Tạo đuôi
        this.trail.push({x: this.x, y: this.y, alpha: 1});
        if (this.trail.length > 8) this.trail.shift();

        if (this.vy >= 0 || this.y <= this.targetY) {
            this.explode();
            return false; // Rocket chết
        }
        return true; // Rocket sống
    }

    draw() {
        ctx.fillStyle = this.color;
        // Vẽ đuôi
        this.trail.forEach(t => {
            ctx.globalAlpha = t.alpha;
            ctx.fillRect(t.x, t.y, 2, 2);
            t.alpha -= 0.1;
        });
        ctx.globalAlpha = 1;
        // Vẽ đầu đạn
        ctx.fillRect(this.x, this.y, 4, 4);
    }

    explode() {
        if (this.type === 'heart') {
            createHeartExplosion(this.x, this.y);
        } else if (this.type === 'name') {
            createNameExplosion(this.x, this.y);
        } else {
            createNormalExplosion(this.x, this.y, this.color);
        }
    }
}

class Spark {
    constructor(x, y, vx, vy, color, textSpark = false) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color;
        this.alpha = 1;
        this.friction = textSpark ? 0.92 : 0.95; // Chữ bay chậm hơn
        this.gravity = textSpark ? 0.02 : 0.05;  // Chữ rơi chậm hơn
        this.size = textSpark ? 1.5 : Math.random() * 2 + 1;
    }
    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.012;
    }
    draw() {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
    }
}

function createNormalExplosion(x, y, color) {
    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        fireworks.push(new Spark(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color));
    }
}

function createHeartExplosion(x, y) {
    for (let i = 0; i < 80; i++) {
        const angle = (i / 40) * Math.PI; // Vẽ nửa trái tim rồi đối xứng
        const r = 3;
        // Công thức tim
        const vx = r * 16 * Math.pow(Math.sin(angle), 3);
        const vy = -r * (13 * Math.cos(angle) - 5 * Math.cos(2*angle) - 2 * Math.cos(3*angle) - Math.cos(4*angle));
        
        fireworks.push(new Spark(x, y, vx/15, vy/15, "#ff3366")); 
    }
}

function createNameExplosion(x, y) {
    // Tạm dừng vẽ lên canvas chính để lấy tọa độ chữ
    const offC = document.createElement('canvas');
    offC.width = width; offC.height = height;
    const offCtx = offC.getContext('2d');
    
    // Scale chữ nhỏ để vừa vụ nổ
    const fontSize = Math.min(width/10, 60); 
    offCtx.font = `900 ${fontSize}px Arial`;
    offCtx.fillStyle = "white";
    offCtx.textAlign = "center";
    offCtx.fillText("NgocAnh", width/2, height/2); // Vẽ ở giữa canvas ảo

    const data = offCtx.getImageData(0, 0, width, height).data;
    const step = 4;
    
    for (let r = 0; r < height; r += step) {
        for (let c = 0; c < width; c += step) {
            if (data[(r * width + c) * 4 + 3] > 128) {
                // Tính vector khoảng cách từ tâm canvas đến điểm chữ
                const dx = (c - width/2) * 0.1; // * 0.1 để thu nhỏ lại gần điểm nổ
                const dy = (r - height/2) * 0.1;
                
                // Tạo hạt tại vị trí nổ (x, y) nhưng có vận tốc hướng ra ngoài tạo thành hình chữ
                // Hoặc dịch chuyển vị trí hạt tới đúng hình dáng chữ luôn
                let s = new Spark(x + (c - width/2)*0.5, y + (r - height/2)*0.5, 0, 0, "#00ffff", true);
                s.alpha = 1.5; // Sáng hơn
                fireworks.push(s);
            }
        }
    }
}

// --- VÒNG LẶP CHÍNH (RENDER LOOP) ---
let rockets = [];

function animate() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; // Xóa mờ (tạo đuôi)
    ctx.fillRect(0, 0, width, height);

    // 1. Matrix Rain (Chạy nền)
    if (!isFireworkStage) {
        ctx.font = CONFIG.matrixSpeed + "px monospace";
        for (let i = 0; i < matrixDrops.length; i++) {
            ctx.fillStyle = matrixColors[i % matrixColors.length];
            const text = String.fromCharCode(0x30A0 + Math.random() * 96);
            ctx.fillText(text, i * CONFIG.matrixSpeed, matrixDrops[i] * CONFIG.matrixSpeed);
            if (matrixDrops[i] * CONFIG.matrixSpeed > height && Math.random() > 0.98) matrixDrops[i] = 0;
            matrixDrops[i]++;
        }
    }

    // 2. Chữ hạt (Particle Text)
    if (!isFireworkStage) {
        particles.forEach(p => {
            // Linear Interpolation: Di chuyển mượt về đích
            p.currX += (p.targetX - p.currX) * CONFIG.snapSpeed;
            p.currY += (p.targetY - p.currY) * CONFIG.snapSpeed;
            
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(p.currX, p.currY, CONFIG.particleSize, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 3. Pháo hoa
    if (isFireworkStage) {
        // Tự động bắn
        if (Math.random() < 0.04) {
            let type = 'normal';
            const r = Math.random();
            if (r > 0.6) type = 'heart';
            if (r > 0.85) type = 'name';
            rockets.push(new Firework(type));
        }

        // Cập nhật Rockets
        rockets = rockets.filter(r => r.update());
        rockets.forEach(r => r.draw());

        // Cập nhật Sparks
        fireworks = fireworks.filter(s => s.alpha > 0);
        fireworks.forEach(s => {
            s.update();
            s.draw();
        });
    }

    requestAnimationFrame(animate);
}

animate();