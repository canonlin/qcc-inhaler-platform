function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.sheetType === "satisfaction" ? "滿意度問卷" : "藥師收案";
    var tab = sheet.getSheetByName(sheetName) || sheet.insertSheet(sheetName);
    if (tab.getLastRow() === 0) tab.appendRow(Object.keys(data.values));
    tab.appendRow(Object.values(data.values));
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var VALID_PHARMACISTS = ["黃永成","林家薐","林亭君","黃詩婷","曾彥哲","劉士宏"];
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    var tab = sheet.getSheetByName("藥師收案");
    var satTab = sheet.getSheetByName("滿意度問卷");

    var empty = { status:"ok", totalCases:0, avgErrorRate:0, avgKnowledge:0, avgSatisfaction:0, criticalErrorRate:0, byPharmacist:[], byDevice:[], stepErrors:[], knowledgeErrors:[], dailyTrend:[] };

    // 病患個別查詢
    if (e.parameter.action === "getPatient") {
      var pid = e.parameter.id;
      if (!tab || tab.getLastRow() < 2) return ContentService.createTextOutput(JSON.stringify({status:"ok", patientId:pid, records:[]})).setMimeType(ContentService.MimeType.JSON);
      var data = tab.getDataRange().getValues(); var headers = data[0];
      var pidIdx = headers.indexOf("病歷號碼"); var tpIdx = headers.indexOf("追蹤時間點");
      var dateIdx = headers.indexOf("收案日期"); var phIdx = headers.indexOf("藥師");
      var corrIdx = headers.indexOf("操作正確數"); var totalIdx = headers.indexOf("操作總步驟");
      var knowIdx = headers.indexOf("知識總分"); var critIdx = headers.indexOf("重大錯誤數"); var drugIdx = headers.indexOf("藥品名稱");
      var records = data.slice(1).filter(function(r){ return String(r[pidIdx])===String(pid); }).map(function(r){
        var corr=parseFloat(r[corrIdx])||0, tot=parseFloat(r[totalIdx])||1;
        return {timePoint:r[tpIdx], date:String(r[dateIdx]).slice(0,10), pharmacist:r[phIdx], operationRate:corr/tot*100, knowledgeScore:parseFloat(r[knowIdx])||0, criticalErrors:parseFloat(r[critIdx])||0, drugName:r[drugIdx]};
      });
      return ContentService.createTextOutput(JSON.stringify({status:"ok", patientId:pid, records:records})).setMimeType(ContentService.MimeType.JSON);
    }

    // 病患清單查詢
    if (e.parameter.action === "getPatientList") {
      if (!tab || tab.getLastRow() < 2) return ContentService.createTextOutput(JSON.stringify({status:"ok", patients:[]})).setMimeType(ContentService.MimeType.JSON);
      var data = tab.getDataRange().getValues(); var headers = data[0];
      var pidIdx = headers.indexOf("病歷號碼"); var tpIdx = headers.indexOf("追蹤時間點");
      var dateIdx = headers.indexOf("收案日期"); var phIdx = headers.indexOf("藥師");
      var corrIdx = headers.indexOf("操作正確數"); var totalIdx = headers.indexOf("操作總步驟");
      var knowIdx = headers.indexOf("知識總分"); var critIdx = headers.indexOf("重大錯誤數"); var drugIdx = headers.indexOf("藥品名稱");
      var patientMap = {};
      data.slice(1).forEach(function(r) {
        var pid = String(r[pidIdx]); if(!pid || pid==="undefined" || pid==="") return;
        if(!patientMap[pid]) patientMap[pid] = {patientId:pid, records:[]};
        var corr=parseFloat(r[corrIdx])||0, tot=parseFloat(r[totalIdx])||1;
        patientMap[pid].records.push({timePoint:r[tpIdx], date:String(r[dateIdx]).slice(0,10), pharmacist:r[phIdx], operationRate:corr/tot*100, knowledgeScore:parseFloat(r[knowIdx])||0, criticalErrors:parseFloat(r[critIdx])||0, drugName:r[drugIdx]});
      });
      return ContentService.createTextOutput(JSON.stringify({status:"ok", patients:Object.values(patientMap)})).setMimeType(ContentService.MimeType.JSON);
    }

    if (!tab || tab.getLastRow() < 2) return ContentService.createTextOutput(JSON.stringify(empty)).setMimeType(ContentService.MimeType.JSON);

    var data = tab.getDataRange().getValues();
    var headers = data[0]; var rows = data.slice(1);
    var totalCases = rows.length;

    var getIdx = function(h) { return headers.indexOf(h); };
    var correctIdx=getIdx("操作正確數"), totalStepsIdx=getIdx("操作總步驟");
    var knowIdx=getIdx("知識總分"), pharmacistIdx=getIdx("藥師");
    var deviceIdx=getIdx("吸入劑型"), criticalIdx=getIdx("重大錯誤數");
    var dateIdx=getIdx("收案日期");

    var totalErrorSum=0, knowSum=0, criticalSum=0;
    var pharmacistMap={}, deviceMap={}, dailyMap={};
    var stepErrorMap={}, knowErrorMap={};
    var KQ=["使用前吐氣","MDI慢深吸","DPI快速吸","閉氣5-10秒","ICS後漱口","兩口藥操作","白煙代表吸到","計數器歸零","急救vs控制型","不喘可停藥"];

    rows.forEach(function(row) {
      var correct=parseFloat(row[correctIdx])||0;
      var total=parseFloat(row[totalStepsIdx])||1;
      totalErrorSum+=(1-correct/total);
      knowSum+=parseFloat(row[knowIdx])||0;
      criticalSum+=parseFloat(row[criticalIdx])||0;

      // 藥師統計（限定有效名單）
      var ph = String(row[pharmacistIdx]||"");
      if (VALID_PHARMACISTS.includes(ph)) {
        if(!pharmacistMap[ph]) pharmacistMap[ph]={count:0,errorSum:0};
        pharmacistMap[ph].count++;
        pharmacistMap[ph].errorSum+=(1-correct/total);
      }

      // 劑型統計
      var dv=String(row[deviceIdx]||"未知");
      if(dv && dv!=="未知") deviceMap[dv]=(deviceMap[dv]||0)+1;

      // 每日趨勢
      var rawDate = row[dateIdx];
      var dateStr = "";
      if(rawDate instanceof Date) dateStr = Utilities.formatDate(rawDate, "Asia/Taipei", "yyyy-MM-dd");
      else dateStr = String(rawDate).slice(0,10);
      if(dateStr && dateStr.length===10) dailyMap[dateStr]=(dailyMap[dateStr]||0)+1;

      // 步驟錯誤
      var devType=String(row[deviceIdx]||"");
      var steps = devType==="MDI"?["搖","開","吐","含","壓","吸","閉","漱"]:devType==="SMI"?["轉","開","吐","含","壓吸","吸","閉","吐"]:["開","吐","含","吸","閉","關","漱"];
      steps.forEach(function(s){
        var col=getIdx("步驟_"+s);
        if(col>=0 && row[col]==="錯誤") stepErrorMap[s]=(stepErrorMap[s]||0)+1;
      });

      // 知識題錯誤
      for(var qi=1;qi<=10;qi++){
        var qcol=getIdx("知識Q"+qi);
        if(qcol<0) continue;
        var ans=row[qcol];
        var correctAns=[true,true,false,true,true,false,false,true,true,false][qi-1];
        var isWrong=correctAns?(ans==="不對"):(ans==="對");
        if(isWrong) knowErrorMap[qi]=(knowErrorMap[qi]||0)+1;
      }
    });

    var satAvg=0;
    if(satTab && satTab.getLastRow()>=2){
      var satData=satTab.getDataRange().getValues();
      var satHeaders=satData[0]; var satRows=satData.slice(1);
      var avgIdx=satHeaders.indexOf("平均分數");
      if(avgIdx>=0){ var satSum=satRows.reduce(function(s,r){return s+(parseFloat(r[avgIdx])||0);},0); satAvg=satSum/satRows.length; }
    }

    var stepErrors=Object.entries(stepErrorMap).map(function(e){return{step:e[0],count:e[1]};}).sort(function(a,b){return b.count-a.count;});
    var knowledgeErrors=Object.entries(knowErrorMap).map(function(e){return{qNum:parseInt(e[0]),text:KQ[parseInt(e[0])-1],count:e[1],rate:e[1]/totalCases};}).sort(function(a,b){return b.rate-a.rate;});
    var byPharmacist=Object.entries(pharmacistMap).map(function(e){return{name:e[0],count:e[1].count,errorRate:e[1].errorSum/e[1].count};}).sort(function(a,b){return b.count-a.count;});
    var byDevice=Object.entries(deviceMap).map(function(e){return{type:e[0],count:e[1]};});
    var dailyTrend=Object.entries(dailyMap).map(function(e){return{date:e[0],count:e[1]};}).sort(function(a,b){return a.date>b.date?1:-1;});

    return ContentService.createTextOutput(JSON.stringify({
      status:"ok", totalCases:totalCases,
      avgErrorRate:totalErrorSum/totalCases, avgKnowledge:knowSum/totalCases,
      criticalErrorRate:criticalSum/totalCases/7, avgSatisfaction:satAvg,
      byPharmacist:byPharmacist, byDevice:byDevice,
      stepErrors:stepErrors, knowledgeErrors:knowledgeErrors, dailyTrend:dailyTrend
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:"error", message:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}