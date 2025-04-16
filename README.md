# SnapSaver Downloader

[![npm version](https://img.shields.io/npm/v/snapsaver-downloader.svg)](https://www.npmjs.com/package/snapsaver-downloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An unofficial Node.js package to download media from Facebook, Instagram, and TikTok using SnapSave API.

## Features

- 📥 Download videos and images from:
  - Facebook posts, reels, and watch videos
  - Instagram posts and reels
  - TikTok videos
- 📱 Support for multiple quality options (when available)
- 🌐 URL normalization and validation
- 🔄 Automatic platform detection

## Installation

```bash
npm install snapsaver-downloader
```

Or with yarn:

```bash
yarn add snapsaver-downloader
```

## Usage

```typescript
import { SnapSaver } from 'snapsaver-downloader';

// Example: Download from Facebook
async function downloadMedia() {
  try {
    const result = await SnapSaver('https://www.facebook.com/watch/?v=1377532133417378');
    
    if (result.success) {
      console.log('Media found:', result.data);
      // Access download URLs:
      const mediaUrls = result.data?.media?.map(item => item.url);
      console.log('Download URLs:', mediaUrls);
    } else {
      console.error('Error:', result.message);
    }
  } catch (error) {
    console.error('Failed to download:', error);
  }
}

downloadMedia();
```

### Supported URLs

The package supports various URL formats:

#### Facebook
- `https://www.facebook.com/watch/?v=1234567890`
- `https://www.facebook.com/share/v/123ABC456/`
- `https://www.facebook.com/username/videos/1234567890`
- `https://fb.watch/abcdef123/`

#### Instagram
- `https://www.instagram.com/p/ABC123def/`
- `https://www.instagram.com/reel/ABC123def/`
- URLs with query parameters (e.g., `?utm_source=ig_web_copy_link`)

#### TikTok
- `https://www.tiktok.com/@username/video/1234567890`
- `https://vt.tiktok.com/ABCDEF/`

## API Reference

### SnapSaver(url: string): Promise<SnapSaveDownloaderResponse>

The main function to download media from supported social platforms.

#### Parameters

- `url` (string): URL of the social media post to download

#### Returns

Returns a Promise that resolves to a `SnapSaveDownloaderResponse` object:

```typescript
interface SnapSaveDownloaderResponse {
  success: boolean;
  message?: string;
  data?: SnapSaveDownloaderData;
}

interface SnapSaveDownloaderData {
  description?: string;
  preview?: string;
  media?: SnapSaveDownloaderMedia[];
}

interface SnapSaveDownloaderMedia {
  resolution?: string;
  shouldRender?: boolean;
  thumbnail?: string;
  type?: "image" | "video";
  url?: string;
}
```

#### Response Structure

- `success` - Boolean indicating if the download was successful
- `message` - Error message (only present when `success` is false)
- `data` - Result data (only present when `success` is true)
  - `description` - Description of the post (when available)
  - `preview` - Preview image URL (when available)
  - `media` - Array of media objects containing:
    - `type` - Media type ("video" or "image")
    - `url` - Direct download URL
    - `resolution` - Resolution (for videos, when available)
    - `thumbnail` - Thumbnail URL (for videos, when available)
    - `shouldRender` - Whether the media needs special rendering

## Utilities

The package exports several utility functions that might be useful:

```typescript
import { 
  normalizeURL, 
  detectPlatformFromURL,
  fixThumbnail
} from 'snapsaver-downloader/dist/utils';

// Normalize a URL (add www if missing)
const normalizedUrl = normalizeURL('https://facebook.com/video/123');
// Result: 'https://www.facebook.com/video/123'

// Detect platform from URL
const platform = detectPlatformFromURL('https://www.instagram.com/reel/ABC123/');
// Result: 'Instagram'
```

## Limitations

- This package relies on the SnapSave.app service, which may change its API without notice
- Some platforms may block scraping attempts or change their URL structure
- For high-volume applications, consider implementing rate limiting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This package is not affiliated with, endorsed by, or connected to SnapSave.app or any of the social media platforms it supports. It is provided for educational purposes only. Always respect the terms of service of the platforms you are downloading content from, and ensure you have the right to download and use the content.