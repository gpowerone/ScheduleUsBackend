const express = require('express')
const bodyParser = require('body-parser')
const massive = require('massive')
const uuidv1 = require('uuid/v1')
const config = require('config')
const bcrypt = require('bcrypt')
const cors = require('cors')
const request = require('request-promise')
const uuidvalidate = require('uuid-validate')
const eventscls = require('./libraries/events')
const utilitycls = require('./libraries/utility')
const clientcls = require('./libraries/client')
const sessioncls = require('./libraries/session')
const messagecls = require('./libraries/message')
const twilio = require('twilio');

const dbConfig = config.get('ScheduleUs.dbConfig');
const twConfig = config.get('ScheduleUs.twilio');
const rcConfig = config.get('ScheduleUs.recaptcha');
const evConfig = config.get('ScheduleUs.evConfig');

massive({  
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password,
}).then(db => {

  var objs={
    utilityobj: new utilitycls(),
    sessionobj: new sessioncls(db),
    clientobj: new clientcls(db, rcConfig),
    eventsobj: new eventscls(db),
    messageobj: new messagecls("+12406410911", new twilio(twConfig.sid, twConfig.token)),
    request: request,
    bcrypt:bcrypt,
    uuidv1: uuidv1,
    uuidvalidate: uuidvalidate,
    envURL: evConfig.envURL
  }

  objs.utilityobj._setObjs(objs);
  objs.sessionobj._setObjs(objs);
  objs.clientobj._setObjs(objs);
  objs.eventsobj._setObjs(objs);
  objs.messageobj._setObjs(objs);

  function sessionHook(req,res,next) {
    try {
      if (req.body.ClientID!==null && req.body.SessionID!==null && req.body.SessionLong!==null) {
         objs.sessionobj.setSession(req.body.ClientID, req.body.SessionID, req.body.SessionLong);
      }
    }
    catch(e) {}

    next()
  }

	var app = express()
	app.use(bodyParser.json())
  app.use(cors())
  app.use(sessionHook);

  app.post('/accountrecovery', function(req, res) {
    try {
      objs.clientobj.accountRecovery(req.body.PhoneNumber).then(r=> {
          if (r!==null) {
            res.send({ status: 200, message:"OK" });
          }        
          else {
            res.send({ status: 500, message:"This account was not found" });
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.get('/accountquestion', function(req, res) {
    try {
      objs.clientobj.accountSecurityQuestion(req.body.secanswer).then(r=> {
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

  app.post('/changenumber', function(req, res) {
    try {
      objs.clientobj.changeNumber(req.body.Passwd, req.body.PhoneNumber).then(r=> {
          if (r==="OK") {
            res.send({ status: 200, message:"OK" });
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

  app.post('/changepassword', function(req, res) {
      try {
         var msg = objs.clientobj.verify("999-999-9999",req.body.passwd);
         if (msg==="OK")
         {
            objs.bcrypt.genSalt(10, function(err, psalt) {
              objs.bcrypt.hash(req.body.npasswd, psalt, function(err, _hash) {
                objs.clientobj.changePassword(req.body.passwd,_hash).then(r=> {
                    if(r==="OK") {
                        res.send({ status: 200, message:"OK" });
                    }
                    else {
                        res.send({ status: 500, message:r });
                    }
                })
              })
            })
         }
         else {
          res.send({ status: 500, message:msg });
         }
      }
      catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred "+e.message});
      }
  })

  app.post('/createaccount', function (req, res)
  {
      try {
        objs.clientobj.verifyCaptcha(req.body.recaptchaToken).then(re => {
           if (re==="OK") {

            var msg = objs.clientobj.verify(req.body.Phone,req.body.Passwd);
            if (msg==="OK")
            {
                var sPhone=objs.clientobj.standardizePhone(req.body.Phone);
                if (sPhone!=="NotOK")
                {
                    objs.clientobj.getClientByPhone(sPhone).then(rvp=> {
                      if (rvp===null)
                      {
                          objs.bcrypt.genSalt(10, function(err, psalt) {
                              objs.bcrypt.hash(req.body.Passwd, psalt, function(err, _hash) {
                                  objs.bcrypt.genSalt(10, function(err, salt) {
                                      objs.bcrypt.hash(req.body.SecAnswer, salt, function(err, _sechash) {
                                          objs.clientobj.create(sPhone, req.body.SecQuestion, _hash, _sechash).then(r=> 
                                          {      
                                                if (r===null) {
                                                  res.send({ status: 500, message:"An unspecified error occurred"});
                                                }
                                                else if (r==="OK") {
                                                  res.send({ status: 200, message:"OK" });
                                                }
                                                else {
                                                  res.send({ status: 500, message:r });
                                                }
                                          });
                                      })
                                  })
                              })
                          })
                      }
                      else {
                        res.send({ status: 500, message: "This account already exists"})
                      }
                    })
                  }
                  else {
                    res.send({ status: 500, message: "Error validating phone number"})
                  }   
              }
              else {
                  res.send({ status: 500, message: msg});
              }

            }
            else {
                  res.send({ status: 500, message: "Failed to verify captcha"});
            }           
        });
      }
      catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred "+e.message});
      }
  })

	app.post('/createevent', function (req, res) 
  {
     try {
        constmsg = validateEvent(req);

        if (msg=="OK") {
          objs.eventsobj.createEvent(req).then(r => {
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

  app.post('/deleteaccount', function(req, res) {
    try {
      objs.clientobj.delete().then(r=> {
          if (r==="OK") {
            res.send({ status: 200, message:"OK" });
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

  app.post('/filladdress', function (req, res) {
    try {
       objs.clientobj.fillAddress(req.body.Street, req.body.City, req.body.State, req.body.PostalCode).then(r=> {
           if (r==="OK") {
               res.send({ status: 200, message:"OK"});
           }
           else {
               res.send({ status: 500, message:r});
           }
       })
    }
    catch(e) {
       res.send({ status: 500, message:"An unexpected error occurred"});
    }
 })

  app.post('/fillname', function (req, res) {
     try {
        objs.clientobj.fillName(req.body.FirstName, req.body.LastName).then(r=> {
            if (r===true) {
                res.send({ status: 200, message:"OK"});
            }
            else {
                res.send({ status: 500, message:"An unexpected error occurred"});
            }
        })
     }
     catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred"});
     }
  })

  app.post('/getclient', function (req, res) {
     try {
         objs.sessionobj.verify().then(r=> {
            if (r!==null) {
                objs.clientobj.getClientByID(req.body.ClientID).then(c => {
                    var cliobj = {
                        FirstName: c.FirstName==null?"":c.FirstName,
                        LastName: c.LastName==null?"":c.LastName,
                        Address: c.Address==null?"":c.Address,
                        City: c.City==null?"":c.City,
                        State: c.State==null?"":c.State,
                        PostalCode: c.PostalCode==null?"":c.PostalCode,
                        PhoneNumber: c.PhoneNumber,
                        EmailAddress: c.EmailAddress==null?"":c.EmailAddress                        
                    }

                    res.send({ status: 200, message:JSON.stringify(cliobj)});
                });
            }
            else {
              res.send({ status: 500, message:"An unexpected error occurred"});
            }
         })
     }
     catch(e) {
        res.send({ status: 500, message:e});
     }
  })

  app.post('/login', function(req, res) {
    try {
        var phone=req.body.Phone;
        var email=null;
        if (phone.indexOf("@")>-1) {
            email=phone;
            phone=null;
        }
        if (phone!==null) {
            phone=objs.clientobj.standardizePhone(phone);
        }

        objs.clientobj.login(phone, req.body.Passwd, email, null).then(s=> {
            if (s!==null) {
                res.send({ status: typeof(s.SessionID)!=="undefined"?200:500, message:s});
            }
            else {
                res.send({ status: 500, message:"Could not create session"});
            }
        });
    }
    catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/logout', function(req, res) {
     try {
         objs.sessionobj.logout(req.body.ClientID, req.body.SessionID).then(r=> {
              return "OK";
         });
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

  app.post('/resendtext', function(req, res) {
    try {
        objs.clientobj.resendText(req.body.ClientID).then(s=> {
            if (s==="OK") {
              res.send({ status: 200, message:"OK" });
            }        
            else {
              res.send({ status: 500, message:s });
            }
        })
    }
    catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/updateevent', function(req, res) {

  })

  app.post('/verifyaccount', function(req, res) {
    try {
      objs.clientobj.verifyAccount(req.body.ClientID, req.body.VerificationCode).then(r=> {
          if (r==="OK") {
            res.send({ status: 200, message:"OK" });
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

  app.listen(3000, () => console.log(`Schedule Us has started`))
});
