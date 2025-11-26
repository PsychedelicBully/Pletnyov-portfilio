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
            '/.netlify/functions/tumblr',
            '/api/tumblr',
            'https://api.tumblr.com/v2/blog/pletnyov.tumblr.com/posts/photo?api_key=Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG&limit=20'
        ];
        
        for (let endpoint of endpoints) {
            try {
                console.log('Trying endpoint:', endpoint);
                const response = await fetch(endpoint);
                
                if (response.ok) {
                    const data = await response.json();
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
        const processedPosts = [];
        
        if (!posts || !Array.isArray(posts)) {
            console.warn('No posts array in response');
            return this.generateDemoPosts();
        }
        
        posts.forEach((post, index) => {
            if (post.type === 'photo' && post.photos && post.photos.length > 0) {
                post.photos.forEach((photo, photoIndex) => {
                    if (photo.original_size && photo.original_size.url) {
                        processedPosts.push({
                            id: `${post.id}-${photoIndex}`,
                            title: post.summary || `Work ${processedPosts.length + 1}`,
                            image: photo.original_size.url,
                            tags: post.tags || ['art', 'design'],
                            description: this.extractDescription(post),
                            date: post.date,
                            url: post.post_url
                        });
                    }
                });
            }
        });
        
        console.log(`Processed ${processedPosts.length} items`);
        
        // Если нет постов, показываем демо-данные
        if (processedPosts.length === 0) {
            return this.generateDemoPosts();
        }
        
        return processedPosts;
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
        if (post.caption) {
            return this.extractTextContent(post.caption);
        }
        if (post.summary) {
            return post.summary;
        }
        return 'Portfolio work';
    }
    
    extractTextContent(html) {
        if (!html) return '';
        const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        return text.substring(0, 100) + (text.length > 100 ? '...' : '');
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
        
        item.innerHTML = `
            <img src="${post.image}" alt="${post.title}" loading="lazy">
            <div class="post-info">
                <div class="post-title">${post.title}</div>
                <div class="post-description">${post.description}</div>
                <div class="tags">
                    ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>
            </div>
        `;
        
        if (post.url && post.url !== '#') {
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