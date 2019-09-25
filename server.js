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
const googleplaces = require("googleplaces");
const GoogleGeocoder = require('google-geocoder');

const dbConfig = config.get('ScheduleUs.dbConfig');
const twConfig = config.get('ScheduleUs.twilio');
const rcConfig = config.get('ScheduleUs.recaptcha');
const evConfig = config.get('ScheduleUs.evConfig');
const googConfig = config.get('ScheduleUs.googConfig');

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
    messageobj: new messagecls("+12036354194", new twilio(twConfig.sid, twConfig.token)),
    request: request,
    bcrypt:bcrypt,
    uuidv4: uuidv4,
    uuidvalidate: uuidvalidate,
    envURL: evConfig.envURL,
    xss: xss,
    googleplaces: new googleplaces(googConfig.apiKey, "json"),
    geocoder: new GoogleGeocoder({
        key: googConfig.mapsKey
    })
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

  app.post('/addguest', function(req, res) {
    try {
       var guestobj={
          gname: req.body.gname,
          gphone: req.body.gphone,
          gemail: req.body.gemail,
          greq:false
       };
       var vg = objs.eventsobj.verifyGuest(guestobj); 

       if (vg==="OK") {
         objs.sessionobj.verify().then(c=> {
            objs.eventsobj.getEventById(req.body.EventID).then(e=> {
                if (e.GuestsCanBringOthers===true && e.ActionReq>0) {

                  for(var eg=0; eg<e.Guests.length; eg++) {
                    
                    if ((c!==null && e.Guests[eg].ClientID===c) || 
                        (guestobj.gphone!==null && guestobj.gphone!=="Not Specified" && e.Guests[eg].PhoneNumber===guestobj.gphone) || 
                        (guestobj.gemail!==null && guestobj.gemail!=="Not Specified" && e.Guests[eg].EmailAddress===guestobj.gemail)) {
                       res.send({ status: 500, message:"This person has already been added to the event/activity" });
                       return;
                    }
                  }

                  objs.eventsobj.addGuest(req.body.EventID, guestobj, false, c===null?null:c).then(r=> {
                      if (r!==null) {
                        objs.eventsobj.addScheduledGuest(e.Schedules[0].EventScheduleID, r.EventGuestID).then(egs=> {
                            if (e.NotifyWhenGuestsAccept===true) {
                                objs.messageobj.sendMessage(e.CreatorPhone,"New attendee "+guestobj.gname+" RSVPed to your event/activity "+e.EventName);
                            }
                            res.send({ status: 200, message:"OK" });
                        })
                      }        
                      else {
                        res.send({ status: 500, message:r });
                      }
                    })
                }
              });
          })
      }
      else {
        res.send({ status: 500, message: vg});
      }
    }
    catch(e) {
     console.log(e);
     res.send({ status: 500, message:"An unexpected error occurred"});
    }
 })

  app.post('/changenumber', function(req, res) {
    try {
      objs.clientobj.changeNumber(req.body.Passwd, req.body.PhoneNumber).then(r=> {
          if (r==="OK") {
            res.send({ status: 200, message:r });
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
         var msg = objs.clientobj.verify("test","test","999-999-9999",req.body.passwd);
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
        res.send({status:500, message:"New account creation disabled"});
        return;

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
            if (typeof(r)!=="undefined" && r!==null && (r==="OK" || r.indexOf("?e=")>-1)) {
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

  app.post('/locationfinder', function(req, res) {
     try {
         if (req.body.PickLocation===true) {
       
            objs.geocoder.find(req.body.Geocode, function(err,r) {

                objs.eventsobj.locationFinder(req.body.Place, [r[0].location.lat,r[0].location.lng], req.body.Keyword, function(error,response) {
                  response.foundCoords=[r[0].location.lat,r[0].location.lng];
                  res.send({ status: 200, message:JSON.stringify(response) })
                });
            });
         }
         else {
            objs.eventsobj.locationFinder(req.body.Place, req.body.Coords, req.body.Keyword, function(error,response) {
              res.send({ status: 200, message:JSON.stringify(response) })
            });
         }
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

  app.post('/suggestnewlocation', function(req, res) {
    try {
       objs.eventsobj.suggestNewLocation(req.body.EventID, req.body.EventGuestID, req.body.Location, req.body.Address, req.body.City, req.body.State, req.body.PostalCode).then(r=>{
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

  app.post('/suggestnewtime', function(req, res) {
    try {
       objs.eventsobj.suggestNewTime(req.body.EventID, req.body.EventGuestID, req.body.EvTime).then(r=>{
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

  app.post('/verifyphone', function(req, res) {
    try {
      objs.eventsobj.verifyPhoneConfirm(req.body.EventID, req.body.Hash).then(r=> {
          if (r!=="Fail") {
            res.send({ status: 200, message:r });
          }        
          else {
            res.send({ status: 500, message:"Fail" });
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
})

  app.listen(process.env.PORT || 80, () => console.log(`Schedule Us has started`))
});
