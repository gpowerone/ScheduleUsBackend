class events {

    async addComment(eventID, eventGuestID, parentID, comment) {
   
        if (comment.length<1) {
            return "Comment is required";
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

                return this.db.EventComments.insert({
                    EventCommentID: this.objs.uuidv4(),
                    EventID: eventID,
                    EventGuestID: eventGuestID,
                    CommenterName: c,
                    Comment: comment,
                    ParentID: parentID,
                    CreationDate: new Date().getTime()
                }).then(r=> {
                    if (e.NotifyOnNewMessages===true) {
                        this.objs.messageobj.sendMessage(e.CreatorPhone, c+" commented on your event/activity "+e.EventName+ " https://"+this.objs.envURL+"/#/event?e="+hash+"&c="+r.EventCommentID);
                    }

                    return "OK";
                });
            });
        });
    }

    async addGuest(eventID, guest, isOrg, clientID) {

        if (guest.gemail!==null && guest.gemail!=="Not Specified" && this.objs.utilityobj.verifyEmail(guest.gemail)!=="OK") {
            return new Promise(null);
        }

        if (guest.gphone!==null && guest.gphone!=="Not Specified" && this.objs.utilityobj.verifyPhone(guest.gphone)!=="OK") {
            return new Promise(null);
        }

        if ((guest.gemail===null && guest.gphone===null) || (guest.gemail==="Not Specified" && guest.gphone==="Not Specified")) {
            return new Promise(null);
        }

        var phone = this.objs.utilityobj.standardizePhone(guest.gphone);

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

    async addScheduledGuest(eventScheduleID,eventGuestID) {
        return await this.getPhoneID(eventGuestID).then(ph=> {
            this.db.EventScheduleGuests.insert({
                EventGuestID: eventGuestID,
                Acceptance: true,
                EventScheduleGuestID: this.objs.uuidv4(),
                EventScheduleID: eventScheduleID,
                PhoneID: ph,
                SpecialSend: 0
            })
        })
    }

    async completeVerification(eventID,hash) {
        return await this.getEventById(eventid).then(e=> {
            if (e!==null) {
                if (e.Hash===hash) {
                    self.db.Events.update({
                        EventID: eventID
                    }, {
                        ActionReq: 1
                    });

                    return "OK";
                }
                else {
                    return "An error occurred";
                }
            }
            else {
                return "An error occurred";
            }
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

                var actionReq=0;

                var phone = this.objs.utilityobj.standardizePhone(req.body.ClientPhone);
                if (phone==="NotOK") {
                    return "Invalid Event";
                }

                var creatorID="00000000-0000-0000-0000-000000000000";

                if (cli !==null) {
                    if (phone===cli.PhoneNumber) {
                        actionReq=1;
                    }
                    creatorID=cli.ClientID;
                }


                var sdate = new Date(req.body.EventDate).getTime()+req.body.UTCOffset;
                var validationStatus = this.validateEvent(req,cli,sdate);
                if (validationStatus==="OK") {
                
                    return this.phoneSecurity(actionReq,phone).then(ps=> {
                        if (ps===null) {
                            return "This phone number is associated with an account. You must log in."
                        }

                        return this.db.Events.insert({
                            CreatorID: creatorID,
                            CreatorPhone: phone,
                            CreatorName: req.body.ClientName,
                            EventID: this.objs.uuidv4(),
                            EventName: req.body.EventName,
                            Hash: this.createEvHash(),
                            IsRecurring: req.body.EventIsRecurring,
                            EventDescription: req.body.EventDescription,
                            CreationDate: Date.now(),
                            AllowReschedule: req.body.GuestsReschedule,
                            AllowLocationChange:req.body.GuestsChangeLocation,
                            ActionReq: actionReq,
                            GuestListVisible:req.body.GuestListVisible,
                            GuestsMustRegister:req.body.GuestsMustRegister,
                            GuestsCanBringOthers:req.body.GuestsBringOthers,
                            EventMaxCapacity:parseInt(req.body.GuestLimitTotal),
                            AllowChildren: req.body.GuestsBringChildren,
                            ProvideSharing: req.body.GuestsProvideSharing,
                            NotifyWhenGuestsAccept:req.body.NotifyGuestAccept,
                            NotifyOnNewMessages:req.body.NotifyNewMessages,
                            NotifyEventReschedule:req.body.NotifyEventRescheduled,
                            NotifyLocationChanged:req.body.NotifyEventLocationChanges,
                            GuestsCanChat:req.body.GuestsCanDiscuss,
                            NotifySchedulingComplete:req.body.NotifyScheduleComplete,
                            ReminderTime: req.body.ReminderTime,
                            SeeRSVPed: req.body.GuestsSeeRSVPs,
                            ScheduleCutoffTime:req.body.ScheduleCutoffTime,
                            TimezoneOffset:req.body.UTCOffset,
                            MustApproveDiffLocation: req.body.MustApproveDiffLocation,
                            MustApproveDiffTime: req.body.MustApproveDiffTime,
                            EventDate: sdate
                        }).then(r=> {
                            if (r!==null && typeof(r.EventID)!==undefined) {
                        
                                if (actionReq===1) {
                                    return this.scheduleEvent(r.EventID, req.body, phone, sdate, creatorID).then(e=> {
                                        return "?e="+r.Hash;
                                    }); 
                                }
                                else {
                                    return this.scheduleEvent(r.EventID, req.body, phone, sdate, creatorID).then(e=> {
                                        this.verifyPhone(r.EventID, r.Hash, phone);
                                        return "OK"; 
                                    }); 
                                    
                                }
                            }
                            else {
                                return "Database failure";
                            }
                        })
                    })
                }
                else {
                    return validationStatus;
                }
            })
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
                                if (e.NotifySchedulingComplete===true && accptCnt===es.length-1) {
                                    if (e.CreatorID!=="00000000-0000-0000-0000-000000000000") 
                                    {  
                                        this.db.EventGuests.findOne({
                                            ClientID: e.CreatorID
                                        }).then(eg=> {
                                            this.objs.messageobj.sendMessage(e.CreatorPhone, "All attendees have replied to your invitation for "+e.EventName+". Access here: https://"+this.objs.envURL+"/#/event?e="+e.Hash+"&g="+eg.EventGuestID);
                                            return "OK";
                                        });

                                    }
                                    else {
                                        this.db.EventGuests.findOne({
                                            PhoneNumber: CreatorPhone
                                        }).then(eg=> {
                                            this.objs.messageobj.sendMessage(e.CreatorPhone, "All attendees have replied to your invitation for "+e.EventName+". Access here: https://"+this.objs.envURL+"/#/event?e="+e.Hash+"&g="+eg.EventGuestID);
                                            return "OK";
                                        });
                                    }
                                }
                                else if (e.NotifyWhenGuestsAccept===true) {
                                    this.db.EventGuests.findOne({
                                        EventGuestID: ESGID
                                    }).then(eg=> {
                                        this.objs.messageobj.sendMessage(e.CreatorPhone, eg.GuestName+" has "+(rsvp===true?"accepted":"rejected")+" your invitation to "+e.EventName);
                                        return "OK";
                                    })
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
                                    }
                                }
                                else {
                                    if (eg[g].EventGuestID===me) {
                                        r.EGID=eg[g].EventGuestID;
                                        r.NeedsAcceptance=(accpt===null)?true:false;
                                        r.Acceptance=accpt;
                                        egid=r.EGID;
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

                            if (r.GuestsCanBringOthers===true) {
                                r.MoreAllowed=true;
                                if (r.EventMaxCapacity<=r.Guests.length) {
                                    r.MoreAllowed=false;
                                }
                            }
                            else {
                                // If guests can't bring others then we need some ID to show the page
                                if (r.EGID===null) {
                                    return null;
                                }
                            }

                            return this.db.EventComments.find({
                                EventID: r.EventID
                            }).then(ec=> {
                                r.Comments=[];
                                if (ec!=null && ec.length>0) {
                                    r.Comments = this.objs.utilityobj.createTree(ec,"00000000-0000-0000-0000-000000000000");
                                }
                                return r;
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

    async scheduleEvent(eventid,params,phone,sdate,clientid) {
        return await this.db.EventSchedules.insert({
            EventScheduleID: this.objs.uuidv4(),
            EventID: eventid,
            IterationNum:0,
            StartDate: sdate,
            EventLength: params.EventLength,
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
                                PhoneID: ph,
                                SpecialSend: 0
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
                                PhoneID: ph,
                                SpecialSend: 0
                            })
                        })
                    }
                });
            }

            return e;
        })
    }

    validateEvent(req,cli,sdate) {

        try {
            if (req.body.ClientName.length<1 || req.body.ClientName.length>128) {
                return "Client name is invalid";
            }

            if (req.body.EventName.length<1 || req.body.EventName.length>128) {
                return "Event name is invalid";
            }

            if (req.body.Location.length<1 || req.body.Location.length>128) {
                return "Location is invalid";
            }

            if (req.body.EventStreet.length<1 || req.body.EventStreet.length>255) {
                return "Address is invalid";
            }

            if (req.body.EventCity.length<1 || req.body.EventCity.length>64) {
                return "City is invalid";
            }

            if (!this.objs.utilityobj.getUSStates().hasOwnProperty(req.body.EventState)) {
                return "State is invalid";
            }

            if (req.body.EventZip.length!==5 && req.body.EventZiplength!==10) {
                return "Postal code is invalid";
            }            

            var vdate = new Date().getTime()+req.body.UTCOffset;
            var diff = sdate-vdate;
            var hours = Math.round(diff/(1000*60*60))
            var length = parseInt(req.body.EventLength)/60;
            if (hours<length) {
                return "Cannot schedule dates in the past";
            }

            if (parseInt(req.body.ReminderTime)>hours) {
                return "Cannot set a reminder time past the date of the event";
            }

            if (parseInt(req.body.ScheduleCutoffTime)>hours) {
                return "Cannot set a cutoff time past the date of the event";
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
                var vg = this.verifyGuest(req.body.Guests[g]);
                if (vg!=="OK") {
                    return vg;
                }
            }

            var glt = parseInt(req.body.GuestLimitTotal);

            if (cli===null) {
                if (req.body.EventIsRecurring===true) {
                    return "Recurring event not allowed";
                }
                if (req.body.Guests.length>8) {
                    return "Up to 8 guests allowed when not logged in"
                }
                if (glt>8) {
                    return "Maximum guest total cannot be greater than 8"
                }
            }
            else {
                if (req.body.EventIsRecurring===true && c.IsPremium!==true) {
                    return "Recurring event not allowed";
                }
                if (req.body.Guests.length>50 && cli.IsPro!==true) {
                    return "Non-pro accounts are allowed up to 50 guests";
                }
                if (glt>50) {
                    return "Maximum guest total cannot be greater than 50";
                }
            }


            if (req.body.UTCOffset===null) {
                return "Invalid UTC Offset";
            }
        }
        catch(e) {
            return "An unspecified error occurred";
        }

        return "OK";
    }

    verifyGuest(guest) {
        if (guest.gname.length<1 || guest.gname.length>128) {
            return "Invalid guest name";
        }
        if (guest.gphone!=="Not Specified" && guest.gphone!==null) {
            var vp = this.objs.utilityobj.verifyPhone(guest.gphone);
            if (vp!=="OK") {
                return vp;
            }
        }
        if (guest.gemail!=="Not Specified" && guest.gemail!==null) {
            var ve = this.objs.utilityobj.verifyEmail(guest.gemail);
            if (ve!=="OK") {
                return ve;
            }
        }
        return "OK";
    }

    verifyPhone(eid,hash,phone) {
        this.objs.messageobj.sendMessage(phone, "Schedule Us - Verify phone number to set up event/activity: https://"+this.objs.envURL+"/#/verifyphone?e="+eid+"&h="+hash);
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

                        this.objs.messageobj.sendMessage(e.CreatorPhone, "Schedule Us - Event/Activity set up. Access here: https://"+this.objs.envURL+"/#/event?e="+hash+"&g="+eg.EventGuestID);

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