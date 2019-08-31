class client {

    async accountRecovery(phoneNumber) {

        var sPhone = this.objs.utilityobj.standardizePhone(phoneNumber);
        if (sPhone==="NotOK") {
            return "Please check that the phone number is formatted correctly";
        }

        return await this.getClientByPhone(sPhone).then(r => {
            if (r!==null) {

                var hsh=this.objs.utilityobj.createHash(42);

                return this.db.Clients.update({
                    ClientID: r.ClientID
                }, {
                    Recover: hsh
                }).then(cr=> {

                    // Reset URL
                    this.objs.messageobj.sendMessage(sPhone, "Click here to recover your Schedule Us account: https://"+this.objs.envURL+"/#/recover?c="+r.ClientID+"&v="+hsh);

                    return "OK";
                })
 
            }
            return null;
        })
    }

    async accountRecSec(clientid, verificationid) {
        return await this.getClientByID(clientid).then(cli=> {
            if (cli!==null) {
                if (cli.Recover===verificationid) {
                    return cli.SecQuestion;
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

    async accountSecurityQuestion(clientid, verificationcode, passwd, secanswer, phash) {
        return await this.getClientByID(clientid).then(cli=> {
            if (cli!==null) {
                if (cli.Recover===verificationcode) {

                    var self = this;
                    return this.objs.bcrypt.compare(secanswer,cli.SecAnswer).then(function(res) {

                        if (res) {

                            if (passwd.length<8 || !/[a-z]/.test(passwd) || !/[0-9]/.test(passwd) || !/[A-Z]/.test(passwd)) {
                                return "Password must be at least 8 characters and contain an uppercase character, a lowercase character, and a number";
                            }

                            return self.db.Clients.update({
                                ClientID: cli.ClientID
                            }, {
                                Recover: null,
                                Password: phash
                            }).then(r=> {
                                return "OK";
                            })
                        }
                        else {
                            return "Invalid Credentials"
                        }
                    })

                }
                else {
                    return "Invalid Credentials"
                } 
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
                    var sPhone=this.objs.utilityobj.standardizePhone(phone);
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
                                this.objs.messageobj.sendMessage(sPhone, "Click the link to verify your new phone number: https://"+this.objs.envURL+"/#/verify?c="+c+"&v="+hsh+"&cp=yes");
                                
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

    contact(params) {
        var msg="Name: "+
        this.objs.xss(params.YourName)+"<br />Email: "+
        this.objs.xss(params.ContactEmail)+"<br />Phone: "+
        this.objs.xss(params.ContactPhone)+"<br />Reason: "+
        this.objs.xss(params.ContactReason)+"<br />Details:<br />"+
        this.objs.xss(params.ContactDetails);

        this.objs.messageobj.sendEmail("gpowerone@yahoo.com","Schdule Us Contact", msg);
        return "OK";
    }

    async create(firstname,lastname,phone,secquestion,hash,sechash) {        

        return await this.db.Clients.insert({
            ClientID: this.objs.uuidv1(),
            FailedAttempts: 0,
            Password: hash,
            HasImage: false,
            Enabled: true,
            PhoneNumber: phone,
            FirstName: firstname,
            LastName: lastname,
            IsPremium: false,
            SecQuestion: secquestion,
            SecAnswer: sechash,
            VerificationResend: 0,
            Verification: this.objs.utilityobj.createHash(64)
        }).then(r=> {
            // Send verification message
            this.objs.messageobj.sendMessage(phone, "Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/#/verify?c="+r.ClientID+"&v="+r.Verification);

            return "OK";
        })
                     
    }

    async delete() {
        return await this.objs.sessionobj.verify().then(c=> {
            this.objs.sessionobj.deleteForClient(c);

            this.db.Clients.destroy({
                ClientID: c
            })

            return "OK";
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

                    if (!this.objs.utilityobj.getUSStates().hasOwnProperty(State)) {
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

        var conditional=[];
        if (clientid!=null) {
            conditional.push({
                "ClientID": clientid
            })
        }
        else if (phone!==null) {
            conditional.push({
                "PhoneNumber": phone
            })
        }
        else if (email!==null) {
            conditional.push({
                "EmailAddress": email
            })
        }
        else {
            return new Promise();
        }

        return await this.db.Clients.findOne({
            or: conditional
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
                                            s.UserName=r.FirstName+" "+r.LastName;
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
                console.log("hi");
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

                    self.objs.messageobj.sendMessage(r.PhoneNumber,"Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/#/verify?c="+r.ClientID+"&v="+r.Verification);
                    
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

    async setEmail(emailaddress) {
        return await this.objs.sessionobj.verify().then(c=> {

            if (c!==null) {
                return this.db.ClientEmailVerification.insert({
                    ClientEmailVerificationID: this.objs.uuidv1(),
                    ClientID: c,
                    EmailAddress: emailaddress,
                    Verification: this.objs.utilityobj.createHash(64)
                }).then(r=> {
                    this.objs.messageobj.sendEmail(emailaddress,"Schedule Us Email Verification","Click https://"+this.objs.envURL+"/#/verifyemail?c="+c+"&v="+r.Verification+" to verify your email address");

                    return "OK";
                });
            }
            else {
                return "An unexpected problem occurred";
            }
               
        })
    }


    verify(firstname,lastname,phone,passwd) {

        if (firstname.length<1) {
            return "First name is required";
        }

        if (lastname.length<1) {
            return "Last name is required";
        }

        if (firstname.length>64) {
            return "First name is too long";
        }

        if (lastname.length>64) {
            return "Last name is too long";
        }

        var vp = this.objs.utilityobj.verifyPhone(phone);
        if (vp!=="OK") {
            return vp;
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

    async verifyEmail(clientid,verificationid) {
        var self = this;
        return await this.getClientByID(clientid).then(cli=> {
            if (cli!==null) {
                return this.db.ClientEmailVerification.findOne({
                    Verification: verificationid,
                    ClientID: clientid
                }).then(r=> {
                    if (r!==null) {
                        return self.db.Clients.update({
                            ClientID: r.ClientID
                        }, {
                            EmailAddress: r.EmailAddress
                        }).then(q=> {

                            return self.db.ClientEmailVerification.destroy({
                                ClientEmailVerificationID: r.ClientEmailVerificationID
                            }).then(d=> {
                                return "OK";
                            });
                        });
                    }
                    else {
                        return "An error occurred"
                    }
                })                               
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