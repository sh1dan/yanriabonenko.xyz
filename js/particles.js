const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });
const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, lastX: 0, lastY: 0, active: false };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let particles = [];
let width = 0;
let height = 0;
let resizeTimeout;
let lastFrame = 0;

const SOCIAL_LINKS = {
    telegram: 'https://t.me/yanriabonenko',
    instagram: 'https://www.instagram.com/yanriabonenko',
    twitch: 'https://www.twitch.tv/sh1dan'
};
const SVG_ICONS = {
    telegram: new Path2D('M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z')
};
let socialHitAreas = [];
let pointerStart = { x: 0, y: 0, time: 0 };

function isMobileDevice() {
    return width < 768 || (width < 900 && height > width);
}

function getSettings() {
    const isMobile = isMobileDevice();
    return {
        isMobile,
        step: isMobile ? 2.4 : 3.0,
        particleSize: isMobile ? 1.35 : 1.35,
        mouseRadius: isMobile
            ? Math.max(54, Math.min(80, width * 0.17))
            : Math.max(48, Math.min(74, width * 0.045))
    };
}

function setupCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    textCanvas.width = width;
    textCanvas.height = height;
    pointer.active = false;
}

function drawRoundRect(c, x, y, w, h, r) {
    c.beginPath();
    if (typeof c.roundRect === 'function') {
        c.roundRect(x, y, w, h, r);
    } else {
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.arcTo(x + w, y, x + w, y + r, r);
        c.lineTo(x + w, y + h - r);
        c.arcTo(x + w, y + h, x + w - r, y + h, r);
        c.lineTo(x + r, y + h);
        c.arcTo(x, y + h, x, y + h - r, r);
        c.lineTo(x, y + r);
        c.arcTo(x, y, x + r, y, r);
        c.closePath();
    }
}

