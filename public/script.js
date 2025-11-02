// script.js - Исправленная версия с Netlify Functions
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
            this.showError(error.message);
        }
    }
    
    async fetchFromTumblrAPI() {
        // Используем Netlify Function вместо прямого вызова Tumblr API
        const functionUrl = '/api/posts';
        
        console.log('Fetching via Netlify Function:', functionUrl);
        
        try {
            const response = await fetch(functionUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Tumblr API response via Netlify Function:', data);
            
            if (data.meta && data.meta.status === 200 && data.response.posts) {
                return this.processTumblrPosts(data.response.posts);
            } else {
                throw new Error('Invalid response format from Tumblr API');
            }
            
        } catch (error) {
            console.error('Netlify Function request failed:', error);
            throw new Error(`Failed to load portfolio: ${error.message}`);
        }
    }
    
    processTumblrPosts(posts) {
        const processedPosts = [];
        
        if (!posts || !Array.isArray(posts)) {
            console.warn('No posts array in response');
            return processedPosts;
        }
        
        posts.forEach((post, index) => {
            // Обрабатываем фото-посты
            if (post.type === 'photo' && post.photos && post.photos.length > 0) {
                post.photos.forEach((photo, photoIndex) => {
                    if (photo.original_size && photo.original_size.url) {
                        processedPosts.push({
                            id: `${post.id}-${photoIndex}`,
                            title: post.summary || `Work ${processedPosts.length + 1}`,
                            image: photo.original_size.url,
                            tags: post.tags || [],
                            description: this.extractDescription(post),
                            date: post.date,
                            url: post.post_url
                        });
                    }
                });
            }
            
            // Обрабатываем текстовые посты с изображениями
            if ((post.type === 'text' || post.type === 'regular') && post.body) {
                const images = this.extractImagesFromContent(post.body);
                images.forEach((imgUrl, imgIndex) => {
                    processedPosts.push({
                        id: `${post.id}-text-${imgIndex}`,
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
        
        console.log(`Processed ${processedPosts.length} items from ${posts.length} posts`);
        return processedPosts;
    }
    
    extractImagesFromContent(content) {
        if (!content) return [];
        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        const matches = [];
        let match;
        
        while ((match = imgRegex.exec(content)) !== null) {
            if (match[1] && !match[1].includes('avatar') && !match[1].includes('icon')) {
                matches.push(match[1]);
            }
        }
        
        return matches;
    }
    
    extractTextContent(html) {
        if (!html) return '';
        const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        return text.substring(0, 100) + (text.length > 100 ? '...' : '');
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
                (post.title && post.title.toLowerCase().includes(this.searchTerm)) ||
                (post.description && post.description.toLowerCase().includes(this.searchTerm))
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
            <img src="${post.image}" alt="${post.title}" loading="lazy" onerror="this.style.display='none'">
            <div class="post-info">
                <div class="post-title">${post.title}</div>
                <div class="post-description">${post.description}</div>
                ${post.tags && post.tags.length > 0 ? `
                    <div class="tags">
                        ${post.tags.slice(0, 3).map(tag => `<span class="tag">#${tag}</span>`).join('')}
                    </div>
                ` : ''}
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
                    Используем Netlify Functions для обхода CORS
                </p>
            </div>
        `;
    }
    
    showError(message) {
        this.galleryEl.innerHTML = `
            <div class="error">
                <h3>Не удалось загрузить работы</h3>
                <p style="color: #ff4444; margin: 10px 0;">${message}</p>
                <p>Это нормально - мы используем Netlify Functions для обхода CORS ограничений.</p>
                <button onclick="location.reload()" class="retry-button">Попробовать снова</button>
            </div>
        `;
    }
    
    showNoResults() {
        this.galleryEl.innerHTML = `
            <div class="no-works">
                <p>Ничего не найдено</p>
                <p style="margin-top: 10px; font-size: 0.9em; color: #888;">
                    Попробуйте изменить фильтр или поисковый запрос
                </p>
            </div>
        `;
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioGallery();
});