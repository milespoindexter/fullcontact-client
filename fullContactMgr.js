#!/usr/bin/env node

var dbSvc = require('./dbSvc');
var dateUtils = require('../dateUtils');

exports.emailsJson = function(request, response) { 

	//get list of emails
	var emailList = request.body.emails;
	var emailCount = emailList.length;
	var batchId = 0;
	
	response.writeHead(200, {'Content-Type': 'application/json'});

	if(emailCount > 0) {
		var emailObj = emailList[0];
		batchId = emailObj.batchId;
		addEmails(batchId, emailList, function(err, collectionName) {
			if(err) {
				return response.end("{ \"error\": \""+err+"\"}");
			}
			
		});
	}
	
	//don't wait for the job to finish adding to the queue. Just return.
	response.end("{ \"emailCount\": \""+emailCount+"\", \"batch\": \""+batchId+"\"}");

};

var addEmails = function(batchId, emailList, cb) {
	//console.log("loading batch ID: "+batchId);
	var collectionName = dbSvc.COLLECTION_PRE + batchId;
	var emailCount = emailList.length;

	addBatchId(batchId, function(err, batchJson) {
		if(!err) {
			addEmailsToDb(emailList, collectionName, function(error, emailCount) {
				if(error) {
					console.log("error adding FC emails to queue: "+error);
					return cb(error);
				}
				else {
					//update all emails with status: 0
					dbSvc.addEmailStatuses(collectionName, function(upErr) {
						if(!upErr) {
							return cb(null, collectionName);
						}
					});
				}
			});
		}
		else {
			return(err);
		}
		
	});
}

var addBatchId = function(batchId, cb) {
	var batchJson = {};
	batchJson[dbSvc.BATCH_ID] = batchId;
	batchJson[dbSvc.ADDED] = dateUtils.today();
	batchJson[dbSvc.LOADED] = new Date();
	batchJson[dbSvc.STATUS] = dbSvc.PROCESSING;
	
	dbSvc.addItem(batchJson, dbSvc.BATCHES, function(err, emailCount) {
		if(err) {
			console.log("error adding batchId: "+err);
			return cb(err);
		}
		else {
			//console.log("Added batchId: "+batchId);
			return cb(null, batchJson);

		}
		
	});
	/*
	db.emailBatches.update({_id: ObjectId("52fed921c059ed5705e1f3e5")}, 
		{$set: {"batchId" : 155, 
		"added" : "2014-2-2014 22:4:1:631", 
		"loaded" : ISODate("2014-02-15T03:04:01.608Z")}})
	*/
}


var addEmailsToDb = function(emailList, collectionName, cb) {
	if(emailList.length > 0) {

		dbSvc.addItems(emailList, collectionName, function(err, emailCount) {
			if(err) {
				console.log("error adding emails to collection "+collectionName+": "+err);
				return cb(err);
			}
			else {
				//console.log("Added "+emailCount+" emails to collection "+collectionName);
			}
			return cb(null, emailCount);
		});
	}
	else {
		return cb(null, 0);
	}
	
}

exports.addEmails = addEmails;
exports.addBatchId = addBatchId;

