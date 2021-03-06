function VidyoLog(containerId) {
	var logLines = [];
	var xmlTrace = {};
	var logRecordsFilter = "";
	var logServersRecordsIndex = []; /* store index per server */
	var logServers = []; /* store servers */
	var serverId = 1;
	var searchString = "";
	var logTable;
	var vidyoStats;
	var stopPoll = false;
	
	this.AddServer = function(serverName, serverHOST) {
		if (serverHOST && !serverHOST.startsWith("http"))
			serverURL = "http://" + serverHOST;
		else
			serverURL = serverHOST;
		var server = { name: serverName, url: serverURL, id: serverId, colorId: serverId%10, index: 0, outstandingRequest: false };
		serverId++;
		
		logServers[server.id] = server;
		return server;
	}
	this.RemoveServer = function(serverHOST) {
		if (serverHOST && !serverHOST.startsWith("http"))
			serverURL = "http://" + serverHOST;
		else
			serverURL = serverHOST;
		logServers.forEach(function(logServer) {
			if (logServer.url == serverURL)
				delete logServers[logServer.id];
		});
	}
	this.StartPoll = function() {
		stopPoll = false;
	}
	this.StopPoll = function() {
		stopPoll = true;
	}
	this.Search = function(string) {
		searchString = string;
		if (searchString == "") {
			$(".logLine").show();
		} else {
			for (i = 0; i < logLines.length; i++) {
				var logLine = logLines[i];
				if (SearchFilter(logLine, searchString) == true) {
					$( "#" + logLine.id).hide();
				}
			}
		}
	}
	this.SetServerSideFilter = function(filter) {
		logRecordsFilter = filter;
	}
	this.AddLogRecords = function(logRecords, server) {
		for (recordId in logRecords) {
			record = logRecords[recordId];
			var logLine = new Object();
			logLine.index = record.index;
			logLine.serverName = server.name;
			logLine.serverId = "serverID-" + server.id;
			logLine.colorId = "colorID-" + server.colorId;
			logLine.id = logLine.serverId + "-" + record.index;
			logLine.time =  new Date(record.eventTime/1000000);
			logLine.level = record.level;
			logLine.category = record.categoryName;
			logLine.threadName = record.threadName;
			logLine.threadId = record.threadId;
			logLine.functionLine = record.file+record.file+ ':' + record.line;
			logLine.functionLineShort = logLine.functionLine.split("/").pop().replace(":", "-").replace(".", "_");
			
			logLine.functionName = record.functionName;
			logLine.body = record.message;
			
			logLine.levelEncoded = EncodeStringForAttr(logLine.level);
			logLine.categoryEncoded = EncodeStringForAttr(logLine.category);
			logLine.functionLineShortEncoded = EncodeStringForAttr(logLine.functionLineShort);
			logLine.functionNameEncoded = EncodeStringForAttr(logLine.functionName);
			/* order lines */
			OrderAndRender(logLine);
		}
		return;
	}
	function ParseDesktopLog(logLineUnparsed, id) {
		/* for the first 4 variables the delimiter is a space (multi) */
		var logLineTags = logLineUnparsed.split(/ +/, 5);
		if (!logLineTags || logLineTags.length != 5)
			return null;
		
		var indexOfBodyBegin = logLineUnparsed.indexOf(logLineTags[4]);
		/* the end of body is hard to find. the best delimiter seems to be " [ " */
		var indexOfBodyEnd = logLineUnparsed.indexOf(" [ ");
		var logLine = new Object();
		
		/* separate the rest of meta data after body and remove last "]"*/
		var restOfMetaData = logLineUnparsed.slice(indexOfBodyEnd + 3, logLineUnparsed.length -1 );
		var logLineRestTags = restOfMetaData.split(", ", 3);
		
		/* log does not contain year, assume current */
		var currentYear = new Date().getFullYear();
		var timeMonthDay = logLineTags[0].split(/[\/ -.:]/, 6);
		var timeHourMinSec = logLineTags[1].split(/[\/ -.:]/, 6);
		logLine.id = "logLine" + id;
		logLine.time =  new Date(currentYear, timeMonthDay[0] - 1, timeMonthDay[1], timeHourMinSec[0], timeHourMinSec[1], timeHourMinSec[2], timeHourMinSec[3]);
		
		/* check for valid header */
		if(logLine.time.getDate()) {			
			logLine.level = logLineTags[2];
			logLine.category = logLineTags[3];
			logLine.threadName = logLineRestTags[0];
			logLine.functionLine = logLineRestTags[2];
			logLine.functionLineShort = logLine.functionLine.split("/").pop().replace(":", "-").replace(".", "_");
			logLine.functionName = logLineRestTags[1];
			logLine.body = logLineUnparsed.slice(indexOfBodyBegin, indexOfBodyEnd);
			logLine.index = id;
		} else {		
			return null;
		}
		return logLine;
	}
	function ParseSDKLog(logLineUnparsed, id) {
		var logLineTags = logLineUnparsed.split(": ", 6);
		if (!logLineTags || logLineTags.length != 6)
			return null;
		var indexOfLastMarker = logLineUnparsed.indexOf(logLineTags[5]) + logLineTags[5].length + 2;
		var logLine = new Object();
		
		var timeParts = logLineTags[0].split(/[\/ -.:]/, 7);
		logLine.id = "logLine" + id;
		logLine.time =  new Date(timeParts[0], timeParts[1] - 1, timeParts[2], timeParts[3], timeParts[4], timeParts[5], timeParts[6]);
		
		/* check for valid header */
		if(logLine.time.getFullYear()) {			
			logLine.level = logLineTags[1];
			logLine.category = logLineTags[2];
			logLine.threadName = logLineTags[3];
			logLine.functionLine = logLineTags[4];
			logLine.functionLineShort = logLine.functionLine.split("/").pop().replace(":", "-").replace(".", "_");
			logLine.functionName = logLineTags[5];
			logLine.body = logLineUnparsed.slice(indexOfLastMarker);	
			logLine.index = id;
		} else {		
			return null;
		}
		return logLine;
	}
	function ParseErrorLog(id) {
		var logLine = new Object();
		logLine.time = new Date();
		logLine.level = "LOG_ERROR";
		logLine.category = "LogParser";
		logLine.threadName = "N/A";
		logLine.functionLine = "log-" + id;
		logLine.functionLineShort = "N/A";
		logLine.functionName = "N/A";
		logLine.body = "Error parsing log line " + id;
		logLine.index = id;
		return logLine;
	}
	this.ProcessLogFile = function (logFile) {
		var lineNumber = 1;
        	logFileSplit = logFile.split('\n');
        	var i=0;
        	var lineProcess=function () {
          		var logLineUnparsed = logFileSplit[i];
          		var logLine = null;

			if (!logLineUnparsed || logLineUnparsed.length == 0) {
                	return;
			} else {
                		/* if the next line does not begin with a number, concatenate both lines! */
                		var logLineFullUnparsed = logFileSplit[i];
                		while (logFileSplit[i + 1] && (logFileSplit[i + 1][0] < '0' || logFileSplit[i + 1][0] > '9')) {
                  			logLineFullUnparsed = logLineFullUnparsed.concat(logFileSplit[i + 1]);
                    			i = i + 1;
                		}
                		if (logLineUnparsed[2] == '-') {
                    			logLine = ParseDesktopLog(logLineFullUnparsed, lineNumber);
                		} else {
                    			logLine = ParseSDKLog(logLineFullUnparsed, lineNumber);
                		}
            		}
             		if (!logLine) {
                		logLine = ParseErrorLog(i);
            		}
            		logLine.levelEncoded = EncodeStringForAttr(logLine.level);
            		logLine.categoryEncoded = EncodeStringForAttr(logLine.category);
            		logLine.functionLineShortEncoded = EncodeStringForAttr(logLine.functionLineShort);
            		logLine.functionNameEncoded = EncodeStringForAttr(logLine.functionName);
            		lineNumber++;

            		/* order lines */
            		OrderAndRender(logLine);
			
            		$("#processing").html("loading: "+Math.round(i/logFileSplit.length*10000)/100+" %");
            		i++;
            		if(i==logFileSplit.length-1) {
                	clearInterval(x);
                	$("#processing").html("Complete!!!");
           		} 
        	};    
        	var x=setInterval(lineProcess,1);
		/* for (var i = 0; i < logFileSplit.length; i++) {
        	}*/
	}
	
	this.ScrollToLogRecord = function(logRecord, server) {
		var recordId = "serverID-" + server.id + "-" + logRecord.index;
		$("#" + containerId).animate({
			scrollTop: $("#" + containerId).scrollTop() - $("#" + containerId).offset().top + $("#" + recordId).offset().top
		}, 0);
	}
	this.SetNewContainer = function(containerId) {
		logStatsDiv = $('<div/>', {
			id: "logStats",
			class: "logStats"
		});
		logTableDiv = $('<div/>', {
			id: "logTable"
		});
		logTable = $('<table/>', {
			class: "logTable"
		});
		logTableDiv.append(logTable);
		$("#" + containerId).html("");
		$("#" + containerId).append(logStatsDiv);
		$("#" + containerId).append(logTableDiv);
		logLines = [];
		vidyoStats = new VidyoStats("logStats");
	}

	function EncodeStringForAttr(string) {
		return window.btoa(string).replace(/=+/, "");
	}

	function getDate(date) {
		function addZero(x,n) {
			if (x.toString().length < n) {
				x = "0" + x;
			}
			return x;
		}
		return addZero(date.getHours(), 2) + ":" + addZero(date.getMinutes(), 2) + ":" + addZero(date.getSeconds(), 2) + "." + addZero(date.getMilliseconds(), 3);
		
	}
	function OrderAndRender(logLine) {
		/* order lines */
		if (logLines.length) {
			var foundLogLine = null;
			for (i = logLines.length - 1; i >= 0; i--) {
				var existingLogLine = logLines[i];
				if (logLine.time >= existingLogLine.time) {
					foundLogLine = existingLogLine;
					break;
				}
			}
			if (foundLogLine) {
				AppendLogLine(logLine, foundLogLine);
				logLines.splice(i+1, 0, logLine);
			} else {
				AppendLogLine(logLine, null);
				logLines.splice(0, 0, logLine);
			}
		} else {
			AppendLogLine(logLine, null);
			logLines.push(logLine);
		}	
	}
	function AppendLogLine(logLine, currentLogLine) {
		parsedLogBodyElements = WrapXML(logLine);
		sentOrReceived = logLine.level;
		parsedLogBodyElements.forEach(function(logBody) {
			AppendLogLineHTML(logLine, currentLogLine, logBody);
		});
	}
	function AppendLogLineHTML(logLine, currentLogLine, logBody) {
		var tr = $('<tr/>', {
			id: logLine.id,
			class: "logLine " + logLine.levelEncoded + " " + logLine.categoryEncoded + " " + logLine.functionLineShortEncoded + " " + logLine.functionNameEncoded
		});
		var tdIndex = $('<td/>', {
			class: "logIndex " + logLine.colorId,
			title: logLine.serverName,
			text: logLine.index
		});
		var tdTime = $('<td/>', {
			class: "logTime",
			text: getDate(logLine.time)
		});
		var tdSentRequest = $('<td/>', {
			class: "logGoTo"
		});
		var tdReceivedRequest = $('<td/>', {
			class: "logGoTo"
		});
		var tdSentResponse = $('<td/>', {
			class: "logGoTo"
		});
		var tdReceivedResponse = $('<td/>', {
			class: "logGoTo"
		});
		var threadId = '';
		if (logLine.threadId) {
			threadId = ' (0x' + logLine.threadId.toString(16) + ')'
		}
		var tdBody = $('<td/>', {
			class: "logBody " + logLine.level,
			title: ' Level: ' + logLine.level + '\n Category: ' + logLine.category + '\n Thread: ' + logLine.threadName + threadId + '\n File: ' + logLine.functionLineShort + '\n Function: ' + logLine.functionName + '\n Body: \n' + logLine.body,
			html: logBody.body.html()
		});
		
		/* check if the xml has been parsed */
		if (logBody.attributes.to && logBody.attributes.from && logBody.attributes.id) {
			var leg1_sentRequest = false;
			var leg2_receivedRequest = false;
			var leg3_sentResponse = false;
			var leg4_receivedResponse = false;
			var traceId;
			/* traceId format = id_to_from */
			if (logLine.level == "LMI_LOGLEVEL_SENT" || logLine.level == "VIDYO_LOGLEVEL_SENT") {
				/* leg1 or leg3 */
				/* reverse from and to to see if it's been received before */
				traceId = logBody.attributes.id + "_" + logBody.attributes.from + "_" + logBody.attributes.to;
				if (xmlTrace[traceId]) {
					leg3_sentResponse = true;
				} else {
					traceId = logBody.attributes.id + "_" + logBody.attributes.to + "_" + logBody.attributes.from;
					leg1_sentRequest = true;
					xmlTrace[traceId] = traceId;
				}
			} else if (logLine.level == "LMI_LOGLEVEL_RECEIVED" || logLine.level == "VIDYO_LOGLEVEL_RECEIVED") {
				/* leg2 or leg4 */
				/* reverse from and to to see if it's been sent before */
				traceId = logBody.attributes.id + "_" + logBody.attributes.from + "_" + logBody.attributes.to;
				if (xmlTrace[traceId]) {
					leg4_receivedResponse = true;
				} else {
					traceId = logBody.attributes.id + "_" + logBody.attributes.to + "_" + logBody.attributes.from;
					leg2_receivedRequest = true;
					xmlTrace[traceId] = traceId;
				}
			}
			
			var sentRequest = btoa("leg1_sentRequest" + traceId);
			var receivedRequest = btoa("leg2_receivedRequest" + traceId);
			var sentResponse = btoa("leg3_sentResponse" + traceId);
			var receivedResponse = btoa("leg4_receivedResponse" + traceId);
			if (leg1_sentRequest) {
				/* this logLine is sentRequest */
				tdSentRequest.attr("id",sentRequest);
				tdReceivedRequest.html("<a href='#" + receivedRequest + "'>&#8595;</a>");
				tdSentResponse.html("<a href='#" + sentResponse + "'>&#8595;</a>");
				tdReceivedResponse.html("<a href='#" + receivedResponse + "'>&#8595;</a>");
			} else if (leg2_receivedRequest) {
				/* this logLine is receivedRequest */
				tdSentRequest.html("<a href='#" + sentRequest + "'>&#8593;</a>");
				tdReceivedRequest.attr("id",receivedRequest);
				tdSentResponse.html("<a href='#" + sentResponse + "'>&#8595;</a>");
				tdReceivedResponse.html("<a href='#" + receivedResponse + "'>&#8595;</a>");
			} else if (leg3_sentResponse) {
				/* this logLine is sentResponse */
				tdSentRequest.html("<a href='#" + sentRequest + "'>&#8593;</a>");
				tdReceivedRequest.html("<a href='#" + receivedRequest + "'>&#8593;</a>");
				tdSentResponse.attr("id",sentResponse);
				tdReceivedResponse.html("<a href='#" + receivedResponse + "'>&#8595;</a>");
			} else if (leg4_receivedResponse) {
				/* this logLine is SentRequest */
				tdSentRequest.html("<a href='#" + sentRequest + "'>&#8593;</a>");
				tdReceivedRequest.html("<a href='#" + receivedRequest + "'>&#8593;</a>");
				tdSentResponse.html("<a href='#" + sentResponse + "'>&#8593;</a>");
				tdReceivedResponse.attr("id",receivedResponse);
			}
		} else if (logBody.attributes.stats) {
			tdBody.append("<div id='statsJson_" + logLine.id + "'></div>");
		}
		tr.append(tdIndex).append(tdTime).append(tdSentRequest).append(tdReceivedRequest).append(tdSentResponse).append(tdReceivedResponse).append(tdBody);
		
		if (currentLogLine) {
			$( "#" + currentLogLine.id).after(tr);
		} else {
			logTable.prepend(tr);
		}
		if (SearchFilter(logLine, searchString) == true) {
			$( "#" + logLine.id).hide();
		}
		if (logBody.attributes.stats) {
			/* JSON stats must be appended at the end after the HTML has been renderered for expand/collapse to function */
			$("#statsJson_" + logLine.id).JSONView(logLine.body, { collapsed: true });
		}
		
	}
	
	function RecurseHTMLFromXMLObj(xmlObj, output, level) {
		level = level + 1;
		var tagName = xmlObj.tagName;
		var beginObj = $("<span class='xmlBeginObj " + tagName+ "'/>");
		beginObj.text(tagName);
		
		var tabs = "";
		for (var i = 0; i < level; i++) {
			tabs = tabs + '  ';
		}
		
		output.append(tabs + "<").append(beginObj);
		var attrsString = "";
		
		$.each(xmlObj.attributes, function() {
			var nameObj = $("<span class='xmlNameObj xmlName" + this.name + "'/>");
			nameObj.text(this.name);
			var valueObj = $("<span class='xmlValueObj xmlValue" + this.name + "'/>");
			valueObj.text(this.value);
			output.append(" ").append(nameObj).append("='").append(valueObj).append("'");
		});
		output.append(">");
		
		if ($(xmlObj).text()) {
			var textWithoutChildren = $(xmlObj).clone().children().remove().end().text();
			if (textWithoutChildren) {
				bodyObj = $("<span class='xmlBodyObj " + tagName+ "'/>");
				bodyObj.text(textWithoutChildren);
				output.append(bodyObj);
			}
		}
		
		if (xmlObj.children.length) /* Do not create a next line if there are no children */
			output.append("</br>");
		
		$.each(xmlObj.children, function() {
			RecurseHTMLFromXMLObj(this, output, level);
			output.append("</br>");
		});
		var endObj =  $("<span class='xmlEndObj " + tagName+ "'/>");
		if (xmlObj.children.length) {
			endObj.text(tabs + "</" + tagName + ">");
		} else {
			endObj.text("</" + tagName + ">");
		}
		
		output.append(endObj);
	}
	
	function WrapXML(logLine) {
		var textXML = logLine.body;
		var parsedLogBodyElements =[];
		if (textXML[0] == "<") {
			try {
				var xmlObj = $(textXML);
				xmlObj.each(function() {
					var output = $("<div class='rootXML' />");
					var attributes = {};
					var scipDetected = false;
					$.each(this.attributes, function() {
						if (this.name == "to") {
							attributes.to = this.value;
						} else if (this.name == "from") {
							attributes.from = this.value;
						} else if (this.name == "id") {
							attributes.id = this.value;
						} else if (this.name == "dsturi") {
							attributes.to = this.value;
							scipDetected = true;
						} else if (this.name == "srcuri") {
							attributes.from = this.value;
							scipDetected = true;
						}
					});
					if (scipDetected) {
						$.each(this.children[0].attributes, function() {
							if (this.name == "transactionid") {
								attributes.id = this.value;
							}
						});
					}
					RecurseHTMLFromXMLObj(this, output, -1);
					parsedLogBodyElements.push({body: output, attributes: attributes});
				});
			} catch (err) {
				var output = $("<div class='rootString' />");
				output.text(textXML);
				parsedLogBodyElements.push({body: output, attributes: {}});
			}
		} else {
			var output = $("<div class='rootString' />");
			var attributes = {};
			var statsHtml = vidyoStats.ProcessLogLine(logLine);
			/* Check if stats */
			if (statsHtml) {
				attributes.stats = "json";
				output.append(statsHtml);
			} else {
				output.text(textXML);
			}
			parsedLogBodyElements.push({body: output, attributes: attributes});
		}
		return parsedLogBodyElements;
	}
	
	function SearchFilter(logLine, searchString) {
		return (logLine.body.search(searchString) < 0 &&
			logLine.level.search(searchString) < 0 &&
			logLine.category.search(searchString) < 0 &&
			logLine.threadName.search(searchString) < 0 &&
			logLine.functionLine.search(searchString) < 0 &&
			logLine.functionName.search(searchString) < 0);
	}
	
	this.SetNewContainer(containerId);
	
	var vidyoLog_ = this;
	setInterval(function () {
		if (stopPoll == true)
			return;
		/* get the log if available on servers */
		for (var logServerId in logServers) {
			var server = logServers[logServerId];
			if (server.outstandingRequest == false && server.url != null) {
				/* prevent concurrent requests */
				server.outstandingRequest = true;
				$.getJSON(server.url + '/logRecords?index=' + server.index + ';filter=' + logRecordsFilter + ";callback=?", (function() {
					/* user a closure to store data */
					var requestedServer = server;
					return function(data) {
					   vidyoLog_.AddLogRecords(data.records, requestedServer);
					   requestedServer.index = data.nextIndex;
					};
				})())
				.always((function() {
					/* user a closure to store data */
					var requestedServer = server;
					return function(data) {
						/* continue requests */
						requestedServer.outstandingRequest = false;
					};
				})());
			}
		}
	}, 1000);
};

