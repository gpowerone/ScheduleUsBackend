class client {

    async accountRecovery(phoneNumber) {
        return await this.getClientByPhone(phoneNumber).then(r => {
            if (r!==null) {
                return r.secquestion;
            }
            return null;
        })
    }

    async accountSecurityQuestion(clientid, answer) {
        return await this.getClientByID(clientid).then(r=> {
            if (r!==null) {
                this.bc.genSalt(7, function(err, salt) {
                    this.bc.hash(answer, salt, function(err, _hash) {
                        if (r.secanswer===_hash) {
                            return true;
                        }
                    })
                })
            }
            return false;
        })
    }

    async accountVerify(clientid,verificationcode) {
        return await this.getClientByID(clientid).then(r=> {
           if (r!==null) {
              if (r.Verification===verificationcode) {
                 r.Verification=null;
                 this.db.Clients.update(r);

                 return true;
              }
           }
           return false;
        })
    }

    async create(phone,passwd,secquestion,secanswer) {

        var msg = verify(phone,passwd);
        if (msg==="OK")
        {
            var hash=null;
            var sechash=null;

            this.bc.genSalt(7, function(err, salt) {
                this.bc.hash(passwd, salt, function(err, _hash) {
                    hash=_hash;
                })
            })

            this.bc.genSalt(7, function(err, salt) {
                this.bc.hash(secanswer, salt, function(err, _sechash) {
                    sechash=_sechash;
                })
            })

            if (hash===null || sechash===null) {
                return null;
            }

            return await this.db.Clients.insert({
                ClientID: this.ud(),
                Address: null,
                City: null,
                FailedAttempts: 0,
                Password: hash,
                State: null,
                PostalCode: null,
                PhoneNumber: phone,
                EmailAddress: null,
                IsPremium: false,
                SecQuestion: secquestion,
                SecAnswer: sechash,
                FirstName: null,
                LastName: null,
                MiddleName: null,
                Verification: this.ut.createHash(64)
            }).then(r=> {
                return r;
            })
                
        }
        else {
            return msg;
        }
    }

    async fillDetails(clientid,sessionid,FirstName,MiddleName,LastName,EmailAddress) {

        if (clientid===this.se.verify(sessionid)) {
            return await this.getClientByID(clientid).then(r=> {
                if (r!==null) {
                    r.FirstName=FirstName;
                    r.LastName=LastName;
                    r.MiddleName=MiddleName;
                    r.EmailAddress=EmailAddress;

                    this.db.Clients.update(r);

                    return true;
                }
                else {
                    return false;
                }
            });
        }
        
        return false;
    }

    async getClientByEmail(email) {
        return await this.db.Clients.findOne({ 
            EmailAddress: email
        }).then(r=> {
            return r;
        });
    }

    async getClientByID(id) {
        return await this.db.Clients.findOne({ 
            ClientID: id
        }).then(r=> {
            return r;
        });
    }

    async getClientByPhone(phone) {
        return await this.db.Clients.findOne({ 
            PhoneNumber: phone
        }).then(r=> {
            return r;
        });
    }

    async login(phone,passwd,email) {

        return await this.db.Clients.findOne({
            or: [
                {
                    "PhoneNumber": phone,
                    "EmailAddress": email
                }
            ]
        }).then(r=> {
            if (r!==null) {
                if (r.FailedAttempts>6) {
                    bcrypt.compare(passwd, r.Password).then(function(res) {
                        if (res) {
                            return "OK"
                        }

                        r.FailedAttempts++;
                        this.db.Clients.update(r);

                        return "Invalid Credentials";
                    });
                }
                else {
                    return "There have been too many failed login attempts, please reset your password";
                }
            }
            else {
                return "Invalid Credentials";
            }
        })    
    }

    verify(phone,passwd) {
        var phoneVerification = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
        if (!phoneVerification.test(phone)) {
            return "Invalid Phone Number"
        }
        
        if (passwd.length<8 || !/[a-z]/.test(passwd) || !/[0-9]/.test(passwd) || !/[A-Z]/.test(passwd)) {
            return "Password must be at least 8 characters and contain an uppercase character, a lowercase character, and a number";
        }

        return "OK"
    }

    constructor(_db, _bc, _ud, _ut, _se) {
        this.db=_db
        this.bc=_bc
        this.ud=_ud
        this.ut=_ut
        this.se=_se
    }

}

module.exports=client;