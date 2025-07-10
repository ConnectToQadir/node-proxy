const express = require('express');
const axios = require('axios');
const https = require('https');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Proxy endpoint that forwards requests to any HTTPS endpoint
app.post('/proxy', async (req, res) => {
    try {
        const url = req.body?.url;
        const body = req.body?.body;
        const headers = req.body?.headers || {};
        const query = req.body?.query || {};
        const params = req.body?.params || {};
        const timeout = req.body?.timeout || 300000; // Increased to 5 minutes
        const method = req.body?.method || 'POST';

        // Validate required fields
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        // Validate URL format
        try {
            new URL(url);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }

        // Default headers to mimic a real browser and bypass bot detection
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        };

        // Prepare request configuration
        const config = {
            method: method.toUpperCase(),
            url: url,
            timeout: timeout,
            headers: {
                ...defaultHeaders,
                ...headers
            },
            // SSL/TLS configuration to handle certificate issues
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                secureProtocol: 'TLSv1_2_method',
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 10,
                maxFreeSockets: 5
            }),
            // Additional axios configuration for better connection handling
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 600; // Accept all status codes to handle errors properly
            }
        };

        // Add query parameters if provided
        if (query && typeof query === 'object') {
            config.params = query;
        }

        // Add URL parameters if provided (for REST-style URLs)
        if (params && typeof params === 'object') {
            let finalUrl = url;
            Object.keys(params).forEach(key => {
                finalUrl = finalUrl.replace(`:${key}`, params[key]);
            });
            config.url = finalUrl;
        }

        // Add request body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(config.method) && body) {
            config.data = body;
        }


        // Make the request
        const response = await axios(config);

        // Return the response
        res.status(response.status).json({
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        });

    } catch (error) {
        console.error('Proxy request failed:', error.message);
        
        // Handle different types of errors
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            res.status(error.response.status).json({
                success: false,
                error: error.message,
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: error.response.data
            });
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            // Timeout error
            res.status(408).json({
                success: false,
                error: 'Request timeout',
                details: 'The request took too long to complete. Try increasing the timeout value.',
                timeout: timeout
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(500).json({
                success: false,
                error: 'No response received from target server',
                details: error.message
            });
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).json({
                success: false,
                error: 'Request setup failed',
                details: error.message
            });
        }
    }
});

app.get('/', (req, res) => {
    res.send(`Proxy Utility is Running...`);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
    console.log('Available endpoints:');
    console.log('- POST /proxy - Proxy any HTTP request with full options');
});