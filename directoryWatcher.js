#!/usr/bin/env node

/*
This will watch for files being added to the directory.
Files added will be read and all emails processed.
Then file will be moved to "done" directory
*/
var fs = require('fs');

var settings = require("./fcSettings");
var dateUtils = require('../dateUtils');
var fullContactMgr = require("./fullContactMgr");

var emailsProcessed = 0;


exports.startWatching = function() {
	console.log("directoryWatcher watching for files in: " + settings.REQUEST_PATH);
	
	// Watch the sim directory
	fs.watch(settings.REQUEST_PATH, { persistent: true }, function (event, fileName) {
		console.log("directoryWatcher Event: " + event);
		if (fileName) {
		  	//console.log("directoryWatcher file: " + fileName + "\n");
		  	if(event === "rename") {
		  		//check if file is there, since this event also fires when
		  		//files are REMOVED from the watched directory!!
		  		fs.exists(settings.REQUEST_PATH+fileName, function (exists) {
		  			if(exists) {
		  				//wait some minutes to make sure file is fully uploaded . . .
				  		console.log("waiting "+settings.FILE_LOAD_DELAY+" seconds(s) before loading FC emails");
				  		dateUtils.sleepBlock(settings.FILE_LOAD_DELAY);
				  		
				  		fs.readFile(settings.REQUEST_PATH+fileName, function(err, contents) {
				  			if(!err) {
				  				var emailsJson = JSON.parse(contents);
				  				var emailList = emailsJson.emails;
				  				var emailCount = emailList.length;
				  				var batchId = emailsJson.batchId;

				  				//console.log(emailCount + " emails found in file: "+fileName);						
								
								if(emailCount > 0) {
									if(!batchId) {
										var emailObj = emailList[0];
										batchId = emailObj.batchId;
									}
									
									fullContactMgr.addEmails(batchId, emailList, function(err, collectionName) {
										console.log(emailCount+" emails added to "+collectionName);

										//move file to finished dir
									    try {
									    	fs.renameSync(settings.REQUEST_PATH + fileName, settings.FINISHED_REQ_PATH + fileName);
									    }
									    catch(fsErr) {
									    	return console.log("could not move finished request file "+fileName+": ",fsErr);
									    }

									});
								}
						  	}
						  	else {
						  		return console.log("file watcher error: "+err);
						  	}
				  		});

		  			}
		  		});
		  	}
		}
	});  
    
}


	
