class pickforus {

    // Build date times for day segments
    buildDateTimeSegments(day, startHour, finishHour, aP, startMin, finishMin, inc) {
        var hasResult=false;

        if (startHour===12) {
            for(var minute=startMin; minute<=finishMin; minute+=inc) {
                if (this.calendarize(day,12,minute,aP)) {
                    this.datetimes[day].push([aP,12,minute]);
                    hasResult=true;
                }
            }

            startHour=1;
        }

        for(var hour=startHour; hour<=finishHour; hour++) {
            for(var minute=startMin; minute<=finishMin; minute+=inc) {
                if (this.calendarize(day,hour,minute,aP)) {
                    this.datetimes[day].push([aP,hour,minute]);
                    hasResult=true;
                }
            }
        }

        return hasResult;
    }

    // Returns true if there are no calendar conflicts for the given date time
    calendarize(day,hour,minute,ap) {
        return true;
    }

    createDateTimes(params) {
 
        var evlength=Number.parseInt(params.Length);
        
        // We will look for times in 15-minute increments but then throw out any 15 minute entries if there are hour or half hour entries
        // Generally we will prefer to do things on the hour as opposed to the half or 15 minute mark
        
         // Use 8 hour time slots for all day events
         // At some point in the future we may have to change this
        if (evlength>480) {
            evlength=480;
        }
 
        var hasTime=false;

        for(var day=0; day<this.days.length; day++) {
            this.datetimes.push(day);
            this.datetimes[day]=[];

            var hasHour=false;
            var hasHalf=false;
            var hasFifteen=false;

            // Hour rotation
            // Consider morning times
            if (params.Mornings===true) {
                    if(this.buildDateTimeSegments(day,6,11,"AM",0,0,60)) {
                        hasHour=true;
                    }
            }

            // Consider afternoon times
            if (params.Afternoons===true) {
                if (this.buildDateTimeSegments(day,12,5,"PM",0,0,60)) {
                    hasHour=true;
                }
            }

            // Consider evening times
            if (params.Evenings===true) {
                if (this.buildDateTimeSegments(day,6,11,"PM",0,0,60)) {
                    hasHour=true;
                }
            }

            // Consider late night times
            if (params.LateNight===true) {
                if (this.buildDateTimeSegments(day,12,5,"AM",0,0,60)) {
                    hasHour=true;
                }
            }   
            
            if (!hasHour) {

                // Half hour rotation
                // Consider morning times
                if (params.Mornings===true) {
                    if(this.buildDateTimeSegments(day,6,11,"AM",30,30,30)) {
                        hasHalf=true;
                    }
                }

                // Consider afternoon times
                if (params.Afternoons===true) {
                    if (this.buildDateTimeSegments(day,12,5,"PM",30,30,30)) {
                        hasHalf=true;
                    }
                }

                // Consider evening times
                if (params.Evenings===true) {
                    if (this.buildDateTimeSegments(day,6,11,"PM",30,30,30)) {
                        hasHalf=true;
                    }
                }

                // Consider late night times
                if (params.LateNight===true) {
                    if (this.buildDateTimeSegments(day,2,5,"AM",30,30,30)) {
                        hasHalf=true;
                    }
                }   

                if (!hasHalf) {
                    // 15 minute rotation
                    // Consider morning times
                    if (params.Mornings===true) {
                        if (this.buildDateTimeSegments(day,6,11,"AM",15,45,15)) {
                            hasFifteen=true;
                        }
                    }

                    // Consider afternoon times
                    if (params.Afternoons===true) {
                        if (this.buildDateTimeSegments(day,12,5,"PM",15,45,15)) {
                            hasFifteen=true;
                        }
                    }

                    // Consider evening times
                    if (params.Evenings===true) {
                        if (this.buildDateTimeSegments(day,6,11,"PM",15,45,15)) {
                            hasFifteen=true;
                        }
                    }

                    // Consider late night times
                    if (params.LateNight===true) {
                        if (this.buildDateTimeSegments(day,2,5,"AM",15,45,15)) {
                            hasHalf=true;
                        }
                    }   
                }
            }

            if (hasHour||hasHalf||hasFifteen) {
                hasTime=true;
            }
        }

        return hasTime;
        
    }

    doPickForUs(params) {

        this.userTime = this.getDateFromOffset(params.Offset);
        this.calendars = this.getCalendars(params.Users, params.Offset);
        
        // This array will contain the available days to choose from
        this.days=[];

        // This array will contain date time pairs to choose from
        this.datetimes=[];

        // Determine all days from date ranges
        if (params.RequireToday===true) {
            this.days=[0];
        }
        else {
            if (params.LSoon===true) {
                this.pushDays(0,3);
            }
            if (params.LWeek===true) {
                this.pushDays(4,7);
            }
            if (params.LMonth===true) {
                this.pushDays(8,30);
            }
            if (params.LMonthPlus===true) {
                this.pushDays(31,90);
            }
        }

        // Now limit days by days of week
        this.limitDays(params);

        // Create available date-time region pairs
        this.createDateTimes(params);

        console.log(this.datetimes);

    }

    // will look up users and get calendars from sources
    getCalendars(users) {
        return [];
    }

    // Gets the users local time as we're going to return times relative to them
    getDateFromOffset(inputTzOffset) { 
        var now = new Date();  
        var currentOffset = -now.getTimezoneOffset()/60   
        var delta = (inputTzOffset - currentOffset) * 1000 * 60 * 60; 
        return new Date(now.getTime()+ delta); 
    }

    // Limit days by days of the week
    limitDays(params) {
        // First, determine current day of week (day 0 day)
        var thisDay=this.userTime.getDay();
        this.dayChart = [];

        for(var di=thisDay; di<7; di++) {
            if (this.dayChart.length<this.days.length) {
                this.dayChart.push(di);
            }
        }

        for(var di=7; di<=90; di++) {
            if (this.dayChart.length<this.days.length) {
                this.dayChart.push(di);
            }
        }


        if (params.Sundays!==true) {
            this.removeDay(0);
        }

        if (params.Mondays!==true) {
            this.removeDay(1);
        }

        if (params.Tuesdays!==true) {
            this.removeDay(2);
        }

        if (params.Wednesdays!==true) {
            this.removeDay(3);
        }

        if (params.Thursdays!==true) {
            this.removeDay(4);
        }

        if (params.Fridays!==true) {
            this.removeDay(5);
        }

        if (params.Saturdays!==true) {
            this.removeDay(6);
        }

        var tempdays=this.days;
        this.days=[];
        for(var x=0; x<tempdays.length; x++) {
            if (this.dayChart[x]!==-1) {
                this.days.push(tempdays[x]);
            }
        }
    }

    // Put days on to the days stack
    pushDays(start,end) {
        for(var x=start; x<=end; x++) {
            this.days.push(x);
        }
    }

    removeDay(d) {
        for(var di=0; di<this.dayChart.length; di++) {
            if (this.dayChart[di]===d) {
                this.dayChart[di]=-1;
            }
        }
    }

    _setObjs(_objs) {
        this.objs=_objs;
    }

    constructor(_db) {
        this.db=_db;
    }
}

module.exports=pickforus;