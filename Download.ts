import { CheerioAPI, load } from "cheerio";
import type { SnapSaveDownloaderData, SnapSaveDownloaderMedia, SnapSaveDownloaderResponse } from "./types";
import { facebookRegex, fixThumbnail, instagramRegex, normalizeURL, tiktokRegex } from "./utils";

/**
 * URL Validator class - responsible for validating URLs against supported platforms
 */
class UrlValidator {
  private readonly supportedRegexes: RegExp[];

  constructor(regexes: RegExp[] = [facebookRegex, instagramRegex, tiktokRegex]) {
    this.supportedRegexes = regexes;
  }

  /**
   * Validates if the URL is from a supported platform
   * @param url URL to validate
   * @returns Boolean indicating if the URL is supported
   */
  public isValid(url: string): boolean {
    return this.supportedRegexes.some(regex => url.match(regex));
  }
}

/**
 * SnapSave Decoder class - responsible for all decoding and decryption logic
 */
class SnapSaveDecoder {
  /**
   * Decodes SnapApp encoded content
   * @param args Array of arguments from the encoded content
   * @returns Decoded content
   */
  private decodeSnapApp(args: string[]): string {
    let [encodedContent, u, charMap, subtractValue, base, decodedResult] = args;
    
    /**
     * Internal decoder function for number conversion
     */
    const decodeNumber = (value: number, fromBase: number, toBase: number): string => {
      const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".split("");
      const fromCharset = charset.slice(0, fromBase);
      const toCharset = charset.slice(0, toBase);
      
      // @ts-expect-error - Known limitation in type inference for this algorithm
      let decimal = value.split("").reverse().reduce((sum: number, char: string, index: number) => {
        if (fromCharset.indexOf(char) !== -1)
          return sum += fromCharset.indexOf(char) * (Math.pow(fromBase, index));
        return sum;
      }, 0);
      
      let result = "";
      while (decimal > 0) {
        result = toCharset[decimal % toBase] + result;
        decimal = (decimal - (decimal % toBase)) / toBase;
      }
      return result || "0";
    };

    decodedResult = "";
    for (let i = 0, len = encodedContent.length; i < len; i++) {
      let segment = "";
      while (encodedContent[i] !== charMap[Number(base)]) {
        segment += encodedContent[i];
        i++;
      }
      
      for (let j = 0; j < charMap.length; j++) {
        segment = segment.replace(new RegExp(charMap[j], "g"), j.toString());
      }
      
      // @ts-expect-error - Known limitation in type inference for this algorithm
      decodedResult += String.fromCharCode(decodeNumber(segment, base, 10) - subtractValue);
    }

    return this.fixEncoding(decodedResult);
  }

