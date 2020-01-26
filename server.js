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
const axios = require('axios')
const googleplaces = require("googleplaces");
const GoogleGeocoder = require('google-geocoder');
const jimp = require('jimp');
const cfrontinvalidate = require('aws-cloudfront-invalidate')
const {OAuth2Client} = require('google-auth-library');
const {google} = require('googleapis');
const helm = require('helmet');
const rssparser = require('rss-parser');

const dbConfig = config.get('ScheduleUs.dbConfig');
const twConfig = config.get('ScheduleUs.twilio');
const rcConfig = config.get('ScheduleUs.recaptcha');
const evConfig = config.get('ScheduleUs.evConfig');
const googConfig = config.get('ScheduleUs.googConfig');
const stripeConfig = config.get('ScheduleUs.stripeConfig');

const stripe = require("stripe")(stripeConfig.secret);

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
    messageobj: new messagecls("+12036354194", new twilio(twConfig.sid, twConfig.token), db),
    request: request,
    bcrypt:bcrypt,
    uuidv4: uuidv4,
    uuidvalidate: uuidvalidate,
    envURL: evConfig.envURL,
    xss: xss,
    axios: axios,
    jimp: jimp,
    cfrontinvalidate: cfrontinvalidate,
    googauth: OAuth2Client,
    google: google,
    googcalcliid: googConfig.calClientID,
    googcalsecret: googConfig.calSecret,
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
      else {
         objs.sessionobj.setSession(null,null,null);
      }
    }
    catch(e) {
       objs.sessionobj.setSession(null,null,null);
    }

    next()
  }

  var app = express()
  
	app.use(bodyParser.json({
    verify: function(req,res,buf) {
      if (req.originalUrl.startsWith('/checkoutconfirm') || req.originalUrl.startsWith('/charge')) {
          req.rawBody = buf.toString()
      }
    }
  }))
  app.use(helm())
  app.use(cors())
  app.use(sessionHook);
  app.use(function(req, res, next) {
    var host = req.get('host');
    if (host==="localhost" || host==="api.schd.us") { 

        res.header('Access-Control-Allow-Origin', "*")
        res.header('Access-Control-Allow-Credentials', true)
        res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    }
    next()
  })


  app.post('/acceptchanges', function(req, res) {
      objs.eventsobj.acceptChanges(req.body.EventID).then(r=>{
           if (r==="OK") {
              res.send({ status: 200, message:"OK" });
           }
           else {
              res.send({ status: 500, message:r });
           }
      })
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

  app.post('/addavatar', function(req, res) {
     try { 
        objs.clientobj.addAvatar(Buffer.from(req.body.Image, 'base64')).then(r=>{
            res.send({ status: 200, message:"OK"});
        });
     }
     catch(e) {
        console.log(e);
        res.send({ status: 500, message:"An unexpected error occurred"});
     }
  })

  app.post('/addcalendar', function(req, res) {
     try {
        objs.clientobj.addCalendar(req.body.CalendarType, req.body.Code).then(r=> {
           if (r==="OK") {
              res.send({ status: 200, message:r });
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

  app.post('/addcomment', function(req, res) {
     try {
        objs.eventsobj.addComment(req.body.EventID, req.body.EventGuestID, req.body.ParentID, req.body.Comment).then(r=> {
          if (r.indexOf("{")>-1) {
            res.send({ status: 200, message:r });
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

  app.post('/addgroup', function(req, res) {
    try {
       objs.clientobj.addGroup(req.body.GroupName, req.body.Clients).then(r=> {
         if (r==="OK") {
           res.send({ status: 200, message:r });
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

 app.post('/addtogooglecalendar', function(req, res) {
     objs.clientobj.addToGoogleCalendar(req.body.EventName, req.body.EventAddr, req.body.EventStartDate, req.body.EventEndDate, req.body.EventDesc).then(r=>{
        if (r==="OK") {
           res.send({ status: 200, message:r });
        }
        else {
          res.send({ status: 500, message:r });
        }
     });
 })

 app.post('/addtogroup', function(req, res) {
  try {
     objs.clientobj.addToGroup(req.body.ClientGroupID, req.body.Client).then(r=> {
       if (r.length===36) {
         res.send({ status: 200, message:r });
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


                if ((e.CreatorID===c || e.GuestsCanBringOthers===true) && e.ActionReq>0 && e.EventDate>=new Date().getTime()) {

                  
                  for(var eg=0; eg<e.Guests.length; eg++) {
                    
                    if ((guestobj.gphone!==null && guestobj.gphone.length>0 && e.Guests[eg].PhoneNumber===objs.utilityobj.standardizePhone(guestobj.gphone)) || 
                        (guestobj.gemail!==null && guestobj.gemail.length>0 && e.Guests[eg].EmailAddress===guestobj.gemail)) {
                       res.send({ status: 500, message:"This person has already been added to the event" });
                       return;
                    }
                  }

                  if (e.Guests.length+1>e.EventMaxCapacity) {
                    res.send({ status: 500, message:"This event is at capacity and cannot accept any additional RSVPs" });
                    return;
                  }

                  objs.eventsobj.addGuest(req.body.EventID, guestobj, false, e.CreatorID===c?null:c).then(r=> {
                      if (r!==null) {
                        objs.eventsobj.addScheduledGuest(e.Schedules[0].EventScheduleID, r.EventGuestID, e.CreatorID===c, e, r).then(egs=> {
                            
                            res.send({ status: 200, message:"OK" });
                        })
                      }        
                      else {
                        res.send({ status: 500, message:r });
                      }
                    })
                }
                else {
                  res.send({ status: 500, message:"Invalid Operation" });
                }
              });
          })
      }
      else {
        res.send({ status: 500, message: vg});
      }
    }
    catch(e) {
      console.log(e)
     res.send({ status: 500, message:"An unexpected error occurred"});
    }
 })

app.post('/cancelevent', function(req, res) {
  try {
    objs.eventsobj.cancelEvent(req.body.EventID).then(r=>{
        if (r==="OK") {
          res.send({ status: 200, message:r });
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

app.post('/cancelsubscription', function(req, res) {
  objs.sessionobj.verify().then(c=> {
      objs.clientobj.getClientByID(c).then(cli=> {

        if (cli.PaymentID!==null) {
          stripe.subscriptions.list(
            { customer: cli.PaymentID },
            function(err, subscriptions) {
                if (subscriptions.data.length>0) {

                    for (var y=0; y<subscriptions.data.length; y++) {
                        if (subscriptions.data[y].canceled_at===null) {
                          var sub = subscriptions.data[y];

                          stripe.subscriptions.del(
                            sub.id,
                            function(err, confirmation) {
                                db.Clients.update({
                                    ClientID: cli.ClientID
                                },{
                                    SubTerminationDate: sub.current_period_end
                                })
                                res.send({status:200, message:"OK"});
                            }
                          );
                        }
                    }
                }
                else {
                  res.send({status:500, message:"Invalid Operation"});
                }
            });
        }
        else {
          res.send({status:500, message:"Invalid Operation"});
        }
      })
  })
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
         var msg = objs.clientobj.verify("test","test","999-999-9999",req.body.passwd,"1");
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

  app.post('/charge', (request, response)=>{
      const sig = request.headers['stripe-signature'];

      let event;
    
      try {
        event = stripe.webhooks.constructEvent(request.rawBody, sig, stripeConfig.charge);

        db.Clients.findOne({
          PaymentID: event.data.object.customer
        }).then(c=>{

            if (c===null) {
                response.status(400).send("Client not found");
            }
            else {

                if (event.type==="charge.succeeded") {

                    var amt=""; 
                    var desc="";

                    if (event.data.object.amount===1197) {
                        amt="11.97";
                        desc="3 Months Schedule Us Premium";
                    }
                    else if (event.data.object.amount===999) {
                        amt="9.99";
                        desc="1 Month Schedule Us Pro";
                    }
                    else if (event.data.object.amount===399) {
                        amt="3.99";
                        desc="1 Month Schedule Us Premium";
                    }
                    else {
                        amt="29.97";
                        desc="3 Months Schedule Us Pro";
                    }

                    db.ClientOrderHistory.insert({
                        ClientOrderHistoryID: objs.uuidv4(),
                        ClientID: c.ClientID,
                        OrderDate: new Date().getTime(),
                        Amount: amt,
                        Description: desc
                    })       
                    
                    db.Clients.update({
                      ClientID: c.ClientID
                    },{
                        SubTerminationDate: null
                    })
                }
                if (event.type==="charge.failed") {
                    db.ClientOrderHistory.insert({
                      ClientOrderHistoryID: objs.uuidv4(),
                      ClientID: c.ClientID,
                      OrderDate: new Date().getTime(),
                      Amount: "0.00",
                      Description: "Subscription Payment Failed"
                  })

                  var endDate = (new Date().getTime())/1000;
                  endDate+=252900;

                  db.Clients.update({
                      ClientID: c.ClientID
                  },{
                      SubTerminationDate: endDate
                  })

                  objs.messageobj.addToQueue(c.ClientID, "Schedule Us Payment Failed. Please update your payment information on the My Account page");
                  objs.messageobj.sendMessage(c.PhoneNumber, "Schedule Us Payment Failed. Your access to Schedule Us Premium/Pro will be cut off in three days. Please update your payment method on the My Account page");
               }

               // Return a response to acknowledge receipt of the event
               response.json({received: true});
            }

        });

      }
      catch(err) {
         response.status(400).send(`Webhook Error: ${err.message}`);
      }
  })

  app.post('/checkoutconfirm', (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;
  
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, sig, stripeConfig.checkout_confirm);

      if (event.type==="checkout.session.completed") {

          var sub=event.data.object.subscription; 

          stripe.subscriptions.retrieve(sub, function(error, subscription) {

              if (subscription!==null) {
                  db.Clients.findOne({
                      PaymentID: event.data.object.customer
                  }).then(c=>{
                      var isPro=false;
                      var isPremium=false;
                      if (subscription.plan.id==="plan_GSkdU2M4uopeO2") {
                            isPremium=true;
                      }
                      if (subscription.plan.id==="plan_GSkenZwDUSheRL") {
                            isPro=true;
                      }
                      db.Clients.update({
                          ClientID: c.ClientID
                      },{
                            IsPro: isPro,
                            IsPremium: isPremium,
                            SubTerminationDate: null
                      })
                    
                      db.EventGuests.find({
                           ClientID: c.ClientID
                      }).then(egs=>{
                          for(var x=0; x<egs.length; x++) {
                              db.EventGuests.update({
                                  EventGuestID: egs[x].EventGuestID
                              },{
                                  Flair: isPremium===true?1:2
                              })
                          }
                      })
                      db.Events.find({
                          CreatorID: c.ClientID
                      }).then(es=>{
                          for(var x=0; x<es.length; x++) {
                             db.Events.update({
                                 EventID: es[x].EventID
                             },{
                                 Deletable: isPremium===true?1:2
                             })
                          }
                      })
                  })
              }
          })
       
      }

      // Return a response to acknowledge receipt of the event
      response.json({received: true});
    }
    catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
    }

    
});

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

            var msg = objs.clientobj.verify(req.body.FirstName,req.body.LastName,req.body.Phone,req.body.Passwd,req.body.SecAnswer);
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

  app.post('/createcheckout', function(req, res) {
      objs.sessionobj.verify().then(r=> {
        if (r!==null) {
            objs.clientobj.getClientByID(r).then(c => {
                const { planId } = req.body;

                if (c.PaymentID===null) {
                    var nm="";
                    try {
                       nm=c.FirstName+" "+c.LastName;
                    }
                    catch(e) {}

                    stripe.customers.create({
                        phone: c.PhoneNumber,
                        name: nm
                    }).then(customer=>{
                        if (customer!==null) {
                            db.Clients.update({
                                ClientID: c.ClientID
                            },{
                                PaymentID: customer.id       
                            }).then(q=>{
                                objs.clientobj.doCheckout(customer.id, planId, res, stripe);
                            })
                        }
                        else {
                          res.send({
                             status: 500,
                             message: "Invalid"
                          });
                        }
                    })
                }
                else {
                    objs.clientobj.doCheckout(c.PaymentID, planId, res, stripe);
                }
            }) 
          }
          else {
            res.send({
              status: 500,
              message: "Invalid"
            });
          }
      });
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

  app.post('/dismissclientqueue', function(req, res) {
      objs.messageobj.removeFromQueue(req.body.ClientQueueID).then(r=>{
        res.send({ status: 200, message:"OK" });
      })
  })

  app.post('/doemailoptout', function(req, res) {
    try {
        objs.clientobj.emailOptOut(req.body.EmailAddress).then(r=> {
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

  app.post('/editgroupmember', function(req, res) {
      try {
        objs.clientobj.editGroupMember(req.body.ClientGroupClientID, req.body.Name, req.body.EmailAddress, req.body.PhoneNumber).then(r=>{
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

  app.post('/editgroupname', function(req, res) {
      try {
         objs.clientobj.editGroupName(req.body.ClientGroupID, req.body.GroupName).then(r=>{
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

  app.post('/getcalendarintegrationstatus', function(req,res) {
      try {
         objs.clientobj.getCalendarIntegrationStatus().then(r=>{
             res.send({ status: 200, message:r})
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
                        EventCount: c.EventCnt,
                        Address: c.Address==null?"":xss(c.Address),
                        City: c.City==null?"":xss(c.City),
                        State: c.State==null?"":xss(c.State),
                        PostalCode: c.PostalCode==null?"":xss(c.PostalCode),
                        PhoneNumber: xss(c.PhoneNumber),
                        EmailAddress: c.EmailAddress==null?"":xss(c.EmailAddress),
                        IsPremium: c.IsPremium==null?false:c.IsPremium,
                        IsPro: c.IsPro==null?false:c.IsPro,
                        AccountType: c.AccountType                      
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

  app.post('/getclientcalendars', function(req, res) {
      objs.clientobj.getClientCalendars().then(r=>{
           if (r!=="Invalid") {
               res.send({ status: 200, message:r}); 
           }
           else {
               res.send({ status: 500, message:"An unexpected error occurred"});
           }
      })
  })

  app.post('/getclientqueue', function(req, res) {
      objs.messageobj.getClientQueue().then(c=>{
          if (c===null) {
            res.send({ status: 500, message:"An unexpected error occurred"});
          }
          else {
            res.send({ status: 200, message:c}); 
          }
      })
  })

  app.post('/getclientorderhistory', function (req, res) {
      objs.clientobj.getOrderHistoryForClient().then(r=>{
          if (r!==null) {
             res.send({ status: 200, message:r}); 
          }
          else {
             res.send({ status: 500, message:"An unexpected error occurred"});
          }
      })
  })

  app.post('/getbyphoneoremail', function(req, res) {
      try {
          if (req.body.PhoneNumber!==null) {

            var sPhone = objs.utilityobj.standardizePhone(req.body.PhoneNumber);
            if (sPhone!=="NotOK") {

              objs.clientobj.getClientByPhone(sPhone).then(c=> {
                if (c!==null) {
                  res.send({ status: 200, message:c.ClientID}); 
                }
                else {
                  res.send({ status: 500, message:"An unexpected error occurred"}); 
                }
              });
            }
            else {
              res.send({ status: 500, message:"An unexpected error occurred"}); 
            }
          }
          else if (req.body.EmailAddress!==null) {
            objs.clientobj.getClientByEmail(req.body.EmailAddress).then(c=> {
              if (c!==null) {
                res.send({ status: 200, message:c.ClientID}); 
              }
              else {
                res.send({ status: 500, message:"An unexpected error occurred"}); 
              }
            });
          }
      }  
      catch(e) {
        res.send({ status: 500, message:"An unexpected error occurred"});
      }
  });

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

  app.post('/getclientsforgroup', function(req, res) {
    try {
      objs.clientobj.getClientsForGroup(req.body.ClientGroupID).then(cgs=>{
         if (cgs!==null && cgs.Clients.length>0) {
             res.send({ status: 200, message:xss(JSON.stringify(cgs))})
         }
         else {
             res.send({ status: 200, message:"NOCLIENTS"})
         }
      }); 
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/getfeed', function(req, res) {
      let parser = new rssparser();
      
      try {
        parser.parseURL('https://schdus.blogspot.com/feeds/posts/default?alt=rss').then(feed=>{
          res.send({ status: 200, message:JSON.stringify(feed)})
        });
      }
      catch(e) {
        res.send({ status: 500, message: "NotOK"});
      }
  });

  app.post('/getgroupsforclient', function(req, res) {
     try {
       objs.clientobj.getGroupsForClient().then(cgs=>{
          if (cgs!==null && cgs.length>0) {
              res.send({ status: 200, message:xss(JSON.stringify(cgs))})
          }
          else {
              res.send({ status: 200, message:"NOGROUPS"})
          }
       }); 
     }
     catch(e) {
       res.send({ status: 500, message:"An unexpected error occurred"});
     }
  })

  app.post('/getcomments', function(req, res) {
    try {
      objs.eventsobj.getComments(req.body.EventID).then(r=>{
          res.send({ status: 200, message:xss(JSON.stringify(r))})
      }); 
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/getnextpaymentdate', function(req, res) {
    objs.sessionobj.verify().then(c=> {
      objs.clientobj.getClientByID(c).then(cli=> {

        if (cli===null) {
          res.send({status: 500, message:"Invalid Operation"})
        }

        if (cli.PaymentID!==null) {
          stripe.subscriptions.list(
            { customer: cli.PaymentID },
            function(err, subscriptions) {

                if (subscriptions!==null && subscriptions.data.length>0) {

                    for (var y=0; y<subscriptions.data.length; y++) {
                        if (subscriptions.data[y].canceled_at===null) {
                          var sub = subscriptions.data[y];
                          res.send({status: 200, message:sub.current_period_end})
                        }
                    }
                }
                else {
                  res.send({status: 500, message:"No Subscriptions"})
                }
              })
          }
          else {
            res.send({status: 500, message:"Invalid Operation"})
          }
        })
      })
  })

  app.post('/getrecurringinfo', function(req,res) {
      objs.eventsobj.getRecurringInfo(req.body.EventID).then(q=>{
         if (q===null) {
            res.send({ status: 500, message:"An unexpected error occurred"});
         }
         else {
            res.send({ status: 200, message:xss(JSON.stringify(q))});
         }
      })
  })

  app.post('/getsuggestedlocations', function(req, res) {
    try {
      objs.eventsobj.getSuggestedLocations(req.body.EventID, req.body.IterationNum).then(r=>{
          res.send({ status: 200, message:xss(JSON.stringify(r))})
      }); 
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/getsuggestedtimes', function(req, res) {
    try {
      objs.eventsobj.getSuggestedTimes(req.body.EventID, req.body.IterationNum).then(r=>{
          res.send({ status: 200, message:xss(JSON.stringify(r))})
      }); 
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })


  app.post('/locationdetails', function(req, res) {
    try {
       objs.eventsobj.doLocationDetails(req,res); 
    }
    catch(e) {
       res.send({ status: 500, message:"An unexpected error occurred"});
    }
 })

  app.post('/locationfinder', function(req, res) {
     try {
        objs.eventsobj.doLocationFinder(req,res); 
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
          objs.pickobj.doPickForUs(req.body).then(r=>{
            if (r===null) {
              res.send({ status: 200, message:"N"});
            }
            else {
                res.send({ status: 200, message:JSON.stringify(r)});
            }
          });        
      }
      catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred"});
      }
  });

  app.post('/pickforus_spc', function(req,res) {
     try {
       if (req.body.t==="30bkYlYaIMgSVusiV2HtuOzvyk9QfuigOOVSJkGwPoD1WASHG1ErOAv23NCg2Lfz") {
           objs.pickobj.doTokenPFUS(req.body).then(r=>{
              res.send({ status: 200, message:JSON.stringify(r)});
           })
       }
       else {
           res.send({ status: 500, message:"An unexpected error occurred"});
       }
     }
     catch (e) {
       res.send({ status: 500, message:"An unexpected error occurred"});
     }
  })

  app.post('/rejectchanges', function(req, res) {
    objs.eventsobj.rejectChanges(req.body.EventID).then(r=>{
         if (r==="OK") {
            res.send({ status: 200, message:"OK" });
         }
         else {
            res.send({ status: 500, message:r });
         }
    })
 })

  app.post('/removeattendee', function(req, res) {
      try {
         objs.eventsobj.verifyOwner(req.body.EventID).then(o=>{   
            objs.eventsobj.removeAttendee(o.EventID,req.body.PhoneNumber,req.body.EmailAddress).then(r=>{
              if (r==="OK") {
                res.send({ status: 200, message:r });
              }        
              else {
                res.send({ status: 500, message:r });
              }
            })

         });
      }
      catch(e) {
         res.send({ status: 500, message:"An unexpected error occurred"});
      }
  });

  app.post('/removegroup', function(req, res) {
    try {
       objs.clientobj.removeGroup(req.body.ClientGroupID).then(r=> {
         if (r==="OK") {
           res.send({ status: 200, message:r });
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

 app.post('/removefromgroup', function(req, res) {
    try {
      objs.clientobj.removeFromGroup(req.body.ClientGroupID, req.body.ClientGroupClientID).then(r=> {
        if (r==="OK") {
          res.send({ status: 200, message:r });
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

  app.post('/reportcomment', function(req, res) {
     objs.eventsobj.reportComment(req.body.EventCommentID).then(e=>{
      res.send({ status: 200, message:"OK" });
     });
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

  app.post('/updatelocation', function(req,res) {
    try {
      objs.eventsobj.verifyOwner(req.body.EventID).then(o=>{   
         objs.clientobj.getClientByID(o.CreatorID).then(cli=> { 

              if (cli.IsPremium && !cli.IsPro) {
                   if (cli.EventCnt>=30) {
                      res.send({ status: 500, message:"You have reached your schedule limit for the month"});
                      return;
                   }
              }
              if (!cli.IsPremium && !cli.IsPro) {
                    if (cli.EventCnt>=3) {
                      res.send({ status: 500, message:"You have reached your schedule limit for the month"});
                      return;
                    }   
              }

              if (o!==null) {

                var addrr = objs.eventsobj.verifyAddress(req);
                if (addrr!=="OK") {
                    res.send({ status: 500, message: addrr})
                }
                else {
                  objs.eventsobj.rescheduleEvent(o.EventID, null, null, req.body.Location, req.body.EventStreet, req.body.EventCity, req.body.EventState, req.body.EventZip, -1);
                  res.send({ status: 200, message:"OK"});
                }
              }
              else {
                  res.send({ status: 500, message:"Invalid operation"});
              }
          })
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/updatesubscription', function(req, res) {
    objs.sessionobj.verify().then(c=> {
      objs.clientobj.getClientByID(c).then(cli=> {

        if (cli.PaymentID!==null) {
          stripe.subscriptions.list(
            { customer: cli.PaymentID },
            function(err, subscriptions) {
                if (subscriptions.data.length>0) {

                    for (var y=0; y<subscriptions.data.length; y++) {
                        if (subscriptions.data[y].canceled_at===null) {
                          var sub = subscriptions.data[y];
    
                          stripe.checkout.sessions.create({
                              payment_method_types: ['card'],
                              mode: 'setup',
                              setup_intent_data: {
                                metadata: {
                                  customer_id: cli.PaymentID,
                                  subscription_id: sub.id,
                                },
                              },
                              success_url: 'https://schd.us/myaccount?upd=1',
                              cancel_url: 'https://schd.us/myaccount?upd=2',
                          }).then(session=>{
                              res.send({
                                status: 200,
                                sessionId: session.id
                              });
                          })
                        }
                      }
                  }
                  else {
                    res.send({status:500, message:"Invalid Operation"})
                  }
                }               
              )
          }
          else {
                res.send({status:500, message:"Invalid Operation"})
          }
        })
     })
   
  })

  app.post('/updatetime', function(req,res) {
    try {
      objs.eventsobj.verifyOwner(req.body.EventID).then(o=>{
          if (o!==null) {
              objs.clientobj.getClientByID(o.CreatorID).then(cli=> { 

                  if (cli.IsPremium && !cli.IsPro) {
                      if (cli.EventCnt>=30) {
                          res.send({ status: 500, message:"You have reached your schedule limit for the month"});
                          return;
                      }
                  }
                  if (!cli.IsPremium && !cli.IsPro) {
                        if (cli.EventCnt>=3) {
                          res.send({ status: 500, message:"You have reached your schedule limit for the month"});
                          return;
                        }   
                  }
                  var sdate = new Date(req.body.EventDate).getTime()+(o.TimezoneOffset*60*1000);
                  var vdate = new Date().getTime()+(o.TimezoneOffset*60*1000);
                  var edate=null;
    
                  if (req.body.EndDate!==null) {
                    edate = new Date(req.body.EndDate).getTime();
                  }

                  var diff = sdate-vdate;
                  if (diff<0) {
                      return "Cannot schedule dates in the past";
                  }

                  if (edate!==null && req.body.EventLength==='i') {
                      if (edate-sdate<0) {
                          return "The end date cannot be before the start date";
                      }
                  }

                  if (edate!=null && req.body.EventLength!=='i') {
                      return "Invalid operation";
                  }

                  objs.eventsobj.rescheduleEvent(o.EventID, sdate, edate, null, null, null, null, null, -1);
                  res.send({ status: 200, message:"OK"});
             });
          }
          else {
              res.send({ status: 500, message:"Invalid operation"});
          }
      });
    }
    catch(e) {
      res.send({ status: 500, message:"An unexpected error occurred"});
    }
  })

  app.post('/updatetitle', function(req, res) {
    try {
       objs.eventsobj.verifyOwner(req.body.EventID).then(o=>{
           if (o!==null) {
              if (req.body.Title.length>0 && req.body.Title.length<=128) {
                  db.Events.update({
                      EventID: req.body.EventID  
                  },{
                      EventName: req.body.Title
                  });

                  res.send({ status: 200, message:"OK"});
              }
           }
           else {
              res.send({ status: 500, message:"Invalid operation"});
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

  app.post('/verifygooglogin', function(req, res) {
      try {
        objs.clientobj.verifyGoogleLogin(req.body.Token, req.body.Phone, req.body.EmailAddress).then(r=> {
            if (r==="OK"||r==="NEEDPHONE"||r[0]==="{"||r.length===36) {
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
  });


  app.listen(process.env.PORT || 80, () => console.log(`Schedule Us has started`))
});
