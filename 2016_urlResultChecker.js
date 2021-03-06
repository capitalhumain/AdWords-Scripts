/**
*   AdWords URL Check
*   Version: 1.1.0
*   @author: Alexander Groß
*   norisk GmbH
*   agross@noriskshop.de
*
************
*   READ ME!!!!
*   @changeLog:
*    v1.1.0: Exluded pages added as array, makes it easier to maintain a full list of those pages.
*            CORE ADJUSTMENT: The whole script needs to be replaced with the new version. Config data as well.
*            EXCLUDED_PAGES variable must be adjusted for each client individually!
************
*
*
* THIS SOFTWARE IS PROVIDED BY norisk GMBH ''AS IS'' AND ANY
* EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL norisk GMBH BE LIABLE FOR ANY
* DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
* (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
* LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
* ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
* (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
* SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
/***************** CONFIG_BLOCK START *****************/
var NOTIFY = ['email@noriskshop.de'];     // The List of Email-Adresses, the output mail gets sent to.
var ACCOUNT_NAME = 'Shop';                  // The Name of the Current Account used for file naming.            
var SEARCH_PAGE_TYPE = "searchparam";           // Specify the URL-Query which is used to identify the page type "search".
var LABEL_CONFIG = "URL_404_ERROR_PAUSED";     // Specify the Label you want to apply to automatically paused ads.
var NO_RESULT_ATTR = 'listartcount nrSearchRecommMessage ';// Specify the tag Class or id which identifies a "No-result"-search.
var TEILERGEBNIS = 'listartcount nrSearchRecommMessage  nrListSearch';
var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1S29gLvMkh_p8ODBSgjecmfaXmc-0yHEfQPBdmzC7dRg/edit#gid=0'; // Demo-Spreadsheet
var DATE_RANGE = 'LAST_30_DAYS';//TODAY, YESTERDAY, LAST_7_DAYS, THIS_WEEK_SUN_TODAY, LAST_WEEK, LAST_14_DAYS, LAST_30_DAYS, LAST_BUSINESS_WEEK, LAST_WEEK_SUN_SAT, THIS_MONTH, LAST_MONTH, ALL_TIME
var RESULT_COUNT_CLASS = 'listartcount';
var ARTICLE_DETAIL_PARAM = '.html';
var EXCLUDED_PAGES = ["URL1", "URL2"];
var CLICKS_THRESHOLD = '5';
var IMPRESSION_THRESHOLD = '0';
/***************** CONFIG_BLOCK END *****************/
function main(){
         
  var adsIter = AdWordsApp.ads().withCondition('Status = "ENABLED"').withCondition('CampaignStatus = "ENABLED"').withCondition('AdGroupStatus = "ENABLED"').forDateRange('ALL_TIME').withCondition('Clicks > "'+CLICKS_THRESHOLD+'"').withCondition('Impressions > "'+IMPRESSION_THRESHOLD+'"')/*.withIds([[2135597737, 48189598777],[2135597737,48189598897]])*/.get();
  /*To make execution faster: Filter here by clicks/impressions = 0, don't check these)*/
  Logger.log(adsIter.totalNumEntities());
  var summaryData = [];
  var ctr = 0;
  var checkedUrls = [];
    
  while(adsIter.hasNext()){
    try{
      var ad = adsIter.next();
      var url = ad.urls().getFinalUrl();
      if(url==null)
        continue;
      if(url.indexOf('adword')!=-1)
        url = url.split('adword')[0];
      url = encodeURI(url);
      if(hasBeenChecked(url,checkedUrls)){
        Logger.log("Skipping. URL has already been checked.");
        ctr++;
        continue;
      }
      if(EXCLUDED_PAGES.indexOf(url)!=-1){
        Logger.log("Skipping, due to homepage rule.");
        ctr++;
        continue;
      }
      Logger.log(url);
      var code = UrlFetchApp.fetch(url).getResponseCode();
      var clicks = ad.getStatsFor(DATE_RANGE).getClicks();
      var impressions = ad.getStatsFor(DATE_RANGE).getImpressions();
      var adId = ad.getId(); 
      var headline = ad.getHeadline();
      var search_hasResults;
      var artCount;
      var adGroupId = ad.getAdGroup().getId();
      
      if(isSearchPage(url)){
        search_hasResults = hasResults(url);
        if(search_hasResults) //These two parts of the code are unbelievably slow! If we don't neccesarily need to check them. we shouldn't!
          artCount = getResultCount(UrlFetchApp.fetch(url).getContentText());
        else
          artCount = 0;
      }
      else if(isCategoryPage(url)){
        search_hasResults = hasResults(url);
        if(search_hasResults) //These two parts of the code are unbelievably slow! If we don't neccesarily need to check them. we shouldn't!
          artCount = getResultCount(UrlFetchApp.fetch(url).getContentText());
        else
          artCount = 0;
      }
      else{
        Logger.log("Skipping, due to article detail page rule.");
        ctr++;
        continue;
      }
        
      var adData = {
        adId : adId,
        url : url,
        code : code,
        headline : headline,
        search_hasResults : search_hasResults,
        artCount : artCount,
        impressions : impressions,
        clicks : clicks,
        adGroupId : adGroupId
      }
        
      summaryData.push(adData);
      checkedUrls.push(url);
      ctr++;
      Logger.log(ctr);
    }
    catch(e){
      Logger.log("Invalid Operation.");
    }
  }
  sendOutputToSpreadsheet(summaryData);
  /*
  for(var i =0;i<summaryData.length;i++){
    updateAds(summaryData[i].adId,summaryData[i].code,summaryData[i].search_hasResults,summaryData[i].adGroupId); //store the bad ads into an array to pause them!!!
  }*/
}
//static void function that sends out an email after the spreadsheet was created
function sendNotificationEmail(){
    
  var htmlBody = '<html><body>Your AdWords URL Checker Summary for ' + ACCOUNT_NAME + ' is available at ' + SPREADSHEET_URL + '.</body></html>';
  var date = new Date();
  var subject = 'AdWords URL Checker Summary Results for ' + ACCOUNT_NAME + ' ' + date;
  var body = subject;
  var options = { htmlBody : htmlBody };
    
  for(var i in NOTIFY) {
    MailApp.sendEmail(NOTIFY[i], subject, body, options);
    Logger.log("An Email has been sent.");
  }
}
//@returns boolean isCategoryPage
//static function that checks, if the current page at the given url is a category page. Criteria need to be defined in config above.
function isCategoryPage(url){
  var isCategoryPage = false;
    
  if(url.indexOf(SEARCH_PAGE_TYPE)==-1&&url.indexOf(ARTICLE_DETAIL_PARAM)==-1){
    isCategoryPage = true;  
  }
      
  return isCategoryPage;
}
//@returns boolean isSearchPage
//static function that checks, if the current page at the given url is a search page. Criteria need to be defined in config above.
function isSearchPage(url){
    
  if(url!=undefined){
    var isSearchPage = false;
   
    if(url.indexOf(SEARCH_PAGE_TYPE)!=-1){
      isSearchPage = true;
      Logger.log("URL. %s is SearchPage: %s",url,isSearchPage);
    }
      
    return isSearchPage;
  }
}
//returns boolean hasResults
//static function that checks, if the search at the given url has results or not.
function hasResults(url){
    var content = UrlFetchApp.fetch(url).getContentText();
    var hasResults = true;    
    if(content.indexOf(NO_RESULT_ATTR)!=-1||content.indexOf(TEILERGEBNIS)!=-1){
      hasResults = false;
    }  
    return hasResults;
}
//@returns int artCount
//static function that gets the amount of results of a search or category page
function getResultCount(content){
    
  var index = content.indexOf(RESULT_COUNT_CLASS);
  var indexOfNumber= index + RESULT_COUNT_CLASS.length + 2;
  content = content.substring(indexOfNumber,indexOfNumber+5);
  var artCount = parseInt(content);
    
  return artCount;
}
  
//static boolean function that checks if the given url has already been checked.
//@returns boolean hasBeenChecked
function hasBeenChecked(url,checkedUrls){
   
  var hasBeenChecked = false;
  if(checkedUrls.indexOf(url)!=-1)
    return true;
    
  return hasBeenChecked
}
//static void function that fetches a Google Spreadsheet an pushes the results of the link check
function sendOutputToSpreadsheet(summaryData){
    
  var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = spreadsheet.getActiveSheet();
  sheet.clear();
  sheet.appendRow(['AD_ID','ADGOURP_ID','URL','CODE','HEADLINE','HAS_SEARCH_RESULTS','RESULT_COUNT','CLICKS','IMPRESSIONS'])
  for(var i=0;i<summaryData.length;i++){
    var row = summaryData[i];
    sheet.appendRow([row.adId,row.adGroupId,row.url,row.code,row.headline,row.search_hasResults,row.artCount,row.clicks,row.impressions]);    
  }
  Logger.log("Spreadsheet available at %s.", SPREADSHEET_URL)
  sendNotificationEmail();
}
