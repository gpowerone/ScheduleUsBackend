const express = require('express')
const bodyParser = require('body-parser')
const massive = require('massive')
const uuidv4 = require('uuid/v4')
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
const pickforuscls = require('./libraries/pickforus')
const twilio = require('twilio')
const awssdk = require('aws-sdk')
const xss = require('xss')

const dbConfig = config.get('ScheduleUs.dbConfig');
const twConfig = config.get('ScheduleUs.twilio');
const rcConfig = config.get('ScheduleUs.recaptcha');
const evConfig = config.get('ScheduleUs.evConfig');

awssdk.config.update({region: 'us-east-1'})

massive({  
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password,
}).then(db => {

  var objs={
    aws: awssdk,
    utilityobj: new utilitycls(),
    sessionobj: new sessioncls(db),
    clientobj: new clientcls(db, rcConfig),
    eventsobj: new eventscls(db),
    pickobj: new pickforuscls(db),
    messageobj: new messagecls("+12406410911", new twilio(twConfig.sid, twConfig.token)),
    request: request,
    bcrypt:bcrypt,
    uuidv4: uuidv4,
    uuidvalidate: uuidvalidate,
    envURL: evConfig.envURL,
    xss: xss
  }

  objs.utilityobj._setObjs(objs);
  objs.sessionobj._setObjs(objs);
  objs.clientobj._setObjs(objs);
  objs.eventsobj._setObjs(objs);
  objs.messageobj._setObjs(objs);
  objs.pickobj._setObjs(objs);

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
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Credentials', true)
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next()
  })

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

  app.post('/accountrecsec', function(req, res) {
    try {
      objs.clientobj.accountRecSec(req.body.ClientID, req.body.VerificationCode).then(r=> {
          if (r!==null) {
            res.send({ status: 200, message:r });
          }        
          else {
            res.send({ status: 500, message:"Verification not found" });
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })


  app.post('/accountquestion', function(req, res) {
    try {
        objs.bcrypt.genSalt(10, function(err, psalt) {
          objs.bcrypt.hash(req.body.Passwd, psalt, function(err, _pwhash) {

              objs.clientobj.accountSecurityQuestion(req.body.ClientID,req.body.VerificationCode,req.body.Passwd,req.body.SecAnswer,_pwhash).then(r=> {
                  if (r==="OK") {
                    res.send({ status: 200, message:"OK" });
                  }        
                  else {
                    res.send({ status: 500, message:r });
                  }
              })
              
          })
        })
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/addcomment', function(req, res) {
     try {
        objs.eventsobj.addComment(req.body.EventID, req.body.EventGuestID, req.body.ParentID, req.body.Comment).then(r=> {
          if (r==="OK") {
            res.send({ status: 200, message:"OK" });
          }        
          else {
            res.send({ status: 500, message:r });
          }
        })
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
         res.send({ status: 500, message:"An unexpected error occurred"});
      }
  })

  app.post('/contact', function(req, res) {
      try {
        var r = objs.clientobj.contact(req.body);
        if (r==="OK") {
          res.send({ status: 200, message:"OK" });
        }        
        else {
          res.send({ status: 500, message:r });
        }      
      }
      catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred"});
      }
  })

  app.post('/createaccount', function (req, res)
  {
      try {
        objs.clientobj.verifyCaptcha(req.body.recaptchaToken).then(re => {
           if (re==="OK") {

            var msg = objs.clientobj.verify(req.body.FirstName,req.body.LastName,req.body.Phone,req.body.Passwd);
            if (msg==="OK")
            {
                var sPhone=objs.utilityobj.standardizePhone(req.body.Phone);
                if (sPhone!=="NotOK")
                {
                    objs.clientobj.getClientByPhone(sPhone).then(rvp=> {
                      if (rvp===null)
                      {
                          objs.bcrypt.genSalt(10, function(err, psalt) {
                              objs.bcrypt.hash(req.body.Passwd, psalt, function(err, _hash) {
                                  objs.bcrypt.genSalt(10, function(err, salt) {
                                      objs.bcrypt.hash(req.body.SecAnswer, salt, function(err, _sechash) {
                                          objs.clientobj.create(req.body.FirstName, req.body.LastName, sPhone, req.body.SecQuestion, _hash, _sechash).then(r=> 
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
     
        objs.eventsobj.createEvent(req).then(r => {
            if (r==="OK") {
               res.send({ status: 200, message:"OK" });
            }
            else {
               res.send({ status: 500, message:r });
            }
        })     
      
     }
     catch(e) {
         console.log(e);
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

  app.post('/dorsvp', function(req, res) {
     try {
         objs.eventsobj.doRSVP(req.body.EventID, req.body.EventScheduleID, req.body.rsvp, req.body.me).then(r=> {
            if (r==="OK") {
              res.send({ status: 200, message:"OK" });
            }        
            else {
              res.send({ status: 500, message:r });
            }
         })
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
                        FirstName: c.FirstName==null?"":xss(c.FirstName),
                        LastName: c.LastName==null?"":xss(c.LastName),
                        Address: c.Address==null?"":xss(c.Address),
                        City: c.City==null?"":xss(c.City),
                        State: c.State==null?"":xss(c.State),
                        PostalCode: c.PostalCode==null?"":xss(c.PostalCode),
                        PhoneNumber: xss(c.PhoneNumber),
                        EmailAddress: c.EmailAddress==null?"":xss(c.EmailAddress),
                        IsPremium: c.IsPremium==null?false:xss(c.IsPremium),
                        IsPro: c.IsPro==null?false:xss(c.IsPro)                        
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
        res.send({ status: 500, message:"An unexpected error occurred"});
     }
  })

  app.post('/getevents', function(req, res) {
    try {
      objs.sessionobj.verify().then(r=> {
         if (r!==null) {
            objs.eventsobj.getEventsForClient().then(r=> {
                if (r!==null) {
                    res.send({ status: 200, message:xss(JSON.stringify(r))}); 
                }
                else {
                    res.send({ status: 500, message:"An unexpected error occurred"}); 
                }
            })
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

  app.post('/geteventbyhash', function(req, res) {
      try {
         objs.eventsobj.getEventByHash(req.body.hsh,req.body.me,req.body.mic).then(r=> {
            if (r!==null) {
                res.send({ status: 200, message:xss(JSON.stringify(r))}); 
            }
            else {
                res.send({ status: 500, message:"An unexpected error occurred"}); 
            }
         });
      }
      catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred"});
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
            phone=objs.utilityobj.standardizePhone(phone);
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

  app.post('/pickforus', function(req,res) {
      try {
          var r = objs.pickobj.doPickForUs(req.body);
          if (r===null) {
             res.send({ status: 200, message:"N"});
          }
          else {
             res.send({ status: 200, message:JSON.stringify(r)});
          }
      }
      catch(e) {
         console.log(e);
         res.send({ status: 500, message:"An unexpected error occurred"});
      }
  });

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

  app.post('/setemail', function(req, res) {
    try {
      objs.clientobj.setEmail(req.body.EmailAddress).then(s=> {
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
  });

  app.post('/verifyemail', function(req, res) {
      try {
        objs.clientobj.verifyEmail(req.body.ClientID, req.body.VerificationCode).then(r=> {
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

  app.listen(process.env.PORT || 80, () => console.log(`Schedule Us has started`))
});
