export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const API_KEY = 'Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG';
        const blogs = ['pletnyov.tumblr.com', 'stepa2.tumblr.com'];
        const { before, limit = 20, id, blog } = req.query;

        // Single post by ID — search both blogs
        if (id) {
            for (const b of blogs) {
                const url = `https://api.tumblr.com/v2/blog/${b}/posts?id=${id}&api_key=${API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.response?.posts?.length > 0) {
                    return res.status(200).json(data);
                }
            }
            return res.status(404).json({ response: { posts: [] } });
        }

        // Fetch from both blogs in parallel
        const requests = blogs.map(b => {
            let url = `https://api.tumblr.com/v2/blog/${b}/posts?api_key=${API_KEY}&limit=${limit}`;
            if (before) url += `&before=${before}`;
            return fetch(url).then(r => r.json());
        });

        const results = await Promise.all(requests);

        // Merge posts from both blogs and sort by timestamp descending
        const merged = results
            .flatMap(data => data.response?.posts || [])
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);

        res.status(200).json({
            response: { posts: merged }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}