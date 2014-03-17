#!/usr/bin/env node

var settings = require("./fcSettings");

var fs = require('fs');
var net = require('net');
var dbSvc = require('./dbSvc');

var dateUtils = require('../dateUtils');
var fullContactClient = require("../fullContactClient");

var js2xmlparser = require("js2xmlparser");

var emailsProcessed = 0;
var emailsProcessed404 = 0;

var fileName = settings.FILE_NAME + dateUtils.timeStamp() + ".xml";
var fileName404 = settings.FILE_404 + dateUtils.timeStamp() + ".xml";

var emails202 = new Array();


//if this changes, a new batch is being processed, so we should rotate the xml files,
//so that one file will not have 2 different batches in them
var currentBatchId = null;


process.on('SIGINT', function() {
	try {
		fs.renameSync(settings.APPEND_PATH + fileName, settings.FINISHED_PATH + fileName);
	}
    catch(fsErr) {}

    try {
		fs.renameSync(settings.APPEND_PATH + fileName404, settings.FINISHED_PATH + fileName404);
	}
    catch(fsErr) {}
	
    process.exit(0);
});

process.on('uncaughtException', function(err) {
    console.log('Caught exception: ' + err);
    console.log(err.stack);
});

var server = net.createServer(function (socket) {
    socket.on('error', function(err){
        console.log('Caught socket IO exception: ' + err);
    });
});

var looping = false;

var loopThroughEmails = function(emailList, apiKey, batchId) {
    var i = -1;
    looping = true;

	(function f(){
	    i = (i + 1) % emailList.length;
	    
	    //document.write(stories[ i ] + '<br/>');
	    console.log("processing email "+(i+1)+" of "+emailList.length);
	    var email = emailList[i];
	    email[dbSvc.BATCH_ID] = batchId; //add this just in case we need it
	    var prevStatus = email[dbSvc.STATUS];
	    if(prevStatus > 0) { //this has already been requested. Save status before retry
	    	email[dbSvc.PREV_STATUS] = prevStatus;
	    }

	    getFullContactData(email, apiKey, batchId, function(fcErr, fcEmail) {
			if(fcErr) {
				return console.log("error getting FullContact data for email '"+email[dbSvc.EMAIL]+"': "+fcErr);
			}
			else {
				//now update the email object in the db
				var collectionName = dbSvc.COLLECTION_PRE+batchId;
				//console.log("updating "+fcEmail.email+" from batch: "+batchId);
				dbSvc.updateEmail(fcEmail, collectionName, function(upErr, updatedEmail) {
					if(upErr) {
						return console.log("error updating email after FC request: "+upErr);
					}
				});
			}
			
		});

	    //console.log("comparing i: "+i+" to list length: "+(emailList.length - 1));
		if(i >= (emailList.length - 1)) {
	    	looping = false;
	    	return 'done';
	    }

	    setTimeout(f, settings.FC_WAIT);
	 }) ();
}



exports.processEmails = function() {
	console.log("fcEmailMgr processing FullContact emails . . .");
	
	//function repeatProcess() {
    var inter = setInterval(function() {

    	if(!looping) {
    		console.log("Not looping, so getting new batch of emails . . . ");
    		//find oldest batch ID that is still not complete
			dbSvc.findOldestBatchId(function(idErr, batchId) {
				if(idErr || !batchId) {
					return console.log("problems getting emails from "+collectionName+": "+idErr);
				}
				else {
					var collectionName = dbSvc.COLLECTION_PRE+batchId;
					//select emails from this batchId collection where status < 200
					dbSvc.getUnprocessedEmails(collectionName, function(listErr, eList) {
						if(listErr || !eList || eList.length < 1) {
							return console.log("problems getting emails from "+collectionName+": "+listErr);
						}
						else {
							console.log("found "+eList.length+" emails in "+collectionName);
							//loop through email list and hit FullContact API
							loopThroughEmails(eList, settings.API_KEY, batchId);
						}
						
					});
				}	
			});
    	}
    	else {
    		console.log("still looping through emails . . . ");
    	}
		
		
	}, settings.EMAIL_QUERY_DELAY);
		
  	//	setTimeout(repeatProcess, settings.EMAIL_QUERY_DELAY);
	//}

	//repeatProcess();
}