// Custom SH1DAN lettering + Instagram icon below
function drawNameMask() {
    const glyphs = [
        { width: 70, strokes: [[[70, 0], [6, 0], [0, 43], [62, 43], [55, 100], [0, 100]]] },
        { width: 70, strokes: [[[10, 0], [10, 100]], [[60, 0], [60, 100]], [[0, 44], [70, 44]]] },
        { width: 42, strokes: [[[0, 18], [30, 0], [30, 100]]] },
        { width: 70, strokes: [[[0, 0], [64, 0], [64, 76], [46, 100], [6, 100]], [[10, 0], [10, 100]]] },
        { width: 70, strokes: [[[0, 100], [8, 0], [62, 0], [70, 100]], [[4, 46], [66, 46]]] },
        { width: 70, strokes: [[[0, 100], [0, 0], [62, 100], [70, 100], [70, 0]]] }
    ];
    const gap = 18;
    const letteringWidth = glyphs.reduce((sum, glyph) => sum + glyph.width, 0) + gap * (glyphs.length - 1);
    const isMobile = isMobileDevice();
    const isPortrait = height > width;

    const maxAllowedWidth = isMobile
        ? (isPortrait ? width * 0.88 : Math.min(width * 0.82, 540))
        : Math.min(width * 0.82, 660);

    const maxAllowedHeight = isMobile && isPortrait
        ? Math.min(height * 0.22, 140)
        : Math.min(height * 0.26, 180);

    const scale = Math.min(maxAllowedWidth / letteringWidth, maxAllowedHeight / 100);

    // 1. Text is placed perfectly in the center of the screen
    const originX = (width - letteringWidth * scale) / 2;
    const originY = (height - 100 * scale) / 2;

    textCtx.save();
    textCtx.translate(originX, originY);
    textCtx.scale(scale, scale);
    textCtx.strokeStyle = '#fff';
    textCtx.fillStyle = '#fff';
    textCtx.lineWidth = isMobile ? 16 : 15;
    textCtx.lineJoin = 'miter';
    textCtx.miterLimit = 2;
    textCtx.lineCap = 'square';

    for (const glyph of glyphs) {
        for (const stroke of glyph.strokes) {
            textCtx.beginPath();
            stroke.forEach(([x, y], index) => {
                if (index === 0) textCtx.moveTo(x, y);
                else textCtx.lineTo(x, y);
            });
            textCtx.stroke();
        }
        textCtx.translate(glyph.width + gap, 0);
    }
    textCtx.restore();

    // 2. Social Icons Row (Telegram, Instagram, Twitch) at the BOTTOM CENTER
    const iconSize = isMobile ? 30 : 34;
    const gapIcons = isMobile ? 32 : 44;
    const bottomPadding = isMobile ? 46 : 52;
    const iconCenterY = height - bottomPadding;
    const tgCenterX = width / 2 - (iconSize + gapIcons);
    const igCenterX = width / 2;
    const twitchCenterX = width / 2 + (iconSize + gapIcons);
    const hitRadius = Math.max(24, iconSize * 0.75);

    socialHitAreas = [
        { type: 'telegram', url: SOCIAL_LINKS.telegram, x: tgCenterX, y: iconCenterY, radius: hitRadius },
        { type: 'instagram', url: SOCIAL_LINKS.instagram, x: igCenterX, y: iconCenterY, radius: hitRadius },
        { type: 'twitch', url: SOCIAL_LINKS.twitch, x: twitchCenterX, y: iconCenterY, radius: hitRadius }
    ];

    // --- TELEGRAM ICON (Left) ---
    // Render official Telegram paper plane via official SVG Path2D
    textCtx.save();
    textCtx.translate(tgCenterX, iconCenterY);
    const tgScale = (iconSize * 1.45) / 24;
    textCtx.scale(tgScale, tgScale);
    textCtx.translate(-11.7, -11.6);
    textCtx.fillStyle = '#fff';
    textCtx.fill(SVG_ICONS.telegram);
    textCtx.strokeStyle = '#fff';
    textCtx.lineWidth = 1.0;
    textCtx.stroke(SVG_ICONS.telegram);
    textCtx.restore();

    // --- INSTAGRAM ICON (Center) ---
    textCtx.save();
    textCtx.strokeStyle = '#fff';
    textCtx.fillStyle = '#fff';
    textCtx.lineJoin = 'round';
    textCtx.lineCap = 'round';
    const halfIg = iconSize / 2;
    const cornerR = iconSize * 0.28;

    textCtx.lineWidth = isMobile ? 3.8 : 4.2;
    drawRoundRect(textCtx, igCenterX - halfIg, iconCenterY - halfIg, iconSize, iconSize, cornerR);
    textCtx.stroke();

    textCtx.beginPath();
    textCtx.arc(igCenterX, iconCenterY, iconSize * 0.22, 0, Math.PI * 2);
    textCtx.lineWidth = isMobile ? 3.0 : 3.4;
    textCtx.stroke();

    textCtx.beginPath();
    textCtx.arc(igCenterX + iconSize * 0.26, iconCenterY - iconSize * 0.26, isMobile ? 1.8 : 2.2, 0, Math.PI * 2);
    textCtx.fill();
    textCtx.restore();

    // --- TWITCH ICON (Right) ---
    textCtx.save();
    textCtx.strokeStyle = '#fff';
    textCtx.fillStyle = '#fff';
    textCtx.lineJoin = 'miter';
    textCtx.lineCap = 'square';

    const twW = iconSize * 0.94;
    const twH = iconSize * 0.92;
    const twLeft = twitchCenterX - twW / 2;
    const twTop = iconCenterY - twH / 2;
    const twRight = twLeft + twW;
    const twBottom = twTop + twH * 0.76;
    const twTailY = twTop + twH;
    const twCutX = twitchCenterX - twW * 0.10;
    const twTailX = twitchCenterX - twW * 0.28;

    textCtx.lineWidth = isMobile ? 3.4 : 3.8;
    textCtx.beginPath();
    textCtx.moveTo(twLeft, twTop);
    textCtx.lineTo(twRight, twTop);
    textCtx.lineTo(twRight, twBottom);
    textCtx.lineTo(twCutX, twBottom);
    textCtx.lineTo(twTailX, twTailY);
    textCtx.lineTo(twTailX, twBottom);
    textCtx.lineTo(twLeft, twBottom);
    textCtx.closePath();
    textCtx.stroke();

    // Eyes
    const eyeW = isMobile ? 2.8 : 3.2;
    textCtx.lineWidth = eyeW;
    const eyeTop = iconCenterY - twH * 0.18;
    const eyeBottom = iconCenterY + twH * 0.14;
    const eyeOffset = twW * 0.16;

    textCtx.beginPath();
    textCtx.moveTo(twitchCenterX - eyeOffset, eyeTop);
    textCtx.lineTo(twitchCenterX - eyeOffset, eyeBottom);
    textCtx.stroke();

    textCtx.beginPath();
    textCtx.moveTo(twitchCenterX + eyeOffset, eyeTop);
    textCtx.lineTo(twitchCenterX + eyeOffset, eyeBottom);
    textCtx.stroke();
    textCtx.restore();
}

