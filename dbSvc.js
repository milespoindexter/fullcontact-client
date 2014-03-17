#!/usr/bin/env node

var dateUtils = require('../dateUtils');

var MongoClient = require('mongodb').MongoClient;
//Server = require('mongodb').Server;

var fcDb;

var DB_NAME = "fullcontact";
var DB_URL = 'mongodb://127.0.0.1:27017/fullcontact';

//DB collection names
//name of the MongoDB collection tracking email batches
var BATCHES = "emailBatches";
var RETRIES = "retries";
var PROFILES = "profiles";

//property names for email documents in MongoDB
var EMAIL = "email";
var BATCH_ID = "batchId";
var ADDED = "added";
var LOADED = "loaded";
var STATUS = "status";
var PREV_STATUS = "previousStatus";
var RETRY = "retry";
var DOC_ID = "_id";
var FC_RESPONSE = "fullContactResponse";
var ATTEMPTS = "attempts";
var PROCESSED = "processed";


//possible values for the status property of an email doc
var PROCESSING = "processing";
var DONE = "done";

//text that will be prepended to collection names for each batch
var COLLECTION_PRE = "batch";

var RESULT_LIMIT = 25000;


/********   Make the vars available to other objects   *********/
exports.DB_NAME = DB_NAME;
exports.DB_URL = DB_URL;
exports.BATCHES = BATCHES;
exports.RETRIES = RETRIES;
exports.PROFILES = PROFILES;
exports.EMAIL = EMAIL;
exports.BATCH_ID = BATCH_ID;
exports.ADDED = ADDED;
exports.LOADED = LOADED;
exports.RETRY = RETRY;
exports.STATUS = STATUS;
exports.PREV_STATUS = PREV_STATUS;
exports.DOC_ID = DOC_ID;
exports.FC_RESPONSE = FC_RESPONSE;
exports.ATTEMPTS = ATTEMPTS;
exports.PROCESSED = PROCESSED;
exports.PROCESSING = PROCESSING;
exports.DONE = DONE;
exports.COLLECTION_PRE = COLLECTION_PRE;
/*****************************************************************/

function removeEmailCb(conErr, db, emailId) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var query = {};
    query[DOC_ID] = emailId;

    db.collection(RETRIES, function(err, collection) {
        if(!err) {
            //console.log("removing email: "+emailId);
            collection.remove(query, function(remErr, result) {
                if(remErr) {
                    return console.log("error removing email: "+remErr);
                }
            });
        }
        else {
            return console.log(err);
        }
    }); 
}

function getRetryEmailsCb(conErr, db, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    //{retry: {$lte: new Date()}}
    var query = {};
    query[STATUS] = 202;
    query[RETRY] = {$lte: new Date()};

    db.collection(collectionName, function(err, collection) {
        
        if(!err) {
            //console.log("executing query: "+JSON.stringify(query));
            collection.find(query).toArray(function(queryErr, docs) {
                if(queryErr) {
                    console.log("error with mongo query: "+queryErr);
                    return cb(queryErr);
                }
                else {
                    //console.log("returning: "+docs);
                    return cb(null, docs);
                    
                }
            });
        }
        else {
            console.log("error accessing "+RETRIES+" collection: "+err);
            return cb(err);
        }
        
    });
}

//select emails from this batchId collection where status is 0 or 202 or 403
function getUnFinishedEmailsCb(conErr, db, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var q1 = {};
    q1[STATUS] = 202;
    var q2 = {};
    q2[STATUS] = 0;
    var q3 = {};
    q3[STATUS] = 403;
    var query = {};
    query['$or'] = [q1, q2, q3];

    //var query = { $or: [ {status: 202}, {status: 0}, {status: 403} ] };

    db.collection(collectionName, function(err, collection) {
        
        if(!err) {
            //console.log("executing query: "+JSON.stringify(query));
            collection.find(query).toArray(function(queryErr, docs) {
                if(queryErr) {
                    console.log("error with mongo query: "+queryErr);
                    return cb(queryErr);
                }
                else {
                    //console.log("returning: "+docs);
                    return cb(null, docs);
                    
                }
            });
        }
        else {
            console.log("error accessing "+collectionName+" collection: "+err);
            return cb(err);
        }
        
    });
}



function addItemCb(conErr, db, item, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    //add current date to item
    var d = dateUtils.today();
    //console.log("adding todays date: "+d);
    item[ADDED] = d;
    //console.log('Adding item: ' + JSON.stringify(item));
    
    db.collection(collectionName, function(err, collection) {
        collection.insert(item, {safe:true}, function(insertErr, result) {
            if (insertErr) {
                return cb(insertErr);
            } else {
                //console.log('Success: ' + JSON.stringify(result[0]));
                return cb(null, result[0]);
            }
        });
    });
}

function addItemsCb(conErr, db, itemList, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var i = 0;
    for (i = 0; i < itemList.length; i++) {
        //console.log("adding msg to DB collection: "+JSON.stringify(itemList[i]));
        addItem(itemList[i], collectionName, function(err, result) {
            if (err) {
                console.log("error adding item: ", err);
                return cb(err);
            } else {
                //console.log('Success: ' + JSON.stringify(result));
                
            }
        });

    }

    return cb(null, i);

}

