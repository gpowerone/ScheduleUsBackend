class events {

    addInvitee(EventID,ClientID,EventScheduleID,Required,PhoneNumber,EmailAddress) {
        this.db.EventScheduleContacts.insert({
            EventContactID: this.objs.uuidv1(),
            EventClientID: ClientID,
            PhoneNumber: PhoneNumber,
            EmailAddress: EmailAddress,
            EventID: EventID,
            EventScheduleID: EventScheduleID,
            Acceptance:false,
            Required:Required
        });
    }

    async createEvent(req) {

        var _EventClientID=null;

        // Authentication is optional for Create Event
        if (typeof(req.body.SessionID)!=="undefined") {
            var clid = this.objs.sessionobj.verify(req.body.ClientID,req.body.SessionID,req.body.SessionLong)
            if (clid!==null) {
                _EventClientID=clid
            }
        }

        return await db.Events.insert({
            ActionReq: 0,
            EventID: this.objs.uuidv1(),
            EventClientID: _EventClientID,
            EventType: req.body.ventType,
            IsRecurring: req.body.IsRecurring,
            CreationDate: new Date().now(),
            EventDescription: req.body.EventDescription,
            AllowReschedule: req.body.AllowReschedule,
            AllowLocationChange: req.body.AllowLocationChange,
            IsOpenEvent: req.body.IsOpenEvent
        }).then(r => {
  
          for(var x=0; x<req.body.AvailableTimes.length; x++) {
              this.db.EventAvailableTimes.insert({
                    EventAvailableTimeID: this.objs.uuidv1(),
                    EventID: r.EventID,
                    StartDate: req.body.AvailableTimes[x]
              });
          }

          this.db.EventSchedules.insert({
                EventID: r.EventID,
                EventScheduleID: this.objs.uuidv1(),
                IterationNum: 0,
                Address: req.body.Address,
                City: req.body.City,
                State: req.body.State,
                EventLength: req.body.EventLength,
                PostalCode: req.body.PostalCode,
                StartDate: req.body.StartDate,
                Status: 0,
                TimeScheduled: null,
                TimeZone: req.body.TimeZone
            }).then(rs=> {

                for (var x=0; x<req.body.Invitees.length; x++) {
                    if (req.body.Invitees[x].PhoneNumber!==null) {
                        clientobj.getClientByPhone(req.body.Invitees[x].PhoneNumber).then(rc => {
                            if (rc===null) {
                                this.addInvitee(r.EventID, null, rs.EventScheduleID, req.body.Invitees[x].Required, req.body.Invitees[x].PhoneNumber, null);
                            }
                            else {
                                this.addInvitee(r.EventID, rc.ClientID, rs.EventScheduleID, req.body.Invitees[x].Required, req.body.Invitees[x].PhoneNumber, null);
                            }
                        });
                    }
                    else if (req.body.Invitees[x].EmailAddress!==null) {
                        clientobj.getClientByEmail(req.body.Invitees[x].EmailAddress).then(rc => {
                            if (rc===null) {
                                this.addInvitee(r.EventID, null, rs.EventScheduleID, req.body.Invitees[x].Required, null, req.body.Invitees[x].EmailAddress);
                            }
                            else {
                                this.addInvitee(r.EventID, rc.ClientID, rs.EventScheduleID, req.body.Invitees[x].Required, null, req.body.Invitees[x].EmailAddress);
                            }
                        });
                    }
                }
            })
        });
    }

    validateEvent(req) {

        try {
            if (req.body.Name.length<1 || req.body.Name.length>128) {
                return "Name is invalid";
            }

            if (req.body.Address.length<1 || req.body.Address.length>255) {
                return "Address is invalid";
            }

            if (req.body.City.length<1 || req.body.City.length>64) {
                return "City is invalid";
            }

            if (!utilityobj.getUSStates().hasProperty(req.body.State)) {
                return "State is invalid";
            }

            if (req.body.PostalCode.length!==5 && req.body.PostalCode.length!==10) {
                return "Postal code is invalid";
            }

            if (req.body.EventClientID!==null && !uuidvalidate(req.body.EventClientID)) {
                return "An unspecified error occurred";
            }

            if (req.body.EventType<0 || req.body.EventType>1) {
                return "Invalid event type";
            }

            if (req.body.IsRecurring!==false && req.body.IsRecurring!==true) {
                return "Invalid recurring type";
            }

            if (req.body.AllowLocationChange!==false && req.body.AllowLocationChange!==true) {
                return "Invalid location change";
            }

            if (req.body.AllowReschedule!==false && req.body.AllowReschedule!==true) {
                return "Invalid allow reschedule";
            }

            if (req.body.TimeZone===null) {
                return "Invalid time zone";
            }
        }
        catch(e) {
            return "An unspecified error occurred";
        }

        return "OK";

    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_db) {
        this.db=_db;
    }
}

module.exports=events;