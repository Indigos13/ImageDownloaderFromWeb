import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API endpoint to scrape images from a URL
app.post('/api/scrape-images', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Fetch the webpage
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const images = [];
    const baseUrl = new URL(url);

    // Extract all images
    $('img').each((index, element) => {
      let src = $(element).attr('src');
      let dataSrc = $(element).attr('data-src');
      let dataOriginal = $(element).attr('data-original');
      let dataLazySrc = $(element).attr('data-lazy-src');
      
      // Try different image sources (lazy loading support)
      const imageUrl = dataLazySrc || dataOriginal || dataSrc || src;
      
      if (imageUrl) {
        // Convert relative URLs to absolute
        let absoluteUrl;
        try {
          absoluteUrl = new URL(imageUrl, baseUrl).href;
        } catch {
          absoluteUrl = imageUrl;
        }

        // Get image dimensions if available
        const width = $(element).attr('width') || $(element).attr('data-width') || null;
        const height = $(element).attr('height') || $(element).attr('data-height') || null;
        
        // Get alt text
        const alt = $(element).attr('alt') || '';
        
        // Skip very small images (likely icons or tracking pixels)
        const isLikelyIcon = (width && parseInt(width) < 50) || (height && parseInt(height) < 50);
        
        if (!isLikelyIcon || images.length < 5) {
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            index: images.length + 1
          });
        }
      }
    });

    // Also check for background images in style attributes
    $('[style]').each((index, element) => {
      const style = $(element).attr('style') || '';
      const match = style.match(/background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/i);
      if (match && match[1]) {
        let absoluteUrl;
        try {
          absoluteUrl = new URL(match[1], baseUrl).href;
        } catch {
          absoluteUrl = match[1];
        }
        
        images.push({
          url: absoluteUrl,
          alt: 'Background Image',
          width: null,
          height: null,
          index: images.length + 1
        });
      }
    });

    // Remove duplicates
    const uniqueImages = images.filter((img, index, self) =>
      index === self.findIndex((t) => t.url === img.url)
    );

    res.json({
      success: true,
      url: url,
      totalImages: uniqueImages.length,
      images: uniqueImages
    });

  } catch (error) {
    console.error('Error scraping images:', error.message);
    res.status(500).json({
      error: 'Failed to scrape images',
      message: error.message
    });
  }
});

// Proxy endpoint for downloading images (handles CORS)
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': new URL(url).origin
      },
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024 // 50MB max
    });

    // Set appropriate content type
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error.message);
    res.status(500).json({
      error: 'Failed to proxy image',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve Vite frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all route to serve index.html for Single Page Apps
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
