let audioUnlocked = false;

function tryPlayAudio() {
    const audio = document.getElementById("theme");
    if (!audio) return;
    audio.volume = 0.2;
    audio.play()
        .then(() => { audioUnlocked = true; })
        .catch(e => console.log("Autoplay waiting for user gesture:", e));
}

window.addEventListener("DOMContentLoaded", () => {
    tryPlayAudio();
});

// Unlock audio on first mobile tap or touch anywhere
function unlockOnInteraction() {
    if (!audioUnlocked) {
        tryPlayAudio();
    }
}
window.addEventListener('touchstart', unlockOnInteraction, { passive: true, once: true });
window.addEventListener('pointerdown', unlockOnInteraction, { passive: true, once: true });
window.addEventListener('click', unlockOnInteraction, { passive: true, once: true });

function bigshot_yes(e) {
    if (e && e.cancelable && e.type.startsWith('touch')) {
        e.preventDefault();
    }
    document.body.classList.add('BigShotMode');
    switchAudio('theme2.mp3');
}

function bigshot_no(e) {
    if (e && e.cancelable && e.type.startsWith('touch')) {
        e.preventDefault();
    }
    document.body.classList.remove('BigShotMode');
    switchAudio('theme.mp3');
}

function switchAudio(newSource) {
    const audio = document.getElementById("theme");
    const source = document.getElementById("audioSource");
    if (!audio || !source) return;

    if (source.src.endsWith(newSource)) return;

    audio.pause();
    source.src = './media/' + newSource;
    audio.load();
    audio.play().catch(e => console.log("Audio play error:", e));
}