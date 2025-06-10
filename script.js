// 变量声明
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isProcessing = false;
let recordingTimerInterval;
let recordingSeconds = 0;
let enrollTimer;
let enrollSeconds = 0;
let audio = new Audio();
let soundWaveAnimationId;
let systemSettings = {
    kwsEnabled: true,
    svEnabled: false,
    kwsText: "站起来"
};

// 获取DOM元素
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const enrollSvBtn = document.getElementById('enroll-sv-btn');
const updateKwsBtn = document.getElementById('update-kws-btn');
const kwsSwitch = document.getElementById('kws-switch');
const svSwitch = document.getElementById('sv-switch');
const kwsText = document.getElementById('kws-text');
const svStatus = document.getElementById('sv-status');
const assistantStatus = document.getElementById('assistant-status');
const recordingStatus = document.getElementById('recording-status');
const conversationHistory = document.getElementById('conversation-history');
const modal = document.getElementById('modal');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
const closeBtn = document.querySelector('.close-btn');
const recordingTimerDisplay = document.getElementById('recording-timer');
const voiceIndicator = document.getElementById('voice-indicator');
const soundWave = document.getElementById('sound-wave');

// 服务器端点
const API_ENDPOINT = window.location.protocol + '//' + window.location.hostname + ':5000';

// 页面加载时检查系统状态
document.addEventListener('DOMContentLoaded', checkSystemStatus);

// 绑定事件监听器
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
clearBtn.addEventListener('click', clearConversation);
enrollSvBtn.addEventListener('click', showEnrollModal);
updateKwsBtn.addEventListener('click', updateKeyword);
kwsSwitch.addEventListener('change', toggleKws);
svSwitch.addEventListener('change', toggleSv);
modalConfirm.addEventListener('click', startEnrollRecording);
modalCancel.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);

// 初始化检查系统状态
function checkSystemStatus() {
    fetch(`${API_ENDPOINT}/system_status`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                systemSettings.kwsEnabled = data.kws_enabled;
                systemSettings.svEnabled = data.sv_enabled;
                systemSettings.kwsText = data.kws_text;
                
                kwsSwitch.checked = systemSettings.kwsEnabled;
                svSwitch.checked = systemSettings.svEnabled;
                kwsText.value = systemSettings.kwsText;
                
                if (data.sv_enrolled) {
                    svStatus.textContent = "已注册";
                    svStatus.classList.add('status-active');
                } else {
                    svStatus.textContent = "未注册";
                    svStatus.classList.remove('status-active');
                }
                
                if (data.models_loaded) {
                    assistantStatus.textContent = "就绪";
                    assistantStatus.className = "status-badge status-active";
                } else {
                    assistantStatus.textContent = "模型加载中";
                    assistantStatus.className = "status-badge status-warning";
                }
            } else {
                showError("系统状态检查失败: " + data.message);
                assistantStatus.textContent = "连接失败";
                assistantStatus.className = "status-badge status-error";
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError("无法连接到服务器，请确保服务已启动");
            assistantStatus.textContent = "连接失败";
            assistantStatus.className = "status-badge status-error";
        });
        
    // 检查声纹注册状态
    fetch(`${API_ENDPOINT}/check_enrollment`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                if (data.enrolled) {
                    svStatus.textContent = "已注册";
                    svStatus.classList.add('status-active');
                } else {
                    svStatus.textContent = "未注册";
                    svStatus.classList.remove('status-active');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// 启动录音功能 - 持续录音实现
function startRecording() {
    if (isRecording) return;
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            isRecording = true;
            audioChunks = [];
            recordingSeconds = 0;
            
            // 设置状态
            startBtn.disabled = true;
            stopBtn.disabled = false;
            recordingStatus.textContent = "录音中";
            recordingStatus.className = "status-badge status-active";
            
            // 设置MediaRecorder
            mediaRecorder = new MediaRecorder(stream);
            
            // 关键修改：使用较短时间片段进行录音并自动发送
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                    // 当积累了足够的数据时自动处理
                    if (audioChunks.length >= 1 && !isProcessing) {
                        processAudioChunk();
                    }
                }
            };
            
            // 每2秒获取一次数据，实现持续对话
            mediaRecorder.start(2000);
            
            // 显示录音计时器
            recordingTimerInterval = setInterval(() => {
                recordingSeconds++;
                updateSoundWaveAnimation(true);
                voiceIndicator.style.display = 'block';
            }, 1000);
            
            // 启动音量波形动画
            startSoundWaveAnimation();
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            showError("无法访问麦克风: " + error.message);
        });
}

