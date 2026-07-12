// App State
let activeTab = 'caption-tab';
let currentConfig = { encoder_type: 'resnet50', decoder_type: 'lstm' };
let lossChart = null;
let currentFile = null;
let datasetFile = null;

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const tabs = document.querySelectorAll('.tab-content');
const tabTitle = document.getElementById('tab-title');

// Badges
const encoderBadge = document.getElementById('current-encoder-badge');
const decoderBadge = document.getElementById('current-decoder-badge');

// Config Modal
const configModal = document.getElementById('config-modal');
const configForm = document.getElementById('config-form');

// Inference elements
const dropZone = document.getElementById('drop-zone');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const removeImgBtn = document.getElementById('remove-img-btn');
const previewContainer = dropZone.querySelector('.preview-container');
const dropPrompt = dropZone.querySelector('.drop-zone-content');
const generateCaptionBtn = document.getElementById('generate-caption-btn');
const outputContainer = document.getElementById('output-container');
const resultCaptionText = document.getElementById('result-caption-text');
const inferenceTime = document.getElementById('inference-time');
const inferenceDevice = document.getElementById('inference-device');

// Training elements
const trainForm = document.getElementById('train-form');
const startTrainBtn = document.getElementById('start-train-btn');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressStatusText = document.getElementById('progress-status-text');
const progressPctText = document.getElementById('progress-pct-text');
const consoleLogs = document.getElementById('console-logs');

// Dataset elements
const datasetGrid = document.getElementById('dataset-grid');
const datasetCount = document.getElementById('dataset-count');
const addDatasetForm = document.getElementById('add-dataset-form');
const datasetDropZone = document.getElementById('dataset-drop-zone');
const datasetImgInput = document.getElementById('dataset-img-input');
const datasetUploadPrompt = document.getElementById('dataset-upload-prompt');
const datasetUploadPreview = document.getElementById('dataset-upload-preview');
const datasetPreviewImg = document.getElementById('dataset-preview-img');
const datasetCaptionInput = document.getElementById('dataset-caption');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initConfig();
    initChart();
    initUploadZone();
    initDatasetUploadZone();
    loadDataset();
});

// 1. Navigation / Tab management
function initTabs() {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            
            // Toggle buttons
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle tabs
            tabs.forEach(t => t.classList.remove('active'));
            const activeTabEl = document.getElementById(target);
            activeTabEl.classList.add('active');
            
            // Update Title
            tabTitle.textContent = btn.querySelector('span').textContent;
            
            // Special chart redraw if training tab is opened
            if (target === 'train-tab' && lossChart) {
                setTimeout(() => lossChart.update(), 100);
            }
        });
    });
}

// 2. Active Model Config
async function initConfig() {
    try {
        const response = await fetch('/api/config');
        currentConfig = await response.json();
        updateConfigBadges();
    } catch (e) {
        console.error('Failed to load current configuration', e);
    }
}

function updateConfigBadges() {
    encoderBadge.textContent = currentConfig.encoder_type.toUpperCase();
    decoderBadge.textContent = currentConfig.decoder_type.toUpperCase();
    
    // Update radio values in modal
    const encoderRadio = configForm.querySelector(`input[name="encoder"][value="${currentConfig.encoder_type.toLowerCase()}"]`);
    const decoderRadio = configForm.querySelector(`input[name="decoder"][value="${currentConfig.decoder_type.toLowerCase()}"]`);
    
    if (encoderRadio) encoderRadio.checked = true;
    if (decoderRadio) decoderRadio.checked = true;
}

function openConfigModal() {
    configModal.style.display = 'flex';
}

function closeConfigModal() {
    configModal.style.display = 'none';
}

configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const encoder = configForm.querySelector('input[name="encoder"]:checked').value;
    const decoder = configForm.querySelector('input[name="decoder"]:checked').value;
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encoder_type: encoder, decoder_type: decoder })
        });
        const result = await response.json();
        currentConfig = result.config;
        updateConfigBadges();
        closeConfigModal();
        addLogLine(`system`, `Model architecture changed to: ${encoder.toUpperCase()} + ${decoder.toUpperCase()}.`);
    } catch (err) {
        alert('Failed to update configuration: ' + err.message);
    }
});