function VidyoStats(containerId) {
	var rawStats = {};
	
	function ShowJson(date) {
		if (!date)
			return;
		var dateInSecs = date.split(/[.]+/)[0];
		var stats = rawStats[dateInSecs];
		if (!stats)
			return;
		$("#json").JSONView(stats, { collapsed: true });
	}
	
	function ShowOverview(date) {
		if (!date)
			return;
		var dateInSecs = date.split(/[.]+/)[0];
		var stats = rawStats[dateInSecs];
		if (!stats)
			return;
		/* navigate to logline */
		location.href = "#" + stats.logLineId;
	}

	/* Available Resources */
	var availableResources = {
		"cpuTrace"                     : { x: [], y: [], text: [], type: 'scatter', name: "Current CPU"},
		"sendBandwidthTrace"           : { x: [], y: [], text: [], type: 'scatter', name: "Send BW %"},
		"receiveBandwidthTrace"        : { x: [], y: [], text: [], type: 'scatter', name: "Receive BW %"},
		"encodeCpuTrace"               : { x: [], y: [], text: [], type: 'scatter', name: "Encode CPU %"},
		"decodeCpuTrace"               : { x: [], y: [], text: [], type: 'scatter', name: "Decode CPU %"}
	}
	$("#" + containerId).append($('<div/>', { id: "availableResources", class: "availableResources" }));
	Plotly.newPlot("availableResources", [availableResources["cpuTrace"], availableResources["sendBandwidthTrace"], availableResources["receiveBandwidthTrace"], availableResources["encodeCpuTrace"], availableResources["decodeCpuTrace"]], {
		yaxis: {title: 'Available', showline: false, range: [0, 100]},
		xaxis: {showgrid: false, zeroline: false },
		height: 200,
		showlegend: true,
		legend: {
			x: 0,
			y: 1,
			traceorder: 'normal',
			font: {
			  family: 'sans-serif',
			  size: 12,
			  color: '#000'
			},
			bgcolor: '#E2E2E2',
			bordercolor: '#FFFFFF',
			borderwidth: 2
		},
		margin: {
			t: 10
		},
	},
	{
		displaylogo: false,
		displayModeBar: false
	});
	$("#availableResources").on('plotly_click', function(event,data){
		ShowOverview(data["points"][0].x);
	});
	
	/* Overview */
	$("#" + containerId).append($('<div/>', { id: "overview", class: "overview" }));
	$("#" + containerId).append($('<div/>', { id: "json", class: "json" }));
		
	window.onresize = function() {
	    Plotly.Plots.resize("availableResources");
	};
  
	this.ProcessLogLine = function(logLine){
		if (logLine.functionName == "VidyoRoomStatisticsAsyncRun" || logLine.functionName == "VidyoEndpointStatisticsRun") {
			/* Client Log */
			var stats = $.parseJSON(logLine.body);
			stats.logLineId = logLine.id;
			return this.ProcessStatsObject(stats);
		} else if (logLine.functionName == "UsageTrackerLog") {
			/* Server Log */
			var stats = $.parseJSON(logLine.body);
			stats.stats.logLineId = logLine.id;
			return this.ProcessStatsObject(stats.stats);
		}
		return null;
	}
	
	this.ProcessStatsObject = function(stats){
		var vitals = {};
		var sendStreams = {};
		var receiveStreams = {};
		var audioDebug = {};
		if (!stats)
			return null;
		ParseStats(stats, vitals, sendStreams, receiveStreams, audioDebug);
		Render(vitals, sendStreams, receiveStreams, audioDebug);
		
		var dateInSecs = vitals.timeStamp.split(/[.]+/)[0];
		rawStats[dateInSecs] = stats;
		return RenderOverview(stats);
	}
	
	function ParseStats(stats, vitals, sendStreams, receiveStreams, audioDebug)  {
		/* keep the bandwidth totals cumulative */
		var sendStreamBitRateTotal = 0;
		var sendStreamPixelRateTotal = 0;
		var receiveStreamBitRateTotal = 0;
		var receiveStreamPixelRateTotal = 0;
		
		vitals.timeStamp = stats.timeStamp;
		
		function LocalStreamVideoParse(deviceStat, sendStreamStat, index) {
			var key = "V:" + deviceStat.name + "_" + index;
			sendStreamBitRateTotal   += sendStreamStat["sendNetworkBitRate"];
			sendStreamPixelRateTotal += (sendStreamStat["width"] * sendStreamStat["height"] * sendStreamStat["fpsSent"]);
			sendStreams[key] = {};
			sendStreams[key].bitRate     = sendStreamBitRateTotal;
			sendStreams[key].bitRateText = sendStreamStat["sendNetworkBitRate"]/1024 + "Kb " +  sendStreamStat["codecName"] + " rtt:" + sendStreamStat["sendNetworkRtt"]/1000000 + "ms" + " N:" + sendStreamStat["codecNacks"] + " I:" + sendStreamStat["codecIFrames"] + " F:" + sendStreamStat["codecFir"];
			sendStreams[key].pixelRate     = sendStreamPixelRateTotal;
			sendStreams[key].pixelRateText = deviceStat["width"] + "x" + deviceStat["height"] + "@S:" + 1/deviceStat["frameIntervalSet"] + "/M:" + 1/deviceStat["frameIntervalMeasured"] + sendStreamStat["width"] + "x" + sendStreamStat["height"] + "@E:" + sendStreamStat["fps"] + "/I:" + sendStreamStat["fpsInput"] + "/S:" + sendStreamStat["fpsSent"];
		}
		function LocalStreamAudioParse(deviceStat, sendStreamStat, index) {
			var key = "A:" + deviceStat.name + "_" + index;
			sendStreamBitRateTotal += sendStreamStat["sendNetworkBitRate"];
			sendStreams[key] = {};
			sendStreams[key].bitRate     = sendStreamBitRateTotal;
			sendStreams[key].bitRateText = sendStreamStat["sendNetworkBitRate"] + " " + sendStreamStat["codecName"] + ":" + sendStreamStat["sampleRate"] + ":" + sendStreamStat["numberOfChannels"] + " rtt:" + sendStreamStat["sendNetworkRtt"]/1000000 + "ms" + " dtx:" + sendStreamStat["codecDtx"] + " Q:" + sendStreamStat["codecQualitySetting"];
		}
				
		function RemoteStreamVideoParse(remoteDeviceStat, participantStat) {
			var key = participantStat.name + " / " + remoteDeviceStat.name + "(" + participantStat.id + " / " + remoteDeviceStat.id + ")";
			receiveStreamBitRateTotal   += remoteDeviceStat["receiveNetworkBitRate"];
			receiveStreamPixelRateTotal += (remoteDeviceStat["width"] * remoteDeviceStat["height"] * remoteDeviceStat["fpsDecoderInput"]);
			receiveStreams[key] = {};
			receiveStreams[key].bitRate     = receiveStreamBitRateTotal;
			receiveStreams[key].bitRateText        = remoteDeviceStat["receiveNetworkBitRate"] + " " + remoteDeviceStat["codecName"] + " C:" + remoteDeviceStat["receiveNetworkPacketsConcealed"] + " L:" + remoteDeviceStat["receiveNetworkPacketsLost"] + " O:" + remoteDeviceStat["receiveNetworkPacketsReordered"] + " R:" + remoteDeviceStat["receiveNetworkRecoveredWithFec"] + " N:" + remoteDeviceStat["codecNacks"] + " I:" + remoteDeviceStat["codecIFrames"] + " F:" + remoteDeviceStat["codecFir"];
			receiveStreams[key].pixelRate     = receiveStreamPixelRateTotal;
			receiveStreams[key].pixelRateText = remoteDeviceStat["width"] + "x" + remoteDeviceStat["height"] + "@" + remoteDeviceStat["fpsDecoderInput"] + "/" + remoteDeviceStat["fpsDecoded"] + "/" + remoteDeviceStat["fpsRendered"] + " show:" + remoteDeviceStat["showWidth"] + "x" + remoteDeviceStat["showHeight"] + "@" + remoteDeviceStat["showFrameRate"] + " pixelRate:" + remoteDeviceStat["showPixelRate"];
		}
				
		function RemoteStreamAudioParse(remoteDeviceStat, participantStat) {
			var key = participantStat.name + " / " + remoteDeviceStat.name + "(" + participantStat.id + " / " + remoteDeviceStat.id + ")";
			receiveStreamBitRateTotal += remoteDeviceStat["receiveNetworkBitRate"];
			receiveStreams[key] = {};
			receiveStreams[key].bitRate    = receiveStreamBitRateTotal;
			receiveStreams[key].bitRateText = remoteDeviceStat["receiveNetworkBitRate"] + " " + remoteDeviceStat["codecName"] + ":" + remoteDeviceStat["sampleRate"] + ":" + remoteDeviceStat["numberOfChannels"] + " rtt:" + remoteDeviceStat["sendNetworkRtt"]/1000000 + "ms" + " dtx:" + remoteDeviceStat["codecDtx"] + " Q:" + remoteDeviceStat["codecQualitySetting"];
			
			/* Audio debug for speaker streams */
			for (var k in remoteDeviceStat.localSpeakerStreams) {
				var localSpeakerStreamStat = remoteDeviceStat.localSpeakerStreams[k];
				var key = participantStat.name + " / " + remoteDeviceStat.name + "(" + localSpeakerStreamStat.name + ")";
				audioDebug[key] = {};
				audioDebug[key].delay     = localSpeakerStreamStat["delay"]/1000000; //ms
				audioDebug[key].text = "L:" + localSpeakerStreamStat["lowestThreshold"]/1000000 + "ms H:" + localSpeakerStreamStat["highestThreshold"]/1000000 + "ms E:" + localSpeakerStreamStat["lastEnergy"] + " O:" + localSpeakerStreamStat["overrun"]/1000000 + " U:" + localSpeakerStreamStat["underrun"]/1000000 + " P:" + localSpeakerStreamStat["played"]/1000000;
			}
		}
		
		/* Sending streams */
		/* cameras */
		for (var i in stats.localCameraStats) {
			var deviceStat = stats.localCameraStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteRendererStreams) {
				var sendStreamStat = deviceStat.remoteRendererStreams[j];
				/* find stream if already exists */
				LocalStreamVideoParse(deviceStat, sendStreamStat, j);
			}
		}
		/* window shares */
		for (var i in stats.localWindowShareStats) {
			var deviceStat = stats.localWindowShareStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteRendererStreams) {
				var sendStreamStat = deviceStat.remoteRendererStreams[j];
				/* find stream if already exists */
				LocalStreamVideoParse(deviceStat, sendStreamStat, j);
			}
		}
		/* monitors */
		for (var i in stats.localMonitorStats) {
			var deviceStat = stats.localMonitorStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteRendererStreams) {
				var sendStreamStat = deviceStat.remoteRendererStreams[j];
				/* find stream if already exists */
				LocalStreamVideoParse(deviceStat, sendStreamStat, j);
			}
		}
		/* microphones */
		for (var i in stats.localMicrophoneStats) {
			var deviceStat = stats.localMicrophoneStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteSpeakerStreams) {
				var sendStreamStat = deviceStat.remoteSpeakerStreams[j];
				/* find stream if already exists */
				LocalStreamAudioParse(deviceStat, sendStreamStat, j);
			}
		}
		
		/* Receiving streams */
		for (var iu in stats.userStats) {
			var userStat = stats.userStats[iu];
			for (var ir in userStat.roomStats) {
				var roomStat = userStat.roomStats[ir];
				/* assign fitals from any room */
				vitals.cpuUsage                        = roomStat.cpuUsage;
				vitals.maxEncodePixelRate              = roomStat.maxEncodePixelRate;
				vitals.maxDecodePixelRate              = roomStat.maxDecodePixelRate;
				vitals.currentCpuEncodePixelRate       = roomStat.currentCpuEncodePixelRate;
				vitals.currentBandwidthEncodePixelRate = roomStat.currentBandwidthEncodePixelRate;
				vitals.currentCpuDecodePixelRate       = roomStat.currentCpuDecodePixelRate;
				vitals.currentBandwidthDecodePixelRate = roomStat.currentBandwidthDecodePixelRate;
				vitals.sendBitRateAvailable            = roomStat.sendBitRateAvailable;
				vitals.sendBitRateTotal                = roomStat.sendBitRateTotal;
				vitals.receiveBitRateAvailable         = roomStat.receiveBitRateAvailable;
				vitals.receiveBitRateTotal             = roomStat.receiveBitRateTotal;
				
				for (var i in roomStat.participantStats) {
					var participantStat = roomStat.participantStats[i];
					/* iterate through all the remote cameras */
					for (var j in participantStat.remoteCameraStats) {
						var remoteDeviceStat = participantStat.remoteCameraStats[j];
						RemoteStreamVideoParse(remoteDeviceStat, participantStat);
					}
					/* iterate through all the remote window shares */
					for (var j in participantStat.remoteWindowShareStats) {
						var remoteDeviceStat = participantStat.remoteWindowShareStats[j];
						RemoteStreamVideoParse(remoteDeviceStat, participantStat);
					}
					/* iterate through all the remote microphone */
					for (var j in participantStat.remoteMicrophoneStats) {
						var remoteDeviceStat = participantStat.remoteMicrophoneStats[j];
						RemoteStreamAudioParse(remoteDeviceStat, participantStat);

					}
				}
			}
		}
		return stats;
	}
	function RenderOverview(stats)  {
		/* keep the bandwidth totals cumulative */
		var sendStreamBitRateTotal = 0;
		var sendStreamPixelRateTotal = 0;
		var receiveStreamBitRateTotal = 0;
		var receiveStreamPixelRateTotal = 0;
		var txVideoBitRate = 0;
		var txAudioBitRate = 0;
		var txContentBitRate = 0;
		var nsecPerSec = 1000000000;
		var output = $("<div class='statsData' />");
		
		function numberWithCommas(x) {
		    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		function LocalStreamVideoParse(deviceStat, sendStreamStat, txVideoSourcesTableObj, txBitRate) {
			txBitRate += sendStreamStat["sendNetworkBitRate"];
			sendStreamBitRateTotal   += sendStreamStat["sendNetworkBitRate"];
			sendStreamPixelRateTotal += (sendStreamStat["width"] * sendStreamStat["height"] * sendStreamStat["fpsSent"]);
			
			var txVideoSourcesTable = '';
			txVideoSourcesTable +=		'<tr>';
			txVideoSourcesTable +=			'<td title="Name">' + deviceStat.name + '</td>';
			txVideoSourcesTable +=			'<td title="Codec">' + sendStreamStat["codecName"] + '</td>';
			txVideoSourcesTable +=			'<td title="Captured - Constrained">' + deviceStat.width + '/' + deviceStat.height + '-' + sendStreamStat["width"] + '/' + sendStreamStat["height"] + '</td>';
			txVideoSourcesTable +=			'<td title="Set/Measured/Constrained/EncoderInput/Sent">' + Math.round(nsecPerSec/deviceStat.frameIntervalSet) + '/' + Math.round(nsecPerSec/deviceStat.frameIntervalMeasured) + '/' + sendStreamStat["fps"] + '/' + sendStreamStat["fpsInput"] + '/' + sendStreamStat["fpsSent"] + '</td>';
			txVideoSourcesTable +=			'<td title="Frames Dropped">' + sendStreamStat["framesDropped"] + '</td>';
			txVideoSourcesTable +=			'<td title="FIR/NACK/IFrame">' + sendStreamStat["codecFir"] + '/' + sendStreamStat["codecNacks"] + '/' + sendStreamStat["codecIFrames"] + '</td>';
			txVideoSourcesTable +=			'<td title="RTT">' + Math.round(sendStreamStat["sendNetworkRtt"]/1000000) + "ms" + '</td>';
			txVideoSourcesTable +=			'<td title="Bitrate">' + numberWithCommas(sendStreamStat["sendNetworkBitRate"]) + '</td>';
			txVideoSourcesTable +=		'</tr>';
			
			txVideoSourcesTableObj.append(txVideoSourcesTable);
		}
		function LocalStreamAudioParse(deviceStat, sendStreamStat, txAudioSourcesTableObj, txBitRate) {
			txBitRate += sendStreamStat["sendNetworkBitRate"];
			sendStreamBitRateTotal += sendStreamStat["sendNetworkBitRate"];

			var txAudioSourcesTable = '';
			txAudioSourcesTable +=		'<tr>';
			txAudioSourcesTable +=			'<td title="Name">' + deviceStat.name + '</td>';
			txAudioSourcesTable +=			'<td title="Codec">' + sendStreamStat["codecName"] + '</td>';
			txAudioSourcesTable +=			'<td title="Codec DTX">' + sendStreamStat["codecDtx"] + '</td>';
			txAudioSourcesTable +=			'<td title="Codec Quality">' + sendStreamStat["codecQualitySetting"] + '</td>';
			txAudioSourcesTable +=			'<td title="SampleRate">' + sendStreamStat["sampleRate"] + '</td>';
			txAudioSourcesTable +=			'<td title="Channels">' + sendStreamStat["numberOfChannels"] + '</td>';
			txAudioSourcesTable +=			'<td title="Bits Per Sample">' + sendStreamStat["bitsPerSample"] + '</td>';
			txAudioSourcesTable +=			'<td title="RoundTrip">' + Math.round(sendStreamStat["sendNetworkRtt"]/1000000) + "ms" + '</td>';
			txAudioSourcesTable +=			'<td title="Bitrate">' + numberWithCommas(sendStreamStat["sendNetworkBitRate"]) + '</td>';
			txAudioSourcesTable +=		'</tr>';	
			
			txAudioSourcesTableObj.append(txAudioSourcesTable);	
		}
				
		function RemoteStreamVideoParse(remoteDeviceStat, participantStat, rxVideoSinkTableObj, rxBitRate) {
			rxBitRate += remoteDeviceStat["receiveNetworkBitRate"];
			receiveStreamBitRateTotal   += remoteDeviceStat["receiveNetworkBitRate"];
			receiveStreamPixelRateTotal += (remoteDeviceStat["width"] * remoteDeviceStat["height"] * remoteDeviceStat["fpsDecoderInput"]);

			var rxVideoSinkTable = '';
			rxVideoSinkTable +=		'<tr>';
			rxVideoSinkTable +=			'<td title="Participant">' + participantStat.name + '</td>';
			rxVideoSinkTable +=			'<td title="Name">' + remoteDeviceStat.name + '</td>';
			rxVideoSinkTable +=			'<td title="Codec">' + remoteDeviceStat["codecName"] + '</td>';
			rxVideoSinkTable +=			'<td title="Show - Received">' + remoteDeviceStat["showWidth"] + '/' + remoteDeviceStat["showHeight"] + '-' + remoteDeviceStat["width"] + '/' + remoteDeviceStat["height"] + '</td>';
			rxVideoSinkTable +=			'<td title="Show/Received/Decoded/Displayed">' + remoteDeviceStat["showFrameRate"] + '/' + remoteDeviceStat["fpsDecoderInput"] + '/' + remoteDeviceStat["fpsDecoded"] + '/' + remoteDeviceStat["fpsRendered"] + '</td>';
			rxVideoSinkTable +=			'<td title="Show State">' + remoteDeviceStat["showState"] + '</td>';
			rxVideoSinkTable +=			'<td title="FIR/NACK/IFRAME">' + remoteDeviceStat["codecFir"] + '/' + remoteDeviceStat["codecNacks"] + '/' + remoteDeviceStat["codecIFrames"] + '</td>';
			rxVideoSinkTable +=			'<td title="Lost/Concealed/Reordered">' + remoteDeviceStat["receiveNetworkPacketsLost"] + '/' + remoteDeviceStat["receiveNetworkPacketsConcealed"] + '/' + remoteDeviceStat["receiveNetworkPacketsReordered"] + '</td>';
			rxVideoSinkTable +=			'<td title="Bitrate">' + numberWithCommas(remoteDeviceStat["receiveNetworkBitRate"]) + '</td>';
			rxVideoSinkTable +=		'</tr>';
			
			rxVideoSinkTableObj.append(rxVideoSinkTable);	
		}
				
		function RemoteStreamAudioParse(remoteDeviceStat, participantStat, rxAudioSinkTableObj, rxBitRate) {
			rxBitRate += remoteDeviceStat["receiveNetworkBitRate"];
			receiveStreamBitRateTotal += remoteDeviceStat["receiveNetworkBitRate"];
			
			/* Audio debug for speaker streams */
			for (var k in remoteDeviceStat.localSpeakerStreams) {
				var localSpeakerStreamStat = remoteDeviceStat.localSpeakerStreams[k];
				var rxAudioSinkTable = '';
				rxAudioSinkTable +=		'<tr>';
				rxAudioSinkTable +=			'<td title="Participant">' + participantStat.name + '</td>';
				rxAudioSinkTable +=			'<td title="Name">' + remoteDeviceStat.name + '</td>';
				rxAudioSinkTable +=			'<td title="Codec">' + remoteDeviceStat["codecName"] + '</td>';
				rxAudioSinkTable +=			'<td title="SampleRate">' + remoteDeviceStat["sampleRateSet"] + '</td>';
				rxAudioSinkTable +=			'<td title="Channels">' + remoteDeviceStat["numberOfChannels"] + '</td>';
				rxAudioSinkTable +=			'<td title="Bits Per Sample">' + remoteDeviceStat["bitsPerSample"] + '</td>';
				rxAudioSinkTable +=			'<td title="Delay ms">' + Math.round(localSpeakerStreamStat["delay"]/1000000) + '</td>';
				rxAudioSinkTable +=			'<td title="Overrun ms">' + Math.round(localSpeakerStreamStat["overrun"]/1000000) + '</td>';
				rxAudioSinkTable +=			'<td title="Last Energy DBFS">' + localSpeakerStreamStat["lastEnergy"] + '</td>';
				rxAudioSinkTable +=			'<td title="Bitrate">' + numberWithCommas(remoteDeviceStat["receiveNetworkBitRate"]) + '</td>';
				rxAudioSinkTable +=		'</tr>';
			
				rxAudioSinkTableObj.append(rxAudioSinkTable);	
		
			}
		}
			
		function GenerationParse(participantGenerationStat, rxDynamicTableObj, generation) {
			var rxDynamicTable = '';
			rxDynamicTable +=		'<tr>';
			rxDynamicTable +=			'<td title="Generation">' + generation + '</td>';
			rxDynamicTable +=			'<td title="Name">'       + participantGenerationStat.name + '</td>';
			rxDynamicTable +=			'<td title="Camera">'     + participantGenerationStat.cameraName + '</td>';
			rxDynamicTable +=			'<td title="Show">'      + participantGenerationStat.width + '/' + participantGenerationStat.height + '</td>';
			rxDynamicTable +=			'<td title="Show">'       + Math.round(nsecPerSec/participantGenerationStat.frameInterval) + '</td>';
			rxDynamicTable +=			'<td title="PixelRate">'  + numberWithCommas(participantGenerationStat.pixelRate) + '</td>';
			rxDynamicTable +=		'</tr>';
			
			rxDynamicTableObj.append(rxDynamicTable);	
		}
		
		/* Sending streams */
		/* cameras */
		var txVideoTable = '';		
		txVideoTable += '<table class="stats">';
		txVideoTable +=		'<tr>';
		txVideoTable +=			'<th title="Name">Name</th>';
		txVideoTable +=			'<th title="Encoder">Encoder</th>';
		txVideoTable +=			'<th title="Captured - Constrained">Resolution</th>';
		txVideoTable +=			'<th title="Set/Measured/Constrained/EncoderInput/Sent/Dropped">FPS</th>';
		txVideoTable +=			'<th title="Frames Dropped">Drop</th>';
		txVideoTable +=			'<th title="FIR/NACK/IFrame">FIR</th>';
		txVideoTable +=			'<th title="RTT">RTT</th>';
		txVideoTable +=			'<th title="Bitrate">Bitrate</th>';
		txVideoTable +=		'</tr>';
		txVideoTable += '</table>';
		txVideoTable = $(txVideoTable);
		for (var i in stats.localCameraStats) {
			var deviceStat = stats.localCameraStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteRendererStreams) {
				var sendStreamStat = deviceStat.remoteRendererStreams[j];
				/* find stream if already exists */
				LocalStreamVideoParse(deviceStat, sendStreamStat, txVideoTable, txVideoBitRate);
			}
		}
		
		/* window shares */
		var txContentTable = '';		
		txContentTable += '<table class="stats">';
		txContentTable +=	'<tr>';
		txContentTable +=		'<th title="Name">Name</th>';
		txContentTable +=		'<th title="Encoder">Encoder</th>';
		txContentTable +=		'<th title="Captured - Constrained">Resolution</th>';
		txContentTable +=		'<th title="Set/Measured/Constrained/EncoderInput/Sent/Dropped">FPS</th>';
		txContentTable +=		'<th title="Frames Dropped">Drop</th>';
		txContentTable +=		'<th title="FIR/NACK/IFrame">FIR</th>';
		txContentTable +=		'<th title="RTT">RTT</th>';
		txContentTable +=		'<th title="Bitrate">Bitrate</th>';
		txContentTable +=	'</tr>';
		txContentTable += '</table>';
		txContentTable = $(txContentTable);
		for (var i in stats.localWindowShareStats) {
			var deviceStat = stats.localWindowShareStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteRendererStreams) {
				var sendStreamStat = deviceStat.remoteRendererStreams[j];
				/* find stream if already exists */
				LocalStreamVideoParse(deviceStat, sendStreamStat, txContentTable, txContentBitRate);
			}
		}
		/* monitors */
		for (var i in stats.localMonitorStats) {
			var deviceStat = stats.localMonitorStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteRendererStreams) {
				var sendStreamStat = deviceStat.remoteRendererStreams[j];
				/* find stream if already exists */
				LocalStreamVideoParse(deviceStat, sendStreamStat, txContentTable, txContentBitRate);
			}
		}
		
		/* microphones */
		var txAudioTable = '';		
		txAudioTable += '<table class="stats">';
		txAudioTable +=		'<tr>';
		txAudioTable +=			'<th title="Name">Name</th>';
		txAudioTable +=			'<th title="Codec">Encoder</th>';
		txAudioTable +=			'<th title="Codec DTX">DTX</th>';
		txAudioTable +=			'<th title="Codec Quality">Qual</th>';
		txAudioTable +=			'<th title="SampleRate">Rate</th>';
		txAudioTable +=			'<th title="Channels">Ch</th>';
		txAudioTable +=			'<th title="Bits Per Sample">BPS</th>';
		txAudioTable +=			'<th title="RoundTrip">RTT</th>';
		txAudioTable +=			'<th title="Bitrate">Bitrate</th>';
		txAudioTable +=		'</tr>';
		txAudioTable += '</table>';
		txAudioTable = $(txAudioTable);
		for (var i in stats.localMicrophoneStats) {
			var deviceStat = stats.localMicrophoneStats[i];
			/* iterate through all the remote streams */
			for (var j in deviceStat.remoteSpeakerStreams) {
				var sendStreamStat = deviceStat.remoteSpeakerStreams[j];
				/* find stream if already exists */
				LocalStreamAudioParse(deviceStat, sendStreamStat, txAudioTable, txAudioBitRate);
			}
		}
		
		var txBandwidthTable = '';	
		var rxBandwidthTable = '';	
		var pixelRateTable = '';	
		var vitalsTable = '';	
		var sourcesTable = '';
		var rateShaperTable = '';
				
		var rxVideoTable = '';		
		rxVideoTable += '<table class="stats">';
		rxVideoTable +=		'<tr>';
		rxVideoTable +=			'<th title="Participant">Participant</th>';
		rxVideoTable +=			'<th title="Name">Name</th>';
		rxVideoTable +=			'<th title="Codec">Decoder</th>';
		rxVideoTable +=			'<th title="Show - Received">Resolution</th>';
		rxVideoTable +=			'<th title="Show/Received/Decoded/Displayed">FPS</th>';
		rxVideoTable +=			'<th title="Show State">State</th>';
		rxVideoTable +=			'<th title="FIR/NACK/IFRAME">FIR</th>';
		rxVideoTable +=			'<th title="Lost/Concealed/Reordered">Packets</th>';
		rxVideoTable +=			'<th title="Bitrate">Bitrate</th>';
		rxVideoTable +=		'</tr>';
		rxVideoTable += '</table>';
		rxVideoTable = $(rxVideoTable);
		
		var rxContentTable = '';		
		rxContentTable += '<table class="stats">';
		rxContentTable +=		'<tr>';
		rxContentTable +=			'<th title="Participant">Participant</th>';
		rxContentTable +=			'<th title="Name">Name</th>';
		rxContentTable +=			'<th title="Codec">Decoder</th>';
		rxContentTable +=			'<th title="Show - Received">Resolution</th>';
		rxContentTable +=			'<th title="Show/Received/Decoded/Displayed">FPS</th>';
		rxContentTable +=			'<th title="FIR/NACK/IFRAME">FIR</th>';
		rxContentTable +=			'<th title="Lost/Concealed/Reordered">Packets</th>';
		rxContentTable +=			'<th title="Bitrate">Bitrate</th>';
		rxContentTable +=		'</tr>';
		rxContentTable += '</table>';
		rxContentTable = $(rxContentTable);
		
		var rxAudioTable = '';		
		rxAudioTable += '<table class="stats">';
		rxAudioTable +=		'<tr>';
		rxAudioTable +=			'<th title="Participant">Participant</th>';
		rxAudioTable +=			'<th title="Name">Name</th>';
		rxAudioTable +=			'<th title="Codec">Decoder</th>';
		rxAudioTable +=			'<th title="SampleRate">Rate</th>';
		rxAudioTable +=			'<th title="Channels">Ch</th>';
		rxAudioTable +=			'<th title="Bits Per Sample">BPS</th>';
		rxAudioTable +=			'<th title="Delay ms">Delay</th>';
		rxAudioTable +=			'<th title="Overrun ms">Over</th>';
		rxAudioTable +=			'<th title="Last Energy DBFS">Energy</th>';
		rxAudioTable +=			'<th title="Bitrate">Bitrate</th>';
		rxAudioTable +=		'</tr>';
		rxAudioTable += '</table>';
		rxAudioTable = $(rxAudioTable);
		
		var rxDynamicTable = '';		
		rxDynamicTable += '<table class="stats">';
		rxDynamicTable +=		'<tr>';
		rxDynamicTable +=			'<th title="Generation">Generation</th>';
		rxDynamicTable +=			'<th title="Name">Name</th>';
		rxDynamicTable +=			'<th title="Camera">Camera</th>';
		rxDynamicTable +=			'<th title="Show">Resolution</th>';
		rxDynamicTable +=			'<th title="Show">FPS</th>';
		rxDynamicTable +=			'<th title="Pixelrate">Pixelrate</th>';
		rxDynamicTable +=		'</tr>';
		rxDynamicTable += '</table>';
		rxDynamicTable = $(rxDynamicTable);
		
		/* Receiving streams */
		for (var iu in stats.userStats) {
			var userStat = stats.userStats[iu];
			for (var ir in userStat.roomStats) {
				var roomStat = userStat.roomStats[ir];
				var rxVideoBitRate = 0;
				var rxAudioBitRate = 0;
				var rxContentBitRate = 0;
					
				for (var i in roomStat.participantStats) {
					var participantStat = roomStat.participantStats[i];
					/* iterate through all the remote cameras */
					for (var j in participantStat.remoteCameraStats) {
						var remoteDeviceStat = participantStat.remoteCameraStats[j];
						RemoteStreamVideoParse(remoteDeviceStat, participantStat, rxVideoTable, rxVideoBitRate);
					}
					/* iterate through all the remote window shares */
					for (var j in participantStat.remoteWindowShareStats) {
						var remoteDeviceStat = participantStat.remoteWindowShareStats[j];
						RemoteStreamVideoParse(remoteDeviceStat, participantStat, rxContentTable, rxContentBitRate);
					}
					/* iterate through all the remote microphone */
					for (var j in participantStat.remoteMicrophoneStats) {
						var remoteDeviceStat = participantStat.remoteMicrophoneStats[j];
						RemoteStreamAudioParse(remoteDeviceStat, participantStat, rxAudioTable, rxAudioBitRate);

					}
				}
				for (var i in roomStat.participantGenerationStats) {
					var participantGenerationStat = roomStat.participantGenerationStats[i];
					GenerationParse(participantGenerationStat, rxDynamicTable, i);
				}
						
				txBandwidthTable += '<table class="stats">';
				txBandwidthTable +=		'<tr>';
				txBandwidthTable +=			'<th></th>';
				txBandwidthTable +=			'<th title="Available bandwidth Mb/s">Avail</th>';
				txBandwidthTable +=			'<th title="Actual bitrate Mb/s">Actual</th>';
				txBandwidthTable +=			'<th title="Total Transmit bitrate Mb/s">Total</th>';
				txBandwidthTable +=			'<th title="Retransmit bitrate Mb/s">Ret</th>';
				txBandwidthTable +=			'<th title="Target Encoder bitrate Mb/s">Target</th>';
				txBandwidthTable +=			'<th>LB Delay</th>';
				txBandwidthTable +=		'</tr>';
				txBandwidthTable +=		'<tr>';
				txBandwidthTable +=			'<td>Video</td>';
				txBandwidthTable +=			'<td title="Available bandwidth Mb/s">' + numberWithCommas(roomStat.bandwidthVideo.availableBandwidth) + '</td>';
				txBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthVideo.actualEncoderBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Total Transmit bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthVideo.totalTransmitBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Retransmit bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthVideo.retransmitBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Target Encoder bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthVideo.targetEncoderBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Leaky Bucket delay msec">' + numberWithCommas(roomStat.bandwidthVideo.leakyBucketDelay) + '</td>';
				txBandwidthTable +=		'</tr>';
				txBandwidthTable +=		'<tr>';
				txBandwidthTable +=			'<td>Audio</td>';
				txBandwidthTable +=			'<td title="Available bandwidth Mb/s">' + numberWithCommas(roomStat.bandwidthAudio.availableBandwidth) + '</td>';
				txBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthAudio.actualEncoderBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Total Transmit bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthAudio.totalTransmitBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Retransmit bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthAudio.retransmitBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Target Encoder bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthAudio.targetEncoderBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Leaky Bucket delay msec">' + numberWithCommas(roomStat.bandwidthAudio.leakyBucketDelay) + '</td>';
				txBandwidthTable +=		'</tr>';
				txBandwidthTable +=		'<tr>';
				txBandwidthTable +=			'<td>Content</td>';
				txBandwidthTable +=			'<td title="Available bandwidth Mb/s">' + numberWithCommas(roomStat.bandwidthApp.availableBandwidth) + '</td>';
				txBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthApp.actualEncoderBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Total Transmit bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthApp.totalTransmitBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Retransmit bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthApp.retransmitBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Target Encoder bitrate Mb/s">' + numberWithCommas(roomStat.bandwidthApp.targetEncoderBitRate) + '</td>';
				txBandwidthTable +=			'<td title="Leaky Bucket delay msec">' + numberWithCommas(roomStat.bandwidthApp.leakyBucketDelay) + '</td>';
				txBandwidthTable +=		'</tr>';
				txBandwidthTable +=		'<tr>';
				txBandwidthTable +=			'<td>Total</td>';
				txBandwidthTable +=			'<td title="Available bandwidth Mb/s">' + numberWithCommas(roomStat.sendBitRateAvailable) + '</td>';
				txBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(roomStat.sendBitRateTotal) + '</td>';
				txBandwidthTable +=			'<td title="Total Transmit bitrate Mb/s"></td>';
				txBandwidthTable +=			'<td title="Retransmit bitrate Mb/s"></td>';
				txBandwidthTable +=			'<td title="Target Encoder bitrate Mb/s"></td>';
				txBandwidthTable +=			'<td title="Leaky Bucket delay msec"></td>';
				txBandwidthTable +=		'</tr>';
				txBandwidthTable += '</table>';
					
				rxBandwidthTable += '<table class="stats">';
				rxBandwidthTable +=		'<tr>';
				rxBandwidthTable +=			'<th></th>';
				rxBandwidthTable +=			'<th title="Available bandwidth Mb/s">Avail</th>';
				rxBandwidthTable +=			'<th title="Actual bitrate Mb/s">Actual</th>';
				rxBandwidthTable +=		'</tr>';
				rxBandwidthTable +=		'<tr>';
				rxBandwidthTable +=			'<td>Video</td>';
				rxBandwidthTable +=			'<td title="Available bandwidth Mb/s"></td>';
				rxBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(rxVideoBitRate) + '</td>';
				rxBandwidthTable +=		'</tr>';
				rxBandwidthTable +=		'<tr>';
				rxBandwidthTable +=			'<td>Audio</td>';
				rxBandwidthTable +=			'<td title="Available bandwidth Mb/s"></td>';
				rxBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(rxAudioBitRate) + '</td>';
				rxBandwidthTable +=		'</tr>';
				rxBandwidthTable +=		'<tr>';
				rxBandwidthTable +=			'<td>Content</td>';
				rxBandwidthTable +=			'<td title="Available bandwidth Mb/s"></td>';
				rxBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(rxContentBitRate) + '</td>';
				rxBandwidthTable +=		'</tr>';
				rxBandwidthTable +=		'<tr>';
				rxBandwidthTable +=			'<td>Total</td>';
				rxBandwidthTable +=			'<td title="Available bandwidth Mb/s">' + numberWithCommas(roomStat.receiveBitRateAvailable) + '</td>';
				rxBandwidthTable +=			'<td title="Actual bitrate Mb/s">' + numberWithCommas(roomStat.receiveBitRateTotal) + '</td>';
				rxBandwidthTable +=		'</tr>';
				rxBandwidthTable += '</table>';
								
				rateShaperTable += '<table class="stats">';
				rateShaperTable +=		'<tr>';
				rateShaperTable +=			'<th></th>';
				rateShaperTable +=			'<th title="Delay Normal">Delay N</th>';
				rateShaperTable +=			'<th title="Delay Retransmit">Delay R</th>';
				rateShaperTable +=			'<th title="Packets Normal">Packets N</th>';
				rateShaperTable +=			'<th title="Packets Retransmit">Packets R</th>';
				rateShaperTable +=			'<th title="Drop Normal">Drop N</th>';
				rateShaperTable +=		'</tr>';
				rateShaperTable +=		'<tr>';
				rateShaperTable +=			'<td>Video</td>';
				rateShaperTable +=			'<td title="Delay Normal">' + numberWithCommas(roomStat.rateShaperVideo.delayNormal) + '</td>';
				rateShaperTable +=			'<td title="Delay Retransmit">' + numberWithCommas(roomStat.rateShaperVideo.delayRetransmit) + '</td>';
				rateShaperTable +=			'<td title="Packets Normal">' + numberWithCommas(roomStat.rateShaperVideo.packetsNormal) + '</td>';
				rateShaperTable +=			'<td title="Packets Retransmit">' + numberWithCommas(roomStat.rateShaperVideo.packetsRetransmit) + '</td>';
				rateShaperTable +=			'<td title="Drop Normal">' + numberWithCommas(roomStat.rateShaperVideo.dropNormal) + '</td>';
				rateShaperTable +=		'</tr>';
				rateShaperTable +=		'<tr>';
				rateShaperTable +=			'<td>Audio</td>';
				rateShaperTable +=			'<td title="Delay Normal">' + numberWithCommas(roomStat.rateShaperAudio.delayNormal) + '</td>';
				rateShaperTable +=			'<td title="Delay Retransmit">' + numberWithCommas(roomStat.rateShaperAudio.delayRetransmit) + '</td>';
				rateShaperTable +=			'<td title="Packets Normal">' + numberWithCommas(roomStat.rateShaperAudio.packetsNormal) + '</td>';
				rateShaperTable +=			'<td title="Packets Retransmit">' + numberWithCommas(roomStat.rateShaperAudio.packetsRetransmit) + '</td>';
				rateShaperTable +=			'<td title="Drop Normal">' + numberWithCommas(roomStat.rateShaperAudio.dropNormal) + '</td>';
				rateShaperTable +=		'</tr>';
				rateShaperTable +=		'<tr>';
				rateShaperTable +=			'<td>Content</td>';
				rateShaperTable +=			'<td title="Delay Normal">' + numberWithCommas(roomStat.rateShaperApp.delayNormal) + '</td>';
				rateShaperTable +=			'<td title="Delay Retransmit">' + numberWithCommas(roomStat.rateShaperApp.delayRetransmit) + '</td>';
				rateShaperTable +=			'<td title="Packets Normal">' + numberWithCommas(roomStat.rateShaperApp.packetsNormal) + '</td>';
				rateShaperTable +=			'<td title="Packets Retransmit">' + numberWithCommas(roomStat.rateShaperApp.packetsRetransmit) + '</td>';
				rateShaperTable +=			'<td title="Drop Normal">' + numberWithCommas(roomStat.rateShaperApp.dropNormal) + '</td>';
				rateShaperTable +=		'</tr>';
				rateShaperTable += '</table>';
				
				pixelRateTable += '<table class="stats">';
				pixelRateTable +=		'<tr>';
				pixelRateTable +=			'<th></th>';
				pixelRateTable +=			'<th title="Encoder pixelrate pixel/sec">Encode</th>';
				pixelRateTable +=			'<th title="Decoder pixelrate pixel/sec">Decode</th>';
				pixelRateTable +=		'</tr>';
				pixelRateTable +=		'<tr>';
				pixelRateTable +=			'<td>Max</td>';
				pixelRateTable +=			'<td title="Encoder pixelrate pixel/sec">' + numberWithCommas(roomStat.maxEncodePixelRate) + '</td>';
				pixelRateTable +=			'<td title="Decoder pixelrate pixel/sec">' + numberWithCommas(roomStat.maxDecodePixelRate) + '</td>';
				pixelRateTable +=		'</tr>';
				pixelRateTable +=		'<tr>';
				pixelRateTable +=			'<td>CPU</td>';
				pixelRateTable +=			'<td title="Encoder pixelrate pixel/sec">' + numberWithCommas(roomStat.currentCpuEncodePixelRate) + '</td>';
				pixelRateTable +=			'<td title="Decoder pixelrate pixel/sec">' + numberWithCommas(roomStat.currentCpuDecodePixelRate) + '</td>';
				pixelRateTable +=		'</tr>';
				pixelRateTable +=		'<tr>';
				pixelRateTable +=			'<td>Bandwidth</td>';
				pixelRateTable +=			'<td title="Encoder pixelrate pixel/sec">' + numberWithCommas(roomStat.currentBandwidthEncodePixelRate) + '</td>';
				pixelRateTable +=			'<td title="Decoder pixelrate pixel/sec">' + numberWithCommas(roomStat.currentBandwidthDecodePixelRate) + '</td>';
				pixelRateTable +=		'</tr>';
				pixelRateTable += '</table>';
				
				vitalsTable += '<table class="stats">';
				vitalsTable +=		'<tr>';
				vitalsTable +=			'<td>CPU</td>';
				vitalsTable +=			'<td title="CPU %">' + roomStat.cpuUsage + '</td>';
				vitalsTable +=		'</tr>';
				vitalsTable +=		'<tr>';
				vitalsTable +=			'<td>Timestamp</td>';
				vitalsTable +=			'<td title="Timestamp">' + stats.timeStamp + '</td>';
				vitalsTable +=		'</tr>';
				vitalsTable +=		'<tr>';
				vitalsTable +=			'<td>Application Tag</td>';
				vitalsTable +=			'<td title="Application Tag">' + stats.applicationTag + '</td>';
				vitalsTable +=		'</tr>';
				vitalsTable +=		'<tr>';
				vitalsTable +=			'<td>Library Version</td>';
				vitalsTable +=			'<td title="Library Version">' + stats.libraryVersion + '</td>';
				vitalsTable +=		'</tr>';
				vitalsTable +=		'<tr>';
				vitalsTable +=			'<td>Build Tag</td>';
				vitalsTable +=			'<td title="Build Tag">' + stats.buildTag + '</td>';
				vitalsTable +=		'</tr>';
				vitalsTable += '</table>';
				
				sourcesTable += '<table class="stats">';
				sourcesTable +=		'<tr>';
				sourcesTable +=			'<td>Max Dynamic</td>';
				sourcesTable +=			'<td title="Maximum dynamic sources allowed">' + (roomStat.maxVideoSources - roomStat.staticSources) + '</td>';
				sourcesTable +=		'</tr>';
				sourcesTable +=		'<tr>';
				sourcesTable +=			'<td>Static Sources</td>';
				sourcesTable +=			'<td title="Current static sources">' + roomStat.staticSources + '</td>';
				sourcesTable +=		'</tr>';
				sourcesTable +=		'<tr>';
				sourcesTable +=			'<td>Max Sources</td>';
				sourcesTable +=			'<td title="Maximum sources allowed">' + roomStat.maxVideoSources + '</td>';
				sourcesTable +=		'</tr>';
				sourcesTable += '</table>';
			}
		}
		txBandwidthTable = $(txBandwidthTable);
		rxBandwidthTable = $(rxBandwidthTable);
		rateShaperTable = $(rateShaperTable);
		pixelRateTable = $(pixelRateTable);
		vitalsTable = $(vitalsTable);
		sourcesTable = $(sourcesTable);
		
		var vitalsRow = $('<div/>', { id: "Vitals", class: "floatTables" });
		vitalsRow.append("<h1>Vitals</h1>")
			.append(vitalsTable);
			
		var sourcesRow = $('<div/>', { id: "Sources", class: "floatTables" });
		sourcesRow.append("<h1>Sources</h1>")
			.append(sourcesTable);
			
		var pixelRateRow = $('<div/>', { id: "PixelRate", class: "floatTables" });
		pixelRateRow.append("<h1>Pixel Rate</h1>")
			.append(pixelRateTable);

		var rateShaperRow = $('<div/>', { id: "RateShaper", class: "floatTables" });
		rateShaperRow.append("<h1>Rate Shaper</h1>")
			.append(rateShaperTable);
			
		var txRow = $('<div/>', { id: "TX", class: "TX" });
		txRow.append("<h1>TX</h1>")
			.append("<h2>Bandwidth</h2>")
			.append(txBandwidthTable)
			.append("<h2>Video</h2>")
			.append(txVideoTable)
			.append("<h2>Content</h2>")
			.append(txContentTable)
			.append("<h2>Audio</h2>")
			.append(txAudioTable);

		var rxRow = $('<div/>', { id: "RX", class: "RX" });
		rxRow.append("<h1>RX</h1>")
			.append("<h2>Bandwidth</h2>")
			.append(rxBandwidthTable)
			.append("<h2>Video</h2>")
			.append(rxVideoTable)
			.append("<h2>Content</h2>")
			.append(rxContentTable)
			.append("<h2>Audio</h2>")
			.append(rxAudioTable)
			.append("<h2>Dynamic</h2>")
			.append(rxDynamicTable);
		
		
		var jsonRow = $('<div/>', { id: "JsonView" + stats.logLineId, class: "JsonView" });

		output.append(vitalsRow).append(sourcesRow).append(pixelRateRow).append(rateShaperRow).append(txRow).append(rxRow).append("<div class='EndStats'></div>").append(jsonRow);
		
		$("JsonView" + stats.logLineId).JSONView(stats, { collapsed: false });
		
		return output;
	}
	
	function Render(vitals, sendStreams, receiveStreams, audioDebugStreams)  {
		var traceIndex = 0;

		/* Available Resources */
		var availableResources = {x: [], y: [], text: []};
		var availableResourcesIndexes = [];
		var traceIndex = 0;
		// 0 = cpuTrace
		availableResources.x.push(   [vitals["timeStamp"]]);
		availableResources.y.push(   [vitals["cpuUsage"]]);
		availableResources.text.push([]);
		availableResourcesIndexes.push(traceIndex); traceIndex++;
		// 1 = sendBandwidthTrace
		availableResources.x.push(   [vitals["timeStamp"]]);
		availableResources.y.push(   [(Math.min(vitals["currentBandwidthEncodePixelRate"], vitals["maxEncodePixelRate"])/vitals["maxEncodePixelRate"])*100]);
		availableResources.text.push([]);
		availableResourcesIndexes.push(traceIndex); traceIndex++;
		// 2 = receiveBandwidthTrace
		availableResources.x.push(   [vitals["timeStamp"]]);
		availableResources.y.push(   [(Math.min(vitals["currentBandwidthDecodePixelRate"], vitals["maxDecodePixelRate"])/vitals["maxDecodePixelRate"])*100]);
		availableResources.text.push([]);
		availableResourcesIndexes.push(traceIndex); traceIndex++;
		// 3 = encodeCpuTrace
		availableResources.x.push(   [vitals["timeStamp"]]);
		availableResources.y.push(   [(Math.min(vitals["currentCpuEncodePixelRate"], vitals["maxEncodePixelRate"])/vitals["maxEncodePixelRate"])*100]);
		availableResources.text.push([]);
		availableResourcesIndexes.push(traceIndex); traceIndex++;
		// 4 = decodeCpuTrace
		availableResources.x.push(   [vitals["timeStamp"]]);
		availableResources.y.push(   [(Math.min(vitals["currentCpuDecodePixelRate"], vitals["maxDecodePixelRate"])/vitals["maxDecodePixelRate"])*100]);
		availableResources.text.push([]);
		availableResourcesIndexes.push(traceIndex); traceIndex++;
		
		Plotly.extendTraces("availableResources", availableResources, availableResourcesIndexes, 100);
	}
};