function createParticles() {
    const { step, particleSize } = getSettings();
    textCtx.clearRect(0, 0, width, height);
    drawNameMask();
    const { data } = textCtx.getImageData(0, 0, width, height);
    particles = [];

    // Y threshold for bottom social icons row
    const bottomSocialY = (socialHitAreas[0]?.y || (height - 60)) - 35;
    const midX = width / 2;
    const gap = (socialHitAreas[1]?.x - socialHitAreas[0]?.x) || 70;
    const splitLeft = midX - gap / 2;
    const splitRight = midX + gap / 2;

    for (let py = 0; py < height; py += step) {
        for (let px = 0; px < width; px += step) {
            const sampleX = Math.max(0, Math.min(width - 1, px + (Math.random() - 0.5) * step));
            const sampleY = Math.max(0, Math.min(height - 1, py + (Math.random() - 0.5) * step));
            if (data[(Math.floor(sampleY) * width + Math.floor(sampleX)) * 4 + 3] > 180) {
                let socialType = null;
                if (sampleY >= bottomSocialY) {
                    if (sampleX < splitLeft) socialType = 'telegram';
                    else if (sampleX > splitRight) socialType = 'twitch';
                    else socialType = 'instagram';
                }
                particles.push({
                    x: sampleX, y: sampleY, baseX: sampleX, baseY: sampleY,
                    vx: 0, vy: 0,
                    size: particleSize * (socialType ? 1.05 : (0.8 + Math.random() * 0.4)),
                    density: 6 + Math.random() * 38,
                    interactionScale: 0.88 + Math.random() * 0.24,
                    phase: Math.random() * Math.PI * 2,
                    socialType: socialType
                });
            }
        }
    }
}

function animate(time) {
    const elapsed = lastFrame ? Math.min((time - lastFrame) / 16.667, 3) : 1;
    lastFrame = time;
    const { mouseRadius, isMobile } = getSettings();
    const isBigShot = document.body.classList.contains('BigShotMode');

    ctx.clearRect(0, 0, width, height);

    const effectiveRadius = isBigShot ? mouseRadius * 1.3 : mouseRadius;
    const orbitDistance = reducedMotion.matches ? 0 : (isMobile ? Math.min(1.2, width * 0.003) : Math.min(1.5, width * 0.002));

    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        // Floating idle orbit
        particle.phase += (isBigShot ? 0.045 : 0.012) * elapsed;

        // Big Shot chaotic jitter & dynamic undulating dance for nickname
        const jitterX = isBigShot ? (Math.random() - 0.5) * 3 : 0;
        const jitterY = isBigShot ? (Math.random() - 0.5) * 3 : 0;

        let waveX = 0;
        let waveY = 0;
        if (isBigShot && !particle.socialType) {
            waveX = Math.sin(time * 0.0035 + particle.baseY * 0.035) * 7
                  + Math.sin(time * 0.005 + particle.baseX * 0.02) * 4;
            waveY = Math.cos(time * 0.003 + particle.baseX * 0.03) * 7
                  + Math.sin(time * 0.0045 + particle.baseY * 0.02) * 4;
        }

        const targetX = particle.baseX + Math.sin(particle.phase) * orbitDistance + jitterX + waveX;
        const targetY = particle.baseY + Math.cos(particle.phase * 0.8) * orbitDistance + jitterY + waveY;

        if (pointer.active) {
            const dx = pointer.x - particle.x;
            const dy = pointer.y - particle.y;
            const dist = Math.hypot(dx, dy);

            if (!particle.socialType) {
                // Nickname particles: follow and chase after the cursor
                const chaseRadius = isMobile ? Math.max(90, width * 0.22) : Math.max(120, width * 0.09);
                if (dist < chaseRadius) {
                    const proximity = 1 - dist / chaseRadius;
                    // 1. Drag along cursor trajectory (wake / chasing momentum)
                    const wakePower = proximity * 0.38;
                    particle.vx += pointer.vx * wakePower;
                    particle.vy += pointer.vy * wakePower;

                    // 2. Attraction towards cursor (chasing effect)
                    if (dist > 22) {
                        const pull = proximity * 0.042 * particle.interactionScale;
                        particle.vx += dx * pull;
                        particle.vy += dy * pull;
                    } else {
                        // Gentle cushion near cursor center
                        const push = (1 - dist / 22) * 1.5;
                        const normX = dist > 0.001 ? dx / dist : 0;
                        const normY = dist > 0.001 ? dy / dist : 0;
                        particle.vx -= normX * push;
                        particle.vy -= normY * push;
                    }
                }
            } else {
                // Social icon particles: gentle repulsion
                const radius = effectiveRadius * particle.interactionScale;
                if (dist < radius) {
                    const falloff = (1 - dist / radius) ** 2;
                    const force = falloff * 0.45 * elapsed;
                    const normX = dist > 0.001 ? dx / dist : 0;
                    const normY = dist > 0.001 ? dy / dist : 0;
                    particle.vx -= normX * force;
                    particle.vy -= normY * force;
                }
            }
        }

        // Spring physics: return smoothly towards target
        const springK = particle.socialType ? 0.08 : 0.042;
        const damping = particle.socialType ? 0.82 : 0.86;

        particle.vx += (targetX - particle.x) * springK;
        particle.vy += (targetY - particle.y) * springK;

        particle.vx *= Math.pow(damping, elapsed);
        particle.vy *= Math.pow(damping, elapsed);

        particle.x += particle.vx * elapsed;
        particle.y += particle.vy * elapsed;
    }

    // Dampen pointer velocity after distributing impulse
    pointer.vx *= Math.pow(0.55, elapsed);
    pointer.vy *= Math.pow(0.55, elapsed);

    // 1. Draw Text particles in clean white
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = isMobile ? 1 : 3;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.socialType) {
            ctx.moveTo(p.x + p.size, p.y);
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
    }
    ctx.fill();

    // 2. Draw Telegram icon in Telegram Blue
    ctx.fillStyle = '#229ED9';
    ctx.shadowColor = 'rgba(34, 158, 217, 0.8)';
    ctx.shadowBlur = isMobile ? 2 : 4;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.socialType === 'telegram') {
            ctx.moveTo(p.x + p.size, p.y);
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
    }
    ctx.fill();

    // 3. Draw Instagram icon in official sunset gradient
    const igArea = socialHitAreas[1] || { x: width / 2, y: height - 50, radius: 20 };
    const r = igArea.radius;
    const igGrad = ctx.createLinearGradient(
        igArea.x - r, igArea.y + r,
        igArea.x + r, igArea.y - r
    );
    igGrad.addColorStop(0.0, '#feda75');  // Warm Yellow
    igGrad.addColorStop(0.25, '#fa7e1e'); // Bright Orange
    igGrad.addColorStop(0.55, '#d62976'); // Magenta / Red
    igGrad.addColorStop(0.80, '#962fbf'); // Royal Purple
    igGrad.addColorStop(1.0, '#4f5bd5');  // Deep Blue

    ctx.fillStyle = igGrad;
    ctx.shadowColor = 'rgba(214, 41, 118, 0.7)';
    ctx.shadowBlur = isMobile ? 2 : 4;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.socialType === 'instagram') {
            ctx.moveTo(p.x + p.size, p.y);
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
    }
    ctx.fill();

    // 4. Draw Twitch icon in official Twitch Purple
    ctx.fillStyle = '#9146FF';
    ctx.shadowColor = 'rgba(145, 70, 255, 0.85)';
    ctx.shadowBlur = isMobile ? 2 : 4;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.socialType === 'twitch') {
            ctx.moveTo(p.x + p.size, p.y);
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
    }
    ctx.fill();

    requestAnimationFrame(animate);
}

