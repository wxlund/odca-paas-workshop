var http = require('http'),
    express = require('express'),
    path = require('path');
    MongoHandle = require('mongodb').MongoClient;
    MongoServer = require('mongodb').Server;
    Collections = require('./collections').collections;

var app = express();
app.set('port', process.env.PORT || 4000); 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

var mongoEnv = {};

if (process.env.VCAP_SERVICES) {
	  var vcap_services = JSON.parse(process.env.VCAP_SERVICES);
	  var parseString = vcap_services.mongolab[0].credentials.uri;
	  var elements = parseString.split(":");
	  var user;
	  var password;
	  var port;
	  var db;
	  var hostname;
	  for (var i = 0; i < elements.length; i++ ) {
		  if (i === 0) {
			  var end = parseString.indexOf("://");
			  var protocol = elements[i];
			  console.log("protocol: " + protocol);
			  
		  } else if (i === 1) {
			  user = elements[i].substring(2, elements[i].length);
			  console.log("user: " + user);
		  } else if (i === 2) {
			  var passEnd = elements[i].indexOf("@");
			  password = elements[i].substring(0, passEnd);
			  console.log("password: " + password);
			  hostname = elements[i].substring(passEnd + 1, elements[i].length);
			  console.log("hostname: " + hostname)
		  } else if (i === 3 ) {
			  end = elements[i].indexOf('/');
			  port = elements[i].substring(0, end);
			  console.log("port: " + port)
			  db = elements[i].substring(end + 1, elements[i].length);
			  console.log("db: " + db)
		  }
  		}
	  mongoEnv = {
			"hostname":hostname,
			"username": user,
			"password" : password,
			"port" : port,
			"db" : db
		}
	} else {
	  mongoEnv = {
	    "hostname":"localhost",
	    "port": 27017,
	    "username":"",
	    "password":"", 
	    "name":"",
	    "db":"test"
	  }
	}


var generate_mongo_url = function(obj) {
	console.log("trace: generate_mongo_url");
	console.log("obj.hostname: " + obj.hostname);
	console.log("obj.username: " + obj.username);
	console.log("obj.password: " + obj.password);
	console.log("obj.port: " + obj.port);
	  if(obj.username && obj.password){
	    return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
	  }
	  else{
	    return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
	  }
	}

var mongourl = generate_mongo_url(mongoEnv);

//Open the connection with database now..
console.log("mongo: " + mongoEnv);
console.log("mongourl: " + mongourl);
console.log("mongo.hostname: " + mongoEnv.hostname);
console.log("mongo.port: " + mongoEnv.port);


var mongohandle = new MongoHandle(new MongoServer(mongoEnv.hostname,mongoEnv.port));
mongohandle.open(function(err,mongohandle){
	if (!err) {
		console.log("Connected to database");
		if(!mongohandle){
			console.error("Oops ! MongoDB is not available..Start it");
			process.exit(1);
		}
		// mongolabs manages database and we have only user rights.
		var db;
		if (process.env.VCAP_SERVICES) {
			console.log("Setting db to CloudFoundry_ri5de6se_mu7oe30a");
			db = mongohandle.db("CloudFoundry_ri5de6se_mu7oe30a");
		} else {
			console.log("Setting db to PaaSWorkshop");
			db = mongohandle.db("PaaSWorkshop");		
		}
		if (mongoEnv.username) {
			db.authenticate(mongoEnv.username, mongoEnv.password, function() {
				if (!err) {
					console.log("Authenticated");
				} else {
					console.log("Error in authentication.");
					console.log(err);
				}
			});
		}
	}
	collections = new Collections(db);
});	
//AT this stage, we do have our DB connectivity established !

var appInstance = {};
var startedAt = new Date();

var describeAppInstance = function() {
	var port;
	var vcapApplication;
	var vcapServices;
	if (process.env.PORT) {
		port = process.env.PORT;
		vcapApplication = JSON.parse(process.env.VCAP_APPLICATION || '{}');
		vcapServices = process.env.VCAP_SERVICES;
		appInstance = {
			"now" : new Date(),
			"port" : app.port,
			"vcapApplication" : vcapApplication,
			"vcapServices" : vcapServices
		}
	} else {
		port = app.port;
		vcapApplication = {
				"instance_id" : "0",
				"instance_index": "0",
				"started_at" : startedAt
		}
		vcapServices = "localhost:27017/PaaSWorkshop";
		appInstance = {
			"now" : new Date(),
			"port" : app.port,
			"vcapApplication" : vcapApplication,
			"vcapServices" : vcapServices
		}
		return appInstance;
	}
}

app.get('/', function (req, res) {
	appInstance = describeAppInstance(); 
	console.log("appInstance.now" + appInstance.now);
	res.render('index', { title: 'PaaS Workshop', now: appInstance.now.toLocaleString(), 
		port: appInstance.port, vcapApplication: appInstance.vcapApplication, 
		vcapServices: appInstance.vcapServices });
});

	


//Get the Collections from Mongo -- Route
app.get('/collections/:collection', function(req, res) { //A
   var params = req.params; //B
   collections.findAll(req.params.collection, function(error, objs) { //C
    	  if (error) { res.send(400, error); } //D
	      else { 
	          if (req.accepts('html')) { //E
	        	  appInstance = describeAppInstance();
    	          res.render('data',{ title: 'data', now:  appInstance.now.toLocaleString(), 
    	        	  port: appInstance.port, 
    	        	  vcapApplication: appInstance.vcapApplication, 
    	        	  vcapServices: appInstance.vcapServices, objects: objs, 
    	        	  collection: req.params.collection}); //F
              } else {
	          res.set('Content-Type','application/json'); //G
                  res.send(200, objs); //H
              }
         }
   	});
});

app.get('/collections/:collection/:entity', function(req, res) { //I
   var params = req.params;
   var entity = params.entity;
   var collection = params.collection;
   if (entity) {
       collections.get(collection, entity, function(error, objs) { //J
          if (error) { res.send(400, error); }
          else { res.send(200, objs); } //K
       });
   } else {
      res.send(400, {error: 'bad url', url: req.url});
   }
});


app.post('/collections/:collection', function(req, res) { //A
    var object = req.body;
    var collection = req.params.collection;
    collections.save(collection, object, function(err,docs) {
          if (err) { res.send(400, err); } 
          else { res.send(201, docs); } //B
     });
});

app.delete('/collections/:collection/:entity', function(req, res) {
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;
    if (entity) {
       collections.delete(collection, entity, function(error, objs) { 
          if (error) { res.send(400, error); }
          else { res.send(200, objs); } 
       });
   } else {
       var error = { "message" : "Cannot DELETE a whole collection" };
       res.send(400, error);
   }
});

app.use(function (req,res) {
    res.render('404', {url:req.url});
});
 
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