// 3. Upload Management (Caption Studio)
function initUploadZone() {
    // Click to open file chooser
    dropZone.addEventListener('click', (e) => {
        if (e.target !== removeImgBtn && !removeImgBtn.contains(e.target)) {
            imageInput.click();
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (imageInput.files.length > 0) {
            handleFileSelect(imageInput.files[0]);
        }
    });

    // Drag and Drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('hover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('hover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    removeImgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPreview();
    });
}

function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file!');
        return;
    }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        dropPrompt.style.display = 'none';
        previewContainer.style.display = 'flex';
        generateCaptionBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearPreview() {
    currentFile = null;
    imageInput.value = '';
    imagePreview.src = '';
    previewContainer.style.display = 'none';
    dropPrompt.style.display = 'flex';
    generateCaptionBtn.disabled = true;
    
    // Reset output card
    outputContainer.classList.add('empty');
    outputContainer.querySelector('.placeholder-visual').style.display = 'block';
    outputContainer.querySelector('.loader-visual').style.display = 'none';
    outputContainer.querySelector('.caption-result-box').style.display = 'none';
}

// 4. Captioning Execution
generateCaptionBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    // Show Loader
    outputContainer.classList.remove('empty');
    outputContainer.querySelector('.placeholder-visual').style.display = 'none';
    outputContainer.querySelector('.loader-visual').style.display = 'block';
    outputContainer.querySelector('.caption-result-box').style.display = 'none';
    generateCaptionBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', currentFile);

    const startTime = performance.now();

    try {
        const response = await fetch('/api/caption', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Inference failed');
        }

        const data = await response.json();
        const endTime = performance.now();
        const durationSec = ((endTime - startTime) / 1000).toFixed(2);

        // Render result
        resultCaptionText.textContent = `"${data.caption}"`;
        inferenceTime.textContent = `${durationSec}s`;
        inferenceDevice.textContent = currentConfig.encoder_type === 'resnet50' ? 'CPU' : 'CPU'; // pre-trained models running on cpu

        outputContainer.querySelector('.loader-visual').style.display = 'none';
        outputContainer.querySelector('.caption-result-box').style.display = 'flex';
    } catch (err) {
        // Reset and display error
        outputContainer.classList.add('empty');
        outputContainer.querySelector('.placeholder-visual').style.display = 'block';
        outputContainer.querySelector('.loader-visual').style.display = 'none';
        alert('Caption Error: ' + err.message);
    } finally {
        generateCaptionBtn.disabled = false;
    }
});

// 5. Chart.js Initialization
function initChart() {
    const ctx = document.getElementById('lossChart').getContext('2d');
    lossChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Training Loss',
                data: [],
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#8b5cf6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
                    title: { display: true, text: 'Loss', color: '#94a3b8' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
                    title: { display: true, text: 'Epoch', color: '#94a3b8' }
                }
            }
        }
    });
}

function updateChart(epochs, losses) {
    lossChart.data.labels = epochs;
    lossChart.data.datasets[0].data = losses;
    lossChart.update();
}

function clearChart() {
    lossChart.data.labels = [];
    lossChart.data.datasets[0].data = [];
    lossChart.update();
}

