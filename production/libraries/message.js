/* This class is responsible for handling text messaging and email
   It expects the phone number to be used in the Twilio API to be passed to it, 
   all messages will be sent from that number */
class message {

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

    constructor(_phone, _twClient) {
        this.phone=_phone;
        this.twClient=_twClient
    }
}

module.exports=message;