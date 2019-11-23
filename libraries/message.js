/* This class is responsible for handling text messaging and email
   It expects the phone number to be used in the Twilio API to be passed to it, 
   all messages will be sent from that number */
class message {

    async addToQueue(clientid, message) {
        return await this.db.ClientQueue.insert({
            ClientQueueID: this.objs.uuidv4(),
            Message: message,
            ClientID: clientid
        }).then(aq=>{
            return aq;
        })
    }

    async getClientQueue() {
        return await this.objs.sessionobj.verify().then(c=> {
            if (c===null) {
               return null;
            }
          
            return this.db.ClientQueue.find({
                ClientID: c
            }).then(cs=>{
                return cs;
            })
        });
    }

    async removeFromQueue(clientqueueid) {
        return await this.objs.sessionobj.verify().then(c=> {
            return this.db.ClientQueue.destroy({
                ClientQueueID: clientqueueid,
                ClientID: c
            }).then(p=>{
                return "OK";
            })
      })
    }

    async sendEmail(_toaddress, _subject, _body) {
        var params = {
            Destination: { 
              ToAddresses: [
                _toaddress
              ]
            },
            Message: { 
              Body: { 
                Text: {
                 Charset: "UTF-8",
                 Data: _body
                }
               },
               Subject: {
                Charset: 'UTF-8',
                Data: _subject
               }
              },
            Source: 'users@schd.us'
          };

        var sendPromise = new this.objs.aws.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

        return await sendPromise.then(
            function(data) {
                    return "OK";
            }).catch(
                function(err) {
                    console.log(err);
                    return err;
            });

    }

    sendMessage(_tophone, _message) {
        this.twClient.messages
            .create({
                body: _message,
                from: this.phone,
                to: _tophone
            });
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_phone, _twClient, _db) {
        this.phone=_phone;
        this.db=_db;
        this.twClient=_twClient
    }
}

module.exports=message;