// 6. Training Room Execution
trainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const epochs = parseInt(document.getElementById('train-epochs').value);
    const lr = parseFloat(document.getElementById('train-lr').value);
    const batchSize = parseInt(document.getElementById('train-batch').value);

    // Setup UI for training
    startTrainBtn.disabled = true;
    progressBarContainer.style.display = 'block';
    clearChart();
    
    // Clear logs
    consoleLogs.innerHTML = `<div class="log-line system">Starting training thread for ${currentConfig.encoder_type.toUpperCase()} + ${currentConfig.decoder_type.toUpperCase()}...</div>`;
    updateProgressBar(0, 'Initializing dataset...');

    try {
        const response = await fetch('/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ epochs, lr, batch_size: batchSize })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to start training');
        }

        // Connect to SSE stream
        const eventSource = new EventSource('/api/train/stream');
        const epochLabels = [];
        const lossData = [];

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.ping) return; // Keep alive ping
            
            if (data.error) {
                addLogLine('error', `Training error: ${data.error}`);
                progressStatusText.textContent = 'Training Failed';
                startTrainBtn.disabled = false;
                eventSource.close();
                return;
            }

            if (data.done) {
                addLogLine('system', `Training complete! Model weights successfully stored.`);
                updateProgressBar(100, 'Training complete!');
                startTrainBtn.disabled = false;
                eventSource.close();
                // Reload dataset grid (in case synthetic images generated)
                loadDataset();
                return;
            }

            // Update Progress Bar
            const pct = Math.round((data.epoch / data.total_epochs) * 100);
            updateProgressBar(pct, `Epoch ${data.epoch}/${data.total_epochs}`);

            // Add Loss log line
            addLogLine('log', `Epoch [${data.epoch}/${data.total_epochs}] - Loss: ${data.loss.toFixed(4)}`);

            // Update Chart
            epochLabels.push(data.epoch);
            lossData.push(data.loss);
            updateChart(epochLabels, lossData);
        };

        eventSource.onerror = (err) => {
            console.error('EventSource failed:', err);
            addLogLine('error', 'Connection to training log stream lost.');
            startTrainBtn.disabled = false;
            eventSource.close();
        };

    } catch (err) {
        addLogLine('error', err.message);
        startTrainBtn.disabled = false;
    }
});

function updateProgressBar(pct, text) {
    progressBarFill.style.width = `${pct}%`;
    progressStatusText.textContent = text;
    progressPctText.textContent = `${pct}%`;
}

function addLogLine(type, text) {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = text;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// 7. Dataset Manager
async function loadDataset() {
    try {
        const response = await fetch('/api/dataset');
        const dataset = await response.json();
        
        datasetCount.textContent = dataset.length;
        datasetGrid.innerHTML = '';

        dataset.forEach(item => {
            const el = document.createElement('div');
            el.className = 'dataset-item';
            
            // Format path correctly for web url
            // Convert backward slashes to forward slashes
            const webPath = item.image_path.replace(/\\/g, '/');
            
            el.innerHTML = `
                <div class="dataset-img-box">
                    <img src="/${webPath}" alt="Shape image">
                </div>
                <div class="dataset-caption-box" title="${item.caption}">
                    <strong>Caption:</strong> "${item.caption}"
                </div>
            `;
            datasetGrid.appendChild(el);
        });
    } catch (e) {
        console.error('Failed to load dataset', e);
    }
}

function initDatasetUploadZone() {
    datasetDropZone.addEventListener('click', () => {
        datasetImgInput.click();
    });

    datasetImgInput.addEventListener('change', () => {
        if (datasetImgInput.files.length > 0) {
            handleDatasetFileSelect(datasetImgInput.files[0]);
        }
    });

    // Drag events
    ['dragenter', 'dragover'].forEach(eventName => {
        datasetDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            datasetDropZone.classList.add('hover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        datasetDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            datasetDropZone.classList.remove('hover');
        }, false);
    });

    datasetDropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleDatasetFileSelect(files[0]);
        }
    });
}

function handleDatasetFileSelect(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file!');
        return;
    }
    datasetFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        datasetPreviewImg.src = e.target.result;
        datasetUploadPrompt.style.display = 'none';
        datasetUploadPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function clearDatasetForm() {
    datasetFile = null;
    datasetImgInput.value = '';
    datasetPreviewImg.src = '';
    datasetUploadPrompt.style.display = 'flex';
    datasetUploadPreview.style.display = 'none';
    datasetCaptionInput.value = '';
}

addDatasetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!datasetFile) {
        alert('Please select an image for the training sample!');
        return;
    }

    const caption = datasetCaptionInput.value.trim();
    if (!caption) {
        alert('Please enter a caption description!');
        return;
    }

    const formData = new FormData();
    formData.append('file', datasetFile);
    formData.append('caption', caption);

    try {
        const response = await fetch('/api/dataset/add', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to upload dataset sample');
        }

        const data = await response.json();
        addLogLine('system', `Dataset expanded: Added custom sample with caption "${caption}".`);
        clearDatasetForm();
        loadDataset();
        alert('Sample successfully added to the dataset!');
    } catch (err) {
        alert('Error adding dataset sample: ' + err.message);
    }
});
