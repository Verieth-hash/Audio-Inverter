# Аудио Инвертор Фазы и Визуализатор

Веб-приложение для демонстрации принципа инверсии фазы звука и его влияния при сложении с оригинальным сигналом. Позволяет записывать аудио с микрофона, загружать аудиофайлы, обрабатывать их (инвертировать фазу) и визуализировать звуковые волны и частоты в реальном времени.

## Как это работает

### Принцип Инверсии Фазы

Звук представляет собой волну давления. Каждая звуковая волна имеет амплитуду (громкость) и фазу (положение волны во времени). Инверсия фазы означает "переворачивание" звуковой волны на 180 градусов.

Когда оригинальная звуковая волна $S_{ориг}(t)$ складывается с её фазоинвертированной копией $S_{инв}(t)$, происходит их взаимное уничтожение (деструктивная интерференция).

Математически это можно представить так:
Если $S_{инв}(t) = -S_{ориг}(t)$,
тогда их сумма $S_{сумма}(t) = S_{ориг}(t) + S_{инв}(t) = S_{ориг}(t) + (-S_{ориг}(t)) = 0$.

В идеальных условиях это приводит к полной тишине. В реальности полное подавление сложно достичь из-за неидеальности сигналов, задержек и различий в амплитудах, но эффект значительного ослабления звука хорошо заметен.

### Алгоритм в Коде

1.  **Получение аудио:**
    * **Запись с микрофона:** Используется `navigator.mediaDevices.getUserMedia()` для доступа к микрофону и `MediaRecorder` для записи аудиопотока.
    * **Загрузка файла:** Пользователь выбирает аудиофайл (`<input type="file">`), который читается с помощью `FileReader` как `ArrayBuffer`.
2.  **Декодирование:** Полученные аудиоданные (из записи или файла) декодируются в `AudioBuffer` с помощью `audioContext.decodeAudioData()`. `AudioBuffer` содержит необработанные PCM-данные аудио.
3.  **Инверсия Фазы:**
    * Создается новый `AudioBuffer` с теми же параметрами (количество каналов, длина, частота дискретизации), что и у оригинала.
    * Для каждого канала оригинального аудио-буфера получается массив данных (`getChannelData`).
    * Каждый сэмпл (числовое значение амплитуды в данный момент времени) в этом массиве умножается на `-1`.
    * Полученные инвертированные сэмплы записываются в соответствующий канал нового `AudioBuffer`.
4.  **Воспроизведение:**
    * Для воспроизведения аудио (`originalBuffer` или `processedBuffer`) создается `AudioBufferSourceNode`.
    * Этот узел подключается к `audioContext.destination` (выход на динамики), возможно, через `AnalyserNode` для визуализации.
    * При выборе "Сумма (Подавление)" оба узла (`AudioBufferSourceNode` для оригинала и `AudioBufferSourceNode` для инвертированного сигнала) подключаются к одному `AnalyserNode` (для визуализации суммы) и затем к `audioContext.destination`.
5.  **Визуализация:**
    * Используется `AnalyserNode` из Web Audio API.
    * **Форма Волны:** `analyserNode.getByteTimeDomainData()` получает данные об амплитуде сигнала во времени. Эти данные отрисовываются на HTML5 `<canvas>`.
    * **Частоты:** `analyserNode.getByteFrequencyData()` получает данные об интенсивности различных частотных составляющих сигнала (результат быстрого преобразования Фурье - FFT). Эти данные также отрисовываются на `<canvas>` в виде столбцов.
    * Мини-визуализатор во время записи также использует `AnalyserNode`, подключенный напрямую к потоку с микрофона.

## Структура Кода

* **`index.html`**: Определяет структуру веб-страницы, включая все кнопки, индикаторы, холсты (`<canvas>`) для визуализации и текстовые поля.
* **`style.css`**: Отвечает за внешний вид и стилизацию всех элементов на странице. Использует CSS переменные для удобного управления цветовой схемой. Реализован адаптивный дизайн.
* **`script.js`**: Содержит всю логику приложения:
    * Инициализация Web Audio API (`AudioContext`).
    * Обработка событий от кнопок и других элементов управления.
    * Функции для записи аудио, загрузки файлов, инверсии фазы.
    * Управление воспроизведением звука.
    * Логика отрисовки визуализаций на холстах в реальном времени (`requestAnimationFrame`).

## Назначение и Применение

Это приложение может быть полезно для:

1.  **Образовательных целей:**
    * Наглядная демонстрация принципов акустики, таких как фаза волны и интерференция.
    * Изучение основ цифровой обработки сигналов (DSP).
    * Понимание работы Web Audio API.
2.  **Демонстрация технологии шумоподавления:**
    * Хотя это упрощенная модель, она показывает базовый принцип активного шумоподавления (ANC), где генерируется "антишум" для подавления нежелательных звуков. Реальные системы ANC значительно сложнее и используют адаптивные фильтры.
3.  **Аудио-эксперименты:**
    * Позволяет экспериментировать с аудиосигналами и наблюдать результат различных манипуляций.
    * Может служить основой для создания простых аудиоэффектов.
4.  **Разработка и отладка аудио приложений:**
    * Визуализация формы волны и частотного спектра полезна при разработке приложений, работающих со звуком.

