import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Download, 
  Image as ImageIcon, 
  Globe, 
  CheckCircle2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface ImageData {
  url: string;
  alt: string;
  width: string | null;
  height: string | null;
  index: number;
}

interface ScrapeResult {
  success: boolean;
  url: string;
  totalImages: number;
  images: ImageData[];
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Set<number>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<number>>(new Set());

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setDownloaded(new Set());

    try {
      const response = await fetch('/api/scrape-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to scrape images');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while scraping images');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    setDownloading(prev => new Set(prev).add(index));
    
    try {
      // Fetch image as blob
      const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`, {
        method: 'GET',
      }).catch(async () => {
        // Fallback: try direct fetch with no-cors
        return await fetch(imageUrl, { mode: 'no-cors' });
      });

      let blob;
      if (response.ok) {
        blob = await response.blob();
      } else {
        // If proxy fails, create a direct link
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
        });
      }

      // Create download link
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Extract filename from URL
      const urlParts = imageUrl.split('/');
      let filename = urlParts[urlParts.length - 1] || `image-${index}.jpg`;
      if (!filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        filename += '.jpg';
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setDownloaded(prev => new Set(prev).add(index));
    } catch (err) {
      // Fallback: open image in new tab
      window.open(imageUrl, '_blank');
    } finally {
      setDownloading(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const handleDownloadAll = async () => {
    if (!result?.images) return;
    
    for (const image of result.images) {
      if (!downloaded.has(image.index)) {
        await handleDownload(image.url, image.index);
        // Small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScrape();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <ImageIcon className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Image Downloader</h1>
              <p className="text-slate-400 text-sm">Extract and download images from any website</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Input Section */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Enter website URL (e.g., example.com)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-12 h-14 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 text-lg"
                />
              </div>
              <Button
                onClick={handleScrape}
                disabled={loading}
                className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Extract Images
                  </>
                )}
              </Button>
            </div>

            {error && (
              <Alert className="mt-4 bg-red-500/10 border-red-500/30">
                <AlertDescription className="text-red-300">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 px-4 py-2">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  {result.totalImages} Images Found
                </Badge>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-blue-400 flex items-center gap-1 text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {result.url}
                </a>
              </div>
              {result.totalImages > 0 && (
                <Button
                  onClick={handleDownloadAll}
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              )}
            </div>

            {/* Images Grid */}
            {result.images.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {result.images.map((image) => (
                  <Card
                    key={image.index}
                    className="group bg-slate-800/50 border-slate-700/50 overflow-hidden hover:border-blue-500/50 transition-all duration-300"
                  >
                    <div className="relative aspect-square bg-slate-900/50 overflow-hidden">
                      <img
                        src={image.url}
                        alt={image.alt || `Image ${image.index}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23334155"/%3E%3Ctext x="50" y="50" font-size="12" fill="%2394a3b8" text-anchor="middle" dy=".3em"%3EImage Error%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Download Button Overlay */}
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button
                          size="sm"
                          onClick={() => handleDownload(image.url, image.index)}
                          disabled={downloading.has(image.index)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {downloading.has(image.index) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : downloaded.has(image.index) ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300 truncate">
                            {image.alt || `Image ${image.index}`}
                          </p>
                          {(image.width || image.height) && (
                            <p className="text-xs text-slate-500 mt-1">
                              {image.width && `${image.width}px`}
                              {image.width && image.height && ' × '}
                              {image.height && `${image.height}px`}
                            </p>
                          )}
                        </div>
                        {downloaded.has(image.index) && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 ml-2 flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertDescription className="text-yellow-300">
                  No images found on this website. Try a different URL.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Instructions */}
        {!result && !loading && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-800/30 border-slate-700/30">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">1. Enter URL</h3>
                <p className="text-slate-400 text-sm">
                  Paste the website URL you want to extract images from
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/30 border-slate-700/30">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">2. Extract Images</h3>
                <p className="text-slate-400 text-sm">
                  Our tool will scan and find all images on the webpage
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/30 border-slate-700/30">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">3. Download</h3>
                <p className="text-slate-400 text-sm">
                  Preview and download any images you want to save
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-500 text-sm">
            Image Downloader Tool - Extract images from any website
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