function deleteItemCb(conErr, db, id, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var query = {};
    query[DOC_ID] = new BSON.ObjectID(id);

    db.collection(collectionName, function(err, collection) {
        collection.remove(query, {safe:true}, function(remErr, result) {
            if (remErr) {
                return cb(remErr);
            } else {
                //console.log('' + result + ' item deleted');
                return cb(null, result);
            }
        });
    });
}

function findItemsCb(conErr, db, key, val, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var query = { };
    query[key] = val;
    console.log("searching: "+JSON.stringify(query));
    
    db.collection(collectionName, function(err, collection) {
        collection.find(query).toArray(function(findErr, docs) {
            if(!findErr) {
                return cb(null, docs);
            }
            else {
                return cb(findErr);
            }
        });
    });

}

function findProcessingBatchesCb(conErr, db, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var query = {};
    query[STATUS] = PROCESSING;

    //console.log("searching: "+JSON.stringify(query));
    
    db.collection(BATCHES, function(err, collection) {
        collection.find(query).toArray(function(findErr, docs) {
            if(!findErr) {
                return cb(null, docs);
            }
            else {
                console.log("error getting batches in progress: "+findErr);
                return cb(findErr);
            }
            
        });
    });

}

//db.emailBatches.find({status: 'processing'}).sort({loaded: 1})
function findOldestBatchCb(conErr, db, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var query = {};
    query[STATUS] = PROCESSING;
    
    //console.log("searching: "+JSON.stringify(query));
    //.sort({loaded: 1},
    try {
        db.collection(BATCHES, function(err, collection) {
            collection.find(query).toArray(function(findErr, docs) {
                if(!findErr && docs) {
                    //console.log("oldest batch: "+docs[0][BATCH_ID]);
                    return cb(null, docs[0]);
                }
                else {
                    return cb(findErr);
                }
                
            });
        });
    }
    catch(fsErr) {
        return console.log("error trying to get oldest batchId: ", fsErr);
    }
}

//get emails with status 202 and retry date earlier than now,
//and emails with status of 0 or 403
function getUnprocessedEmailsCb(conErr, db, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    //var query = {};
    //query[STATUS] = 0;
    //var query = {status: 202, retry: {$lte: new Date()}};

    var q1 = {};
    q1[STATUS] = 202;
    q1[RETRY] = {$lte: new Date()};
    var q2 = {};
    q2[STATUS] = 0;
    var q3 = {};
    q3[STATUS] = 403;
    var query = {};
    query['$or'] = [q1, q2, q3];

    //var query = { $or: [ {status: 202, retry: {$lte: new Date()}}, {status: 0}, {status: 403} ] };
    //console.log("searching: "+JSON.stringify(query));
    
    db.collection(collectionName, function(err, collection) {
        //collection.find(query).toArray(function(findErr, docs) {
        collection.find(query, {}, { limit : RESULT_LIMIT }).toArray(function(findErr, docs) {
            return cb(null, docs);
        });
    });

}

function updateEmailCb(conErr, db, email, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var query = { };
    query[DOC_ID] = email[DOC_ID];

    var modEmail = {};
    var updates = {};

    
    updates[STATUS] = email[STATUS];
    if(email[PREV_STATUS]) {
        updates[PREV_STATUS] = email[PREV_STATUS];
    }
    if(email[FC_RESPONSE]) {
        updates[FC_RESPONSE] = email[FC_RESPONSE];
    }
    if(email[RETRY]) {
        updates[RETRY] = email[RETRY];
    }
    if(email[BATCH_ID]) {
        updates[BATCH_ID] = email[BATCH_ID];
    }
    
    modEmail['$set'] = updates;

    //increment the attempts field by 1
    var incs = {};
    incs[ATTEMPTS] = 1;
    modEmail['$inc'] = incs;

    //console.log("updating email: "+email[DOC_ID]);
    
    db.collection(collectionName, function(err, collection) {
        
        collection.update(query, modEmail, function(err, doc) {
            if(!err) {
                return cb(null, doc);
            }
            return cb(err);
            
        });
    });
    
      
    //db.emailBatches.update({}, {$set: { test1: 'processing', test2: 'cool' }}, { upsert: false, multi: true })

}

function addEmailStatusesCb(conErr, db, collectionName, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    //db.batch155.update({}, {$set: {status: 0}}, {multi: true})
    db.collection(collectionName, function(err, collection) {
        
        collection.update({}, {$set: {status: 0, attempts: 0}}, {multi: true}, function(err, doc) {
            if(!err) {
                return cb(null);
            }
            return cb(err);
        });
    });

}