## Как запустить

1.  Скачайте файлы `index.html`, `style.css`, `script.js` в одну папку на вашем компьютере.
2.  Откройте файл `index.html` в любом современном веб-браузере (например, Google Chrome, Mozilla Firefox, Microsoft Edge).
3.  Для работы с микрофоном потребуется разрешить браузеру доступ к нему.

---
Автор: @Verieth





# Audio Phase Inverter and Visualizer

A web application to demonstrate the principle of audio phase inversion and its effect when combined with the original signal. It allows recording audio from a microphone, uploading audio files, processing them (inverting the phase), and visualizing sound waves and frequencies in real-time.

## How It Works

### Principle of Phase Inversion

Sound is a pressure wave. Each sound wave has an amplitude (loudness) and a phase (the position of the wave in time). Phase inversion means "flipping" the sound wave by 180 degrees.

When the original sound wave \( S_{\text{original}}(t) \) is combined with its phase-inverted copy \( S_{\text{inv}}(t) \), they cancel each other out (destructive interference).

Mathematically, this can be represented as:
If \( S_{\text{inv}}(t) = -S_{\text{original}}(t) \),
then their sum \( S_{\text{sum}}(t) = S_{\text{original}}(t) + S_{\text{inv}}(t) = S_{\text{original}}(t) + (-S_{\text{original}}(t)) = 0 \).

Under ideal conditions, this results in complete silence. In reality, achieving complete cancellation is difficult due to imperfections in signals, delays, and differences in amplitudes, but the effect of significant sound attenuation is clearly noticeable.

### Algorithm in Code

1. **Obtaining Audio:**
   - **Microphone Recording:** Uses `navigator.mediaDevices.getUserMedia()` to access the microphone and `MediaRecorder` to record the audio stream.
   - **File Upload:** The user selects an audio file (`<input type="file">`), which is read using `FileReader` as an `ArrayBuffer`.

2. **Decoding:** The obtained audio data (from recording or file) is decoded into an `AudioBuffer` using `audioContext.decodeAudioData()`. The `AudioBuffer` contains raw PCM audio data.

3. **Phase Inversion:**
   - A new `AudioBuffer` is created with the same parameters (number of channels, length, sample rate) as the original.
   - For each channel of the original audio buffer, an array of data is obtained (`getChannelData`).
   - Each sample (a numerical value of amplitude at a given moment in time) in this array is multiplied by `-1`.
   - The resulting inverted samples are written to the corresponding channel of the new `AudioBuffer`.

4. **Playback:**
   - To play audio (`originalBuffer` or `processedBuffer`), an `AudioBufferSourceNode` is created.
   - This node is connected to `audioContext.destination` (output to speakers), possibly through an `AnalyserNode` for visualization.
   - When selecting "Sum (Cancellation)," both nodes (`AudioBufferSourceNode` for the original and `AudioBufferSourceNode` for the inverted signal) are connected to a single `AnalyserNode` (for visualizing the sum) and then to `audioContext.destination`.

5. **Visualization:**
   - Uses `AnalyserNode` from the Web Audio API.
   - **Waveform:** `analyserNode.getByteTimeDomainData()` retrieves data about the amplitude of the signal over time. This data is rendered on an HTML5 `<canvas>`.
   - **Frequencies:** `analyserNode.getByteFrequencyData()` retrieves data about the intensity of different frequency components of the signal (result of Fast Fourier Transform - FFT). This data is also rendered on `<canvas>` as bars.
   - The mini-visualizer during recording also uses an `AnalyserNode` connected directly to the microphone stream.

## Code Structure

- **`index.html`:** Defines the structure of the web page, including all buttons, indicators, canvases (`<canvas>`) for visualization, and text fields.
- **`style.css`:** Responsible for the appearance and styling of all elements on the page. Uses CSS variables for convenient color scheme management. Implements responsive design.
- **`script.js`:** Contains all the application logic:
  - Initialization of the Web Audio API (`AudioContext`).
  - Handling events from buttons and other control elements.
  - Functions for recording audio, uploading files, inverting phase.
  - Audio playback management.
  - Logic for rendering visualizations on canvases in real-time (`requestAnimationFrame`).

## Purpose and Application

This application can be useful for:

1. **Educational Purposes:**
   - Visual demonstration of acoustic principles such as wave phase and interference.
   - Study of the basics of digital signal processing (DSP).
   - Understanding the workings of the Web Audio API.

2. **Noise Cancellation Technology Demonstration:**
   - Although this is a simplified model, it shows the basic principle of active noise cancellation (ANC), where "anti-noise" is generated to suppress unwanted sounds. Real ANC systems are much more complex and use adaptive filters.

3. **Audio Experiments:**
   - Allows experimenting with audio signals and observing the results of various manipulations.
   - Can serve as a basis for creating simple audio effects.

4. **Audio Application Development and Debugging:**
   - Visualization of waveform and frequency spectrum is useful in developing applications that work with sound.

## How to Run

1. Download the files `index.html`, `style.css`, and `script.js` into a single folder on your computer.
2. Open the `index.html` file in any modern web browser (e.g., Google Chrome, Mozilla Firefox, Microsoft Edge).
3. To work with the microphone, you will need to allow the browser access to it.

---
Author: @Verieth
