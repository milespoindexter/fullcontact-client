FullContact Mgmt Service
2014-02-05
Miles Poindexter
selfpropelledcity@gmail.com

Written in NodeJS

START:
cd /path/to/fullcontactApp/
nohup node fullContactServer.js > fullcontact.log &

SUMMARY:
Monitors a folder for files of email lists in JSON. Uses FullContact API to request data for each email in list.
Writes date to files.
There is also a HTTP POST API that should should be limited to small (under 500 emails) batches.
This service needs to talk to a MongoDB server to function.
For application settings see: fcSettings.js

DISCLAIMER:  This is one of my first NodeJS apps. There's room for lots of improvement and please feel free to use this and improve it.


Directory Service:
Example content of email list file:
{"batchId": 233, "emails": [ 
	{"email": "miles@spc.com","id": "12345"}, 
	{"email": "test@test.com","id": "23789"}
]}


HTTP POST Service:
URL: http://localhost:2950/fullcontact/json/emails

example POST body:
{"batchId": 233, "emails": [ 
	{"email": "miles@spc.com","id": "12345"}, 
	{"email": "test@test.com","id": "23789"}
]}

_________________________________________________________________
STEPS:
REST SERVICE:
Service has a limited JSON web service (500 email limit)

FILE SERVICE:
For bigger batches, service will watch folder for new JSON files: /app/fullcontact/requests/

PROCESS:
Email array is created from loaded file
Emails are stored as documents in a collection named after the batch number.
i.e. emails for batch 123 stored in collection called batch123.

Name of collection is stored in another collection, with date loaded,
and status=processing. 
When batch is finished, This doc will get appended with finish date, and status=done


EMAIL FC SERVICE:
This periodically processes emails. Each query will only grab emails from one batch.
First it queries the batch collection to find the oldest unfinished batch.
Then it loads docs from that batch collection.
Loops through list:
	1.loads xml from 200 and 404 responses to a file.
	File is saved and new one created after it gets 1000 responses.
	Files (regular and 404) will be rotated also if the service detects a new batchId.

	2. updates email object in db with status, batchId, 
	and optionally: fullContactProfile and retry.


202 SERVICE:
This peridically searches the collection for emails ready to be retried.
First it queries the batch collection to find the oldest unfinished batch.
Then it loads docs with status=202, and retry <= now, from that batch collection.

FILE OUTPUT:
Creates a new file after 1,000 email profiles have been added.
All 404 responses go into a SEPARATE XML file.
Finished files go into a finished file folder.


ROOT FILE PATH WHERE Files stored:
/app/fullcontact/

_______________________________________________________________________
Full Contact INFO:

Sandbox API Key is a great place to start. You can get one here:
http://www.fullcontact.com/sign-up/

Developer Docs:
http://www.fullcontact.com/developer/docs/

API Code Libraries:
http://www.fullcontact.com/developer/docs/libraries/


Examples:
https://api.fullcontact.com/v2/person.json?email=bart@fullcontact.com&apiKey=???

