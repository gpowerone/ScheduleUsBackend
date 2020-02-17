class utilities {

    createHash(length) {
        var hash = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for ( var i = 0; i < length; i++ ) {
           hash += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return hash
    }

    createTree(items,parentid,il) {
        var tree=[]; 
        for(var x=0; x<items.length; x++) {
            if (items[x].ParentID===parentid) {
                items[x].EventGuestID=null;
                items[x].IndentLevel="i-"+il;
                var t = {item: items[x], children: this.createTree(items,items[x].EventCommentID,il+1)};
                tree.push(t);
            }
        }

        return tree;
    }

    getDateFromTimestamp(t) {
        var d = new Date(parseInt(t));
        return (d.getMonth()+1)+"/"+d.getDate()+"/"+d.getFullYear();
    }

    getTimeFromTimestamp(t) {
        var d = new Date(parseInt(t));
        var h = d.getHours();
        var a = "";
        if (h===0) {
            h=12;
            a="AM";
        }
        else {
            if (h>12) {
                h=h-12;
                a="PM";
            }
            else {
                a="AM";
            }
        }
        var m = d.getMinutes();
        if (m<10) {
            m="0"+m;
        }

        return h+":"+m+" "+a;
        
    }

    getUSStates() {
        return {
            "AL": "Alabama",
            "AK": "Alaska",
            "AS": "American Samoa",
            "AZ": "Arizona",
            "AR": "Arkansas",
            "CA": "California",
            "CO": "Colorado",
            "CT": "Connecticut",
            "DE": "Delaware",
            "DC": "District Of Columbia",
            "FM": "Federated States Of Micronesia",
            "FL": "Florida",
            "GA": "Georgia",
            "GU": "Guam",
            "HI": "Hawaii",
            "ID": "Idaho",
            "IL": "Illinois",
            "IN": "Indiana",
            "IA": "Iowa",
            "KS": "Kansas",
            "KY": "Kentucky",
            "LA": "Louisiana",
            "ME": "Maine",
            "MH": "Marshall Islands",
            "MD": "Maryland",
            "MA": "Massachusetts",
            "MI": "Michigan",
            "MN": "Minnesota",
            "MS": "Mississippi",
            "MO": "Missouri",
            "MT": "Montana",
            "NE": "Nebraska",
            "NV": "Nevada",
            "NH": "New Hampshire",
            "NJ": "New Jersey",
            "NM": "New Mexico",
            "NY": "New York",
            "NC": "North Carolina",
            "ND": "North Dakota",
            "MP": "Northern Mariana Islands",
            "OH": "Ohio",
            "OK": "Oklahoma",
            "OR": "Oregon",
            "PW": "Palau",
            "PA": "Pennsylvania",
            "PR": "Puerto Rico",
            "RI": "Rhode Island",
            "SC": "South Carolina",
            "SD": "South Dakota",
            "TN": "Tennessee",
            "TX": "Texas",
            "UT": "Utah",
            "VT": "Vermont",
            "VI": "Virgin Islands",
            "VA": "Virginia",
            "WA": "Washington",
            "WV": "West Virginia",
            "WI": "Wisconsin",
            "WY": "Wyoming"
        };
    }

    removeEmojis(string) {
        var regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
        return string.replace(regex, '');
    }

    shuffle(array) {
        var t, current, top = array.length;
        if(top) while(--top) {
          current = Math.floor(Math.random() * (top + 1));
          t = array[current];
          array[current] = array[top];
          array[top] = t;
        }
        return array;
    }

    standardizePhone(phone) {
        try {
            phone= phone.replace(/[^0-9]/g,"");
            if (phone.length===10) {
                phone="1"+phone;
            }
            if (phone.length===11) {
                return phone;
            }
        }
        catch(e) {}

        return "NotOK";
    }

    verifyEmail(emailaddress) {
        var emailVerification = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(.\w{2,3})+$/;
        if (!emailVerification.test(emailaddress)) {
            return "Email address is invalid";
        }
        return "OK";
    }

    verifyPhone(phone) {    
        var phoneVerification = /^1?-?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
        if (!phoneVerification.test(phone)) {
            return "Enter phone number with area code in format NNN-NNN-NNNN";
        }
        return "OK";
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }
 
}

module.exports = utilities;