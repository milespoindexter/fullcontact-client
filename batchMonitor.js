#!/usr/bin/env node

var settings = require("./fcSettings");
var dbSvc = require('./dbSvc');
var dateUtils = require('../dateUtils');

var assessBatchStatus = function(bIndex, batch) {
	var batchId = batch.batchId;
	var collectionName = "batch"+batchId;
	console.log("checking for unfinished emails in "+collectionName);
	//select emails from this batchId collection where status is 0 or 202
	dbSvc.getUnFinishedEmails(collectionName, function(listErr, eList) {
		console.log(eList.length+" unfinished emails found for "+collectionName);
		if(!listErr) {
			if(!eList || eList.length === 0) {
				//var dBatchId = cName.substring(5);
				//all emails in this batch finished! Update status of batch object
				dbSvc.setBatchDone(batchId, function(upErr) {
					if(upErr) {
						return console.log("could not update batch object: "+upErr);

					}
					return console.log("Batch "+batchId+" completed: "+new Date().toISOString());
				});
			}
		}
		else {
			return;
		}
	});
}

//periodically checks for batches that are finished processing
exports.monitorBatches = function() {
	console.log("batchMonitor monitoring email batches . . .");
  
  	
    var inter = setInterval(function() {
    	console.log("batchMonitor checking for finished batches");

		dbSvc.findProcessingBatches(function(idErr, batches) {
			if(!idErr) {
				for (var i = 0; i < batches.length; i++) {

					//!function outer(i){
					assessBatchStatus(i, batches[i]);

					//}(i)
				};
				
			}
			else {
				return;
			}
		});

	}, settings.BATCH_CHK_DELAY);
    
}
	
