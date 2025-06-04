// script.js
document.addEventListener('DOMContentLoaded', () => {
    // Получение элементов DOM
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const miniVisualizerCanvas = document.getElementById('mini-visualizer-canvas');
    const miniCtx = miniVisualizerCanvas.getContext('2d');

    const fileInput = document.getElementById('fileInput');
    const uploadStatus = document.getElementById('uploadStatus');

    const playOriginalButton = document.getElementById('playOriginalButton');
    const playProcessedButton = document.getElementById('playProcessedButton');
    const playBothButton = document.getElementById('playBothButton');
    const stopButton = document.getElementById('stopButton');

    const originalIndicator = document.getElementById('originalIndicator');
    const processedIndicator = document.getElementById('processedIndicator');

    const mainVisualizerCanvas = document.getElementById('mainVisualizerCanvas');
    const mainCtx = mainVisualizerCanvas.getContext('2d');
    const waveformViewButton = document.getElementById('waveformViewButton');
    const frequencyViewButton = document.getElementById('frequencyViewButton');

    // Установка размеров основного холста визуализации на основе его стилей
    function resizeMainCanvas() {
        mainVisualizerCanvas.width = mainVisualizerCanvas.offsetWidth;
        mainVisualizerCanvas.height = 200; // Фиксированная высота или сделать динамической
    }
    resizeMainCanvas();
    window.addEventListener('resize', resizeMainCanvas); // Обновление при изменении размера окна

    // Переменные для Web Audio API и состояния
    let audioContext;
    let originalBuffer = null;      // Буфер для оригинального аудио
    let processedBuffer = null;     // Буфер для аудио с инвертированной фазой
    
    let mediaRecorder;              // Объект для записи аудио
    let audioChunks = [];           // Массив для хранения фрагментов записанного аудио
    let isRecording = false;        // Флаг состояния записи

    let sourceNodeOriginal = null;  // Узел источника для оригинального аудио
    let sourceNodeProcessed = null; // Узел источника для обработанного аудио
    let analyserNode = null;        // Узел анализатора для визуализации
    
    let visualizationType = 'waveform'; // Тип визуализации: 'waveform' или 'frequency'
    let animationFrameId = null;        // ID для requestAnimationFrame (основная визуализация)
    let liveStreamAnalyserNode = null;  // Анализатор для потока с микрофона (мини-визуализатор)
    let liveStreamSource = null;        // Источник потока с микрофона
    let liveStreamAnimationId = null;   // ID для requestAnimationFrame (мини-визуализатор)

    // Инициализация AudioContext при первом действии пользователя
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // --- Логика Записи ---
    recordButton.addEventListener('click', () => {
        initAudioContext(); // Убедимся, что AudioContext готов
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isRecording = true;
            recordButton.textContent = 'Остановить Запись';
            recordButton.style.backgroundColor = 'var(--red-accent)'; // Красный цвет для кнопки "Стоп"
            recordingStatus.textContent = '🔴 Идёт запись...';
            audioChunks = [];
            
            // Предпочтительный формат записи, если поддерживается
            const options = { mimeType: 'audio/webm;codecs=opus' }; 
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.log(options.mimeType + ' не поддерживается');
                // Если не поддерживается, используем настройки по умолчанию
                mediaRecorder = new MediaRecorder(stream);
            } else {
                mediaRecorder = new MediaRecorder(stream, options);
            }

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                isRecording = false;
                recordButton.textContent = 'Начать Запись';
                recordButton.style.backgroundColor = ''; // Возвращаем стандартный цвет
                recordingStatus.textContent = '⏳ Обработка...';
                stopLiveVisualizer(); // Останавливаем мини-визуализатор
                stream.getTracks().forEach(track => track.stop()); // Освобождаем микрофон

                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                audioContext.decodeAudioData(arrayBuffer, decodedBuffer => {
                    originalBuffer = decodedBuffer;
                    processedBuffer = invertPhase(originalBuffer);
                    recordingStatus.textContent = '✅ Запись завершена. Готово!';
                    uploadStatus.textContent = 'Записанное аудио загружено';
                    updatePlaybackButtonsState(true);
                    visualizeBufferStatic(originalBuffer, 'waveform'); // Показываем статическую форму волны
                }, error => {
                    console.error('Ошибка декодирования аудио:', error);
                    recordingStatus.textContent = '⚠️ Ошибка обработки аудио.';
                    uploadStatus.textContent = 'Аудио не загружено';
                    updatePlaybackButtonsState(false);
                });
            };

            mediaRecorder.start();
            startLiveVisualizer(stream); // Запускаем мини-визуализатор

        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            recordingStatus.textContent = '⚠️ Доступ к микрофону запрещён.';
            isRecording = false;
            recordButton.style.backgroundColor = '';
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            // обработка завершится в mediaRecorder.onstop
        }
    }

    function startLiveVisualizer(stream) {
        if (!audioContext) initAudioContext();
        liveStreamSource = audioContext.createMediaStreamSource(stream);
        liveStreamAnalyserNode = audioContext.createAnalyser();
        liveStreamAnalyserNode.fftSize = 256; // Меньший размер для мини-визуализатора
        liveStreamSource.connect(liveStreamAnalyserNode); // НЕ подключаем к audioContext.destination, чтобы избежать эха
        
        const bufferLength = liveStreamAnalyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        miniCtx.clearRect(0, 0, miniVisualizerCanvas.width, miniVisualizerCanvas.height);

        function drawLive() {
            liveStreamAnimationId = requestAnimationFrame(drawLive);
            liveStreamAnalyserNode.getByteTimeDomainData(dataArray); // Данные временной области

            miniCtx.fillStyle = '#1a1222'; // Фон, как у плейсхолдера
            miniCtx.fillRect(0, 0, miniVisualizerCanvas.width, miniVisualizerCanvas.height);
            miniCtx.lineWidth = 1.5;
            miniCtx.strokeStyle = 'var(--primary-accent)'; // Оранжевый акцент

            miniCtx.beginPath();
            const sliceWidth = miniVisualizerCanvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; // Нормализация байтовых значений (0-255)
                const y = v * miniVisualizerCanvas.height / 2;
                if (i === 0) miniCtx.moveTo(x, y);
                else miniCtx.lineTo(x, y);
                x += sliceWidth;
            }
            miniCtx.lineTo(miniVisualizerCanvas.width, miniVisualizerCanvas.height / 2);
            miniCtx.stroke();
        }
        drawLive();
    }

    function stopLiveVisualizer() {
        if (liveStreamAnimationId) {
            cancelAnimationFrame(liveStreamAnimationId);
            liveStreamAnimationId = null;
        }
        if (liveStreamSource) {
            liveStreamSource.disconnect();
            liveStreamSource = null;
        }
        if (liveStreamAnalyserNode) { // Убедимся, что и анализатор отсоединен
            liveStreamAnalyserNode.disconnect();
            liveStreamAnalyserNode = null;
        }
        // Очищаем мини-холст
        miniCtx.fillStyle = '#1a1222';
        miniCtx.fillRect(0, 0, miniVisualizerCanvas.width, miniVisualizerCanvas.height); 
    }


    // --- Логика Загрузки Файла ---
    fileInput.addEventListener('change', event => {
        initAudioContext();
        const file = event.target.files[0];
        if (file) {
            uploadStatus.textContent = `⏳ Загрузка: ${file.name}`;
            const reader = new FileReader();
            reader.onload = e => {
                audioContext.decodeAudioData(e.target.result, decodedBuffer => {
                    originalBuffer = decodedBuffer;
                    processedBuffer = invertPhase(originalBuffer);
                    uploadStatus.textContent = `✅ Загружено: ${file.name}`;
                    recordingStatus.textContent = 'Нажмите, чтобы начать запись'; // Сбрасываем статус записи
                    updatePlaybackButtonsState(true);
                    visualizeBufferStatic(originalBuffer, 'waveform'); // Показываем статическую форму волны
                }, error => {
                    console.error('Ошибка декодирования аудиофайла:', error);
                    uploadStatus.textContent = `⚠️ Ошибка загрузки: ${file.name}`;
                    updatePlaybackButtonsState(false);
                });
            };
            reader.onerror = () => { // Обработка ошибок чтения файла
                uploadStatus.textContent = `⚠️ Ошибка чтения: ${file.name}`;
                updatePlaybackButtonsState(false);
            };
            reader.readAsArrayBuffer(file);
        }
    });

    // --- Обработка Аудио (Инверсия Фазы) ---
    function invertPhase(buffer) {
        if (!buffer) return null;
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        // Создаем новый буфер с теми же параметрами
        const invertedBuffer = audioContext.createBuffer(numChannels, length, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const originalData = buffer.getChannelData(channel);
            const invertedData = invertedBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                invertedData[i] = -originalData[i]; // Инвертируем фазу (умножаем на -1)
            }
        }
        return invertedBuffer;
    }

    // --- Логика Воспроизведения ---
    function stopAllAudio() {
        // Останавливаем и отключаем источники звука
        if (sourceNodeOriginal) {
            sourceNodeOriginal.onended = null; // Удаляем обработчик, чтобы избежать повторного вызова
            try { sourceNodeOriginal.stop(); } catch (e) { /* Игнорируем ошибки, если уже остановлен */ }
            sourceNodeOriginal.disconnect();
            sourceNodeOriginal = null;
        }
        if (sourceNodeProcessed) {
            sourceNodeProcessed.onended = null;
            try { sourceNodeProcessed.stop(); } catch (e) { /* Игнорируем ошибки */ }
            sourceNodeProcessed.disconnect();
            sourceNodeProcessed = null;
        }
        // Отключаем анализатор от выхода, чтобы остановить обработку данных для визуализации
        if (analyserNode) {
            analyserNode.disconnect(); 
        }
        // Останавливаем цикл анимации визуализации
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        updateIndicators(false, false); // Сбрасываем индикаторы
        stopButton.disabled = true;    // Деактивируем кнопку "Стоп"
    }
    
    stopButton.addEventListener('click', stopAllAudio);

    // Общая функция для воспроизведения аудио
    function playAudio(buffer, type) {
        if (!buffer || !audioContext) return;
        stopAllAudio(); // Останавливаем любое текущее воспроизведение

        analyserNode = audioContext.createAnalyser(); // Всегда создаем свежий анализатор
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyserNode); // Источник -> Анализатор
        analyserNode.connect(audioContext.destination); // Анализатор -> Выход (динамики)
        
        source.start(0);
        source.onended = () => {
            // Проверяем, какой именно источник завершился, чтобы корректно обновить индикаторы
            if ((type === 'original' && source === sourceNodeOriginal) || (type === 'processed' && source === sourceNodeProcessed)) {
                 updateIndicators(type === 'original' ? false : originalIndicator.classList.contains('playing'), 
                                 type === 'processed' ? false : processedIndicator.classList.contains('playing'));
            }
             // Деактивируем кнопку "Стоп", если активных источников не осталось
            if (!sourceNodeOriginal && !sourceNodeProcessed) {
                stopButton.disabled = true;
            }
            // Если это был единственный источник, останавливаем визуализацию и показываем статику
            if (!sourceNodeOriginal && !sourceNodeProcessed && animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
                visualizeBufferStatic(originalBuffer, visualizationType); // Показываем статический оригинал
            }
        };

        if (type === 'original') {
            sourceNodeOriginal = source;
            updateIndicators(true, false); // Обновляем индикатор: оригинал играет, обработанный - нет
        } else if (type === 'processed') {
            sourceNodeProcessed = source;
            updateIndicators(false, true); // Обновляем индикатор: обработанный играет, оригинал - нет
        }
        
        stopButton.disabled = false; // Активируем кнопку "Стоп"
        drawVisualizationLoop();     // Запускаем цикл визуализации
    }

    playOriginalButton.addEventListener('click', () => playAudio(originalBuffer, 'original'));
    playProcessedButton.addEventListener('click', () => playAudio(processedBuffer, 'processed'));

    playBothButton.addEventListener('click', () => {
        if (!originalBuffer || !processedBuffer || !audioContext) return;
        stopAllAudio();

        analyserNode = audioContext.createAnalyser();

        sourceNodeOriginal = audioContext.createBufferSource();
        sourceNodeOriginal.buffer = originalBuffer;

        sourceNodeProcessed = audioContext.createBufferSource();
        sourceNodeProcessed.buffer = processedBuffer;
        
        // Оба источника подключаются к ОДНОМУ анализатору для визуализации суммы сигналов
        sourceNodeOriginal.connect(analyserNode);
        sourceNodeProcessed.connect(analyserNode); 
        analyserNode.connect(audioContext.destination); // Затем анализатор к выходу

        sourceNodeOriginal.start(0);
        sourceNodeProcessed.start(0);

        // Обработчик завершения для обоих источников
        let endedCount = 0;
        const onBothEnded = () => {
            endedCount++;
            if (endedCount === 2) { // Когда оба завершились
                updateIndicators(false, false);
                stopButton.disabled = true;
                 if (animationFrameId) { // Останавливаем визуализацию и показываем статику
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                    visualizeBufferStatic(originalBuffer, visualizationType);
                }
            }
        };
        sourceNodeOriginal.onended = onBothEnded;
        sourceNodeProcessed.onended = onBothEnded;
        
        updateIndicators(true, true); // Оба индикатора активны (показываем, что оба "участвуют")
        stopButton.disabled = false;
        drawVisualizationLoop();
    });

    // Обновление состояния кнопок воспроизведения и индикаторов
    function updatePlaybackButtonsState(enabled) {
        playOriginalButton.disabled = !enabled;
        playProcessedButton.disabled = !enabled;
        playBothButton.disabled = !enabled;
        
        // Класс 'active' означает, что аудио загружено и готово к воспроизведению
        originalIndicator.classList.toggle('active', enabled);
        processedIndicator.classList.toggle('active', enabled);
        
        if (!enabled) { // Если аудио нет (или выгружено)
            stopButton.disabled = true; // Кнопка "Стоп" не нужна
            updateIndicators(false, false); // Сбрасываем индикаторы проигрывания
            if (animationFrameId) { // Если при деактивации кнопок визуализация активна, останавливаем её
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
                visualizeBufferStatic(null, visualizationType); // Очищаем основной холст
            }
        }
    }
    updatePlaybackButtonsState(false); // Изначально кнопки воспроизведения неактивны

    // Обновление визуальных индикаторов проигрывания
    function updateIndicators(originalPlaying, processedPlaying) {
        originalIndicator.classList.toggle('playing', originalPlaying);
        processedIndicator.classList.toggle('playing', processedPlaying);
    }

    // --- Логика Визуализации ---
    waveformViewButton.addEventListener('click', () => {
        visualizationType = 'waveform';
        waveformViewButton.classList.add('active');
        frequencyViewButton.classList.remove('active');
        // Если не идет воспроизведение и есть загруженный буфер, отображаем его статически
        if (!animationFrameId && originalBuffer) { 
             visualizeBufferStatic(originalBuffer, 'waveform');
        }
    });

    frequencyViewButton.addEventListener('click', () => {
        visualizationType = 'frequency';
        frequencyViewButton.classList.add('active');
        waveformViewButton.classList.remove('active');
         if (!animationFrameId && originalBuffer) { 
            visualizeBufferStatic(originalBuffer, 'frequency'); // Для частот может быть сообщение
        }
    });
    
    // Цикл отрисовки для активного воспроизведения
    function drawVisualizationLoop() {
        if (!analyserNode) return; // Прекращаем, если анализатор был отключен (например, при stopAllAudio)
        animationFrameId = requestAnimationFrame(drawVisualizationLoop);

        mainCtx.fillStyle = '#1a1222'; // Фон холста
        mainCtx.fillRect(0, 0, mainVisualizerCanvas.width, mainVisualizerCanvas.height);

        if (visualizationType === 'waveform') { // Форма волны
            analyserNode.fftSize = 2048; // Стандартный размер для формы волны
            const bufferLength = analyserNode.frequencyBinCount; // Для getByteTimeDomainData это длина буфера
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteTimeDomainData(dataArray);

            mainCtx.lineWidth = 2;
            mainCtx.strokeStyle = 'var(--primary-accent)'; // Оранжевый
            mainCtx.beginPath();

            const sliceWidth = mainVisualizerCanvas.width * 1.0 / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; // Нормализация байт (0-255) к диапазону 0-2
                const y = v * mainVisualizerCanvas.height / 2; // Центрируем по вертикали
                if (i === 0) mainCtx.moveTo(x, y);
                else mainCtx.lineTo(x, y);
                x += sliceWidth;
            }
            mainCtx.lineTo(mainVisualizerCanvas.width, mainVisualizerCanvas.height / 2); // Завершаем линию по центру
            mainCtx.stroke();
        } else if (visualizationType === 'frequency') { // Частотные столбцы
            analyserNode.fftSize = 1024; // Можно настроить, 1024 дает 512 столбцов (частотных бинов)
            const bufferLength = analyserNode.frequencyBinCount; // Количество бинов = fftSize / 2
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteFrequencyData(dataArray); // Получаем данные по частотам

            const barWidth = (mainVisualizerCanvas.width / bufferLength) * 1.2; // Ширина столбца с небольшим перекрытием
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeightFraction = dataArray[i] / 255.0; // Нормализуем высоту (0-1)
                const barHeight = barHeightFraction * mainVisualizerCanvas.height;
                
                // Градиент цвета для столбцов: Красный (низкие) -> Желтый -> Зеленый (высокие)
                const hue = (i / bufferLength) * 120 ; // 0=красный, 60=желтый, 120=зеленый
                // Яркость столбца зависит от его высоты, но не ниже 20%
                mainCtx.fillStyle = `hsl(${hue}, 100%, ${Math.max(20, 50 * barHeightFraction)}%)`; 

                mainCtx.fillRect(x, mainVisualizerCanvas.height - barHeight, barWidth, barHeight); // Рисуем столбец снизу вверх
                x += barWidth + 0.5; // Смещаемся для следующего столбца с небольшим зазором
            }
        }
    }
    
    // Функция для отрисовки статической формы волны/частот из буфера (например, после загрузки)
    function visualizeBufferStatic(buffer, type) {
        if (animationFrameId) { // Убедимся, что не идет живая отрисовка
             cancelAnimationFrame(animationFrameId);
             animationFrameId = null;
        }

        mainCtx.fillStyle = '#1a1222'; // Фон холста
        mainCtx.fillRect(0, 0, mainVisualizerCanvas.width, mainVisualizerCanvas.height);

        if (!buffer) return; // Если буфера нет, просто очищаем холст

        if (type === 'waveform') {
            const channelData = buffer.getChannelData(0); // Используем данные первого канала
            const bufferLength = channelData.length;

            mainCtx.lineWidth = 1; // Тоньше для статического детального вида
            mainCtx.strokeStyle = 'var(--primary-accent)';
            mainCtx.beginPath();

            // Оптимизация: рисуем ограниченное количество точек для производительности, если буфер очень длинный
            const samplesToDraw = mainVisualizerCanvas.width * 2; // Рисуем больше точек для детализации
            const step = Math.max(1, Math.floor(bufferLength / samplesToDraw));
            
            for (let i = 0; i < bufferLength; i += step) {
                const x = (i / bufferLength) * mainVisualizerCanvas.width;
                const v = (channelData[i] + 1) / 2.0; // Нормализуем диапазон (-1 до 1) к (0 до 1)
                const y = (1 - v) * mainVisualizerCanvas.height; // Инвертируем Y для системы координат canvas
                if (i === 0) mainCtx.moveTo(x, y);
                else mainCtx.lineTo(x, y);
            }
            mainCtx.stroke();

        } else if (type === 'frequency') {
            // Для статического отображения частот потребовался бы FFT на всем буфере,
            // что сложнее, чем getByteFrequencyData из AnalyserNode.
            // Для простоты выводим сообщение.
            mainCtx.font = "16px var(--font-main)";
            mainCtx.fillStyle = "grey";
            mainCtx.textAlign = "center";
            mainCtx.fillText("Статический вид частот доступен во время воспроизведения.", mainVisualizerCanvas.width/2, mainVisualizerCanvas.height/2);
        }
        // Убедимся, что правильная кнопка визуально активна
        waveformViewButton.classList.toggle('active', type === 'waveform');
        frequencyViewButton.classList.toggle('active', type === 'frequency');
        visualizationType = type; // Устанавливаем текущий тип визуализации
    }
    
    // Начальное состояние приложения
    visualizeBufferStatic(null, 'waveform'); // Очищаем холст при загрузке
    stopLiveVisualizer(); // Убеждаемся, что мини-визуализатор изначально очищен
    uploadStatus.textContent = 'Аудио не загружено'; // Начальный статус загрузки
});