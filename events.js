class events {

    addInvitee(EventID,ClientID,EventScheduleID,Required,PhoneNumber,EmailAddress) {
        this.db.EventScheduleContacts.insert({
            EventContactID: this.ud(),
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
        if (typeof(req.SessionID)!=="undefined") {
            var clid = this.se.verify(req.SessionID)
            if (clid!==null) {
                _EventClientID=clid
            }
        }

        return await db.Events.insert({
            ActionReq: 0,
            EventID: this.ud(),
            EventClientID: _EventClientID,
            EventType: req.EventType,
            IsRecurring: req.IsRecurring,
            CreationDate: new Date().now(),
            EventDescription: req.EventDescription,
            AllowReschedule: req.AllowReschedule,
            AllowLocationChange: req.AllowLocationChange,
            IsOpenEvent: req.IsOpenEvent
        }).then(r => {
  
          for(var x=0; x<req.AvailableTimes.length; x++) {
              this.db.EventAvailableTimes.insert({
                    EventAvailableTimeID: this.ud(),
                    EventID: r.EventID,
                    StartDate: req.AvailableTimes[x]
              });
          }

          this.db.EventSchedules.insert({
                EventID: r.EventID,
                EventScheduleID: this.ud(),
                IterationNum: 0,
                Address: req.Address,
                City: req.City,
                State: req.State,
                EventLength: req.EventLength,
                PostalCode: req.PostalCode,
                StartDate: req.StartDate,
                Status: 0,
                TimeScheduled: null,
                TimeZone: req.TimeZone
            }).then(rs=> {

                for (var x=0; x<req.Invitees.length; x++) {
                    if (req.Invitees[x].PhoneNumber!==null) {
                        this.cl.getClientByPhone(req.Invitees[x].PhoneNumber).then(rc => {
                            if (rc===null) {
                                this.addInvitee(r.EventID, null, rs.EventScheduleID, req.Invitees[x].Required, req.Invitees[x].PhoneNumber, null);
                            }
                            else {
                                this.addInvitee(r.EventID, rc.ClientID, rs.EventScheduleID, req.Invitees[x].Required, req.Invitees[x].PhoneNumber, null);
                            }
                        });
                    }
                    else if (req.Invitees[x].EmailAddress!==null) {
                        this.cl.getClientByEmail(req.Invitees[x].EmailAddress).then(rc => {
                            if (rc===null) {
                                this.addInvitee(r.EventID, null, rs.EventScheduleID, req.Invitees[x].Required, null, req.Invitees[x].EmailAddress);
                            }
                            else {
                                this.addInvitee(r.EventID, rc.ClientID, rs.EventScheduleID, req.Invitees[x].Required, null, req.Invitees[x].EmailAddress);
                            }
                        });
                    }
                }
            })
        });
    }

    validateEvent(req) {

        try {
            if (req.Name.length<1 || req.Name.length>128) {
                return "Name is invalid";
            }

            if (req.Address.length<1 || req.Address.length>255) {
                return "Address is invalid";
            }

            if (req.City.length<1 || req.City.length>64) {
                return "City is invalid";
            }

            if (!this.ut.getUSStates().hasProperty(req.State)) {
                return "State is invalid";
            }

            if (req.PostalCode.length!==5 && req.PostalCode.length!==10) {
                return "Postal code is invalid";
            }

            if (req.EventClientID!==null && !this.uv(req.EventClientID)) {
                return "An unspecified error occurred";
            }

            if (req.EventType<0 || req.EventType>1) {
                return "Invalid event type";
            }

            if (req.IsRecurring!==false && req.IsRecurring!==true) {
                return "Invalid recurring type";
            }

            if (req.AllowLocationChange!==false && req.AllowLocationChange!==true) {
                return "Invalid location change";
            }

            if (req.AllowReschedule!==false && req.AllowReschedule!==true) {
                return "Invalid allow reschedule";
            }

            if (req.TimeZone===null) {
                return "Invalid time zone";
            }
        }
        catch(e) {
            return "An unspecified error occurred";
        }

        return "OK";

    }

    constructor(_db, _ut, _cl, _se, _ud, _uv) {
        this.db=_db;
        this.ut=_ut;
        this.cl=_cl;
        this.se=_se;
        this.ud=_ud;
        this.uv=_uv;
    }
}

module.exports=events;