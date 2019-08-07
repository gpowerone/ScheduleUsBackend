/* This class is responsible for handling text messaging 
   It expects the phone number to be used in the Twilio API to be passed to it, 
   all messages will be sent from that number */
class message {

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