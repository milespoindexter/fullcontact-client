#!/usr/bin/env node

//settings for the FullContact Mgmt Service

//port service will listen on
var SVC_PORT = 2950;
var SVC_PATH = "/fullcontact/json/emails";

//Full Contact API Key needed for requests.
var API_KEY = "123456abcdefg";   //Your Full Contact Account API key

//path where JSON request files will be put for processing by service
var REQUEST_PATH = "/app/fullcontact/requests/";
//path where JSON request files will be moved to after processing by service
var FINISHED_REQ_PATH = "/app/fullcontact/finishedRequests/";


//path where xml files will be built
var APPEND_PATH = "/app/fullcontact/append/";
//path where finished xml files can be retrieved
var FINISHED_PATH = "/app/fullcontact/finished/";
//xml files for all other responses begin with this
var FILE_NAME = "fullContactEmailProfiles_";
//xml files with 404 responses begin with this 
var FILE_404 = "fullContactEmail404_";


//how many emails to append before creating new file
var EMAILS_PER_FILE = 1000; 

/*
 * How long to pause before making another FullContact request IN MILLISECONDS:
 * specify sleep time in milliseconds:
 * (1 second is 1,000 milliseconds)
 * Maximum requests allowed by FullContact: 10 requests/second, i.e. 600 requests / minute
 * so lowest wait time allowed would be 100 milliseconds
 * Currently set to 150 milliseconds, or approx 6.5 requests / second.
 */
var FC_WAIT = 150;  //MILLISECONDS

//how many minutes service will wait before re-checking an email that recieved a 202 status
var RECHECK_WAIT = 2;  //TESTING
//var RECHECK_WAIT = 15; //minutes

//delay between queries to db for emails to process, in milliseconds
var EMAIL_QUERY_DELAY = 2 * 60 * 1000; //TESTING
//var EMAIL_QUERY_DELAY = 3 * 60 * 1000;

//delay before loading new xml file, in seconds 
//to ensure all data is there in case SFTP connection is slow for example
var FILE_LOAD_DELAY = 0;  //TESTING
//var FILE_LOAD_DELAY = 60;  //seconds

//delay between queries to check if any batches have completed processing
var BATCH_CHK_DELAY = 1 * 60 * 1000; //TESTING
//var BATCH_CHK_DELAY = 7 * 60 * 1000;

/********   Make the vars available to other objects   *********/
exports.SVC_PORT = SVC_PORT;
exports.SVC_PATH = SVC_PATH;
exports.API_KEY = API_KEY;
exports.REQUEST_PATH = REQUEST_PATH;
exports.FINISHED_REQ_PATH = FINISHED_REQ_PATH;
exports.APPEND_PATH = APPEND_PATH;
exports.FINISHED_PATH = FINISHED_PATH; 
exports.FILE_NAME = FILE_NAME;
exports.FILE_404 = FILE_404;
exports.EMAILS_PER_FILE = EMAILS_PER_FILE;
exports.FC_WAIT = FC_WAIT;
exports.RECHECK_WAIT = RECHECK_WAIT;
exports.EMAIL_QUERY_DELAY = EMAIL_QUERY_DELAY;
exports.FILE_LOAD_DELAY = FILE_LOAD_DELAY;
exports.BATCH_CHK_DELAY = BATCH_CHK_DELAY;
/*****************************************************************/

