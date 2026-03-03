// public/script.js - Исправленная версия с фильтром из URL
class PortfolioGallery {
    constructor() {
        this.galleryEl = document.getElementById('gallery');
        this.searchInput = document.getElementById('searchInput');

        this.allPosts = [];
        this.filteredPosts = [];
        this.currentFilter = 'all';
        this.searchTerm = '';

        // Получаем фильтр из URL при создании
        this.urlFilter = this.getFilterFromUrl();
        this.setupLazyObserver();
        this.init();
    }

    extractVideoFromContent(content) {
        if (!content || typeof content !== 'string') return null;

        // Поиск тега <video> с poster и source src
        const videoRegex = /<video[^>]*poster="([^"]*)"[^>]*>.*?<source[^>]*src="([^"]*)"[^>]*>/gis;
        const match = videoRegex.exec(content);
        if (match && match[2]) {
            return {
                videoUrl: match[2],
                poster: match[1] || ''
            };
        }

        // Поиск NPF-данных в атрибуте data-npf
        const npfRegex = /data-npf='({.*?})'/gis;
        const npfMatch = npfRegex.exec(content);
        if (npfMatch) {
            try {
                const npf = JSON.parse(npfMatch[1]);
                if (npf.type === 'video' && npf.url) {
                    return {
                        videoUrl: npf.url,
                        poster: npf.poster && npf.poster[0] ? npf.poster[0].url : ''
                    };
                }
            } catch (e) { }
        }

        return null;
    }

    extractTitleFromCaption(html) {
        if (!html || typeof html !== 'string') return null;
        const div = document.createElement('div');
        div.innerHTML = html;
        const h1 = div.querySelector('h1');
        if (h1) {
            // Возвращаем внутренний HTML первого заголовка (со ссылками и другими тегами)
            return h1.innerHTML;
        }
        return null;
    }

    // Получение параметра filter из URL
    getFilterFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('filter');
    }

    init() {
        this.setupEventListeners();
        this.setupThemeToggle(); // <-- добавить эту строку
        this.loadPortfolio();
    }

    setupEventListeners() {
        // Только поиск, так как кнопки фильтров на главной больше нет
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase().trim();
            this.filterPosts();
        });
    }

    async loadPortfolio() {
        this.galleryEl.innerHTML = '';

        try {
            const posts = await this.fetchFromTumblrAPI();
            this.allPosts = posts;
            this.filteredPosts = posts;

            // Если в URL есть фильтр, применяем его
            if (this.urlFilter) {
                this.currentFilter = this.urlFilter;
                this.filterPosts(); // filterPosts сам вызовет displayPosts
            } else {
                this.displayPosts();
            }
        } catch (error) {
            console.error('Error loading from Tumblr:', error);
            this.showDemoData();
        }

    }

    async fetchFromTumblrAPI() {
        try {
            const response = await fetch('/api/tumblr');
            if (!response.ok) throw new Error('API error');
            const data = await response.json();
            return this.processTumblrPosts(data.response.posts);
        } catch (error) {
            console.warn('Using fallback demo data');
            return this.generateDemoPosts();
        }
    }

    processTumblrPosts(posts) {
        // Проверка входных данных
        if (!posts || !Array.isArray(posts)) {
            return this.generateDemoPosts();
        }

        const processedPosts = [];
        const uniquePostIds = new Set();

        posts.forEach((post) => {
            console.log('📦 Пост:', {
                id: post.id_string || post.id,
                type: post.type,
                has_video_url: !!post.video_url,
                has_player: !!post.player,
                has_thumbnail: !!post.thumbnail_url,
                tags: post.tags
            });

            if (uniquePostIds.has(post.id_string || post.id)) return;

            let images = [];
            let videoUrl = null;
            let embedCode = null;
            let mediaType = 'image';

            // --- Фото-пост ---
            if (post.type === 'photo' && post.photos?.length > 0) {
                const firstPhoto = post.photos[0];
                if (firstPhoto.original_size?.url) images.push(firstPhoto.original_size.url);
                mediaType = 'image';
            }

            // --- Видео-пост (настоящий тип video) ---
            else if (post.type === 'video') {
                mediaType = 'video';
                // Постер
                if (post.thumbnail_url) {
                    images.push(post.thumbnail_url);
                } else if (post.photos?.length > 0) {
                    const firstPhoto = post.photos[0];
                    if (firstPhoto.original_size?.url) images.push(firstPhoto.original_size.url);
                } else if (post.body) {
                    const extracted = this.extractImagesFromContent(post.body);
                    if (extracted.length) images.push(extracted[0]);
                }

                // Ссылка на видео
                if (post.video_url) {
                    videoUrl = post.video_url;
                } else if (post.player) {
                    if (Array.isArray(post.player) && post.player[0]?.embed_code) {
                        embedCode = post.player[0].embed_code;
                    } else if (typeof post.player === 'string') {
                        embedCode = post.player;
                    }
                }

                console.log('🎥 Видео-пост обработан:', {
                    images_found: images,
                    videoUrl,
                    embedCode: !!embedCode
                });
            }

            // --- Текстовый пост (может содержать встроенное видео) ---
            else if (post.body && typeof post.body === 'string') {
                // 1. Пытаемся извлечь видео из содержимого
                const videoInfo = this.extractVideoFromContent(post.body);
                if (videoInfo) {
                    mediaType = 'video';
                    videoUrl = videoInfo.videoUrl;
                    if (videoInfo.poster) {
                        images.push(videoInfo.poster);
                    }
                }

                // 2. Извлекаем все изображения
                const extracted = this.extractImagesFromContent(post.body);
                if (extracted.length) {
                    // Если видео не найдено или нет постера, используем первое изображение как постер
                    if (!images.length) {
                        images = [extracted[0]];
                    }
                    // Сохраняем все изображения в allImages (позже добавим в объект)
                }

                // 3. Если видео есть, но нет даже постера, добавляем пустую строку, чтобы запись создалась
                if (videoInfo && !images.length) {
                    images.push('');
                }
            }

            // --- Если нашли медиа (изображение или видео), создаём запись ---
            if (images.length > 0 || videoUrl || embedCode) {
                const imageUrl = images.length ? images[0] : '';

                processedPosts.push({
                    id: post.id_string || post.id,
                    title: this.extractPostTitle(post), // новая функция
                    image: imageUrl,
                    tags: post.tags || [],
                    description: this.extractDescription(post),
                    date: post.date,
                    url: post.post_url,
                    mediaType: mediaType,
                    videoUrl: videoUrl,
                    embedCode: embedCode,
                    allImages: images,
                    originalPost: post
                });

                uniquePostIds.add(post.id_string || post.id);
            }
        });

        // --- Поиск и перемещение pinned-поста в начало ---
        const pinnedIndex = processedPosts.findIndex(p =>
            p.tags && p.tags.some(tag => tag.toLowerCase() === 'pinned')
        );

        if (pinnedIndex !== -1) {
            const [pinnedPost] = processedPosts.splice(pinnedIndex, 1);
            processedPosts.unshift(pinnedPost);
            console.log('📌 Найден pinned-пост, перемещён в начало:', pinnedPost.id);
        }

        // Если после обработки нет постов, возвращаем демо
        if (processedPosts.length === 0) return this.generateDemoPosts();

        return processedPosts;
    }

    extractPostTitle(post) {
        // Пытаемся получить заголовок из caption
        if (post.caption) {
            const titleFromCaption = this.extractTitleFromCaption(post.caption);
            if (titleFromCaption) return titleFromCaption;
        }
        // Если caption нет или там нет h1, пробуем body
        if (post.body) {
            const titleFromBody = this.extractTitleFromCaption(post.body);
            if (titleFromBody) return titleFromBody;
        }
        // Если ничего не нашли, возвращаем пустую строку (на главной ничего не покажется)
        return '';
    }

    /*
    generateTitleFromPost(post) {
        if (post.tags && post.tags.length > 0) {
            const firstTag = post.tags[0];
            return firstTag.charAt(0).toUpperCase() + firstTag.slice(1);
        }
        if (post.date) {
            const date = new Date(post.date);
            return `Work ${date.getFullYear()}`;
        }
        return 'Work';
    }
    */

    extractImagesFromContent(content) {
        if (!content || typeof content !== 'string') return [];

        const images = [];
        const imgRegex = /<img[^>]+src="([^">]+)"/gi;
        let match;

        while ((match = imgRegex.exec(content)) !== null) {
            if (match[1]) {
                const url = match[1].trim();
                if (url && !url.includes('avatar') && !url.includes('icon') &&
                    !url.includes('tumblr.com/s75x75') && !url.includes('tumblr.com/s64x64') &&
                    !url.includes('tumblr.com/s96x96')) {
                    if (url.includes('tumblr.com/s640x960') ||
                        url.includes('tumblr.com/s1280x1920') ||
                        url.includes('tumblr.com/s2048x3072') ||
                        url.includes('.jpg') || url.includes('.jpeg') ||
                        url.includes('.png') || url.includes('.gif') || url.includes('.webp')) {
                        images.push(url);
                    }
                }
            }
        }

        if (images.length === 0) {
            const allMatches = [...content.matchAll(/<img[^>]+src="([^">]+)"/gi)];
            for (const m of allMatches) {
                if (m[1]) {
                    const url = m[1].trim();
                    if (!url.includes('avatar') && !url.includes('icon')) {
                        images.push(url);
                        break;
                    }
                }
            }
        }

        return images;
    }

    generateDemoPosts() {
        return [
            {
                id: 'demo-1',
                title: 'Demo Work 1',
                image: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=500&fit=crop',
                tags: ['design', 'art'],
                description: 'Example portfolio work',
                date: '2024-01-01',
                url: '#'
            },
            {
                id: 'demo-2',
                title: 'Demo Work 2',
                image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop',
                tags: ['photo', 'art'],
                description: 'Another example work',
                date: '2024-01-02',
                url: '#'
            },
            {
                id: 'demo-3',
                title: 'Demo Work 3',
                image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
                tags: ['design', 'photo'],
                description: 'Portfolio example',
                date: '2024-01-03',
                url: '#'
            }
        ];
    }

    extractDescription(post) {
        // Сначала пробуем получить чистый текст из caption или body
        if (post.caption) {
            const captionText = this.extractTextContent(post.caption);
            if (captionText && captionText !== 'Portfolio work' && captionText.trim() !== '') {
                return captionText;
            }
        }
        if (post.body) {
            const bodyText = this.extractTextContent(post.body);
            if (bodyText && bodyText !== 'Portfolio work' && bodyText.trim() !== '') {
                return bodyText;
            }
        }
        // Если ничего нет — возвращаем пустую строку
        return '';
    }

    extractTextContent(html) {
        if (!html || typeof html !== 'string') return '';

        try {
            // Удаляем все теги, оставляем только текст
            const text = html
                .replace(/<[^>]*>/g, ' ')        // заменяем теги на пробелы
                .replace(/&nbsp;/g, ' ')          // заменяем неразрывные пробелы
                .replace(/&amp;/g, '&')           // восстанавливаем амперсанды
                .replace(/&lt;/g, '<')            // восстанавливаем <
                .replace(/&gt;/g, '>')            // восстанавливаем >
                .replace(/&quot;/g, '"')          // восстанавливаем кавычки
                .replace(/&#[0-9]+;/g, ' ')       // убираем HTML-коды символов
                .replace(/\s+/g, ' ')             // убираем лишние пробелы
                .trim();

            // Если текст не пустой и не слишком короткий (меньше 3 символов)
            if (text && text.length > 3) {
                // Обрезаем, если длиннее 200 символов
                return text.length > 200 ? text.substring(0, 200) + '…' : text;
            }
            return '';
        } catch (error) {
            console.error('Error extracting text:', error);
            return '';
        }
    }

    filterPosts() {
        let filtered = this.allPosts.filter(post => {
            // Поиск по тегам (ваш текущий фильтр)
            if (this.currentFilter !== 'all') {
                return post.tags && post.tags.some(tag =>
                    tag.toLowerCase().includes(this.currentFilter.toLowerCase())
                );
            }
            return true;
        });

        if (this.searchTerm) {
            filtered = filtered.filter(post =>
                (post.tags && post.tags.some(tag =>
                    tag.toLowerCase().includes(this.searchTerm)
                )) ||
                (post.title && post.title.toLowerCase().includes(this.searchTerm)) ||
                (post.description && post.description.toLowerCase().includes(this.searchTerm))
            );
        }

        // Находим pinned-пост в оригинальном массиве
        const pinnedPost = this.allPosts.find(p =>
            p.tags && p.tags.some(tag => tag.toLowerCase() === 'pinned')
        );

        // Если pinned-пост существует и его нет в filtered, добавляем его в начало
        if (pinnedPost && !filtered.some(p => p.id === pinnedPost.id)) {
            filtered.unshift(pinnedPost);
        }

        this.filteredPosts = filtered;
        this.displayPosts();
    }

    displayPosts() {
        if (this.filteredPosts.length === 0) {
            this.showNoResults();
            return;
        }

        this.galleryEl.innerHTML = '';

        this.filteredPosts.forEach(post => {
            const item = this.createGalleryItem(post);
            this.galleryEl.appendChild(item);
        });

        this.observeMedia(); // ← ВАЖНО
    }


    createGalleryItem(post) {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const mediaWrapper = document.createElement('div');
        mediaWrapper.className = 'media-item';

        let mediaElement;

        // ===== VIDEO =====
        if (post.mediaType === 'video' && post.videoUrl) {

            mediaElement = document.createElement('video');
            mediaElement.dataset.src = post.videoUrl;

            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.autoplay = true;
            mediaElement.playsInline = true;

            if (post.image) {
                mediaElement.poster = post.image;
            }

        } else {

            // ===== IMAGE =====
            mediaElement = document.createElement('img');
            mediaElement.dataset.src = post.image;
            mediaElement.alt = 'Post image';
        }

        mediaWrapper.appendChild(mediaElement);
        item.appendChild(mediaWrapper);

        // Показываем только заголовок (первый тег), если он есть
        if (post.title && post.title.trim() !== '') {
            const info = document.createElement('div');
            info.className = 'post-info';

            const titleEl = document.createElement('div');
            titleEl.className = 'post-title';
            titleEl.innerHTML = post.title;

            info.appendChild(titleEl);
            item.appendChild(info);
        }
        // Если заголовка нет — ничего не выводим (блок не создаётся)

        item.style.cursor = 'pointer';
        item.addEventListener('click', (e) => {
            // Если кликнули на ссылку (или внутри неё) — не переходим на страницу поста
            if (e.target.closest('a')) return;
            window.location.href = `/post/${post.id}`;
        });

        return item;
    }

    showLoading() {
        // убрали экран загрузки
    }

    showDemoData() {
        this.allPosts = this.generateDemoPosts();
        this.filteredPosts = this.allPosts;
        this.displayPosts();

        const demoNotice = document.createElement('div');
        demoNotice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffeb3b;
            color: #333;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 0.8rem;
            z-index: 1000;
        `;
        demoNotice.textContent = 'Демо-режим: данные с Tumblr недоступны';
        document.body.appendChild(demoNotice);
        setTimeout(() => demoNotice.remove(), 5000);
    }

    showNoResults() {
        this.galleryEl.innerHTML = `<div class="no-works"><p>Ничего не найдено</p></div>`;
    }

    setupLazyObserver() {
        this.observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {

                if (!entry.isIntersecting) return;

                const container = entry.target;
                const media = container.querySelector('img, video');

                if (!media) return;

                // если уже загружено — не трогаем
                if (container.dataset.loaded === "true") {
                    obs.unobserve(container);
                    return;
                }

                container.dataset.loaded = "true";

                const isDark = document.body.classList.contains('dark-theme');
                container.style.backgroundColor = isDark ? '#3E404F' : '#ffffff';
                container.style.position = 'relative';

                const canvas = document.createElement('canvas');
                Object.assign(canvas.style, {
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 1
                });

                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                function resize() {
                    const rect = container.getBoundingClientRect();
                    const dpr = window.devicePixelRatio || 1;
                    canvas.width = rect.width * dpr;
                    canvas.height = rect.height * dpr;
                    canvas.style.width = rect.width + 'px';
                    canvas.style.height = rect.height + 'px';
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }

                resize();
                const ro = new ResizeObserver(resize);
                ro.observe(container);

                const color = isDark ? '#C0E2FF' : '#1A2732';
                const particles = [];

                function create(x, y, r = 4) {
                    return {
                        x, y,
                        vx: (Math.random() - 0.5) * 0.2,
                        vy: (Math.random() - 0.5) * 0.2,
                        r,
                        life: 0,
                        phase: 0
                    };
                }

                // стартуем из центра
                particles.push(create(canvas.width / 2, canvas.height / 2, 5));

                function ease(t) {
                    return t * t * (3 - 2 * t);
                }

                let frame;

                function animate() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    particles.forEach((p, i) => {

                        p.life += 0.02;
                        p.x += p.vx;
                        p.y += p.vy;

                        // мягкий отскок
                        const margin = p.r + 2;
                        if (p.x < margin || p.x > canvas.width - margin) p.vx *= -0.8;
                        if (p.y < margin || p.y > canvas.height - margin) p.vy *= -0.8;

                        if (p.phase === 0) {
                            p.r += 0.08;

                            if (p.r > 10 && particles.length < 20) {
                                p.phase = 1;
                                p.life = 0;
                            }

                            draw(p.x, p.y, p.r);
                        }
                        else {
                            const t = Math.min(p.life, 1);
                            const e = ease(t);
                            const offset = e * p.r * 0.7;

                            draw(p.x - offset, p.y, p.r * 0.7);
                            draw(p.x + offset, p.y, p.r * 0.7);

                            if (t >= 1) {
                                particles.splice(i, 1,
                                    create(p.x - p.r, p.y, p.r * 0.6),
                                    create(p.x + p.r, p.y, p.r * 0.6)
                                );
                            }
                        }
                    });

                    frame = requestAnimationFrame(animate);
                }

                function draw(x, y, r) {
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                }

                animate();

                // ВАЖНО — назначаем src СРАЗУ
                if (media.dataset.src) {
                    media.src = media.dataset.src;
                }

                if (media.tagName === 'VIDEO') {
                    media.load();
                    media.play().catch(() => { });
                }

                const finish = () => {
                    container.classList.add('loaded');

                    cancelAnimationFrame(frame);
                    canvas.style.opacity = '0';

                    setTimeout(() => {
                        canvas.remove();
                        ro.disconnect();
                    }, 300);
                };

                if (media.tagName === 'IMG') {
                    if (media.complete) finish();
                    else media.onload = finish;
                } else {
                    media.onloadeddata = finish;
                }

                obs.unobserve(container);
            });
        }, {
            root: null,
            rootMargin: '0px 0px 200px 0px', // мягкий preload
            threshold: 0.1
        });
    }

    observeMedia() {
        const items = this.galleryEl.querySelectorAll('.media-item');
        items.forEach(item => this.observer.observe(item));
    }

    setupThemeToggle() {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;

        // При загрузке проверяем сохранённую тему
        const savedTheme = localStorage.getItem('site-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }

        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            // Сохраняем выбор
            if (document.body.classList.contains('dark-theme')) {
                localStorage.setItem('site-theme', 'dark');
            } else {
                localStorage.setItem('site-theme', 'light');
            }
        });
    }
}


// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioGallery();
});