class Session {
 
    async create(clientID) {
        return await this.db.Sessions.insert({
            ClientID: clientID,
            SessionID: this.ud(),
            SessionLong: this.ut.createHash(128),
            ValidStartDate: new Date().now()
        }).then(r=> {
            return r;
        })
    }

    async verify(sessionID) {
        return await this.db.Sessions.findOne({
            SessionID: sessionID
        }).then(r=> {
            if (r===null) {
                return null
            }
            return r.ClientID
        });
    }

    constructor(_db, _ut, _ud) {
        this.db=_db;
        this.ud=_ud;
    }
}

module.exports=Session