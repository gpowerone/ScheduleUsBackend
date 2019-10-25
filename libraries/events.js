class events {

    async acceptReschedule(eventID,me,imic) {
        return await this.getEventById(eventID).then({
            and:[{
                EventID: eventID
            },{or:[
                {ActionReq: 5},{ActionReq: 6}
            ]}]
        }).then(e=> {
            var goForward=false;

            if (imic) {
                if (e.CreatorID===me) {
                    goForward=true;
                }
            }
            else {
                for(var x=0; x<e.Guests.length; x++) {
                    if (e.Guests[x].EventGuestID===me && e.Guests[x].PhoneNumber===e.CreatorPhone) {
                        goForward=true;
                    }
                }
            }

            if (goForward) {
                this.db.Events.update({
                    EventID: eventID
                },{
                    ActionReq:1
                }).then(isok=>{
                    return "OK"
                })
            }
            else {
                return "Insufficient Permissions"
            }
        });
    }

    async addComment(eventID, eventGuestID, parentID, comment) {
   
        if (comment.length<1) {
            return "Comment is required";
        }
        
        if (comment.length>1024) {
            return "Comment must be equal to or shorter than 1024 characters";
        }

        return await this.db.Events.findOne({
            EventID: eventID
        }).then(e=> {

            if (e===null || e.ActionReq===0) {
                return "Event not found";
            }

            if (e.GuestsCanChat!==true) {
                return "Comments not allowed";
            }

            return this.getNameFromEventGuestID(eventGuestID).then(c=> {

                if (c!==null) {

                    if (parentID!=="00000000-0000-0000-0000-000000000000") {

                        return this.db.EventComments.findOne({
                            EventCommentID: parentID
                        }).then(ec=> {
                            if (ec!==null && ec.ParentID=="00000000-0000-0000-0000-000000000000") {
                                return this.db.EventComments.insert({
                                    EventCommentID: this.objs.uuidv4(),
                                    EventID: eventID,
                                    EventGuestID: eventGuestID,
                                    CommenterName: c,
                                    Comment: comment,
                                    ParentID: parentID,
                                    CreationDate: new Date().getTime()
                                }).then(r=> {
                                   
                                    r.IndentLevel="i-1";
        
                                    return JSON.stringify(r);
                                });
                            }
                            else {
                                return "Invalid";
                            }
                        })
                    }
                    else {

                        return this.db.EventComments.insert({
                            EventCommentID: this.objs.uuidv4(),
                            EventID: eventID,
                            EventGuestID: eventGuestID,
                            CommenterName: c,
                            Comment: comment,
                            ParentID: parentID,
                            CreationDate: new Date().getTime()
                        }).then(r=> {
                           
                            r.IndentLevel="i-0";

                            return JSON.stringify(r);
                        });
                    }
                }
                else {
                    return "Invalid commenter";
                }
            });
        });
    }

    async addGuest(eventID, guest, isOrg, clientID) {

        if (guest.gemail!==null && guest.gemail.length>0 && guest.gemail!=="Not Specified" && this.objs.utilityobj.verifyEmail(guest.gemail)!=="OK") {
            return new Promise(null);
        }

        if (guest.gphone!==null && guest.gphone.length>0 && guest.gphone!=="Not Specified" && this.objs.utilityobj.verifyPhone(guest.gphone)!=="OK") {
            return new Promise(null);
        }

        if (((guest.gemail===null||guest.gemail.length===0) && (guest.gphone===null||guest.gphone.length===0)) || (guest.gemail==="Not Specified" && guest.gphone==="Not Specified")) {
            return new Promise(null);
        }

        var phone = this.objs.utilityobj.standardizePhone(guest.gphone);
        if (phone=="NotOK") {
            phone=null;
        }

        return await this.db.EventGuests.insert({
            EventID: eventID,
            EventGuestID: this.objs.uuidv4(),
            EmailAddress: guest.gemail,
            PhoneNumber: phone,
            GuestName: guest.gname,
            IsRequired: guest.greq,
            IsOrganizer: isOrg,
            ClientID: clientID
        }).then(r=> {
            return r;
        })
        
    }

    async addScheduledGuest(eventScheduleID,eventGuestID,newSS,eventobj,egobj) {
        return await this.getPhoneID(eventGuestID).then(ph=> {
            this.db.EventScheduleGuests.insert({
                EventGuestID: eventGuestID,
                Acceptance: newSS===true?null:true,
                EventScheduleGuestID: this.objs.uuidv4(),
                EventScheduleID: eventScheduleID,
                PhoneID: ph
            })

            if (newSS) {

                var esobj = eventobj.Schedules[0];

                return this.db.PhoneNumbers.findOne({
                    PhoneID: ph
                }).then(p=> {

                    if (egobj.EmailAddress===null || egobj.EmailAddress.length===0 || egobj.EmailAddress==="Not Specified") {
                        var msg= eventobj.CreatorName+" has invited you ("+egobj.GuestName+") to attend "+eventobj.EventName+" located at "+
                        esobj.Location+" ("+esobj.Address+" "+esobj.City+", "+esobj.State+" "+esobj.PostalCode+") on "+
                        this.objs.utilityobj.getDateFromTimestamp(eventobj.EventDate)+" at "+this.objs.utilityobj.getTimeFromTimestamp(eventobj.EventDate);


                        this.db.Partials.insert({
                            FromPhone: p.PhoneNumber,
                            PartialID: this.objs.uuidv4(),
                            PhoneNumber: egobj.PhoneNumber,
                            EmailAddress: "",
                            Message: msg,
                            Subject: null
                        });
                    }
                    else {
                        var msg="<h3> Dear "+egobj.GuestName+",</h3>"+
                        "<p>"+eventobj.CreatorName+" has invited you ("+egobj.GuestName+") to attend "+eventobj.EventName+" located at "+
                        esobj.Location+" ("+esobj.Address+" "+esobj.City+", "+esobj.State+" "+esobj.PostalCode+") on "+
                        this.objs.utilityobj.getDateFromTimestamp(eventobj.EventDate)+" at "+this.objs.utilityobj.getTimeFromTimestamp(eventobj.EventDate)+"</p>";

                        this.db.Partials.insert({
                            FromPhone: null,
                            PartialID: this.objs.uuidv4(),
                            PhoneNumber: "",
                            EmailAddress: egobj.EmailAddress,
                            Message: msg,
                            Subject: eventobj.CreatorName+" has invited you to "+eventobj.EventName
                        });
                    }
                })
            }
        })
    }

    async cancelEvent(eventID) {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.getEventById(eventID).then(e=>{
                if (e.CreatorID===c && e.ActionReq===2) {
                    for(var x=0; x<e.Guests; x++) {
                        this.removeAttendee(eventID,e.Guests[x].PhoneNumber,e.Guests[x].EmailAddress);
                    }
                    for (var x=0; x<e.Schedules.length; x++) {
                        this.db.EventSchedules.destroy({
                            EventID: eventID
                        })
                    }

                    var self=this;
                    setTimeout(function() {
                        self.db.Events.destroy({
                            EventID: eventID
                        })
                    },2000)

                    return "OK";
                    
                }
                else {
                    return "Invalid Operation";
                }
            });
        })
    }

    createEvHash() {
        var d = new Date();
        var h = this.objs.utilityobj.createHash(8);
        return d.getDate()+h[0]+d.getMonth()+h[1]+d.getHours()+h[2]+h[4]+d.getMinutes()+h[5]+h[6]+h[7];
    }

    async createEvent(req) {

       return await this.objs.sessionobj.verify().then(c=> {
            return this.objs.clientobj.getClientByID(c).then(cli=> {
                return this.db.OptOut.find().then(optouts=>{
                    return this.db.EmailOptOut.find().then(emailoptouts=>{

                        if (cli===null) {
                            return "An account is required to create events"; 
                        }
        
                        var edate = null; 
                        var sdate = new Date(req.body.EventDate).getTime()+(parseInt(req.body.UTCOffset)*60*1000);

                        if (req.body.EndDate!==null) {
                            edate = new Date(req.body.EndDate).getTime()+(parseInt(req.body.UTCOffset)*60*1000);
                        }

                        var validationStatus = this.validateEvent(req,cli,sdate,edate,optouts,emailoptouts);
                        if (validationStatus==="OK") {
                              
                            return this.db.Events.insert({
                                CreatorID: cli.ClientID,
                                CreatorPhone: cli.PhoneNumber,
                                CreatorName: req.body.ClientName,
                                EventID: this.objs.uuidv4(),
                                EventName: req.body.EventName,
                                Hash: this.createEvHash(),
                                IsRecurring: req.body.EventIsRecurring,
                                EventDescription: req.body.EventDescription,
                                CreationDate: Date.now(),
                                AllowReschedule: req.body.GuestsReschedule,
                                AllowLocationChange:req.body.GuestsChangeLocation,
                                ActionReq: 1,
                                GuestListVisible:req.body.GuestListVisible,
                                GuestsMustRegister:req.body.GuestsMustRegister,
                                GuestsCanBringOthers:req.body.GuestsBringOthers,
                                EventMaxCapacity:parseInt(req.body.GuestLimitTotal),
                                AllowChildren: req.body.GuestsBringChildren,
                                ProvideSharing: req.body.GuestsProvideSharing,                     
                                GuestsCanChat:req.body.GuestsCanDiscuss,
                                ReminderTime: req.body.ReminderTime==="yes",
                                SeeRSVPed: req.body.GuestsSeeRSVPs,
                                TimezoneOffset:parseInt(req.body.UTCOffset),
                                MustApproveDiffLocation: req.body.MustApproveDiffLocation,
                                MustApproveDiffTime: req.body.MustApproveDiffTime,
                                EventDate: sdate,
                                EndDate: edate
                            }).then(r=> {
                                if (r!==null && typeof(r.EventID)!==undefined) {
                            
                                    return this.db.Clients.update({
                                        ClientID: cli.ClientID
                                    },{
                                        EventCnt: cli.EventCnt+1
                                    }).then(c=> {
                                        
                                        return this.scheduleEvent(r.EventID, req.body, cli.PhoneNumber, sdate, edate, cli.ClientID).then(e=> {
                                            return "?e="+r.Hash;
                                        });                                
                                    })
                                
                                }
                                else {
                                    return "Database failure";
                                }
                            })
                        
                        }
                        else {
                            return validationStatus;
                        }

                    })
                })


            });
        });
             
    }

    async declineReschedule(eventID,me,imic) {
        return await this.getEventById(eventID).then({
            and:[{
                EventID: eventID
            },{or:[
                {ActionReq: 5},{ActionReq: 6}
            ]}]
        }).then(e=> {
            var goForward=false;

            if (imic) {
                if (e.CreatorID===me) {
                    goForward=true;
                }
            }
            else {
                for(var x=0; x<e.Guests.length; x++) {
                    if (e.Guests[x].EventGuestID===me && e.Guests[x].PhoneNumber===e.CreatorPhone) {
                        goForward=true;
                    }
                }
            }

            if (goForward) {

                return this.db.EventSchedules.update({
                    EventScheduleID: e.Schedules[0].EventScheduleID
                },{
                    Status: 2
                }).then(p=>{
                    return this.db.EventSchedules.update({
                        EventID: e.EventID,
                        IterationNum: e.Schedules[0].IterationNum-1
                    },{
                        Status: 0
                    }).then(q=>{
                        this.db.Events.update({
                            EventID: eventID
                        },{
                            ActionReq:1
                        }).then(isok=>{
                            return "OK"
                        })
                    })
                })

                
            }
            else {
                return "Insufficient Permissions"
            }
        });
    }

    async doLocationFinder(req,res) {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.objs.clientobj.getClientByID(c).then(cli=> {

                if (cli===null) {
                    return "You must be logged in to use the location finder";
                }

                if (cli.LFinderUsage>=15) {
                    return "You have used the location finder the maximum number of times today. Please try again tomorrow";
                }

                return this.db.Clients.update({
                    ClientID: cli.ClientID
                },{
                    LFinderUsage: cli.LFinderUsage+1
                }).then(c=>{

                    if (req.body.PickLocation===true) {
            
                        this.objs.geocoder.find(req.body.Geocode, function(err,r) {
            
                            this.objs.eventsobj.locationFinder(req.body.Place, [r[0].location.lat,r[0].location.lng], req.body.Keyword, function(error,response) {
                                response.foundCoords=[r[0].location.lat,r[0].location.lng];
                                res.send({ status: 200, message:JSON.stringify(response) })
                            });
                        });
                    }
                    else {
                        this.objs.eventsobj.locationFinder(req.body.Place, req.body.Coords, req.body.Keyword, function(error,response) {
                            res.send({ status: 200, message:JSON.stringify(response) })
                        });
                    }
                })

            });
        });
    }

    async doRSVP(eventid, eventscheduleid, rsvp, me) {
        return await this.db.EventScheduleGuests.find({
            EventScheduleID: eventscheduleid
        }).then(es=> {
            if (es!==null) {
                return this.db.Events.findOne({
                    EventID: eventid
                }).then(e=> {

                    if (e!==null && (e.ActionReq===1 || e.ActionReq===2)) {

                        var ESGID=null;
                        var accptCnt=0;

                        for(var x=0; x<es.length; x++) {
                
                            if (es[x].EventGuestID===me) {
                                ESGID=es[x].EventScheduleGuestID;
                                break;
                            }

                            if (es[x].Acceptance!==null) {
                                accptCnt++; 
                            }
                        }
                        if (ESGID!==null) {
                            return this.db.EventScheduleGuests.update({                  
                                EventScheduleGuestID: ESGID
                            },{
                                Acceptance: rsvp
                            }).then(p=>{
                                if (accptCnt===es.length-1) {
                                    if (e.CreatorID!=="00000000-0000-0000-0000-000000000000") 
                                    {  
                                        return this.db.EventGuests.findOne({
                                            ClientID: e.CreatorID
                                        }).then(eg=> {
                                            if (eg!==null) {
                                                this.objs.messageobj.sendMessage(e.CreatorPhone, "All attendees have replied to your invitation for "+e.EventName+". Access here: https://"+this.objs.envURL+"/event?e="+e.Hash+"&g="+eg.EventGuestID);
                                            }
                                            return "OK";
                                        });

                                    }                                  
                                }                          
                                else {
                                    return "OK";
                                }
                            })
                        }
                        else {
                            return null;
                        }
                    }
                    else {
                        return null;
                    }

                })
            }

            return null;
        })
    }

    async getEventByHash(hsh, me, imic) {
        return await this.db.Events.findOne({ 
            Hash: hsh,
            "ActionReq >": 0
        }).then(r=> {
            if (r!==null) {
                if (r.EventDate<new Date().getTime()-(1000*60*60*24)) {
                    return null;
                }

                return this.db.EventGuests.find({
                    EventID: r.EventID
                }).then(eg=> {
                   

                    return this.db.EventSchedules.find({
                        EventID: r.EventID,
                        Status: 0
                    }).then(es=> {
                        r.Schedules=[];
                        r.Schedules.push(es[0]);
                        
                        return this.db.EventScheduleGuests.find({
                            EventScheduleID: es[0].EventScheduleID
                        }).then(esg=> {

                         
                            r.Guests=[];
                            r.EGID=null;
                            r.IsOwner=false;
                            r.NeedsAcceptance=null;
                            r.Acceptance=null;

                            for(var g=0; g<eg.length; g++) {

                                var egid=null;
                                var accpt=null;
 
                                for(var ga=0; ga<esg.length; ga++) {

                                    if (esg[ga].EventGuestID===eg[g].EventGuestID) { 
                                        accpt=esg[ga].Acceptance;
                                    }                             
                                }

                                if (imic) {
                                    if (eg[g].ClientID===me) {                         
                                        r.EGID=eg[g].EventGuestID;
                                        r.NeedsAcceptance=(accpt===null)?true:false;
                                        r.Acceptance=accpt;
                                        egid=r.EGID;
                                        if (r.CreatorID===me) {
                                            r.IsOwner=true;
                                        }
                                    }
                                }
                                else {
                                    if (eg[g].EventGuestID===me) {
                                        r.EGID=eg[g].EventGuestID;
                                        r.NeedsAcceptance=(accpt===null)?true:false;
                                        r.Acceptance=accpt;
                                        egid=r.EGID;
                                        if (r.CreatorPhone==eg[g].PhoneNumber) {
                                            r.IsOwner=true;
                                        }
                                    }
                                }
                                            

                                if (r.GuestListVisible===true) {
                                    if (r.SeeRSVPed!==true) {
                                        accpt=null;
                                    }

                                    r.Guests.push({
                                        GuestName: eg[g].GuestName,
                                        Acceptance: accpt,
                                        EventGuestID: egid
                                    });
                                }
                            }

                            if (r.IsOwner) {
                                for(var g=0; g<eg.length; g++) {
                                    r.Guests[g].PhoneNumber=eg[g].PhoneNumber;
                                    r.Guests[g].EmailAddress=eg[g].EmailAddress;
                                }
                            }

                            if (r.GuestsCanBringOthers===true) {
                                r.MoreAllowed=true;
                                if (r.EventMaxCapacity<=r.Guests.length) {
                                    r.MoreAllowed=false;
                                }
                            }
                            else {
                                // If guests can't bring others then we need some ID to show the page
                                if (r.EGID===null && r.CreatorID!==me) {
                                    return null;
                                }
                            }

                            return this.db.EventComments.find({
                                EventID: r.EventID
                            },{
                                order: [
                                    {field: "CreationDate", direction: "desc"}
                                ]
                            }).then(ec=> {
                                r.Comments=[];
                                if (ec!=null && ec.length>0) {
                                    r.Comments = this.objs.utilityobj.createTree(ec,"00000000-0000-0000-0000-000000000000",0);
                                }
                                return this.db.EventSuggestedTimes.find({
                                    EventID: r.EventID,
                                    IterationNum: es[0].IterationNum
                                }).then(est=>{
                                    return this.db.EventSuggestedLocations.find({
                                        EventID: r.EventID,
                                        IterationNum: es[0].IterationNum
                                    }).then(esl=>{
                                        r.CreatorID=null;
                                        r.CreatorPhone=null;
                                        r.SuggestedTimesCount=est.length;
                                        r.SuggestedLocationsCount=esl.length;
                                        return r;
                                    })
                                })

                                
                            }) 
                        });
                    }) 
                })              
            }
            else {
                return null;
            }
        });
    }

    async getEventById(id) {
        return await this.db.Events.findOne({ 
            EventID: id
        }).then(r=> {
            if (r!==null) {
                return this.db.EventGuests.find({
                    EventID: id
                }).then(eg=> {
                    r.Guests=[];
                    for(var g=0; g<eg.length; g++) {
                        r.Guests.push(eg[g]);
                    }

                    return this.db.EventSchedules.find({
                        EventID: r.EventID,
                        Status: 0
                    }).then(es=> {
                        r.Schedules=[];
                        r.Schedules.push(es[0]);
 
                        return r;
                    })
                })              
            }
            else {
                return null;
            }
        });
    }

    async getEventsForClient() {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.objs.clientobj.getClientByID(c).then(cli=> {
                return  this.db.Events.find({
                    CreatorID: c
                }).then(hosting=> {
  
                    var fc = {
                        PhoneNumber: cli.PhoneNumber
                    };
                    if (cli.EmailAddress!==null) {
                        fc.EmailAddress= cli.EmailAddress;    
                    }

                    var host= [];
                    for(var n=0; n<hosting.length; n++) {
                        if (hosting[n].EventDate>new Date().getTime()-(1000*60*60*24)) {
                            host.push(hosting[n]);
                        }
                    }

                    return this.db.EventGuests.find(fc).then(particguest=> {

                        if (particguest!==null && particguest.length>0)
                        {
                            var vor=[];
                            for (var pg=0; pg<particguest.length; pg++) {
                                vor.push({
                                    EventID: particguest[pg].EventID
                                })
                            }

                            return this.db.Events.find({or: vor}).then(participating=> {
                            
                                var part =[];
                               
                                for(var n=0; n<participating.length; n++) {
                                    if (participating[n].EventDate>new Date().getTime()-(1000*60*60*24)) {
                                        part.push(participating[n]);
                                    }
                                }

                                return {
                                    h: host,
                                    p: part
                                }
                            });   
                         }
                         else {
                            return {
                                h: host,
                                p: []
                            }
                         }                   
                    })
                });
            })
        });
    }

    async getNameFromEventGuestID(eventGuestID) {
        return await this.db.EventGuests.findOne({
            EventGuestID: eventGuestID
        }).then(r=> {
            if (r!==null) {
                return r.GuestName;
            }
            else {
                return "";
            }
        })
    }

    // Make sure that users don't have other events on other phone numbers
    async getPhoneID(eventGuestID) {
        return await this.db.EventScheduleGuests.find({
            EventGuestID: eventGuestID
        }).then(r=>{
            return this.db.PhoneNumbers.find().then(p=> {
                var pa=[];
                for(var x=0; x<p.length; x++) {
                    pa.push(x);
                }
                
                pa = this.objs.utilityobj.shuffle(pa);
                
                for (var y=0; y<pa.length; y++) {
                    var itsGood=true;
                    for (var e=0; y<r.length; r++) {
                        if (r[e].PhoneID===p[pa[y]].PhoneID) {
                            itsGood=false;
                        }
                    }   
                    if (itsGood) {
                        return p[pa[y]].PhoneID;
                    }
                }

                return p[0].PhoneID;
            })
        })
    }

    locationFinder(query, coords, keyword, resp) {
        if (keyword===null) {
            this.objs.googleplaces.placeSearch({
                location:coords,
                rankby:'distance',
                types:query
            }, resp);
        }
        else {
            this.objs.googleplaces.placeSearch({
                location:coords,
                rankby:'distance',
                keyword: keyword
            }, resp);
        }
    }

    async phoneSecurity(actionReq,phone) {
        if (actionReq===1) {
            return "OK"
        }
        return this.db.Clients.findOne({
            PhoneNumber: phone
        }).then(c=> {
            if (c===null) {
                return "OK"
            }
            return null;
        })
    }

    async removeAttendee(id,phone,email) {
        return await this.getEventById(id).then(e=>{
            var theguest=null;
            for(var x=0; x<e.Guests.length; x++) {
                if (e.Guests[x].PhoneNumber===phone || e.Guests[x].EmailAddress===email) {
                    theguest=e.Guests[x];
                }
            }
            if (theguest!==null) {

                return this.db.EventScheduleGuests.findOne({
                    EventGuestID: theguest.EventGuestID,
                    EventScheduleID: e.Schedules[0].EventScheduleID
                }).then(esg=>{
                    return this.db.EventScheduleGuests.destroy({
                        EventScheduleID: e.Schedules[0].EventScheduleID,
                        EventGuestID: theguest.EventGuestID
                    }).then(r=>{
    
                        return this.db.EventGuests.destroy({
                            EventGuestID: theguest.EventGuestID
                        }).then(qr=>{
                            if (phone===null || phone==="Not Specified" || phone.length===0) { 
                                this.db.Partials.insert({
                                    FromPhone:null,
                                    PartialID: this.objs.uuidv4(),
                                    PhoneNumber:"",
                                    EmailAddress: email,
                                    Message: "<h3>Dear "+theguest.GuestName+",</h3><p>You have been uninvited from "+e.EventName+" by "+e.CreatorName+". The event may have been cancelled. Sorry :(</p>",
                                    Subject: "Uninvited From "+e.EventName
                                })

                                return "OK";
                            }
                            else {
                                return this.db.PhoneNumbers.findOne({
                                    PhoneID: esg.PhoneID
                                }).then(p=> {

                                    var stph = this.objs.utilityobj.standardizePhone(phone);
                                    if (stph!=="NotOK") {

                                        this.db.Partials.insert({
                                            FromPhone:p.PhoneNumber,
                                            PartialID: this.objs.uuidv4(),
                                            PhoneNumber:stph,
                                            EmailAddress: "",
                                            Message: "You have been uninvited from "+e.EventName+" by "+e.CreatorName+". The event may have been cancelled. Sorry :(",
                                            Subject: null
                                        })
                                    }

                                    return "OK";
                                })
                            }
                        })
                    })

                })
              
            }
        })
    }

    async rescheduleEvent(eventid,startdate,enddate,location,address,city,state,postalcode,flow) {
        return await this.db.EventSchedules.findOne({
            EventID: eventid,
            Status: 0
        }).then(es=> {
            if (es!==null) {

                return this.db.EventSchedules.update({
                    EventScheduleID: es.EventScheduleID
                },{
                    Status: 1
                }).then(u=>{

                    if (startdate===null) {
                        startdate=es.StartDate;
                    }

                    if (enddate===null) {
                        enddate=es.EndDate;
                    }

                    if (location===null) {
                        location=es.Location;
                    }

                    if (address===null) {
                        address=es.Address;
                    }

                    if (city===null) {
                        city=es.City;
                    }

                    if (state===null) {
                        state=es.State;
                    }

                    if (postalcode===null) {
                        postalcode=es.PostalCode;
                    }

                    return this.db.EventSchedules.insert({
                        EventScheduleID: this.objs.uuidv4(),
                        EventID: eventid,
                        IterationNum:es.IterationNum+1,
                        StartDate: startdate,
                        EndDate: enddate,
                        EventLength: es.EventLength,
                        Status: 0,
                        Location: location,
                        Address: address,
                        City: city,
                        State: state,
                        PostalCode: postalcode
                    }).then(e=> {

                        return this.db.EventScheduleGuests.find({
                            EventScheduleID: es.EventScheduleID
                        }).then(esg=>{
                            for(var x=0; x<esg.length; x++) {
                                this.db.EventScheduleGuests.insert({
                                    EventScheduleGuestID: this.objs.uuidv4(),
                                    EventScheduleID: e.EventScheduleID,
                                    Acceptance: null,
                                    EventGuestID: esg[x].EventGuestID,
                                    PhoneID: esg[x].PhoneID
                                })
                            }

                            return this.db.Events.find({
                                EventID: eventid
                            }).then(ev=>{
                                var areq=1;

                                if (flow===0) {
                                    this.objs.messageobj.sendMessage(ev.CreatorPhone,"Your event "+ev.EventName+" has been rescheduled");
                                }
                                if (flow===1 && ev.MustApproveDiffLocation===true) {
                                    areq=5;
                                    this.objs.messageobj.sendMessage(ev.CreatorPhone,"Your event "+ev.EventName+" has been rescheduled due to attendee location preferences. You must view/approve these changes: https://"+this.objs.envURL+"/event?e="+ev.Hash);
                                }
                                else if (flow===2 && ev.MustApproveDiffTime===true) {
                                    areq=6;
                                    this.objs.messageobj.sendMessage(ev.CreatorPhone,"Your event "+ev.EventName+" has been rescheduled due to attendee time preferences. You must view/approve these changes: https://"+this.objs.envURL+"/event?e="+ev.Hash);
                                }
                               
                                return this.db.Events.update({
                                    EventID: eventid
                                },{
                                    EventDate: startdate,
                                    ActionReq:areq,
                                    Reschedule:true
                                }).then(pox=>{
                                    
                                    return "OK"
                                })

                            })   
        
                        })
                    })

                })
            }
            else {
                return "An unexpected error occurred"
            }
        })
    }

    async scheduleEvent(eventid,params,phone,sdate,edate,clientid) {

        return await this.db.EventSchedules.insert({
            EventScheduleID: this.objs.uuidv4(),
            EventID: eventid,
            IterationNum:0,
            StartDate: sdate,
            EndDate: edate,
            EventLength: params.EventLength==='i'?-1:params.EventLength,
            Status: 0,
            Location: params.Location,
            Address: params.EventStreet,
            City: params.EventCity,
            State: params.EventState,
            PostalCode: params.EventZip
        }).then(e=> {

            for(var x=0; x<params.Guests.length; x++) {

                this.addGuest(eventid, params.Guests[x], false, null).then(g=> {
                    if (g!==null) { 
                        this.getPhoneID(g.EventGuestID).then(ph=> {
                            this.db.EventScheduleGuests.insert({
                                EventGuestID: g.EventGuestID,
                                Acceptance: null,
                                EventScheduleGuestID: this.objs.uuidv4(),
                                EventScheduleID: e.EventScheduleID,
                                PhoneID: ph
                            })
                        })
                    }
                });
            }

            if (params.WillAttend===true) {
                this.addGuest(eventid, {
                    gname: params.YourName,
                    gemail: null,
                    gphone: phone,
                    greq: true,                    
                }, true, clientid).then(gr=> {
                    if (gr!==null) {
                        this.getPhoneID(gr.EventGuestID).then(ph=> {
                            this.db.EventScheduleGuests.insert({
                                EventGuestID: gr.EventGuestID,
                                Acceptance: true,
                                EventScheduleGuestID: this.objs.uuidv4(),
                                EventScheduleID: e.EventScheduleID,
                                PhoneID: ph
                            })
                        })
                    }
                });
            }

            return e;
        })
    }

    async suggestNewLocation(eventid,evguestid,location,address,city,state,postalcode) {
        return await this.getEventById(eventid).then(e=> {

            if (e.AllowLocationChange!==true) {
                return "Location change not allowed";
            }

            return this.db.EventSuggestedLocations.find({
                EventID: eventid
            }).then(allest=>{

                for(var echeck=0; echeck<allest.length; echeck++) {
                    if (allest[echeck].EventGuestID===evguestid && e.Schedules[0].IterationNum===allest[echeck].IterationNum) {
                        return "AlreadyPresent";
                    }
                }
                return this.db.EventSuggestedLocations.insert({
                    EventSuggestedLocationID: this.objs.uuidv4(),
                    EventID: eventid,
                    Location: location,
                    Street: address,
                    City: city,
                    State: state,
                    PostalCode: postalcode,
                    EventGuestID: evguestid,
                    IterationNum: e.Schedules[0].IterationNum
                }).then(esl=>{
                    allest.push(esl);
                
                    for(var y=0; y<allest.length; y++) {
                        var voteCount=0; 
                        if (allest[y].IterationNum===e.Schedules[0].IterationNum) {
                            voteCount++;
                        }
                    }
                    if (voteCount>=(e.Guests.length/2)) {
                        var pollResults=[];
                        for(var tg=0; tg<allest.length; tg++) {
                            
                            var foundPR=false;
                            for(var pr=0; pr<pollResults.length; pr++) {
                                if (pollResults[pr].Address===allest[tg].Street && pollResults[pr].City===allest[tg].City) {
                                    foundPR=true;
                                    pollResults[pr].Count++;
                                }
                            }

                            if (!foundPR) {
                                pollResults.push({
                                    Location: allest[tg].Location,
                                    Address: allest[tg].Street,
                                    City: allest[tg].City,
                                    State: allest[tg].State,
                                    PostalCode: allest[tg].PostalCode,
                                    Count:1
                                });
                            }
                        }


                        var winner={Count:0};
                        for(var w=0; w<pollResults.length; w++) {
                            if (pollResults[w].Count>winner.Count) {
                                winner=pollResults[w];
                            }
                        }

                        return this.rescheduleEvent(eventid,null,null,winner.Location,winner.Address,winner.City,winner.State,winner.PostalCode,1).then(rse=> {
                            return "OK"
                        })
                    }
                    else {
                        return "OK"
                    }
                })
                
            })
        });
    }

    async suggestNewTime(eventid,evguestid,evtime) {
        return await this.getEventById(eventid).then(e=> {

            if (e.AllowReschedule!==true) {
                return "Reschedule not allowed";
            }

            return this.db.EventSuggestedTimes.find({
                EventID: eventid
            }).then(allest=>{

                for(var echeck=0; echeck<allest.length; echeck++) {
                    if (allest[echeck].EventGuestID===evguestid && e.Schedules[0].IterationNum===allest[echeck].IterationNum) {
                        return "AlreadyPresent";
                    }
                }

                var d=new Date(evtime).getTime()+(e.TimezoneOffset*60*1000);

                return this.db.EventSuggestedTimes.insert({
                    EventSuggestedTimeID: this.objs.uuidv4(),
                    EventID: eventid,
                    StartDate: d,
                    EventGuestID: evguestid,
                    IterationNum: e.Schedules[0].IterationNum
                }).then(est=>{

                    allest.push(est);
                
                    for(var y=0; y<allest.length; y++) {
                        var voteCount=0; 
                        if (allest[y].IterationNum===e.Schedules[0].IterationNum) {
                            voteCount++;
                        }
                    }
                    if (voteCount>=(e.Guests.length/2)) {
                        var pollResults=[];
                        for(var tg=0; tg<allest.length; tg++) {
                            
                            var foundPR=false;
                            for(var pr=0; pr<pollResults.length; pr++) {
                                if (pollResults[pr].Time===allest[tg].StartDate) {
                                    foundPR=true;
                                    pollResults[pr].Count++;
                                }
                            }

                            if (!foundPR) {
                                pollResults.push({
                                    Time: allest[tg].StartDate,
                                    Count:1
                                });
                            }
                        }


                        var winner={Count:0};
                        for(var w=0; w<pollResults.length; w++) {
                            if (pollResults[w].Count>winner.Count) {
                                winner=pollResults[w];
                            }
                        }

                        return this.rescheduleEvent(eventid,winner.Time,null,null,null,null,null,null,2).then(rse=> {
                            return "OK"
                        })

                    }
                    else {
                        return "OK"
                    }
                })
            })
        });
    }

    validateEvent(req,cli,sdate,edate,optouts,emailoptouts) {

        try {
            if (req.body.ClientName.length<1 || req.body.ClientName.length>128) {
                return "Client name is invalid";
            }

            if (req.body.EventName.length<1 || req.body.EventName.length>128) {
                return "Event name is invalid";
            }

            var addrr = this.verifyAddress(req);
            if (addrr!=="OK") {
                return addrr;
            }
            
            if (req.body.EventDescription.length>1024) {
                return "Event description is invalid";
            }

            var vdate = new Date().getTime();
            var diff = sdate-vdate;
            var hours = Math.round(diff/(1000*60*60))
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

            if (req.body.ReminderTime==="yes" && hours<25) {
                return "Cannot set a reminder time less than 25 hours before the event";
            }

            if (req.body.Guests.length===0) {
                return "At least one guest is required";
            }

            /* Verify that users don't pick unsupported options for their configuration */
            if (req.body.GuestListVisible===false) {

                req.body.GuestsCanChat=false;
                req.body.GuestsSeeRSVPs=false;               
            }

            if (req.body.GuestsCanBringOthers===false) {
                req.body.GuestsMustRegister=false;
                req.body.ProvideSharing=false;
                req.body.AllowChildren=false;              
            }

      
            for(var g=0; g<req.body.Guests.length; g++) {
                for(var o=0; o<optouts.length; o++) {
                    if (req.body.Guests[g].gphone===optouts[o].PhoneNumber) {
                        return "Phone number "+req.body.Guests[g].gphone+" is on the opt-out list. Cannot invite this guest";
                    }
                }

                for(var o=0; o<emailoptouts.length; o++) {
                    if (req.body.Guests[g].gemail===emailoptouts[o].EmailAddress) {
                        return "Email address "+req.body.Guests[g].gemail+" is on the opt-out list. Cannot invite this guest";
                    }
                }

                var vg = this.verifyGuest(req.body.Guests[g]);
                if (vg!=="OK") {
                    return vg;
                }
            }

            if (cli.EventCnt===3 && cli.IsPro!==true && cli.IsPremium!==true) {
                return "Non-premium accounts are allowed up to 3 events per month";
            }
            if (req.body.EventIsRecurring===true && cli.IsPremium!==true) {
                return "Recurring event not allowed";
            }
            if (req.body.Guests.length>50 && cli.IsPro!==true && cli.IsPremium===true) {
                return "Non-pro accounts are allowed up to 50 attendees";
            } 
            if (req.body.Guests.length>15 && cli.IsPro!==true && cli.IsPremium!==true) {
                return "No-premium accounts are allowed up to 15 attendees";
            }

            if (cli.IsPro!==true && cli.IsPremium!==true) {
                if (req.body.GuestsReschedule===true || req.body.GuestsChangeLocation===true) {
                    return "Reschedule and change location are not allowed for free accounts";
                }
            }

        }
        catch(e) {
            console.log(e);
            return "An unspecified error occurred";
        }

        return "OK";
    }

    verifyAddress(req) {
        if (req.body.Location.length<1 || req.body.Location.length>128) {
            return "Location is invalid";
        }

        if (req.body.EventStreet.length<1 || req.body.EventStreet.length>255) {
            return "Address is invalid";
        }

        if (req.body.EventCity.length<1 || req.body.EventCity.length>64) {
            return "City is invalid";
        }

        if (req.body.EventState!==null && req.body.EventState.length>0 && !this.objs.utilityobj.getUSStates().hasOwnProperty(req.body.EventState)) {
            return "State is invalid";
        }       

        if (req.body.EventZip!==null && req.body.EventZip.length>0 && req.body.EventZip.length!==5 && req.body.EventZip.length!==10) {
            return "Postal code is invalid";
        }   

        return "OK"
    }

    verifyGuest(guest) {
        if (guest.gname.length<1 || guest.gname.length>128) {
            return "Invalid guest name";
        }
        if (guest.gphone!=null && guest.gphone.length>0 && guest.gphone!=="Not Specified" && guest.gphone!==null) {
            var vp = this.objs.utilityobj.verifyPhone(guest.gphone);
            if (vp!=="OK") {
                return vp;
            }
        }
        if (guest.gemail!=null && guest.gemail.length>0 && guest.gemail!=="Not Specified" && guest.gemail!==null) {
            var ve = this.objs.utilityobj.verifyEmail(guest.gemail);
            if (ve!=="OK") {
                return ve;
            }
        }
        if ((guest.gemail===null||guest.gemail.length===0||guest.gemail==="Not Specified")&&(guest.gphone===null||guest.gphone.length===0||guest.gphone==="Not Specified")) {
            return "A guest does not have an email address or phone number"
        }

        return "OK";
    }

    async verifyOwner(eventid) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c!==null) {
                return this.db.Events.findOne({
                    EventID: eventid,
                    CreatorID: c
                }).then(e=>{
                    if (e!==null) {
                        return e; 
                    }
                    else {
                        return null;
                    }
                })
            }
            else {
                return null;
            }
        });
    }

    verifyPhone(eid,hash,phone) {
        this.objs.messageobj.sendMessage(phone, "Schedule Us - Verify phone number to set up event: https://"+this.objs.envURL+"/verifyphone?e="+eid+"&h="+hash);
    }

    async verifyPhoneConfirm(eid,hash) {
        return await this.db.Events.findOne({
            EventID: eid,
            Hash: hash,
            ActionReq: 0
        }).then(e=>{
            if (e!==null) {
                this.db.Events.update({
                    EventID: eid
                },{
                    ActionReq: 1
                }).then(r=>{
                    this.db.EventGuests.findOne({
                        EventID: eid,
                        PhoneNumber: e.CreatorPhone
                    }).then(eg=> {

                        this.objs.messageobj.sendMessage(e.CreatorPhone, "Schedule Us - Event/Activity set up. Access here: https://"+this.objs.envURL+"/event?e="+hash+"&g="+eg.EventGuestID);

                        return "OK";
                    });
                })                
            }
            else {
                return "Fail";
            }
        })
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_db) {
        this.db=_db;
    }
}

module.exports=events;