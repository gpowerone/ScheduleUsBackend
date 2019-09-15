class Session {
 
    async create(clientID) {
        return await this.db.Sessions.insert({
            ClientID: clientID,
            SessionID: this.objs.uuidv4(),
            SessionLong: this.objs.utilityobj.createHash(128),
            ValidStartDate: Date.now()
        }).then(r=> {
            return r;
        })
    }

    async deleteForClient(clientID) {
        return await this.db.Sessions.destroy({
            ClientID: clientID
        }).then(r=> {
            return r;
        });
    }

    async logout(clientID, sessionID) {
        return await this.db.Sessions.destroy({
            ClientID: clientID,
            SessionID: sessionID
        }).then(r=> {
            return "OK";
        });
    }

    setSession(clientID, sessionID, sessionLong) {
        this.clientID=clientID;
        this.sessionID=sessionID;
        this.sessionLong=sessionLong;
    }

    async verify() {

        return await this.db.Sessions.findOne({
            SessionID: this.sessionID,
            ClientID: this.clientID,
            SessionLong: this.sessionLong
        }).then(r=> {        
            if (r===null) {
                return null
            }
            return r.ClientID
        });
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_db) {
        this.db=_db;
    }
}

module.exports=Session