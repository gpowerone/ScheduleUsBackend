class pickforus {

    // Build date times for day segments
    buildDateTimeSegments(day, evlength, tarr, startHour, finishHour) {
        var hasResult=false;

        if (startHour===-1) {
            for(var hour=21; hour<=23; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    if (this.todayCheck(day,hour,minute) && this.calendarize(evlength,day,hour,minute)) {
                        tarr.push([hour,minute]);
                        hasResult=true;
                    }
                }
            }
            for(var hour=0; hour<=6; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    if (this.todayCheck(day,hour,minute) && this.calendarize(evlength,day,hour,minute)) {
                        tarr.push([hour,minute]);
                        hasResult=true;
                    }
                }
            }
        }
        else {

            for(var hour=startHour; hour<=finishHour; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    if (this.todayCheck(day,hour,minute) && this.calendarize(evlength,day,hour,minute)) {
                        tarr.push([hour,minute]);
                        hasResult=true;
                    }
                }
            }
        }

        return hasResult;
    }

    buildDateString(chosenDate) {
        
        // If the event is after today then we need to add the rest of today
        var uTime=this.userTime.getTime();

        console.log(chosenDate);

        // If there are days, these are always added. 
        if (chosenDate.d>0) { 
            var tomorrow = new Date();
            tomorrow.setHours(24,0,0,0);
            uTime+=(tomorrow.getTime()-uTime-this.offset)+ ((chosenDate.d-1)*86400000) +(chosenDate.t[0]*3600000)+(chosenDate.t[1]*60000);
        }
        else {
            var thour = (this.userTime.getUTCHours()*3600000) + (this.userTime.getUTCMinutes()*60000);
            var chour = (chosenDate.t[0]*3600000)+(chosenDate.t[1]*60000);
            uTime+=(chour-thour);
        }

        
        var schdate = new Date(uTime);
        console.log(schdate);

        var r={
            date:(schdate.getUTCMonth()+1)+"-"+schdate.getUTCDate()+"-"+schdate.getUTCFullYear(),
            time:schdate.getUTCHours()+":"+schdate.getUTCMinutes()+":"+schdate.getUTCSeconds()
        };

        return r;
    }

    buildDayChart(thisDay) {
        this.dayChart = [];

        for(var di=thisDay; di<=6; di++) {
            if (this.dayChart.length<this.days.length) {
                this.dayChart.push(di);
            }
        }

        for(var dw=0; dw<12; dw++) {
            for(var xi=0; xi<=6; xi++) {
                if (this.dayChart.length<this.days.length) {
                    this.dayChart.push(xi);
                }
            }
        }
    }

    // Builds preferred times given user parameters
    buildPreferredTimes(params) {

        var prefFrameWeekdays=[];

        if (params.ForWork) {
            for(var hour=8; hour<=16; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    prefFrameWeekdays.push([hour,minute]);
                }
            }
            this.getPreferredTimes(prefFrameWeekdays,false,params.Meal);
        }
        
        if (params.AgeRange==='1' || params.AgeRange==='3' || params.AgeRange==='5') {
            for(var hour=18; hour<=21; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    prefFrameWeekdays.push([hour,minute]);
                }
            }
            this.getPreferredTimes(prefFrameWeekdays,true,params.Meal);
        }

        if (params.AgeRange==='2') {
            for(var hour=8; hour<=21; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    prefFrameWeekdays.push([hour,minute]);
                }
            }
            this.getPreferredTimes(prefFrameWeekdays,true,params.Meal);
        }

        if (params.AgeRange==='4') {
            for(var hour=20; hour<=21; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    prefFrameWeekdays.push([hour,minute]);
                }
            }
            this.getPreferredTimes(prefFrameWeekdays,true,params.Meal);
        }
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
   
            // Hour rotation
            // Consider morning times
            if (params.Mornings===true) {
                if (this.buildDateTimeSegments(this.days[day].d,evlength,this.days[day].t,7,11)) {
                    hasTime=true;
                }
            }

            // Consider afternoon times
            if (params.Afternoons===true) {
                if (this.buildDateTimeSegments(this.days[day].d,evlength,this.days[day].t,12,16)) {
                    hasTime=true;
                }               
            }

            // Consider evening times
            if (params.Evenings===true) {
                if (this.buildDateTimeSegments(this.days[day].d,evlength,this.days[day].t,17,20)) {
                    hasTime=true;
                }
            }

            // Consider late night times
            if (params.LateNight===true) {
                if (this.buildDateTimeSegments(this.days[day].d,evlength,this.days[day].t,-1,-1)) {
                    hasTime=true;
                }            
            }   
          
        }

        return hasTime;
        
    }

    doPickForUs(params) {

        this.userTime = this.getDateFromOffset(params.Offset);
        this.calendars = this.getCalendars(params.Users, params.Offset);
        
        // This array will contain the available days to choose from
        this.days=[];

        // This array will include the preferred date times
        this.preferredtimes=[];

        // Determine all days from date ranges
        if (params.RequireToday===true) {
            this.days.push({d: 0, t:[]});
        }
        if (params.LSoon===true) {
            this.pushDays(1,3);
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

        // Now limit days by days of week
        this.limitDays(params);

        // Create available date-time region pairs
        if (this.createDateTimes(params))
        {
            // Create preferred times if possible
            this.buildPreferredTimes(params);

            if (this.preferredtimes.length>0) {
                return this.buildDateString(this.findFinalDate(true));
            }
            else {
                return this.buildDateString(this.findFinalDate(false));
            }
        }
        else {
            return null;
        }

    }

    findFinalDate(usePreferred) {
        var possibleTimes=this.days;
        if (usePreferred) {
            possibleTimes=this.preferredtimes;
        }

        // If there are hour times use those first, then half hour, then 15 minutes 
        for(var day=0; day<possibleTimes.length; day++) {
            for(var time=0; time<possibleTimes[day].t.length; time++) {
                if (possibleTimes[day].t[time][1]===0) {
                    return {d:possibleTimes[day].d, t:possibleTimes[day].t[time]}
                }
            }
        }

        for(var day=0; day<possibleTimes.length; day++) {
            for(var time=0; time<possibleTimes[day].t.length; time++) {
                if (possibleTimes[day].t[time][1]===30) {
                    return {d:possibleTimes[day].d, t:possibleTimes[day].t[time]}
                }
            }
        }

        return {d:possibleTimes[0].d, t:possibleTimes[0].t[0]}
    }

    // will look up users and get calendars from sources
    getCalendars(users) {
        return [];
    }

    // Gets the users local time as we're going to return times relative to them
    getDateFromOffset(inputTzOffset) { 

        this.offset=inputTzOffset*60*1000;

        var date = new Date(); 
        var now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

        return new Date(now_utc-this.offset); 
    }

    getPreferredTimes(prefweekdays,preferweekends,prefermeal) {

        var thisDay=this.userTime.getDay();
        this.buildDayChart(thisDay);
        
        // Prefer all available weekend times
        if (preferweekends===true) {
            for(var day=0; day<this.days.length; day++) {
                if (this.dayChart[this.days[day].d]===0 || this.dayChart[this.days[day].d]===6) {

                    if (prefermeal) {
                        var dt = {d:this.days[day].d, t:[]}
         
                        for(var q=0; q<this.days[day].t.length; q++) {
                            if (this.days[day].t[q][0]>=8 && this.days[day].t[q][0]<=10) {
                                dt.t.push(this.days[day].t[q]);  
                            }
                            if (this.days[day].t[q][0]>=11 && this.days[day].t[q][0]<=13) {
                                dt.t.push(this.days[day].t[q]);  
                            }
                            if (this.days[day].t[q][0]>=18 && this.days[day].t[q][0]<=20) {
                                dt.t.push(this.days[day].t[q]);  
                            }
                        }  
                        
                        this.preferredtimes.push(dt);
                    }
                    else {
                        this.preferredtimes.push(this.days[day]);
                    }
                }
            }
        }
     
        // Prefer the times passed in prefweekdays
        for(var day=0; day<this.days.length; day++) {
            if (this.dayChart[this.days[day].d]!==0 && this.dayChart[this.days[day].d]!==6) {
                
                var dt = {d:this.days[day].d, t:[]}
                for(var y=0; y<prefweekdays.length; y++) {
                    for(var q=0; q<this.days[day].t.length; q++) {
                        if (this.days[day].t[q][0]===prefweekdays[y][0] && this.days[day].t[q][1]===prefweekdays[y][1]) {

                            if (prefermeal) {
                                if (this.days[day].t[q][0]>=8 && this.days[day].t[q][0]<=10) {
                                    dt.t.push(prefweekdays[y]);  
                                }
                                if (this.days[day].t[q][0]>=11 && this.days[day].t[q][0]<=13) {
                                    dt.t.push(prefweekdays[y]);  
                                }
                                if (this.days[day].t[q][0]>=18 && this.days[day].t[q][0]<=20) {
                                    dt.t.push(prefweekdays[y]);  
                                }
                            }
                            else {
                                dt.t.push(prefweekdays[y]); 
                            }      
                        }

                    }
                }
                this.preferredtimes.push(dt)
            }
        }
    }

    // Limit days by days of the week
    limitDays(params) {
        // First, determine current day of week (day 0 day)
        var thisDay=this.userTime.getDay();
        this.buildDayChart(thisDay);

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
            if (this.dayChart[tempdays[x].d]!==-1) {
                this.days.push(tempdays[x]);
            }
        }

    }

    // Put days on to the days stack
    pushDays(start,end) {
        for(var x=start; x<=end; x++) {
            this.days.push({d:x, t:[]});
        }
    }

    removeDay(d) {
        for(var di=0; di<this.dayChart.length; di++) {
            if (this.dayChart[di]===d) {
                this.dayChart[di]=-1;
            }
        }
    }

    todayCheck(day,hour,minute) {
        if (day>0) {
            return true;
        }
        var curHour=this.userTime.getUTCHours();

        if (hour>curHour) {
            return true;
        }
        else if (hour===curHour) {
            var curMinute = this.userTime.getUTCMinutes();
            if (minute>curMinute) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return false;
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