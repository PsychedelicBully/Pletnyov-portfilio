export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const API_KEY = 'Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG';
        const blog = 'pletnyov.tumblr.com';
        const { offset = 0, limit = 20 } = req.query;
        const tumblrUrl = `https://api.tumblr.com/v2/blog/${blog}/posts?api_key=${API_KEY}&limit=${limit}&offset=${offset}`;
        const response = await fetch(tumblrUrl);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

    // В серверной функции
    const { offset = 0, limit = 20, id } = req.query;
    let tumblrUrl;
    if (id) {
        tumblrUrl = `https://api.tumblr.com/v2/blog/${blog}/posts?id=${id}&api_key=${API_KEY}`;
    } else {
        tumblrUrl = `https://api.tumblr.com/v2/blog/${blog}/posts?api_key=${API_KEY}&limit=${limit}&offset=${offset}`;
    }
}