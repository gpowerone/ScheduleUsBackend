const express = require('express')
const bodyParser = require('body-parser')
const massive = require('massive')
const uuidv1 = require('uuid/v1')
const config = require('config')
const bcrypt = require('bcrypt')
const cors = require('cors')
const uuidvalidate = require('uuid-validate')
const eventscls = require('./events')
const utilitycls = require('./utility')
const clientcls = require('./client')
const sessioncls = require('./session')

const dbConfig = config.get('ScheduleUs.dbConfig');

massive({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password,
}).then(db => {

  const utilityobj = new utilitycls();
  const sessionobj = new sessioncls(db, utilityobj, uuidv1);
  const clientobj = new clientcls(db, bcrypt, utilityobj, sessionobj); 
  const eventsobj = new eventscls(db,  utilityobj, clientobj, sessionobj, uuidv1, uuidvalidate);


	var app = express()
	app.use(bodyParser.json())
  app.use(cors())

  app.post('/accountrecovery', function(req, res) {
    try {
      clientobj.accountRecovery(req.PhoneNumber).then(r=> {
          if (r) {
            res.send({ status: 200, message:"OK" });
          }        
          else {
            res.send({ status: 500, message:"An unexpected error occurred" });
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.get('/accountquestion', function(req, res) {
    try {
      clientobj.accountSecurityQuestion(req.secanswer).then(r=> {
          if (r!==null) {
            res.send({ status: 200, message:"OK" });
          }        
          else {
            res.send({ status: 500, message:"An unexpected error occurred" });
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/createaccount', function (req, res)
  {
      try {
        clientobj.create(req.Phone, req.Passwd, req.SecQuestion, req.SecAnswer).then(r=> {
            if (typeof(r)==="object") {
              res.send({ status: 200, message:"OK" });
            }
            else if (r===null) {
              res.send({ status: 500, message:"An unspecified error occurred"});
            }
            else {
              res.send({ status: 500, message:r });
            }
        });
      }
      catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred"});
      }
  })

	app.post('/createevent', function (req, res) 
  {
     try {
        constmsg = validateEvent(req);

        if (msg=="OK") {
            eventsobj.createEvent(req).then(r => {
                res.send({ status: 200, message:"OK" });
            })     
        }
        else {
            res.send({ status: 500, message:msg });
        }
     }
     catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred"});
     } 
  })

  app.post('/login', function(req, res) {
    try {
        var phone=req.Phone;
        var email=null;
        if (phone.indexOf("@")>-1) {
            email=phone;
            phone=null;
        }

        var stat = clientobj.login(phone, req.Passwd, email);
        res.send({ status: stat==="OK"?200:500, message:stat});
    }
    catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/myevents', function(req, res) {
     try {
        var eventsPage = {
          
        }
     }
     catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred"});
     }
  })
  
  app.post('/pullevents', function(req, res) {

  })

  app.post('/updateevent', function(req, res) {

  })

  app.post('/verifyaccount', function(req, res) {
    try {
      clientobj.accountVerify(req.ClientID, req.VerificationCode).then(r=> {
          if (r) {
            res.send({ status: 200, message:"OK" });
          }        
          else {
            res.send({ status: 500, message:"An unexpected error occurred" });
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.listen(3000, () => console.log(`Schedule Us has started`))
});
