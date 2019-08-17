class events {

    async addGuest(eventID, guest) {

        if (guest.gemail!==null && this.objs.utilityobj.verifyEmail(guest.gemail)!=="OK") {
            return new Promise(null);
        }

        if (guest.gphone!==null && this.objs.utilityobj.verifyPhone(guest.gphone)!=="OK") {
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
            IsOrganizer: false
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
                
                var validationStatus = this.validateEvent(req,cli,phone);
                if (validationStatus==="OK") {
                    return this.db.Events.insert({
                        CreatorID: creatorID,
                        CreatorPhone: phone,
                        EventID: this.objs.uuidv1(),
                        EventName: req.body.EventName,
                        Hash: this.objs.utilityobj.createHash(32),
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
                        LimitPlusOnes:req.body.GuestLimitPerPerson,
                        AllowChildren: req.body.GuestsBringChildren,
                        ProvideSharing: req.body.GuestsProvideSharing,
                        NotifyWhenGuestsAccept:req.body.NotifyGuestAccept,
                        NotifyOnNewMessages:req.body.NotifyNewMessages,
                        NotifyEventReschedule:req.body.NotifyEventRescheduled,
                        NotifyLocationChanged:req.body.NotifyEventLocationChanges,
                        GuestsCanChat:req.body.GuestsCanDiscuss,
                        NotifySchedulingComplete:req.body.NotifyScheduleComplete,
                        AllowPets:req.body.GuestsBringPets,
                        ReminderTime: req.body.ReminderTime,
                        SeeRSVPed: req.body.GuestsSeeRSVPs,
                        ScheduleCutoffTime:req.body.ScheduleCutOffTime,
                        TimezoneOffset:req.body.UTCOffset,
                        MustApproveDiffLocation: req.body.MustApproveDiffLocation,
                        MustApproveDiffTime: req.body.MustApproveDiffTime 
                    }).then(r=> {
                        if (r!==null && typeof(r.EventID)!==undefined) {
                    
                            if (actionReq===1) {
                                return this.scheduleEvent(r.EventID,req.body,phone).then(e=> {
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
                                    })
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
                            return {
                                h: hosting,
                                p: participating
                            }
                        });                      
                    })
                });
            })
        });
    }

    async scheduleEvent(eventid,params,phone) {
        return await this.db.EventSchedules.insert({
            EventScheduleID: this.objs.uuidv1(),
            EventID: eventid,
            IterationNum:0,
            StartDate: params.EventDate,
            TimeScheduled:null,
            EventLength: params.EventLength,
            Status: 0,
            Address: params.EventStreet,
            City: params.EventCity,
            State: params.EventState,
            PostalCode: params.EventZip
        }).then(e=> {

            for(var x=0; x<params.Guests.length; x++) {

                this.addGuest(eventid, params.Guests[x]).then(g=> {

                    this.db.EventScheduleGuests.insert({
                        EventGuestID: g.EventGuestID,
                        Acceptance: false,
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
                    greq: true
                }).then(g=> {
                    if (g!==null) {
                        this.db.EventScheduleGuests.insert({
                            EventGuestID: g.EventGuestID,
                            Acceptance: false,
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

            if (req.body.Guests.length===0) {
                return "At least one guest is required";
            }

            for(var g=0; g<req.body.Guests.length; g++) {
                var guest = req.body.Guests[g];
                if (guest.gname.length<1 || guest.gname.length>128) {
                    return "Invalid guest name";
                }
                var vp = this.objs.utilityobj.verifyPhone(guest.gphone);
                if (vp!=="OK") {
                    return vp;
                }
                var ve = this.objs.utilityobj.verifyEmail(guest.gemail);
                if (ve!=="OK") {
                    return ve;
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