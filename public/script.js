// public/script.js - Версия с bitmap lazy loading (без поломок)

class PortfolioGallery {
    constructor() {
        this.galleryEl = document.getElementById('gallery');
        this.searchInput = document.getElementById('searchInput');

        this.allPosts = [];
        this.filteredPosts = [];
        this.currentFilter = 'all';
        this.searchTerm = '';

        this.urlFilter = this.getFilterFromUrl();

        this.setupLazyObserver();
        this.init();
    }

    /* ================= LAZY LOADING ================= */

    setupLazyObserver() {
        this.observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const container = entry.target;
                const media = container.querySelector('img, video');
                if (!media) return;

                if (media.dataset.src) {
                    media.src = media.dataset.src;
                }

                const loaded = () => {
                    container.classList.add('loaded');
                };

                if (media.tagName === 'IMG') {
                    media.onload = loaded;
                } else {
                    media.onloadeddata = loaded;
                    media.load();
                }

                obs.unobserve(container);
            });
        }, {
            rootMargin: '150px'
        });
    }

    observeMedia() {
        const items = this.galleryEl.querySelectorAll('.media-item');
        items.forEach(item => this.observer.observe(item));
    }

    /* ================= ОСНОВНОЙ КОД ================= */

    extractVideoFromContent(content) {
        if (!content || typeof content !== 'string') return null;

        const videoRegex = /<video[^>]*poster="([^"]*)"[^>]*>.*?<source[^>]*src="([^"]*)"[^>]*>/gis;
        const match = videoRegex.exec(content);
        if (match && match[2]) {
            return { videoUrl: match[2], poster: match[1] || '' };
        }

        return null;
    }

    getFilterFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('filter');
    }

    init() {
        this.setupEventListeners();
        this.loadPortfolio();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase().trim();
            this.filterPosts();
        });
    }

    async loadPortfolio() {
        this.showLoading();

        try {
            const posts = await this.fetchFromTumblrAPI();
            this.allPosts = posts;
            this.filteredPosts = posts;

            if (this.urlFilter) {
                this.currentFilter = this.urlFilter;
                this.filterPosts();
            } else {
                this.displayPosts();
            }
        } catch (error) {
            this.showDemoData();
        }
    }

    async fetchFromTumblrAPI() {
        try {
            const response = await fetch('/api/tumblr');
            const data = await response.json();
            return this.processTumblrPosts(data.response.posts);
        } catch {
            return this.generateDemoPosts();
        }
    }

    processTumblrPosts(posts) {
        if (!posts || !Array.isArray(posts)) {
            return this.generateDemoPosts();
        }

        return posts.map(post => ({
            id: post.id_string || post.id,
            image: post.photos?.[0]?.original_size?.url || post.thumbnail_url || '',
            videoUrl: post.video_url || null,
            mediaType: post.type === 'video' ? 'video' : 'image',
            tags: post.tags || [],
            description: this.extractDescription(post)
        }));
    }

    generateDemoPosts() {
        return [
            {
                id: 'demo-1',
                image: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800',
                mediaType: 'image',
                tags: ['design']
            }
        ];
    }

    extractDescription(post) {
        if (!post.caption && !post.body) return '';
        const text = (post.caption || post.body).replace(/<[^>]*>/g, ' ').trim();
        return text.length > 200 ? text.substring(0, 200) + '…' : text;
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
                )
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

        this.observeMedia(); // 🔥 подключаем lazy loading
    }

    createGalleryItem(post) {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const mediaWrapper = document.createElement('div');
        mediaWrapper.className = 'media-item';

        if (post.mediaType === 'video' && post.videoUrl) {
            const video = document.createElement('video');
            video.dataset.src = post.videoUrl;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            mediaWrapper.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.dataset.src = post.image;
            img.alt = 'Post image';
            mediaWrapper.appendChild(img);
        }

        item.appendChild(mediaWrapper);

        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            window.location.href = `/post/${post.id}`;
        });

        return item;
    }

    showLoading() {
        this.galleryEl.innerHTML = `<div class="loading"><p>Загрузка...</p></div>`;
    }

    showDemoData() {
        this.allPosts = this.generateDemoPosts();
        this.filteredPosts = this.allPosts;
        this.displayPosts();
    }

    showNoResults() {
        this.galleryEl.innerHTML = `<div class="no-works"><p>Ничего не найдено</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PortfolioGallery();
});