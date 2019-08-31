class events {

    async addComment(eventID, eventGuestID, parentID, name, comment) {
        if (name.length<1) {
            return "Name is required";
        }

        if (comment.length<1) {
            return "Comment is required";
        }

        return await this.db.EventComments.insert({
            EventCommentID: this.objs.uuidv1(),
            EventID: eventID,
            EventGuestID: eventGuestID,
            CommenterName: name,
            Comment: comment,
            ParentID: parentID,
            CreationDate: new Date().getTime()
        }).then(r=> {
            return "OK";
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
            EventGuestID: this.objs.uuidv1(),
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

                var creatorID=null;

                if (cli !==null) {
                    if (phone===cli.PhoneNumber) {
                        actionReq=1;
                    }
                    creatorID=cli.ClientID;
                }

                var sdate = new Date(req.body.EventDate).getTime()+req.body.UTCOffset;

                var validationStatus = this.validateEvent(req,cli,phone,sdate);
                if (validationStatus==="OK") {
                    return this.db.Events.insert({
                        CreatorID: creatorID,
                        CreatorPhone: phone,
                        CreatorName: req.body.ClientName,
                        EventID: this.objs.uuidv1(),
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
                        EventMaxCapacity:req.body.GuestLimitTotal,
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
                        ScheduleCutoffTime:req.body.ScheduleCutOffTime,
                        TimezoneOffset:req.body.UTCOffset,
                        MustApproveDiffLocation: req.body.MustApproveDiffLocation,
                        MustApproveDiffTime: req.body.MustApproveDiffTime,
                        EventDate: sdate
                    }).then(r=> {
                        if (r!==null && typeof(r.EventID)!==undefined) {
                    
                            if (actionReq===1) {
                                return this.scheduleEvent(r.EventID, req.body, phone, sdate, creatorID).then(e=> {
                                    return "OK";
                                }); 
                            }
                            else {
                                for (var x=0; x<req.body.Guests.length; x++) {
                                    this.addGuest(r.EventID, req.body.Guests[x]);
                                }
                                if (req.body.WillAttend===true) {
                                    this.addGuest(r.EventID, {
                                        gname: req.body.YourName,
                                        gemail: null,
                                        gphone: phone,
                                        greq: true
                                    }, true)
                                }
                                this.verifyPhone(e.EventID,e.Hash,phone);
                                return "OK"; 
                            }
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
       });       
    }

    async getEventByHash(hsh, me, imic) {
        return await this.db.Events.findOne({ 
            Hash: hsh
        }).then(r=> {
            if (r!==null) {
                if (r.EventDate<new Date().getTime()) {
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
                        for(var s=0; s<es.length; s++) {
                            r.Schedules.push(es[s]);
                        }
                   
                        return this.db.EventScheduleGuests.find({
                            EventScheduleID: es.EventScheduleID
                        }).then(esg=> {

                            r.Guests=[];
                            for(var g=0; g<eg.length; g++) {

                                var accpt=null;
                                
                                for(var ga=0; ga<esg.length; ga++) {

                                    if (esg[ga].EventGuestID==eg[g].EventGuestID) {
                                        accpt=esg[ga].Acceptance;
                                    }

                                    if (!imic) {
                                        if (esg[ga].EventGuestID===me) {
                                            r.NeedsAcceptance=accpt;
                                        }
                                    }                                
                                }

                                if (imic) {
                                    if (eg[g].ClientID===me) {
                                        r.NeedsAcceptance=accpt;
                                    }
                                }            

                                r.Guests.push({
                                    GuestName: eg[g].GuestName,
                                    Acceptance: accpt
                                });
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

                    return r;
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
                    return this.db.EventGuests.find(fc).then(particguest=> {

                        var vor=[];
                        for (var pg=0; pg<particguest.length; pg++) {
                            vor.push({
                                EventID: particguest[pg].EventID
                            })
                        }

                        return this.db.Events.find({or: vor}).then(participating=> {

                            var host= [];
                            var part =[];
                            for(var n=0; n<hosting.length; n++) {
                                if (hosting[n].EventDate>new Date().getTime()) {
                                    host.push(hosting[n]);
                                }
                            }
                            for(var n=0; n<participating.length; n++) {
                                if (participating[n].EventDate>new Date().getTime()) {
                                    part.push(participating[n]);
                                }
                            }


                            return {
                                h: host,
                                p: part
                            }
                        });                      
                    })
                });
            })
        });
    }

    async scheduleEvent(eventid,params,phone,sdate,clientid) {
        return await this.db.EventSchedules.insert({
            EventScheduleID: this.objs.uuidv1(),
            EventID: eventid,
            IterationNum:0,
            StartDate: sdate,
            TimeScheduled:null,
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

                    this.db.EventScheduleGuests.insert({
                        EventGuestID: g.EventGuestID,
                        Acceptance: null,
                        EventScheduleGuestID: this.objs.uuidv1(),
                        EventScheduleID: e.EventScheduleID
                    })
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
                        this.db.EventScheduleGuests.insert({
                            EventGuestID: gr.EventGuestID,
                            Acceptance: true,
                            EventScheduleGuestID: this.objs.uuidv1(),
                            EventScheduleID: e.EventScheduleID
                        })
                    }
                });
            }

            return e;
        })
    }

    validateEvent(req,cli) {

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

            if (!Number.isInteger(req.body.GuestLimitPerPerson)) {
                return "Guest limit per person is invalid";
            }

            if (!Number.isInteger(req.body.GuestLimitTotal)) {
                return "Total guest limit is invalid";
            } 

            var vdate = new Date().getTime()+req.body.UTCOffset;
            var diff = sdate.getTime()-vdate.getTime();
            var hours = Math.round(diff/(1000*60*60))
            var length = parseInt(params.EventLength)/60;
            if (hours<length) {
                return "Cannot schedule dates in the past";
            }

            if (parseInt(params.ReminderTime)>hours) {
                return "Cannot set a reminder time past the date of the event";
            }

            if (parseInt(params.ScheduleCutoffTime)>hours) {
                return "Cannot set a cutoff time past the date of the event";
            }

            if (req.body.Guests.length===0) {
                return "At least one guest is required";
            }

            if (req.body.GuestListVisible===false) {
                if (req.body.GuestsCanChat===true || req.body.req.body.GuestsSeeRSVPs===true) {
                    return "Invalid option";
                }
            }

            /* Verify that users don't pick unsupported options for their configuration */
            /*
     
                     
                        GuestListVisible:req.body.GuestListVisible,
                        GuestsMustRegister:req.body.GuestsMustRegister,
                        GuestsCanBringOthers:req.body.GuestsBringOthers,
                        EventMaxCapacity:req.body.GuestLimitTotal,
                        LimitPlusOnes:req.body.GuestLimitPerPerson,
                        AllowChildren: req.body.GuestsBringChildren,
                        ProvideSharing: req.body.GuestsProvideSharing,
                       
                        GuestsCanChat:req.body.GuestsCanDiscuss,
                        NotifySchedulingComplete:req.body.NotifyScheduleComplete,
                        AllowPets:req.body.GuestsBringPets,
                        ReminderTime: req.body.ReminderTime,
                        SeeRSVPed: req.body.GuestsSeeRSVPs,
                        ScheduleCutoffTime:req.body.ScheduleCutOffTime,
                        TimezoneOffset:req.body.UTCOffset,
                        MustApproveDiffLocation: req.body.MustApproveDiffLocation,
                        MustApproveDiffTime: req.body.MustApproveDiffTime,

            */

            for(var g=0; g<req.body.Guests.length; g++) {
                var guest = req.body.Guests[g];
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
            }

            if (cli===null) {
                if (req.body.EventIsRecurring===true) {
                    return "Recurring event not allowed";
                }
                if (this.Guests.length>8) {
                    return "Up to 8 guests allowed when not logged in"
                }
            }
            else {
                if (req.body.EventIsRecurring===true && c.IsPremium!==true) {
                    return "Recurring event not allowed";
                }
                if (req.body.Guests.length>50 && cli.IsPro!==true) {
                    return "Non-pro accounts are allowed up to 50 guests";
                }
            }

            if (req.body.UTCOffset===null) {
                return "Invalid UTC Offset";
            }
        }
        catch(e) {
            console.log(e);
            return "An unspecified error occurred";
        }

        return "OK";
    }

    verifyPhone(eid,hash,phone) {
        this.objs.messageobj.sendMessage(phone, "Schedule Us - Verify phone number to set up event: https://"+this.objs.envURL+"/vphone.html?e="+eid+"&h="+hash);
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_db) {
        this.db=_db;
    }
}

module.exports=events;