// 处理录音片段
function processAudioChunk() {
    if (audioChunks.length === 0 || isProcessing) return;
    
    isProcessing = true;
    
    // 获取当前的音频片段
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    audioChunks = []; // 清空已处理的片段
    
    // 如果录音片段太小，不处理
    if (audioBlob.size < 1000) {
        isProcessing = false;
        return;
    }
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('kws_enabled', systemSettings.kwsEnabled ? '1' : '0');
    formData.append('sv_enabled', systemSettings.svEnabled ? '1' : '0');
    formData.append('kws_text', systemSettings.kwsText);
    
    // 发送到服务器
    fetch(`${API_ENDPOINT}/process_audio`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        isProcessing = false;
        
        if (data.status === 'success') {
            // 添加用户消息
            if (data.user_message) {
                addMessage('user', data.user_message);
            }
            
            // 添加系统回复
            if (data.message) {
                addMessage('system', data.message);
                
                // 播放音频回复
                if (data.audio_url) {
                    playAudio(`${API_ENDPOINT}${data.audio_url}`);
                }
            }
        } else if (data.status === 'kws_failed') {
            // 唤醒词失败，可以不显示消息，继续录音
            console.log("唤醒词验证失败");
        } else if (data.status === 'sv_failed') {
            // 声纹验证失败
            addMessage('system', data.message);
        } else if (data.status === 'sv_enroll_required') {
            // 需要声纹注册
            addMessage('system', data.message);
        } else {
            // 其他错误
            showError(data.message || "处理音频时发生错误");
        }
    })
    .catch(error => {
        isProcessing = false;
        console.error('Error:', error);
        showError("发送录音到服务器失败");
    });
}

// 停止录音功能
function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    isProcessing = false;
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    // 处理最后的音频片段
    if (audioChunks.length > 0) {
        const lastChunk = new Blob(audioChunks, { type: 'audio/wav' });
        audioChunks = [];
        
        if (lastChunk.size > 1000) {
            const formData = new FormData();
            formData.append('audio', lastChunk);
            formData.append('kws_enabled', systemSettings.kwsEnabled ? '1' : '0');
            formData.append('sv_enabled', systemSettings.svEnabled ? '1' : '0');
            formData.append('kws_text', systemSettings.kwsText);
            
            fetch(`${API_ENDPOINT}/process_audio`, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => handleResponse(data))
            .catch(error => {
                console.error('Error:', error);
                showError("发送录音到服务器失败");
            });
        }
    }
    
    // 清理资源
    clearInterval(recordingTimerInterval);
    stopSoundWaveAnimation();
    voiceIndicator.style.display = 'none';
    
    // 更新UI状态
    startBtn.disabled = false;
    stopBtn.disabled = true;
    recordingStatus.textContent = "未启动";
    recordingStatus.className = "status-badge status-inactive";
    
    // 关闭媒体流
    if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

// 处理服务器响应
function handleResponse(data) {
    if (data.status === 'success') {
        // 添加用户消息
        if (data.user_message) {
            addMessage('user', data.user_message);
        }
        
        // 添加系统回复
        if (data.message) {
            addMessage('system', data.message);
            
            // 播放音频回复
            if (data.audio_url) {
                playAudio(`${API_ENDPOINT}${data.audio_url}`);
            }
        }
    } else if (data.status === 'kws_failed') {
        // 唤醒词失败
        addMessage('system', data.message);
    } else if (data.status === 'sv_failed') {
        // 声纹验证失败
        addMessage('system', data.message);
    } else if (data.status === 'sv_enroll_required') {
        // 需要声纹注册
        addMessage('system', data.message);
    } else {
        // 其他错误
        showError(data.message || "处理音频时发生错误");
    }
}

// 播放音频
function playAudio(url) {
    audio.src = url;
    audio.play();
}

// 添加消息到对话历史
function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    messageDiv.appendChild(contentDiv);
    conversationHistory.appendChild(messageDiv);
    
    // 滚动到底部
    conversationHistory.scrollTop = conversationHistory.scrollHeight;
}

// 清空对话历史
function clearConversation() {
    // 清空UI
    conversationHistory.innerHTML = `
        <div class="message system">
            <div class="message-content">你好，我是小千，一个活泼开朗的18岁女大学生。有什么我能帮你的吗？</div>
        </div>
    `;
    
    // 发送请求到服务器清空历史
    fetch(`${API_ENDPOINT}/clear_history`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== 'success') {
            showError("清空对话历史失败: " + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError("清空对话历史失败");
    });
}

// 显示错误消息
function showError(message) {
    addMessage('system error', message);
}

