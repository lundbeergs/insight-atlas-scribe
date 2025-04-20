
import { FirecrawlCore } from './services/FirecrawlCore';
import { WebScraperService } from './services/WebScraperService';
import { SearchService } from './services/SearchService';
import { DataExtractionService } from './services/DataExtractionService';

export class FirecrawlService {
  static saveApiKey = FirecrawlCore.saveApiKey;
  static getApiKey = FirecrawlCore.getApiKey;
  static testApiKey = FirecrawlCore.testApiKey;
  static crawlWebsite = WebScraperService.crawlWebsite;
  static search = SearchService.search;
  static extractStructuredData = DataExtractionService.extractStructuredData;
}
