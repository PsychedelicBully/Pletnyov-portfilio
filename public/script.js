// public/script.js - Упрощенная версия
class PortfolioGallery {
    constructor() {
        this.galleryEl = document.getElementById('gallery');
        this.filterBtns = document.querySelectorAll('.nav-link');
        this.searchInput = document.getElementById('searchInput');

        this.allPosts = [];
        this.filteredPosts = [];
        this.currentFilter = 'all';
        this.searchTerm = '';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPortfolio();
    }

    setupEventListeners() {
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFilterClick(e.target);
            });
        });

        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase().trim();
            this.filterPosts();
        });
    }

    handleFilterClick(btn) {
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.filterPosts();
    }

    async loadPortfolio() {
        this.showLoading();

        try {
            const posts = await this.fetchFromTumblrAPI();
            this.allPosts = posts;
            this.filteredPosts = posts;
            this.displayPosts();
        } catch (error) {
            console.error('Error loading from Tumblr:', error);
            // Показываем демо-данные если API не работает
            this.showDemoData();
        }
    }

    async fetchFromTumblrAPI() {
        // Пробуем разные эндпоинты
        const endpoints = [
            //'/netlify/functions/tumblr',
            //'/api/tumblr',
            'https://api.tumblr.com/v2/blog/pletnyov.tumblr.com/posts?api_key=Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG&limit=20'
        ];

        for (let endpoint of endpoints) {
            try {
                console.log('Trying endpoint:', endpoint);
                const response = await fetch(endpoint);

                console.log({ response })

                if (response.ok) {
                    const data = await response.json();
                    console.log({ data })

                    console.log('Success with endpoint:', endpoint);

                    if (data.response && data.response.posts) {
                        return this.processTumblrPosts(data.response.posts);
                    }
                }
            } catch (error) {
                console.log('Endpoint failed:', endpoint, error);
                continue;
            }
        }

        throw new Error('All API endpoints failed');
    }

    processTumblrPosts(posts) {
        console.log({ posts });
        const processedPosts = [];

        if (!posts || !Array.isArray(posts)) {
            console.warn('No posts array in response');
            return this.generateDemoPosts();
        }

        // Используем Set для отслеживания уникальных постов по ID
        const uniquePostIds = new Set();

        posts.forEach((post, index) => {
            // Пропускаем если уже обработали этот ID
            if (uniquePostIds.has(post.id_string || post.id)) {
                console.log(`Skipping duplicate post ID: ${post.id_string || post.id}`);
                return;
            }

            console.log(`Processing post ${index}:`, {
                id: post.id_string || post.id,
                type: post.type,
                tags: post.tags,
                hasBody: !!post.body
            });

            let images = [];

            // Вариант 1: Если есть photos (фото-посты) - берем первую
            if (post.photos && Array.isArray(post.photos) && post.photos.length > 0) {
                console.log(`Found ${post.photos.length} photos in photo post`);
                const firstPhoto = post.photos[0];
                if (firstPhoto.original_size && firstPhoto.original_size.url) {
                    images.push(firstPhoto.original_size.url);
                }
            }
            // Вариант 2: Если есть body с изображениями (текстовые посты)
            else if (post.body && typeof post.body === 'string') {
                console.log(`Extracting images from body`);
                const extractedImages = this.extractImagesFromContent(post.body);
                if (extractedImages.length > 0) {
                    // Берем только первую картинку
                    images.push(extractedImages[0]);
                }
            }

            // Если нашли изображения - создаем один пост
            if (images.length > 0) {
                const imageUrl = images[0];
                console.log(`Using image URL: ${imageUrl}`);

                processedPosts.push({
                    id: post.id_string || post.id,
                    title: this.generateTitleFromPost(post),
                    image: imageUrl,
                    tags: post.tags || [],
                    description: this.extractDescription(post),
                    date: post.date,
                    url: post.post_url,
                    // Сохраняем все изображения для будущей детальной страницы
                    allImages: images,
                    originalPost: post // Сохраняем оригинальный пост для деталей
                });

                // Добавляем ID в Set для проверки дубликатов
                uniquePostIds.add(post.id_string || post.id);
            } else {
                console.log(`No images found in post ${post.id_string || post.id}`);
            }
        });

        console.log(`Processed ${processedPosts.length} unique posts from ${posts.length} total posts`);

        // Если нет постов, показываем демо-данные
        if (processedPosts.length === 0) {
            console.log('No processed posts, showing demo data');
            return this.generateDemoPosts();
        }

        return processedPosts;
    }

    generateTitleFromPost(post) {
        // 1. Пробуем получить из тегов
        if (post.tags && post.tags.length > 0) {
            // Берем первый тег и делаем его заголовком
            const firstTag = post.tags[0];
            // Делаем первую букву заглавной
            return firstTag.charAt(0).toUpperCase() + firstTag.slice(1);
        }

        // 2. Пробуем создать из даты
        if (post.date) {
            const date = new Date(post.date);
            return `Work ${date.getFullYear()}`;
        }

        // 3. Или просто номер
        return `Work`;
    }


    extractImagesFromContent(content) {
        if (!content || typeof content !== 'string') return [];

        const images = [];
        const imgRegex = /<img[^>]+src="([^">]+)"/gi;
        let match;

        while ((match = imgRegex.exec(content)) !== null) {
            if (match[1]) {
                const url = match[1].trim();

                // Фильтруем аватарки, иконки и маленькие изображения
                if (url &&
                    !url.includes('avatar') &&
                    !url.includes('icon') &&
                    !url.includes('placeholder') &&
                    !url.includes('tumblr.com/s75x75') && // Маленькие превью
                    !url.includes('tumblr.com/s64x64') &&
                    !url.includes('tumblr.com/s96x96')) {

                    // Предпочитаем оригинальные изображения
                    // Ищем URL с большими размерами или оригинальными
                    if (url.includes('tumblr.com/s640x960') ||
                        url.includes('tumblr.com/s1280x1920') ||
                        url.includes('tumblr.com/s2048x3072') ||
                        url.includes('.jpg') ||
                        url.includes('.jpeg') ||
                        url.includes('.png') ||
                        url.includes('.gif') ||
                        url.includes('.webp')) {
                        images.push(url);
                    }
                }
            }
        }

        // Если не нашли хороших изображений, возвращаем первое подходящее
        if (images.length === 0) {
            // Ищем любые изображения
            const allImgRegex = /<img[^>]+src="([^">]+)"/gi;
            const allMatches = [...content.matchAll(allImgRegex)];

            for (const m of allMatches) {
                if (m[1]) {
                    const url = m[1].trim();
                    if (!url.includes('avatar') && !url.includes('icon')) {
                        images.push(url);
                        break; // Берем только первое
                    }
                }
            }
        }

        return images;
    }


    generateDemoPosts() {
        console.log('Generating demo posts');
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
        // Пробуем получить из тегов
        if (post.tags && post.tags.length > 0) {
            // Берем 2-3 тега для описания
            const tagsForDescription = post.tags.slice(0, 3).join(', ');
            return tagsForDescription;
        }

        // Пробуем из body если есть
        if (post.body) {
            const text = this.extractTextContent(post.body);
            if (text && text !== 'Portfolio work') {
                return text.length > 100 ? text.substring(0, 100) + '...' : text;
            }
        }

        return 'Portfolio work';
    }

    extractTextContent(html) {
        if (!html || typeof html !== 'string') return '';

        try {
            // Удаляем все теги и лишние пробелы
            const text = html
                .replace(/<[^>]*>/g, ' ')  // Заменяем теги на пробелы
                .replace(/&nbsp;/g, ' ')    // Заменяем неразрывные пробелы
                .replace(/&amp;/g, '&')     // Восстанавливаем амперсанды
                .replace(/&lt;/g, '<')      // Восстанавливаем <
                .replace(/&gt;/g, '>')      // Восстанавливаем >
                .replace(/&quot;/g, '"')    // Восстанавливаем кавычки
                .replace(/\s+/g, ' ')       // Убираем лишние пробелы
                .trim();

            // Если текст длинный, обрезаем и добавляем многоточие
            if (text.length > 150) {
                return text.substring(0, 150) + '...';
            }

            return text || 'Portfolio work';
        } catch (error) {
            console.error('Error extracting text:', error);
            return 'Portfolio work';
        }
    }

    filterPosts() {
        let filtered = this.allPosts;

        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(post =>
                post.tags && post.tags.some(tag =>
                    tag.toLowerCase().includes(this.currentFilter.toLowerCase())
                )
            );
        }

        if (this.searchTerm) {
            filtered = filtered.filter(post =>
                (post.tags && post.tags.some(tag =>
                    tag.toLowerCase().includes(this.searchTerm)
                )) ||
                (post.title && post.title.toLowerCase().includes(this.searchTerm))
            );
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
    }

    createGalleryItem(post) {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        // Используем первое изображение
        const imageUrl = post.image || 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=500&fit=crop';

        item.innerHTML = `
        <img src="${imageUrl}" alt="${post.title}" loading="lazy" 
             onerror="this.src='https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=500&fit=crop'">
        <div class="post-info">
            <div class="post-title">${post.title || 'Work'}</div>
            <div class="post-description">${post.description}</div>
            ${post.tags && post.tags.length > 0 ? `
                <div class="tags">
                    ${post.tags.slice(0, 3).map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>
            ` : ''}
            ${post.date ? `<div class="post-date">${new Date(post.date).toLocaleDateString()}</div>` : ''}
        </div>
    `;

        // Добавляем клик для открытия деталей
        item.style.cursor = 'pointer';
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Если есть URL Tumblr, открываем его
            if (post.url && !post.url.includes('#')) {
                window.open(post.url, '_blank');
            } else {
                // Иначе показываем детали (будущая функциональность)
                this.showPostDetails(post);
            }
        });

        return item;
    }

    showPostDetails(post) {
        console.log('Showing post details:', post.id);

        // Создаем модальное окно с деталями поста
        const modal = document.createElement('div');
        modal.className = 'post-modal';
        modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

        modal.innerHTML = `
        <div style="background: white; max-width: 800px; max-height: 90vh; overflow: auto; position: relative;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="position: absolute; right: 10px; top: 10px; background: #333; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer;">×</button>
            <div style="padding: 20px;">
                <img src="${post.image}" alt="${post.title}" style="width: 100%; height: auto; max-height: 60vh; object-fit: contain;">
                <h2 style="margin: 20px 0 10px 0;">${post.title}</h2>
                <p>${post.description}</p>
                ${post.tags && post.tags.length > 0 ? `
                    <div style="margin: 10px 0;">
                        ${post.tags.map(tag => `<span style="background: #f0f0f0; padding: 5px 10px; margin: 0 5px 5px 0; display: inline-block; border-radius: 3px;">#${tag}</span>`).join('')}
                    </div>
                ` : ''}
                ${post.date ? `<div style="color: #666; margin-top: 10px;">${new Date(post.date).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</div>` : ''}
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }



    showLoading() {
        this.galleryEl.innerHTML = `
            <div class="loading">
                <p>Загрузка работ...</p>
            </div>
        `;
    }

    showDemoData() {
        console.log('Showing demo data');
        this.allPosts = this.generateDemoPosts();
        this.filteredPosts = this.allPosts;
        this.displayPosts();

        // Показываем сообщение о демо-режиме
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
        this.galleryEl.innerHTML = `
            <div class="no-works">
                <p>Ничего не найдено</p>
            </div>
        `;
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioGallery();
});