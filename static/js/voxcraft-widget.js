/**
 * VoxCraft AI Web Voice Player - High-Performance Client Widget
 * Embeddable AI Text-to-Speech Player for articles, books, and web pages.
 */
(function () {
    if (window.__VOXCRAFT_INITIALIZED__) return;
    window.__VOXCRAFT_INITIALIZED__ = true;

    function initVoxCraft() {
        const playerEl = document.getElementById('voxcraft-player');
        if (!playerEl) return;

        // Parse attributes
        const apiKey = playerEl.getAttribute('data-key') || playerEl.getAttribute('data-api-key') || '';
        const accent = playerEl.getAttribute('data-accent') || '#6366f1';
        const voicePref = playerEl.getAttribute('data-voice') || 'voice-en-us-emma';
        const btnText = playerEl.getAttribute('data-text') || 'Listen to Page (AI Voice)';
        const position = playerEl.getAttribute('data-position') || 'bottom-left';
        const targetSelector = playerEl.getAttribute('data-target') || 'article, .post-content, main, body';

        // Styling
        const style = document.createElement('style');
        style.textContent = `
            #voxcraft-root {
                position: fixed;
                z-index: 9999;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                user-select: none;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #voxcraft-root.pos-bottom-left {
                bottom: 24px;
                left: 24px;
            }
            #voxcraft-root.pos-bottom-right {
                bottom: 24px;
                right: 96px;
            }
            .vx-pill-btn {
                display: flex;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
                color: #ffffff;
                padding: 10px 18px;
                border-radius: 9999px;
                border: 1px solid rgba(99, 102, 241, 0.4);
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(99, 102, 241, 0.3);
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.2px;
                transition: all 0.25s ease;
            }
            .vx-pill-btn:hover {
                transform: translateY(-2px) scale(1.02);
                border-color: rgba(99, 102, 241, 0.8);
                box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.7), 0 0 25px rgba(99, 102, 241, 0.5);
            }
            .vx-pill-btn svg {
                width: 18px;
                height: 18px;
                fill: none;
                stroke: ${accent};
                stroke-width: 2.2;
                stroke-linecap: round;
                stroke-linejoin: round;
                flex-shrink: 0;
            }
            .vx-panel {
                display: none;
                flex-direction: column;
                width: 320px;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(99, 102, 241, 0.35);
                border-radius: 24px;
                padding: 18px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25);
                color: #f8fafc;
                margin-bottom: 12px;
                animation: vxSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes vxSlideUp {
                from { opacity: 0; transform: translateY(12px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .vx-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }
            .vx-title-wrap {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .vx-badge {
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
                background: ${accent};
                color: #ffffff;
                padding: 2px 6px;
                border-radius: 6px;
                letter-spacing: 0.5px;
            }
            .vx-title {
                font-size: 13px;
                font-weight: 700;
                color: #ffffff;
            }
            .vx-close-btn {
                background: transparent;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s;
            }
            .vx-close-btn:hover {
                color: #ffffff;
                background: rgba(255, 255, 255, 0.1);
            }
            .vx-status-bar {
                font-size: 11px;
                color: #94a3b8;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .vx-waveforms {
                display: flex;
                align-items: center;
                gap: 3px;
                height: 16px;
            }
            .vx-bar {
                width: 3px;
                height: 4px;
                background: ${accent};
                border-radius: 2px;
                transition: height 0.15s ease;
            }
            .vx-playing .vx-bar:nth-child(1) { animation: vxWave 0.6s infinite ease-in-out 0.1s; }
            .vx-playing .vx-bar:nth-child(2) { animation: vxWave 0.6s infinite ease-in-out 0.2s; }
            .vx-playing .vx-bar:nth-child(3) { animation: vxWave 0.6s infinite ease-in-out 0.3s; }
            .vx-playing .vx-bar:nth-child(4) { animation: vxWave 0.6s infinite ease-in-out 0.4s; }
            .vx-playing .vx-bar:nth-child(5) { animation: vxWave 0.6s infinite ease-in-out 0.5s; }
            @keyframes vxWave {
                0%, 100% { height: 4px; }
                50% { height: 16px; }
            }
            .vx-progress-wrap {
                width: 100%;
                height: 5px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 14px;
                cursor: pointer;
            }
            .vx-progress-bar {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, ${accent}, #818cf8);
                transition: width 0.2s linear;
            }
            .vx-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            .vx-btn-circle {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: ${accent};
                color: #ffffff;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                transition: all 0.2s;
            }
            .vx-btn-circle:hover {
                transform: scale(1.08);
                filter: brightness(1.15);
            }
            .vx-btn-circle svg {
                width: 20px;
                height: 20px;
                fill: currentColor;
            }
            .vx-sec-btn {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
                font-size: 11px;
                font-weight: 700;
                padding: 6px 10px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .vx-sec-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                color: #ffffff;
            }
            .vx-select {
                background: #090d16;
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 5px 8px;
                border-radius: 10px;
                font-size: 11px;
                outline: none;
                cursor: pointer;
                max-width: 110px;
            }
        `;
        document.head.appendChild(style);

        // Build HTML
        const container = document.createElement('div');
        container.id = 'voxcraft-root';
        container.className = position === 'bottom-right' ? 'pos-bottom-right' : 'pos-bottom-left';

        container.innerHTML = `
            <div class="vx-panel" id="vxPanel">
                <div class="vx-header">
                    <div class="vx-title-wrap">
                        <span class="vx-badge">AI Audio</span>
                        <span class="vx-title">VoxCraft Player</span>
                    </div>
                    <button class="vx-close-btn" id="vxCloseBtn" title="Close player">
                        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div class="vx-status-bar">
                    <span id="vxStatusText">Ready to play</span>
                    <div class="vx-waveforms" id="vxWaveforms">
                        <div class="vx-bar"></div>
                        <div class="vx-bar"></div>
                        <div class="vx-bar"></div>
                        <div class="vx-bar"></div>
                        <div class="vx-bar"></div>
                    </div>
                </div>

                <div class="vx-progress-wrap" id="vxProgressWrap" title="Progress">
                    <div class="vx-progress-bar" id="vxProgressBar"></div>
                </div>

                <div class="vx-controls">
                    <select class="vx-select" id="vxVoiceSelect" title="Select Voice">
                        <option value="emma">Emma (US Natural)</option>
                        <option value="ava">Ava (Clear AI)</option>
                        <option value="david">David (Deep US)</option>
                        <option value="brian">Brian (UK Male)</option>
                    </select>

                    <button class="vx-btn-circle" id="vxPlayBtn" title="Play / Pause">
                        <svg id="vxPlayIcon" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
                        <svg id="vxPauseIcon" style="display:none;" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </button>

                    <button class="vx-sec-btn" id="vxSpeedBtn" title="Playback Speed">1.0x</button>
                    <button class="vx-sec-btn" id="vxStopBtn" title="Stop">■</button>
                </div>
            </div>

            <button class="vx-pill-btn" id="vxPillBtn">
                <svg viewBox="0 0 24 24">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
                <span>${btnText}</span>
            </button>
        `;

        document.body.appendChild(container);

        // Logic & State
        let isPlaying = false;
        let isPaused = false;
        let currentUtterance = null;
        let sentences = [];
        let currentSentenceIdx = 0;
        let playbackRate = 1.0;
        const speeds = [0.8, 1.0, 1.25, 1.5, 2.0];
        let speedIdx = 1;

        const pillBtn = document.getElementById('vxPillBtn');
        const panel = document.getElementById('vxPanel');
        const closeBtn = document.getElementById('vxCloseBtn');
        const playBtn = document.getElementById('vxPlayBtn');
        const playIcon = document.getElementById('vxPlayIcon');
        const pauseIcon = document.getElementById('vxPauseIcon');
        const stopBtn = document.getElementById('vxStopBtn');
        const speedBtn = document.getElementById('vxSpeedBtn');
        const voiceSelect = document.getElementById('vxVoiceSelect');
        const statusText = document.getElementById('vxStatusText');
        const progressBar = document.getElementById('vxProgressBar');
        const waveforms = document.getElementById('vxWaveforms');

        function extractReadableText() {
            const selectors = targetSelector.split(',').map(s => s.trim());
            let targetEl = null;
            for (const sel of selectors) {
                const found = document.querySelector(sel);
                if (found && found.innerText && found.innerText.trim().length > 50) {
                    targetEl = found;
                    break;
                }
            }
            if (!targetEl) targetEl = document.body;

            const clone = targetEl.cloneNode(true);
            const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', '#voxcraft-root', '#chatContainer', '#liveChatDrawer', '.modal', 'button'];
            removeSelectors.forEach(sel => {
                clone.querySelectorAll(sel).forEach(el => el.remove());
            });

            const rawText = clone.innerText || '';
            const cleaned = rawText
                .replace(/\s+/g, ' ')
                .replace(/https?:\/\/\S+/g, '')
                .trim();

            return cleaned.match(/[^.!?]+[.!?]+(\s+|$)/g) || [cleaned];
        }

        let availableVoices = [];
        function populateVoices() {
            if ('speechSynthesis' in window) {
                availableVoices = window.speechSynthesis.getVoices() || [];
            }
        }
        populateVoices();
        if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoices;
        }

        function getSelectedVoice() {
            const choice = voiceSelect.value;
            if (!availableVoices.length) populateVoices();
            
            if (choice === 'emma' || choice === 'ava') {
                return availableVoices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))) || availableVoices.find(v => v.lang.startsWith('en'));
            } else {
                return availableVoices.find(v => v.lang.startsWith('en') && (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google UK English Male'))) || availableVoices.find(v => v.lang.startsWith('en'));
            }
        }

        function playNextSentence() {
            if (!isPlaying) return;
            if (currentSentenceIdx >= sentences.length) {
                stopSpeech();
                statusText.innerText = 'Completed playback';
                return;
            }

            const sentence = sentences[currentSentenceIdx].trim();
            if (!sentence) {
                currentSentenceIdx++;
                playNextSentence();
                return;
            }

            const pct = Math.round(((currentSentenceIdx + 1) / sentences.length) * 100);
            progressBar.style.width = `${pct}%`;
            statusText.innerText = `Reading section ${currentSentenceIdx + 1}/${sentences.length}...`;

            currentUtterance = new SpeechSynthesisUtterance(sentence);
            currentUtterance.rate = playbackRate;
            
            const voice = getSelectedVoice();
            if (voice) currentUtterance.voice = voice;

            currentUtterance.onend = () => {
                currentSentenceIdx++;
                playNextSentence();
            };

            currentUtterance.onerror = (e) => {
                console.warn('Speech error', e);
                currentSentenceIdx++;
                playNextSentence();
            };

            window.speechSynthesis.speak(currentUtterance);
        }

        function startSpeech() {
            if (!('speechSynthesis' in window)) {
                alert('Text-to-speech is not supported in this browser.');
                return;
            }

            if (isPaused) {
                window.speechSynthesis.resume();
                isPlaying = true;
                isPaused = false;
                updateUIState(true);
                return;
            }

            sentences = extractReadableText();
            if (!sentences || !sentences.length) {
                statusText.innerText = 'No readable text found on page';
                return;
            }

            currentSentenceIdx = 0;
            isPlaying = true;
            isPaused = false;
            updateUIState(true);
            window.speechSynthesis.cancel();
            playNextSentence();
        }

        function pauseSpeech() {
            if ('speechSynthesis' in window && isPlaying) {
                window.speechSynthesis.pause();
                isPlaying = false;
                isPaused = true;
                updateUIState(false);
                statusText.innerText = 'Paused';
            }
        }

        function stopSpeech() {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            isPlaying = false;
            isPaused = false;
            currentSentenceIdx = 0;
            progressBar.style.width = '0%';
            updateUIState(false);
            statusText.innerText = 'Ready to play';
        }

        function updateUIState(playing) {
            if (playing) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
                waveforms.classList.add('vx-playing');
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                waveforms.classList.remove('vx-playing');
            }
        }

        pillBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
            if (panel.style.display === 'flex' && !isPlaying && !isPaused) {
                startSpeech();
            }
        });

        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        playBtn.addEventListener('click', () => {
            if (isPlaying) {
                pauseSpeech();
            } else {
                startSpeech();
            }
        });

        stopBtn.addEventListener('click', () => {
            stopSpeech();
        });

        speedBtn.addEventListener('click', () => {
            speedIdx = (speedIdx + 1) % speeds.length;
            playbackRate = speeds[speedIdx];
            speedBtn.innerText = `${playbackRate}x`;
            if (isPlaying) {
                window.speechSynthesis.cancel();
                playNextSentence();
            }
        });

        voiceSelect.addEventListener('change', () => {
            if (isPlaying) {
                window.speechSynthesis.cancel();
                playNextSentence();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVoxCraft);
    } else {
        initVoxCraft();
    }
})();