// 显示声纹注册模态框
function showEnrollModal() {
    modal.style.display = 'flex';
    document.getElementById('modal-title').textContent = '声纹注册';
    document.getElementById('modal-body').innerHTML = `
        <p>请对着麦克风说话，至少持续<strong>3秒</strong>以上。</p>
        <div class="recording-indicator">
            <div class="recording-spinner"></div>
            <span>准备录音...</span>
            <div id="recording-timer">0s</div>
        </div>
    `;
    modalConfirm.textContent = '开始录音';
    modalConfirm.onclick = startEnrollRecording;
}

// 关闭模态框
function closeModal() {
    modal.style.display = 'none';
    if (enrollTimer) {
        clearInterval(enrollTimer);
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

// 开始声纹注册录音
function startEnrollRecording() {
    if (modalConfirm.textContent === '开始录音') {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                audioChunks = [];
                enrollSeconds = 0;
                
                // 更新UI
                document.querySelector('.recording-spinner').style.display = 'block';
                document.querySelector('.recording-indicator span').textContent = '录音中...';
                modalConfirm.textContent = '停止并注册';
                
                // 设置MediaRecorder
                mediaRecorder = new MediaRecorder(stream);
                
                mediaRecorder.ondataavailable = event => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                mediaRecorder.start();
                
                // 显示录音计时器
                enrollTimer = setInterval(() => {
                    enrollSeconds++;
                    document.getElementById('recording-timer').textContent = `${enrollSeconds}s`;
                }, 1000);
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                showError("无法访问麦克风: " + error.message);
                closeModal();
            });
    } else {
        // 停止录音并注册
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        clearInterval(enrollTimer);
        
        if (enrollSeconds < 3) {
            document.querySelector('.recording-indicator span').textContent = '录音时间太短，请至少录制3秒';
            setTimeout(() => {
                startEnrollRecording();
            }, 1500);
            return;
        }
        
        // 准备上传声纹
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob);
        
        // 更新UI
        document.querySelector('.recording-indicator span').textContent = '正在注册声纹...';
        modalConfirm.disabled = true;
        
        // 发送到服务器
        fetch(`${API_ENDPOINT}/enroll_speaker`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                svStatus.textContent = "已注册";
                svStatus.classList.add('status-active');
                document.querySelector('.recording-indicator span').textContent = '声纹注册成功！';
                setTimeout(closeModal, 1500);
            } else {
                document.querySelector('.recording-indicator span').textContent = `注册失败: ${data.message}`;
                modalConfirm.textContent = '重试';
                modalConfirm.disabled = false;
                modalConfirm.onclick = startEnrollRecording;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.querySelector('.recording-indicator span').textContent = '注册失败，网络错误';
            modalConfirm.textContent = '重试';
            modalConfirm.disabled = false;
        });
        
        // 关闭媒体流
        if (mediaRecorder && mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
}

// 更新唤醒词
function updateKeyword() {
    const newKeyword = kwsText.value.trim();
    
    if (!newKeyword) {
        showError("唤醒词不能为空");
        return;
    }
    
    const formData = new FormData();
    formData.append('keyword', newKeyword);
    
    fetch(`${API_ENDPOINT}/update_keyword`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            systemSettings.kwsText = data.keyword;
            addMessage('system', `唤醒词已更新为: ${data.keyword}`);
        } else {
            showError("更新唤醒词失败: " + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError("更新唤醒词失败");
    });
}

// 切换唤醒词功能
function toggleKws() {
    systemSettings.kwsEnabled = kwsSwitch.checked;
    kwsText.disabled = !systemSettings.kwsEnabled;
    updateKwsBtn.disabled = !systemSettings.kwsEnabled;
}

// 切换声纹识别功能
function toggleSv() {
    systemSettings.svEnabled = svSwitch.checked;
}

// 音量波形动画
function startSoundWaveAnimation() {
    const bars = soundWave.querySelectorAll('.bar');
    
    soundWaveAnimationId = setInterval(() => {
        bars.forEach(bar => {
            const height = Math.floor(Math.random() * 20) + 5;
            bar.style.height = `${height}px`;
        });
    }, 100);
    
    soundWave.style.display = 'flex';
}

function stopSoundWaveAnimation() {
    if (soundWaveAnimationId) {
        clearInterval(soundWaveAnimationId);
    }
    soundWave.style.display = 'none';
}

function updateSoundWaveAnimation(isActive) {
    if (isActive) {
        voiceIndicator.classList.add('active');
    } else {
        voiceIndicator.classList.remove('active');
    }
} 