  /**
   * Fixes UTF-8 encoding issues in the decoded content
   */
  private fixEncoding(str: string): string {
    const bytes = new Uint8Array(str.split("").map(char => char.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  }

  /**
   * Extracts the encoded arguments from SnapSave HTML response
   */
  private getEncodedSnapApp(data: string): string[] {
    return data.split("decodeURIComponent(escape(r))}(")[1]
      .split("))")[0]
      .split(",")
      .map(v => v.replace(/"/g, "").trim());
  }

  /**
   * Extracts the decoded HTML content from SnapSave response
   */
  private getDecodedSnapSave(data: string): string {
    return data.split("getElementById(\"download-section\").innerHTML = \"")[1]
      .split("\"; document.getElementById(\"inputData\").remove(); ")[0]
      .replace(/\\(\\)?/g, "");
  }

  /**
   * Decrypts the SnapSave response by chaining the decoding functions
   * @param data Raw HTML response from SnapSave
   * @returns Decrypted HTML content
   */
  public decrypt(data: string): string {
    return this.getDecodedSnapSave(this.decodeSnapApp(this.getEncodedSnapApp(data)));
  }
}

/**
 * Media Extractor class - responsible for extracting media from different HTML layouts
 */
class MediaExtractor {
  /**
   * Extract metadata from HTML content
   * @param $ Cheerio API instance
   * @returns Extracted metadata
   */
  public extractMetadata($: CheerioAPI): Partial<SnapSaveDownloaderData> {
    const data: SnapSaveDownloaderData = {};
    
    const description = $("span.video-des").text().trim();
    const preview = $("article.media > figure").find("img").attr("src");
    
    if (description) data.description = description;
    if (preview) data.preview = preview;
    
    return data;
  }

  /**
   * Extract media items from table layout
   * @param $ Cheerio API instance
   * @returns Array of extracted media
   */
  public extractTableMedia($: CheerioAPI): SnapSaveDownloaderMedia[] {
    const media: SnapSaveDownloaderMedia[] = [];
    
    $("tbody > tr").each((_, el) => {
      const $el = $(el);
      const $td = $el.find("td");
      const resolution = $td.eq(0).text();
      let mediaUrl = $td.eq(2).find("a").attr("href") || $td.eq(2).find("button").attr("onclick");
      const shouldRender = /get_progressApi/ig.test(mediaUrl || "");
      
      if (shouldRender) {
        mediaUrl = "https://snapsave.app" + /get_progressApi\('(.*?)'\)/.exec(mediaUrl || "")?.[1] || mediaUrl;
      }
      
      media.push({
        resolution,
        ...(shouldRender ? { shouldRender } : {}),
        url: mediaUrl,
        type: resolution ? "video" : "image"
      });
    });
    
    return media;
  }

  /**
   * Extract media items from card layout
   * @param $ Cheerio API instance
   * @returns Array of extracted media
   */
  public extractCardMedia($: CheerioAPI): SnapSaveDownloaderMedia[] {
    const media: SnapSaveDownloaderMedia[] = [];
    
    $("div.card").each((_, el) => {
      const cardBody = $(el).find("div.card-body");
      const aText = cardBody.find("a").text().trim();
      const url = cardBody.find("a").attr("href");
      const type = aText === "Download Photo" ? "image" : "video";
      
      media.push({
        url,
        type
      });
    });
    
    return media;
  }

  /**
   * Extract media from simple layout
   * @param $ Cheerio API instance
   * @returns Array of extracted media
   */
  public extractSimpleMedia($: CheerioAPI): SnapSaveDownloaderMedia[] {
    const media: SnapSaveDownloaderMedia[] = [];
    
    const url = $("a").attr("href") || $("button").attr("onclick");
    const aText = $("a").text().trim();
    const type = aText === "Download Photo" ? "image" : "video";
    
    media.push({
      url,
      type
    });
    
    return media;
  }

  /**
   * Extract media from download items layout
   * @param $ Cheerio API instance
   * @returns Array of extracted media
   */
  public extractDownloadItemsMedia($: CheerioAPI): SnapSaveDownloaderMedia[] {
    const media: SnapSaveDownloaderMedia[] = [];
    
    $("div.download-items").each((_, el) => {
      const itemThumbnail = $(el).find("div.download-items__thumb > img").attr("src");
      const itemBtn = $(el).find("div.download-items__btn");
      const url = itemBtn.find("a").attr("href");
      const spanText = itemBtn.find("span").text().trim();
      const type = spanText === "Download Photo" ? "image" : "video";
      
      media.push({
        url,
        ...(type === "video" && itemThumbnail ? {
          thumbnail: fixThumbnail(itemThumbnail)
        } : {}),
        type
      });
    });
    
    return media;
  }
}

/**
 * SnapSave API Client - responsible for making API requests
 */
class SnapSaveApiClient {
  private readonly apiUrl: string;
  
  constructor(apiUrl: string = "https://snapsave.app/action.php?lang=en") {
    this.apiUrl = apiUrl;
  }
  
  /**
   * Make a request to the SnapSave API
   * @param url URL to download from
   * @returns Raw HTML response
   */
  public async fetchMedia(url: string): Promise<string> {
    // Prepare request to SnapSave API
    const formData = new URLSearchParams();
    formData.append("url", normalizeURL(url));

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/x-www-form-urlencoded",
        "origin": "https://snapsave.app",
        "referer": "https://snapsave.app/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0"
      },
      body: formData
    });

    // Return raw response
    return response.text();
  }
}

/**
 * SnapSaver service - orchestrates the workflow but delegates specific tasks
 */
export class SnapSaverService {
  private readonly urlValidator: UrlValidator;
  private readonly decoder: SnapSaveDecoder;
  private readonly extractor: MediaExtractor;
  private readonly apiClient: SnapSaveApiClient;
  
  constructor() {
    this.urlValidator = new UrlValidator();
    this.decoder = new SnapSaveDecoder();
    this.extractor = new MediaExtractor();
    this.apiClient = new SnapSaveApiClient();
  }

  /**
   * Main method to download media from social platforms via SnapSave
   * @param url URL of the social media post to download
   * @returns Response containing success status and download data
   */
  public async download(url: string): Promise<SnapSaveDownloaderResponse> {
    try {
      // Validate URL against supported platforms
      if (!this.urlValidator.isValid(url)) {
        return { 
          success: false, 
          message: "Invalid URL" 
        };
      }

      // Fetch media from SnapSave API
      const html = await this.apiClient.fetchMedia(url);
      
      // Decrypt the response
      const decodedHtml = this.decoder.decrypt(html);
      
      // Parse HTML and extract media
      const $ = load(decodedHtml);
      
      // Initialize data structure
      const data: SnapSaveDownloaderData = {};
      let media: SnapSaveDownloaderMedia[] = [];

      // Extract data based on the HTML structure
      if ($("table.table").length || $("article.media > figure").length) {
        // Extract metadata
        Object.assign(data, this.extractor.extractMetadata($));
        
        // Extract media based on layout
        if ($("table.table").length) {
          media = this.extractor.extractTableMedia($);
        }
        else if ($("div.card").length) {
          media = this.extractor.extractCardMedia($);
        }
        else {
          media = this.extractor.extractSimpleMedia($);
        }
      }
      // Extract media from download items layout
      else if ($("div.download-items").length) {
        media = this.extractor.extractDownloadItemsMedia($);
      }

      // Validate results
      if (!media.length) {
        return { 
          success: false, 
          message: "No downloadable media found" 
        };
      }

      // Add media to data and return
      data.media = media;
      return { 
        success: true, 
        data 
      };
    }
    catch (error) {
      console.error("SnapSaver error:", error);
      return { 
        success: false, 
        message: "Failed to process download request" 
      };
    }
  }
}