function resetPointer() {
    pointer.active = false;
    pointer.vx = 0;
    pointer.vy = 0;
}

function updatePointerPosition(x, y) {
    if (pointer.active) {
        pointer.vx = x - pointer.x;
        pointer.vy = y - pointer.y;
    } else {
        pointer.vx = 0;
        pointer.vy = 0;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
}

function getHoveredSocial(x, y) {
    for (const area of socialHitAreas) {
        if (Math.hypot(x - area.x, y - area.y) <= area.radius) {
            return area;
        }
    }
    return null;
}

// Pointer Events (Unified Mouse, Pen, Touch)
window.addEventListener('pointerdown', (e) => {
    pointerStart = { x: e.clientX, y: e.clientY, time: Date.now() };
    updatePointerPosition(e.clientX, e.clientY);
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || pointer.active) {
        updatePointerPosition(e.clientX, e.clientY);
    }
    // Change cursor to pointer when hovering over any social icon
    if (e.pointerType === 'mouse') {
        const hovered = getHoveredSocial(e.clientX, e.clientY);
        canvas.style.cursor = hovered ? 'pointer' : 'default';
    }
});

window.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    const duration = Date.now() - pointerStart.time;
    if (moved < 14 && duration < 600) {
        const clicked = getHoveredSocial(e.clientX, e.clientY);
        if (clicked && clicked.url) {
            window.open(clicked.url, '_blank');
        }
    }
    if (e.pointerType !== 'mouse') {
        resetPointer();
    }
});

window.addEventListener('pointercancel', resetPointer);
document.documentElement.addEventListener('pointerleave', resetPointer);
window.addEventListener('blur', resetPointer);

// Explicit Touch Event fallbacks for mobile Safari & Android browsers
window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
        updatePointerPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 0) {
        updatePointerPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

window.addEventListener('touchend', resetPointer, { passive: true });
window.addEventListener('touchcancel', resetPointer, { passive: true });

function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        setupCanvas();
        createParticles();
    }, 100);
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

setupCanvas();
createParticles();
requestAnimationFrame(animate);

