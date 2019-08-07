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
                var selfobj = this.objs;

                selfobj.bcrypt.genSalt(7, function(err, salt) {
                    selfobj.bcrypt.hash(answer, salt, function(err, _hash) {
                        if (r.secanswer===_hash) {
                            return true;
                        }
                    })
                })
            }
            return false;
        })
    }

    async changeNumber(passwd,phone) {
        return await this.objs.sessionobj.verify().then(c=> {
            
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.login(null,passwd,null,c).then(lr=> {
                if (lr==="OK") {
                    var sPhone=this.objs.clientobj.standardizePhone(phone);
                    if (sPhone!=="NotOK") {
                        return this.objs.clientobj.getClientByPhone(sPhone).then(rvp=> {
                            if (rvp===null) {

                                var hsh=this.objs.utilityobj.createHash(64);

                                this.db.Clients.update({
                                    ClientID: c
                                }, {
                                    PhoneNumber: sPhone,
                                    VerificationResend: 0,
                                    Verification: hsh
                                });

                                // Delete old session
                                this.objs.sessionobj.deleteForClient(c);

                                // Verification
                                this.objs.messageobj.sendMessage(sPhone, "Click the link to verify your new phone number: https://"+this.objs.envURL+"/verify.html?c="+c+"&v="+hsh+"&cp=yes");
                                
                                return "OK";
                            }
                            else {
                                return "This account already exists";
                            }
                        });
                    }
                    else {
                        return "Error validating phone number";
                    }  
                }
                else {
                    return "Login unsuccessful";
                }
            })
           
        })
    }

    async changePassword(passwd,npasswd) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.login(null,passwd,null,c).then(cp => {
                if (cp==="OK") {
                    this.db.Clients.update({
                        ClientID: c
                    }, {
                        Password: npasswd
                    });

                    return "OK";
                }
                else {
                    return "Invalid Credentials";
                }
            })
        });
    }

    async create(phone,secquestion,hash,sechash) {        

        return await this.db.Clients.insert({
            ClientID: this.objs.uuidv1(),
            FailedAttempts: 0,
            Password: hash,
            Enabled: true,
            PhoneNumber: phone,
            IsPremium: false,
            SecQuestion: secquestion,
            SecAnswer: sechash,
            VerificationResend: 0,
            Verification: this.objs.utilityobj.createHash(64)
        }).then(r=> {
            // Send verification message
            this.objs.messageobj.sendMessage(phone, "Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/verify.html?c="+r.ClientID+"&v="+r.Verification);

            return "OK";
        })
                     
    }

    async delete() {
        return await this.objs.sessionobj.verify().then(c=> {
            this.objs.sessionobj.deleteForClient(c);

            this.db.Clients.destroy({
                ClientID: c
            })
        })
    }

    async fillAddress(Street,City,State,Postal) {
        return await this.objs.sessionobj.verify().then(c=> {
  
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.getClientByID(c).then(r=> {
                if (r!==null) {

                    if (Street.length>255) {
                        return "Street address length is too long";
                    }
                    if (Street.length===0) {
                        return "Street address is required";
                    }
                    if (City.length>64) {
                        return "City is too long";
                    }
                    if (City.length===0) {
                        return "City length is required";
                    }
                    if (Postal.length>15) {
                        return "Postal code length is too long";
                    }
                    if (Postal.length==0) {
                        return "Postal code is required";
                    }

                    var sok = false;
                    var states = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
                    for(var x=0; x<states.length; x++) {
                        if (State===states[x]) {
                            sok=true;
                        }
                    }

                    if (!sok) {
                        return "State is invalid";
                    }

                    this.db.Clients.update({
                        ClientID: r.ClientID
                    }, {
                        Address: Street,
                        City: City,
                        PostalCode: Postal,
                        State: State
                    });

                    return "OK";

                }
                else {
                    return "An unexpected error occurred";
                }
            });
           
        })
    }

    async fillName(FirstName,LastName) {

        return await this.objs.sessionobj.verify().then(c=> {
                
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.getClientByID(c).then(r=> {
                if (r!==null) {

                    if (FirstName.length>64 || LastName.length>64) {
                        return false;
                    }

                    this.db.Clients.update({
                        ClientID: r.ClientID
                    }, {
                        FirstName: FirstName,
                        LastName: LastName
                    });

                    return true;
                }
                else {
                    return false;
                }
            });
          
        })
        
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

    async login(phone,passwd,email,clientid) {

        return await this.db.Clients.findOne({
            or: [
                {
                    "PhoneNumber": phone                 
                },
                {
                    "EmailAddress": email                   
                },
                {
                    "ClientID": clientid
                }
            ]
        }).then(r=> {
            if (r!==null) {
                if (r.FailedAttempts<6) {
                    var self=this;
      
                    if (r.Enabled) {
                        return self.objs.bcrypt.compare(passwd,r.Password).then(function(res) {
                        
                            if (res) {

                                if (r.Verification!==null) {
                                    return r.ClientID;
                                }

                                r.FailedAttempts=0;
                                self.db.Clients.update({
                                    ClientID: r.ClientID
                                }, {
                                    FailedAttempts: r.FailedAttempts
                                });

                                if (clientid===null) {
                                    return self.objs.sessionobj.deleteForClient(r.ClientID).then(dc=> {
                                        return self.objs.sessionobj.create(r.ClientID).then(s=> {
                                            return s;
                                        });
                                    });
                                }
                                else {
                                    return "OK"
                                }
                            }
                            else {
                                r.FailedAttempts++;
                                self.db.Clients.update({
                                    ClientID: r.ClientID
                                }, {
                                    FailedAttempts: r.FailedAttempts
                                });

                                return "Invalid Credentials";
                            }

                        });
                   
                    }
                    else {
                        return "This account has been disabled by the administrator";
                    }
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

    async resendText(clientid) {
        var self=this;
        return await this.getClientByID(clientid).then(r=> {
            if (r!==null) {
                if (r.VerificationResend<3) {
                    r.VerificationResend++;

                    self.db.Clients.update({
                        ClientID: r.ClientID
                    }, {
                        VerificationResend: r.VerificationResend
                    });

                    self.objs.messageobj.sendMessage(r.PhoneNumber,"Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/verify.html?c="+r.ClientID+"&v="+r.Verification);
                    
                    return "OK";
                }   
                else {
                    return "Maximum verification attempts reached. Please re-create this account.";
                } 
            }
            else {
                return "An error occurred";
            }
        });
    }

    standardizePhone(phone) {
        phone= phone.replace(/[^0-9]/g,"");
        if (phone.length===10) {
            phone="1"+phone;
        }
        if (phone.length===11) {
            return phone;
        }
        return "NotOK";
    }

    verify(phone,passwd) {
        var phoneVerification = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
        if (!phoneVerification.test(phone)) {
            return "Enter phone number with area code in format NNN-NNN-NNNN"
        }

        if (passwd.length<8 || !/[a-z]/.test(passwd) || !/[0-9]/.test(passwd) || !/[A-Z]/.test(passwd)) {
            return "Password must be at least 8 characters and contain an uppercase character, a lowercase character, and a number";
        }

        return "OK"; 
    }

    async verifyAccount(clientid,verificationid) {
        var self = this;
        return await this.getClientByID(clientid).then(r=> {
            if (r!==null) {
                if (r.Verification===verificationid) {
                    self.db.Clients.update({
                        ClientID: r.ClientID
                    }, {
                        Verification: null
                    });   

                    return "OK";
                }               
            }
           
            return "An error occurred";            
        })
    }

    async verifyCaptcha(recap) {
        const verifyCaptchaOptions = {
            method: 'POST',
            uri: "https://www.google.com/recaptcha/api/siteverify",
            json: true,
            body: {
                secret: this.rc.secret,
                response: recap
            }
        };
  
        return await this.objs.request(verifyCaptchaOptions).then(r=>  {
                return "OK"
        });
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_db, _rc) {
        this.db=_db;
        this.rc=_rc;
    }

}

module.exports=client;