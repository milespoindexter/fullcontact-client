#!/usr/bin/env node

var express = require('express');
var fullContactMgr = require('./fullContactMgr');
var directoryWatcher = require("./directoryWatcher");
var fcEmailMgr = require('./fcEmailMgr');
var batchMonitor = require('./batchMonitor');
var settings = require("./fcSettings");
 
var app = express();

app.configure(function () {
    app.use(express.logger('dev'));     /* 'default', 'short', 'tiny', 'dev' */
    app.use(express.bodyParser());
});

app.post(settings.SVC_PATH, fullContactMgr.emailsJson);


app.listen(settings.SVC_PORT);
console.log('FullContact Manager Listening on port '+settings.SVC_PORT);

//start the engines that will process the emails on the queue . . .
directoryWatcher.startWatching();
fcEmailMgr.processEmails();
batchMonitor.monitorBatches();

