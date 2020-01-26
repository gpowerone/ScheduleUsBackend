class client {

    async accountRecovery(phoneNumber) {

        var sPhone = this.objs.utilityobj.standardizePhone(phoneNumber);
        if (sPhone==="NotOK") {
            return "Please check that the phone number is formatted correctly";
        }

        return await this.getClientByPhone(sPhone).then(r => {
            if (r!==null) {

                if (r.AccountType!==0) {
                    return "Cannot recover this account because it was created through Google or Facebook";
                }

                var hsh=this.objs.utilityobj.createHash(42);

                return this.db.Clients.update({
                    ClientID: r.ClientID
                }, {
                    Recover: hsh
                }).then(cr=> {

                    // Reset URL
                    this.objs.messageobj.sendMessage(sPhone, "Click here to recover your Schedule Us account: https://"+this.objs.envURL+"/recover?c="+r.ClientID+"&v="+hsh);

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

    async addAvatar(ablob) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid Operation";
            }


            return this.objs.jimp.read(ablob).then(image=>{

                return image.resize(150,150).getBufferAsync(this.objs.jimp.MIME_PNG).then(rsimage=>{

                    const s3 = new this.objs.aws.S3();
                    const params={
                        Bucket: 'schedus-images',
                        Key: c,
                        Body: rsimage,
                        ACL: 'public-read'
                    }            
        
                    var self=this;
                    s3.upload(params, function(err,data) {        
                        self.objs.cfrontinvalidate("ESPLOB5ZISSCS",['/'+c]).then((data) => {
                      
                        });                 
                    })
        
                    return "OK";

                }).catch(err=>{
                    console.log("Problem processing image");
                })
 
            }).catch(err=>{
                console.log("Problem processing image 2");
            })
      
        })
    }

    async addCalendar(cType, code) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid Operation";
            }

            if (cType===0) {
                return this.objs.axios.post("https://accounts.google.com/o/oauth2/token", {
                    code: code,
                    client_id: this.objs.googcalcliid,
                    client_secret: this.objs.googcalsecret,
                    redirect_uri: "https://"+this.objs.envURL+"/googcalendar",
                    grant_type: "authorization_code"

                }).then((res)=>{

                    return this.db.ClientCalendar.destroy({
                        ClientID: c,
                        CalendarType: cType
                    }).then(cc=>{
                        return this.db.ClientCalendar.insert({
                            ClientCalendarID: this.objs.uuidv4(),
                            ClientID: c,
                            CalendarType: cType,
                            CalendarToken: res.data.refresh_token
                        }).then(p=>{
                            return "OK";
                        })
                    })

                }).catch((error)=>{
                    console.log(error);
                    return "Error";
                })
            }
        })
    }

    async addGroup(groupname, clients) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid Operation";
            }

            if (groupname.length===0 || groupname.length>128) {
                return "Group name is either too short or too long";
            }

            return this.db.ClientGroups.insert({
                ClientGroupID: this.objs.uuidv4(),
                ClientID: c,
                GroupName: groupname
            }).then(g=>{
                for(var cn=0; cn<clients.length; cn++) {
                    
                    this.addGroupAddClient(clients[cn], g);
           
                }

                return "OK";
            })
        })
    }

    async addGroupAddClient(tclient, g) {
        var ph=this.objs.utilityobj.standardizePhone(tclient.PhoneNumber);
        var eml = tclient.EmailAddress;
        var o=[]; 
        if (ph==="NotOK" || ph===null) {
            ph=null;
            o.push({EmailAddress: tclient.EmailAddress});
        }
        else {
            eml=null;
            o.push({PhoneNumber: ph});
        }

        return await this.db.Clients.find({
            or:o
        }).then(fc=>{
            var cl=null;
            if (fc!==null && fc.length>0) {
                cl=fc[0].ClientID;
            }

            this.db.ClientGroupClients.insert({
                ClientGroupClientID: this.objs.uuidv4(),
                ClientGroupID: g.ClientGroupID,
                ClientID: cl,
                PhoneNumber: ph,
                EmailAddress: eml,
                Name: tclient.Name
            });

        })          
    }

    async addToGoogleCalendar(name, addr, sdate, edate, desc) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid Operation";
            }

            return this.db.ClientCalendar.findOne({
                CalendarType: 0,
                ClientID: c
            }).then(cc=>{
                if (cc!==null) {
                    try {
          
                        const oauth2Client = new this.objs.google.auth.OAuth2(
                            "801199894294-iei4roo6p67hitq9sc2tat5ft24qfakt.apps.googleusercontent.com", 
                            "WOihpgSDdZkA81FS8mF_RxmS", 
                            "https://schd.us/googcalendar" 
                        );
                        
                        oauth2Client.setCredentials({
                        refresh_token:
                            cc.CalendarToken
                        });
                        
                        const calendar = this.objs.google.calendar({version: 'v3', auth: oauth2Client});

                        var event = {
                            'summary':  name,
                            'location': addr,
                            'description': desc,
                            'start': {
                              'dateTime': sdate
                            },
                            'end': {
                              'dateTime': edate
                            },
                            'reminders': {
                              'useDefault': true                  
                            }
                        }

                        return calendar.events.insert({
                            auth: oauth2Client,
                            calendarId: 'primary',
                            resource: event,
                        }).then(r=>{
                            return "OK";
                        });

                    }
                    catch(e) {

                    }
                }
                else {
                    return "Invalid Operation";
                }
            });
        });
    }

    async addToGroup(clientgroupid, client) {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid Operation";
            }

            if (client.Name.length===0 || client.Name.length>128) {
                return "Client name is invalid";
            }

            if (client.EmailAddress!==null && client.EmailAddress.length>0  && this.objs.utilityobj.verifyEmail(client.EmailAddress)!=="OK") {
                return "Invalid Email Address";
            }
    
            if (client.PhoneNumber!==null && client.PhoneNumber.length>0  && this.objs.utilityobj.verifyPhone(client.PhoneNumber)!=="OK") {
                return "Invalid Phone Number";
            }
    
            if (((client.EmailAddress===null||client.EmailAddress.length===0) && (client.PhoneNumber===null||client.PhoneNumber.length===0))) {
                return "You must have a phone number or email address";
            }

            return this.db.ClientGroups.findOne({
                ClientGroupID: clientgroupid,
                ClientID: c
            }).then(g=>{
               
                var conditional=null;
                var ph=this.objs.utilityobj.standardizePhone(client.PhoneNumber);
                if (ph!=="NotOK") {
                    conditional={PhoneNumber: ph}; 
                }
                else {
                    conditional={EmailAddress: client.EmailAddress};
                    ph=null;
                }

                return this.db.Clients.find({
                    or:[
                        conditional
                    ]
                }).then(fc=>{
                    var cl=null;
                    if (fc!==null && fc.length>0) {
                        cl=fc[0].ClientID;
                    }

                        return this.db.ClientGroupClients.insert({
                            ClientGroupClientID: this.objs.uuidv4(),
                            ClientGroupID: g.ClientGroupID,
                            ClientID: cl,
                            PhoneNumber: ph,
                            EmailAddress: client.EmailAddress,
                            Name: client.Name
                        }).then(q=>{
                            return q.ClientGroupClientID;
                        })
                    
            
                })                

            })
        })
    }

    async changeNumber(passwd,phone) {
        return await this.objs.sessionobj.verify().then(c=> {
            
            if (c===null) {
                return "Invalid Credentials";
            }

            var sPhone=this.objs.utilityobj.standardizePhone(phone);
            if (sPhone!=="NotOK") {
                return this.objs.clientobj.getClientByPhone(sPhone).then(rvp=> {
                    if (rvp===null) {

                        return this.login(null,passwd,null,c).then(lr=> {
                            if (cli.AccountType>0 || lr==="OK") {
                 
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
                                this.objs.messageobj.sendMessage(sPhone, "Click the link to verify your new phone number: https://"+this.objs.envURL+"/verify?c="+c+"&v="+hsh+"&cp=yes");
                                
                                return "OK";
                            }
                            else {
                                return "Error logging in";
                            }
                        });
                    }
                    else {
                        return "This account already exists";
                    }
                   
                })
                
            }
            else {
                return "Error validating phone number";
            }  
           
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

        this.objs.messageobj.sendEmail("admin@schd.us","Schedule Us Contact", msg);
        return "OK";
    }

    async create(firstname,lastname,phone,secquestion,hash,sechash) {        

        return await this.db.Clients.insert({
            ClientID: this.objs.uuidv4(),
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
            // Remove opt out
            this.db.OptOut.destroy({
                PhoneNumber: phone
            });

            // Send verification message
            this.objs.messageobj.sendMessage(phone, "Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/verify?c="+r.ClientID+"&v="+r.Verification);

            return "OK";
        })
                     
    }

    async delete() {
        return await this.objs.sessionobj.verify().then(c=> {

            return this.getClientByID(c).then(cli=> {

                if (cli.SubTerminationDate===null && (cli.IsPro===true || cli.IsPremium===true)) {
                     return "You must cancel your subscription before deleting your account";
                }        

                return this.db.Events.find({
                    CreatorID: c,
                    ActionReq: 2
                }).then(e=>{

                    for(var xe=0; xe<e.length; xe++) {
                        this.objs.eventsobj.cancelEvent(e[xe].EventID);
                    }

                    return this.db.Clients.update({
                        ClientID: c
                    },{
                        MarkForDelete: true
                    }).then(p=>{

                        this.objs.sessionobj.deleteForClient(c);

                        return "OK";
                    })

                })    
            })
        })
    }

    doCheckout(customerID, planId, res, stripe) {

        var amt=1197;
        if (planId==="plan_GSkenZwDUSheRL") {
            amt=2997;
        }

        stripe.checkout.sessions.create({
            customer: customerID,
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [{ amount: amt, currency: "USD", name:"First Three Months", quantity:1}],
            subscription_data: { items: [{ plan: planId }], trial_from_plan:true },
            success_url: "https://"+this.objs.envURL+'/purchase?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: "https://"+this.objs.envURL+'/cancel'
         }).then(session=>{

              res.send({
                status: 200,
                sessionId: session.id
              });
         })       
    }

    async editGroupName(cgid,cgname) {
        return await this.objs.sessionobj.verify().then(c=> {
  
            if (c===null) {
                return "Invalid Credentials";
            }

            if (cgname.length===0 || cgname.length>128) {
                return "Invalid group name";
            }

            return this.db.ClientGroups.findOne({
                ClientGroupID: cgid,
                ClientID: c
            }).then(g=>{
                if (g!==null) {
                    return this.db.ClientGroups.update({
                        ClientGroupID: cgid
                    },{
                        GroupName: cgname
                    }).then(cg=>{
                        return "OK";
                    })
                }
                else {
                    return "Invalid Credentials";
                }
            });
        })
    }

    async editGroupMember(cgid,gname,gemail,gphone) {
        return await this.objs.sessionobj.verify().then(c=> {

            if (c===null) {
                return "Invalid Credentials";
            }

            if (gname.length===0 || gname.length>128) {
                return "Name is invalid";
            }

            if (gemail!==null && gemail.length>0 && this.objs.utilityobj.verifyEmail(gemail)!=="OK") {
                return "Invalid Email Address";
            }
    
            var ph=null;

            if (gphone!==null) {
                if (gphone.length>0 && this.objs.utilityobj.verifyPhone(gphone)!=="OK") {
                    return "Invalid Phone Number";
                }
                else {
                    ph = this.objs.utilityobj.standardizePhone(gphone);
                    if (ph==="NotOK") {
                        return "Invalid Phone Number";
                    }
                }
             }
    
            if ((gemail===null||gemail.length===0) && (gphone===null||gphone.length===0)) {
                return "You must have a phone number or email address";
            }

           
            return this.db.ClientGroupClients.findOne({
                ClientGroupClientID: cgid
            }).then(cgi=>{
                if (cgi!==null) {
                    return this.db.ClientGroups.findOne({
                        ClientGroupID: cgi.ClientGroupID,
                        ClientID: c
                    }).then(cg=>{
                        if (cg!==null) {
                            return this.db.ClientGroupClients.update({
                                ClientGroupClientID: cgid
                            },{
                                PhoneNumber: ph,
                                EmailAddress: gemail,
                                Name: gname
                            }).then(r=>{
                                return "OK";
                            })
                        }
                        else {
                            return "Invalid Operation";
                        }
                    })
                }
                else {
                    return "Invalid Operation";
                }
            })
            
        });
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

    async emailOptOut(EmailAddress) {
        return await this.db.EmailOptOut.findOne({
            EmailAddress: EmailAddress
        }).then(r=>{
            if (r===null) {
                return this.db.Clients.findOne({
                    EmailAddress: EmailAddress
                }).then(p=>{
                    if (p===null) {
                        this.db.EmailOptOut.insert({
                            EmailAddress: EmailAddress
                        });
                        return "OK";
                    }
                    else {
                        return "NO";
                    }
                })
               
            }
            else {

                return "OK";
            }
        })
    }

    async fillName(FirstName,LastName) {

        return await this.objs.sessionobj.verify().then(c=> {
                
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.getClientByID(c).then(r=> {
                if (r!==null) {

                    if (r.AccountType!==0) {
                        return false;
                    }

                    if (FirstName.length===0 || LastName.length===0) {
                        return false;
                    }

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

    async getCalendarIntegrationStatus() {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return [];
            }

            return this.db.ClientCalendar.find({
                ClientID: c
            }).then(cc=>{
                return cc;
            })
        });
    }

    async getClientByEmail(email) {
        return await this.db.Clients.findOne({ 
            EmailAddress: email
        }).then(r=> {
            return r;
        });
    }

    async getClientByID(id) {
        if (id===null || id.length!==36) {
            return null;
        }

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

    async getClientCalendars() {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
                return "Invalid";
            }
            return this.db.ClientCalendar.find({
                ClientID: c
            }).then(cc=>{
                return cc;
            })
        });
    }

    async getClientsForGroup(clientgroupid) {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.db.ClientGroups.findOne({
                ClientID: c,
                ClientGroupID: clientgroupid
            }).then(cgs=>{
                return this.db.ClientGroupClients.find({
                    ClientGroupID: clientgroupid
                }).then(cgcs=>{
                    cgs.Clients=cgcs;
                    return cgs;
                })
            })

        });
    }

    async getGroupsForClient() {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.db.ClientGroups.find({
                ClientID: c
            }).then(cgs=>{
                return cgs; 
            })
        })
    }

    async getOrderHistoryForClient() {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.db.ClientOrderHistory.find({
                ClientID: c
            }).then(cgs=>{
                return cgs; 
            })
        })
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
                "EmailAddress": email.toLowerCase()
            })
        }
        else {
            return new Promise();
        }

        return await this.db.Clients.findOne({
            or: conditional,
            AccountType: 0
        }).then(r=> {  
            if (r!==null) {
                if (r.MarkForDelete!==true) {
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
                    return "Invalid Credentials";
                }
            }
            else {
                return "Invalid Credentials";
            }
        })    
    }

    async removeFromGroup(clientgroupid,clientgroupclientid) {
        return await this.objs.sessionobj.verify().then(c=> {
                
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.db.ClientGroups.findOne({
                ClientGroupID: clientgroupid,
                ClientID: c
            }).then(cg=>{
                if (cg!==null) {
                    return this.db.ClientGroupClients.destroy({
                        ClientGroupID: clientgroupid,
                        ClientGroupClientID: clientgroupclientid
                    }).then(cgc=>{
                        return "OK";
                    })
                }
                else {
                    return "Invalid Credentials";
                }
            });
        })
    }

    async removeGroup(clientgroupid) {
        return await this.objs.sessionobj.verify().then(c=> {
                
            if (c===null) {
                return "Invalid Credentials";
            }

            return this.db.ClientGroups.findOne({
                ClientGroupID: clientgroupid,
                ClientID: c
            }).then(cg=>{
                if (cg!==null) {
                    return this.db.ClientGroupClients.destroy({
                        ClientGroupID: clientgroupid
                    }).then(cgc=>{
                        return this.db.ClientGroups.destroy({
                            ClientGroupID: clientgroupid
                        }).then(p=>{
                            return "OK";
                        }) 
                    })
                }
                else {
                    return "Invalid Credentials";
                }
            });
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

                    self.objs.messageobj.sendMessage(r.PhoneNumber,"Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/verify?c="+r.ClientID+"&v="+r.Verification);
                    
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
                return this.getClientByID(c).then(cli=> {
                    if (cli.AccountType===0) {
                        return this.db.ClientEmailVerification.destroy({
                            ClientID: c
                        }).then(q=>{
                            return this.db.ClientEmailVerification.insert({
                                ClientEmailVerificationID: this.objs.uuidv4(),
                                ClientID: c,
                                EmailAddress: emailaddress.toLowerCase(),
                                Verification: this.objs.utilityobj.createHash(64)
                            }).then(r=> {
                                this.objs.messageobj.sendEmail(emailaddress,"Schedule Us Email Verification","Click https://"+this.objs.envURL+"/verifyemail?c="+c+"&v="+r.Verification+" to verify your email address");
            
                                return "OK";
                            });
                        })
                    }
                    else {
                        return "An unexpected problem occurred";
                    }
                })
               
            }
            else {
                return "An unexpected problem occurred";
            }
               
        })
    }


    verify(firstname,lastname,phone,passwd,secanswer) {

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

        if (secanswer.length===0) {
            return "Security answer is required";
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

                            self.db.EmailOptOut.destroy({
                                EmailAddress: r.EmailAddress
                            });

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

    async verifyGoogleLogin(token,phone,email) {
        const client = new this.objs.googauth("801199894294-ph8llsbfnu6lovla7ed46mq0rvk9rbnm.apps.googleusercontent.com");
        return await client.verifyIdToken({
            idToken: token,
            audience: "801199894294-ph8llsbfnu6lovla7ed46mq0rvk9rbnm.apps.googleusercontent.com"  
        }).then(t=>{
        
            const payload = t.getPayload();
            if (email===payload.email && payload.email_verified===true) {
        
        
                return this.db.Clients.findOne({
                    EmailAddress: email,
                    AccountType: 1
                }).then(c=>{

                    if (c!==null) {

                        if (c.Verification!==null) {
                            return c.ClientID;
                        }

                        return this.db.Clients.update({
                            ClientID: c.ClientID
                        },{
                            FirstName: payload.given_name===null?"":payload.given_name,
                            LastName: payload.family_name===null?"":payload.family_name
                        }).then(q=>{

                            return this.objs.sessionobj.deleteForClient(c.ClientID).then(dc=> {
                                return this.objs.sessionobj.create(c.ClientID).then(s=> {
                                    s.UserName=c.FirstName+" "+c.LastName;
                                    return this.objs.xss(JSON.stringify(s));
                                });
                            });
                        })

                    }
                    else {

                        if (phone===null) {
                            return "NEEDPHONE"
                        }
                        else {
                            phone = this.objs.utilityobj.standardizePhone(phone);
                            if (phone==="NotOK") {
                                return "Phone number is not formatted correctly";
                            }
                        }

                        return this.db.Clients.findOne({
                            PhoneNumber: phone
                        }).then(cl=>{

                            if (cl!==null) {
                                return "Error: This phone number is already in use";
                            }
                            
                            return this.db.Clients.insert({
                                ClientID: this.objs.uuidv4(),
                                FailedAttempts: 0,
                                AccountType: 1,
                                Password: "",
                                HasImage: false,
                                Enabled: true,
                                PhoneNumber: phone,
                                EmailAddress: email,
                                FirstName: payload.given_name===null?"":payload.given_name,
                                LastName: payload.family_name===null?"":payload.family_name,
                                IsPremium: false,
                                SecQuestion: 0,
                                SecAnswer: "",
                                VerificationResend: 0,
                                Verification: this.objs.utilityobj.createHash(64)
                            }).then(r=> {
                                // Remove opt out
                                this.db.OptOut.destroy({
                                    PhoneNumber: phone
                                });
                                this.db.EmailOptOut.destroy({
                                    EmailAddress: email
                                });

                                // Send verification message
                                this.objs.messageobj.sendMessage(phone, "Welcome to Schedule Us! Click the link to verify your account: https://"+this.objs.envURL+"/verify?c="+r.ClientID+"&v="+r.Verification);

                                return r.ClientID;
                            })
                        });
                    }

                });
                
            }
            else {
                return "Could not verify Google credentials";
            }
     
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