// netlify/functions/tumblr.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Настраиваем CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Обрабатываем preflight OPTIONS запрос
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const API_KEY = 'Tf9urGbt1xhKZRCN75vJd1Dhq8JcD3hRRSKHYQnpNv2Xz7r7CG';
        const blog = 'pletnyov.tumblr.com';
        
        const tumblrUrl = `https://api.tumblr.com/v2/blog/${blog}/posts/photo?api_key=${API_KEY}&limit=50`;

        console.log('Fetching from Tumblr:', tumblrUrl);

        const response = await fetch(tumblrUrl);
        
        if (!response.ok) {
            throw new Error(`Tumblr API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Proxy error:', error);
        
        return {
            statusCode: 500,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: error.message,
                details: 'Failed to fetch from Tumblr API'
            })
        };
    }
};