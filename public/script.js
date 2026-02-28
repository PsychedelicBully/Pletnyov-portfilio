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

    // Получение параметра filter из URL
    getFilterFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('filter');
    }

    init() {
        this.setupEventListeners();
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
                    title: this.generateTitleFromPost(post),
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

        // ❗ ВАЖНО: description НЕ удаляем, а просто отключаем
        // (чтобы не ломать структуру)
        /*
        if (post.description && post.description.trim() !== '') {
            const info = document.createElement('div');
            info.className = 'post-info';
    
            const desc = document.createElement('div');
            desc.className = 'post-description';
            desc.textContent = post.description;
    
            info.appendChild(desc);
            item.appendChild(info);
        }
        */

        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            window.location.href = `/post/${post.id}`;
        });

        return item; // ← ЭТО ОБЯЗАТЕЛЬНО
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
                if (!media || !media.dataset.src) return;

                // Создаём bitmap placeholder
                const placeholder = this.createBitmapPlaceholder(media);

                media.src = media.dataset.src;

                if (media.tagName === 'VIDEO') {
                    media.load();
                    media.play().catch(() => { });
                }

                const loaded = () => {
                    container.classList.add('loaded');
                    // Убираем canvas через плавный fade
                    if (placeholder) setTimeout(() => placeholder.remove(), 600);
                };

                if (media.tagName === 'IMG') media.onload = loaded;
                else media.onloadeddata = loaded;

                obs.unobserve(container);
            });
        }, {
            rootMargin: '200px'
        });
    }

    // Создание bitmap placeholder для картинки
    createBitmapPlaceholder(mediaEl) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Меньшее разрешение → пиксели крупнее
        const width = 32;
        const height = 32;

        canvas.width = width;
        canvas.height = height;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = mediaEl.dataset.src;

        img.onload = () => {
            // Рисуем уменьшенное изображение
            ctx.drawImage(img, 0, 0, width, height);

            // Усиление контраста / posterize эффект
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                // Усиление контраста
                data[i] = data[i] < 128 ? 0 : 255;     // R
                data[i + 1] = data[i + 1] < 128 ? 0 : 255; // G
                data[i + 2] = data[i + 2] < 128 ? 0 : 255; // B
                // Alpha оставляем как есть
            }

            ctx.putImageData(imageData, 0, 0);

            // Вставляем canvas перед media
            mediaEl.parentNode.insertBefore(canvas, mediaEl);
        };

        return canvas;
    }

    observeMedia() {
        const items = this.galleryEl.querySelectorAll('.media-item');
        items.forEach(item => this.observer.observe(item));
    }
}


// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioGallery();
});