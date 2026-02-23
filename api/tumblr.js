export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const API_KEY = 'Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG';
        const blog = 'pletnyov.tumblr.com';
        const tumblrUrl = `https://api.tumblr.com/v2/blog/${blog}/posts?api_key=${API_KEY}&limit=50`;
        const response = await fetch(tumblrUrl);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}