// script.js - Работающая версия с Tumblr API
class PortfolioGallery {
    constructor() {
        this.galleryEl = document.getElementById('gallery');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.searchInput = document.getElementById('searchInput');
        
        // КОНФИГУРАЦИЯ - ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ!
        this.TUMBLR_BLOG = 'pletnyov'; // Тестовый блог с работами
        this.API_KEY = 'Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG'; // Публичный ключ для теста
        
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
            this.showError();
        }
    }
    
    async fetchFromTumblrAPI() {
        // Формируем URL для Tumblr API
        const apiUrl = `https://api.tumblr.com/v2/blog/${this.TUMBLR_BLOG}/posts?api_key=${this.API_KEY}&limit=20&filter=text`;
        
        console.log('Fetching from Tumblr API:', apiUrl);
        
        try {
            // Пробуем прямой запрос
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Tumblr API response:', data);
            
            if (data.meta.status === 200 && data.response.posts) {
                return this.processTumblrPosts(data.response.posts);
            } else {
                throw new Error('No posts in response');
            }
            
        } catch (error) {
            console.error('Direct API request failed:', error);
            
            // Пробуем через CORS прокси
            return await this.fetchWithCorsProxy(apiUrl);
        }
    }
    
    async fetchWithCorsProxy(apiUrl) {
        const corsProxies = [
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`,
            `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(apiUrl)}`
        ];
        
        for (let proxyUrl of corsProxies) {
            try {
                console.log('Trying CORS proxy:', proxyUrl);
                const response = await fetch(proxyUrl);
                
                if (response.ok) {
                    const data = await response.json();
                    return this.processTumblrPosts(data.response.posts);
                }
            } catch (error) {
                console.log('Proxy failed:', error);
                continue;
            }
        }
        
        throw new Error('All CORS proxies failed');
    }
    
    processTumblrPosts(posts) {
        const processedPosts = [];
        
        posts.forEach((post, index) => {
            // Обрабатываем фото-посты
            if (post.type === 'photo' && post.photos && post.photos.length > 0) {
                post.photos.forEach(photo => {
                    processedPosts.push({
                        id: `${post.id}-${index}`,
                        title: post.summary || `Work ${processedPosts.length + 1}`,
                        image: photo.original_size.url,
                        tags: post.tags || [],
                        description: this.extractDescription(post),
                        date: post.date,
                        url: post.post_url
                    });
                });
            }
            
            // Обрабатываем текстовые посты с изображениями
            if (post.type === 'text' || post.type === 'regular') {
                const images = this.extractImagesFromContent(post.body);
                images.forEach(imgUrl => {
                    processedPosts.push({
                        id: `${post.id}-img-${index}`,
                        title: post.title || `Work ${processedPosts.length + 1}`,
                        image: imgUrl,
                        tags: post.tags || [],
                        description: this.extractTextContent(post.body),
                        date: post.date,
                        url: post.post_url
                    });
                });
            }
        });
        
        console.log(`Processed ${processedPosts.length} posts from Tumblr`);
        return processedPosts;
    }
    
    extractImagesFromContent(content) {
        if (!content) return [];
        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        const matches = [];
        let match;
        
        while ((match = imgRegex.exec(content)) !== null) {
            matches.push(match[1]);
        }
        
        return matches;
    }
    
    extractTextContent(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').substring(0, 100) + '...';
    }
    
    extractDescription(post) {
        if (post.caption) {
            return this.extractTextContent(post.caption);
        }
        if (post.body) {
            return this.extractTextContent(post.body);
        }
        if (post.summary) {
            return post.summary;
        }
        return 'Portfolio work';
    }
    
    filterPosts() {
        let filtered = this.allPosts;
        
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(post => 
                post.tags.some(tag => 
                    tag.toLowerCase().includes(this.currentFilter.toLowerCase())
                )
            );
        }
        
        if (this.searchTerm) {
            filtered = filtered.filter(post =>
                post.tags.some(tag => 
                    tag.toLowerCase().includes(this.searchTerm)
                ) ||
                post.title.toLowerCase().includes(this.searchTerm) ||
                post.description.toLowerCase().includes(this.searchTerm)
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
        
        item.innerHTML = `
            <img src="${post.image}" alt="${post.title}" loading="lazy">
            <div class="post-info">
                <div class="post-title">${post.title}</div>
                <div class="post-description">${post.description}</div>
                <div class="tags">
                    ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>
                ${post.date ? `<div class="post-date">${new Date(post.date).toLocaleDateString()}</div>` : ''}
            </div>
        `;
        
        if (post.url) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                window.open(post.url, '_blank');
            });
        }
        
        return item;
    }
    
    showLoading() {
        this.galleryEl.innerHTML = `
            <div class="loading">
                <p>Загрузка работ из Tumblr...</p>
                <p style="margin-top: 10px; font-size: 0.9em; color: #888;">
                    Подключаюсь к блогу: ${this.TUMBLR_BLOG}
                </p>
            </div>
        `;
    }
    
    showError() {
        this.galleryEl.innerHTML = `
            <div class="error">
                <h3>Не удалось загрузить работы из Tumblr</h3>
                <p>Возможные причины:</p>
                <ul style="text-align: left; max-width: 500px; margin: 15px auto;">
                    <li>Блог ${this.TUMBLR_BLOG} не существует или приватный</li>
                    <li>Проблемы с подключением к интернету</li>
                    <li>Ограничения CORS</li>
                </ul>
                <p>Проверьте:</p>
                <ol style="text-align: left; max-width: 500px; margin: 15px auto;">
                    <li>Правильность имени блога в настройках</li>
                    <li>Что блог публичный и содержит посты с изображениями</li>
                    <li>Что используется правильный API ключ</li>
                </ol>
                <button onclick="location.reload()" style="
                    background: #333;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 15px;
                ">Попробовать снова</button>
            </div>
        `;
    }
    
    showNoResults() {
        this.galleryEl.innerHTML = `
            <div class="no-works">
                <p>Пусто</p>
            </div>
        `;
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioGallery();
});