function testFC(email, apiKey, format, cb) {

	var bartJsonFile = 'test_fc_profiles/bart.json';

	var bart200 = {"status": 200, "requestId": "b8090923-8ea3-4c67-830c-989ee2fab14b"};
	var bart202 = {"status": 202, "requestId": "b8090923-8ea3-4c67-830c-989ee2fab14b"};
	var bart404 = {"status": 404, "requestId": "b8090923-8ea3-4c67-830c-989ee2fab14b"};
	var profiles = [bart200,bart202,bart404];
	
    var random = Math.floor(Math.random() * (2 - 0 + 1)) + 0;
	//console.log("profile "+random+" returned.");
	if(random === 0) {
		try {
			return cb(null, fs.readFileSync(bartJsonFile)); 
		}
		catch(readErr) {
			return cb(readErr);
		}
	}
	else {
		return cb(null, JSON.stringify( profiles[random]));
	}

}


var getFullContactData = function(email, apiKey, batchId, cb) {

	//pre set currentBatchId if it is null
	if(!currentBatchId) {
		currentBatchId = batchId;
	}

	//send this to Full Contact
	testFC(email[dbSvc.EMAIL], settings.API_KEY, "json", function(fcErr, data) {
    //fullContactClient.getData(email[dbSvc.EMAIL], settings.API_KEY, "json", function(fcErr, data) {
    	if(fcErr) {
    		console.log("FC error for email "+email[dbSvc.EMAIL]+": "+fcErr);
    	}
    	else {
    		var fcResponse = JSON.parse(data);
    		//add date this was processed
    		fcResponse[dbSvc.PROCESSED] = dateUtils.today();
    		fcResponse[dbSvc.BATCH_ID] = batchId;
    		fcResponse[dbSvc.EMAIL] = email[dbSvc.EMAIL];

    		var statusCode = fcResponse.status;
    		console.log("statusCode for email "+email[dbSvc.EMAIL]+": "+statusCode);

    		email[dbSvc.STATUS] = statusCode;
    		//add the profile to the email object
	    	email[dbSvc.FC_RESPONSE] = fcResponse;


    		if(statusCode === 202) {
    			//console.log("adding retry time to "+email[dbSvc.EMAIL]);
	    		//add timestamp for next time its OK to check this email
	    		var chkTime = dateUtils.addMinutes(new Date(), settings.RECHECK_WAIT);
	    		//add retry time to JSON object
	    		email[dbSvc.RETRY] = chkTime;
	    		currentBatchId = batchId;
	            return cb(null, email);
	    		
	    	}
	    	else { //any other response code is OK
	    		
	    		//console.log("comparing batches: "+currentBatchId+" to "+batchId);
	    		//if 1,000 emails processed, create new file
	    		if(emailsProcessed >= settings.EMAILS_PER_FILE || currentBatchId !== batchId) {
	    			//move old file to finished folder:
	    			fs.renameSync(settings.APPEND_PATH + fileName, settings.FINISHED_PATH + fileName);
					//console.log('file moved to finished dir: '+settings.FINISHED_PATH+fileName);
					//set the count to zero
					emailsProcessed = 0;

	    			//create new file name for next emails:
	    			fileName = settings.FILE_NAME + dateUtils.timeStamp() + ".xml";;

	    		}
	    		if(emailsProcessed404 >= settings.EMAILS_PER_FILE || currentBatchId !== batchId) {
	    			fs.renameSync(settings.APPEND_PATH + fileName404, settings.FINISHED_PATH + fileName404);
					//console.log('404 file moved to finished dir: '+settings.FINISHED_PATH+fileName404);
					//set the count to zero
					emailsProcessed404 = 0;
	    			//create new file name for next emails:
	    			fileName404 = settings.FILE_404 + dateUtils.timeStamp() + ".xml";;
	    		}
	    		
	    		try {
		    		//transform JSON to XML?
		    		var xmlOptions = {declaration: {include: false}};
		    		var dataXml = js2xmlparser("person", fcResponse, xmlOptions);

		    		//append data to file
		    		var targetFile = settings.APPEND_PATH + fileName;
		    		if(statusCode == 404) {
		    			targetFile = settings.APPEND_PATH + fileName404;
		    		}
	    		
	    			fs.appendFileSync(targetFile, dataXml+"\n\n");
	    			//console.log("FC data appended to "+targetFile);
	            	if(statusCode === 404) {
	            		emailsProcessed404++;
	            		//console.log("emailsProcessed404 = "+emailsProcessed404);
	            		
	            	}
	            	else {
	            		emailsProcessed++;
	            		//console.log("emailsProcessed = "+emailsProcessed);
	            	}
	            	
	            	currentBatchId = batchId;
	            	return cb(null, email);
	    		}
	    		catch(fsErr) {
	    			currentBatchId = batchId;
		            console.log("unable to append email/fullcontact data to "+targetFile+": " + fsErr);
		            console.log(dataXml);
		            return cb(fsErr);
	    		}
	    	}

    	} 
    });
}

exports.getFullContactData = getFullContactData;
exports.loopThroughEmails = loopThroughEmails;
	