function setBatchDoneCb(conErr, db, batchId, cb) {
    if (conErr) { return console.log('CONNECTION ERROR! '+conErr); }

    var searchQuery = {};
    searchQuery[BATCH_ID] = batchId;

    var batchUpdate = {};
    var setObj = {};
    setObj.status = DONE;
    setObj.completed = new Date();
    setObj.finished = dateUtils.today();
    batchUpdate['$set'] = setObj;


    //db.emailBatches.update({}, {$set: {status: 'done', completed: new Date()}}, {multi: true})
    db.collection(BATCHES, function(err, collection) {
        //multi: false tells it to only update one item.
        collection.update(searchQuery, batchUpdate, {multi: false}, function(err, doc) {
            if(!err) {
                return cb(null);
            }
            return cb(err);
        });
    });

}


exports.removeEmail = function(emailId) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return removeEmailCb(err)};
            fcDb = db;
            return removeEmailCb(null, db, emailId);
        });  
    } else {
        return removeEmailCb(null, fcDb, emailId);
    }
    //connect(removeEmailCb);
}

exports.getRetryEmails = function(collectionName, cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return getRetryEmailsCb(err)};
            fcDb = db;
            getRetryEmailsCb(null, db, collectionName, cb);
        });  
    } else {
        getRetryEmailsCb(null, fcDb, collectionName, cb);
    }
    //connect(getRetryEmailsCb);
}

exports.addProfile = function(profile, cb) {
    //console.log('Adding profile: ' + JSON.stringify(profile));
    addItem(profile, PROFILES, cb);
}

var addItem = function(item, collectionName, cb) {

   if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return addItemCb(err)};
            fcDb = db;
            addItemCb(null, db, item, collectionName, cb);
        });  
    } else {
        addItemCb(null, fcDb, item, collectionName, cb);
    }

}


exports.addItems = function(itemList, collectionName, cb) {
    //conErr, db, itemList, collectionName, cb

    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return addItemsCb(err)};
            fcDb = db;
            addItemsCb(null, db, itemList, collectionName, cb);
        });  
    } else {
        addItemsCb(null, fcDb, itemList, collectionName, cb);
    }

}

exports.deleteItem = function(id, collectionName, cb) {
    //conErr, db, id, collectionName, cb
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return deleteItemCb(err)};
            fcDb = db;
            deleteItemCb(null, db, id, collectionName, cb);
        });  
    } else {
        deleteItemCb(null, fcDb, id, collectionName, cb);
    }

}


exports.findItems = function(key, val, collectionName, cb) {
    //conErr, db, key, val, collectionName, cb
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return findItemsCb(err)};
            fcDb = db;
            findItemsCb(null, db, key, val, collectionName, cb);
        });  
    } else {
        findItemsCb(null, fcDb, key, val, collectionName, cb);
    }
}

var findOldestBatch = function(cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return findOldestBatchCb(err)};
            fcDb = db;
            findOldestBatchCb(null, db, cb);
        });  
    } else {
        findOldestBatchCb(null, fcDb, cb);
    }

}

exports.updateEmail = function(email, collectionName, cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return updateEmailCb(err)};
            fcDb = db;
            updateEmailCb(null, db, email, collectionName, cb);
        });  
    } else {
        updateEmailCb(null, fcDb, email, collectionName, cb);
    }

}

exports.addEmailStatuses = function(collectionName, cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return addEmailStatusesCb(err)};
            fcDb = db;
            addEmailStatusesCb(null, db, collectionName, cb);
        });  
    } else {
        addEmailStatusesCb(null, fcDb, collectionName, cb);
    }

}


exports.getUnprocessedEmails = function(collectionName, cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return getUnprocessedEmailsCb(err)};
            fcDb = db;
            getUnprocessedEmailsCb(null, db, collectionName, cb);
        });  
    } else {
        getUnprocessedEmailsCb(null, fcDb, collectionName, cb);
    }
}


exports.findOldestBatchId = function(cb) {
    findOldestBatch( function(err, batch) {
        if(err || !batch) {
            cb(err);
        }
        else {
            console.log('oldest batch ID: '+batch[BATCH_ID]);
            cb(null, batch[BATCH_ID]);
        }
    });
}


exports.findProcessingBatches = function(cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return findProcessingBatchesCb(err)};
            fcDb = db;
            findProcessingBatchesCb(null, db, cb);
        });  
    } else {
        findProcessingBatchesCb(null, fcDb, cb);
    }

}

exports.getUnFinishedEmails = function(collectionName, cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return getUnFinishedEmailsCb(err)};
            fcDb = db;
            getUnFinishedEmailsCb(null, db, collectionName, cb);
        });  
    } else {
        getUnFinishedEmailsCb(null, fcDb, collectionName, cb);
    }

}

exports.setBatchDone = function(batchId, cb) {
    if (fcDb === undefined) {
        //console.log("creating mongodb connection.");
        MongoClient.connect(DB_URL, function(err, db) {

            if(err) { return setBatchDoneCb(err)};
            fcDb = db;
            setBatchDoneCb(null, db, batchId, cb);
        });  
    } else {
        setBatchDoneCb(null, fcDb, batchId, cb);
    }

}


exports.findOldestBatch = findOldestBatch;
exports.addItem = addItem;



