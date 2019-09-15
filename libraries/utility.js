class utilities {

    createHash(length) {
        var hash = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for ( var i = 0; i < length; i++ ) {
           hash += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return hash
    }

    createTree(items,parentid) {
        var tree=[]; 
        for(var x=0; x<items.length; x++) {
            if (items[x].ParentID===parentid) {
                var t = {item: items[x], children: this.createTree(items,items[x].EventCommentID)};
                tree.push(t);
            }
        }

        return tree;
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
        var emailVerification = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailVerification.test(emailaddress)) {
            return "Email address is invalid";
        }
        return "OK";
    }

    verifyPhone(phone) {
        var phoneVerification = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
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