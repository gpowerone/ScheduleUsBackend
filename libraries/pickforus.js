class pickforus {


    // Builds ranges for calendar dates
    buildCalendarDates(calendarDateTimes) {
        var calendarDates=[];
        if (calendarDateTimes===null) {
            return calendarDates;
        }

        for (var z=0; z<calendarDateTimes.length; z++) {
            for (var q=0; q<calendarDateTimes[z].length; q++) {
                calendarDates.push([Date.parse(calendarDateTimes[z][q][0]), Date.parse(calendarDateTimes[z][q][1])])
            }
        }

        return calendarDates;
    }

    // Build date times for day segments
    buildDateTimeSegments(day, tarr, startHour, finishHour, params) {
        var hasResult=false;

        if (startHour===-1) {
            for(var hour=21; hour<=23; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    if (this.validCheck(day,hour,minute,params) && this.calendarize(day,hour,minute)) {
                        tarr.push([hour,minute]);
                        hasResult=true;
                    }
                }
            }
            for(var hour=0; hour<=6; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    if (this.validCheck(day,hour,minute,params) && this.calendarize(day,hour,minute)) {
                        tarr.push([hour,minute]);
                        hasResult=true;
                    }
                }
            }
        }
        else {

            for(var hour=startHour; hour<=finishHour; hour++) {
                for(var minute=0; minute<=45; minute+=15) {
                    if (this.validCheck(day,hour,minute,params) && this.calendarize(day,hour,minute)) {
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

        // Watch out, chosen date can be null
        // If there are days, these are always added. 

        try {
            var today = new Date();
            today.setHours(0,0,0,0);

            if (chosenDate.d>0) { 
                
                uTime=(uTime-(uTime-today.getTime()))+ ((chosenDate.d)*86400000) +(chosenDate.t[0]*3600000)+(chosenDate.t[1]*60000);
            }
            else {
                var chour = (chosenDate.t[0]*3600000)+(chosenDate.t[1]*60000);
                uTime=(uTime-(uTime-today.getTime()))+chour;
            }
        }
        catch(e) {
            return null;
        }
        
        var schdate = new Date(uTime);

        var r={
            date:(schdate.getUTCMonth()+1)+"-"+schdate.getUTCDate()+"-"+schdate.getUTCFullYear(),
            time:schdate.getUTCHours()+":"+schdate.getUTCMinutes()+":"+schdate.getUTCSeconds()
        };

        return r;
    }

    buildDayChart(thisDay) {
        this.dayChart = [];

        for(var di=thisDay; di<=6; di++) {
            if (this.dayChart.length<100) {
                this.dayChart.push(di);
            }
        }

        for(var dw=0; dw<12; dw++) {
            for(var xi=0; xi<=6; xi++) {
                if (this.dayChart.length<100) {
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
    calendarize(day,hour,minute) {

        console.log(this.calendars);

        if (this.calendars.length===0) {
            return true;
        }

        var od = new Date();
        var mth = od.getMonth()+1;
        var dy = od.getDate();
        if (mth<10) {
            mth="0"+mth;
        }
        if (dy<10) {
            dy="0"+dy;
        }

        var d = new Date(od.getFullYear()+"-"+mth+"-"+dy+"T00:00:00Z");
        var ts = d.getTime()+(day*86400000)+(hour*3600000)+(minute*60000)+this.offset;

        for(var ci=0; ci<this.calendars.length; ci++) {
            if (ts<this.calendars[ci][1] && ts>=this.calendars[ci][0]) {
                return false;
            }
        }

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
                if (this.buildDateTimeSegments(this.days[day].d,this.days[day].t,7,11,params)) {
                    hasTime=true;
                }
            }
        }

        // Consider afternoon times for events less than 6 hours, unless we don't have a time
        if (evlength<360||!hasTime) {
            for(var day=0; day<this.days.length; day++) {
                if (params.Afternoons===true) {
                    if (this.buildDateTimeSegments(this.days[day].d,this.days[day].t,12,16,params)) {
                        hasTime=true;
                    }          
                }     
            }
        }

        // Consider evening times and late night times for events less than 4 hours long, unless we have no other time
        if (evlength<240||!hasTime) {
            for(var day=0; day<this.days.length; day++) {
                if (params.Evenings===true) {
                    if (this.buildDateTimeSegments(this.days[day].d,this.days[day].t,17,20,params)) {
                        hasTime=true;
                    }
                }

                // Consider late night times
                if (params.LateNight===true) {
                    if (this.buildDateTimeSegments(this.days[day].d,this.days[day].t,-1,-1,params)) {
                        hasTime=true;
                    }            
                }   
            }
        }
          

        return hasTime;
        
    }

    async doPickForUs(params) {

        return await this.objs.sessionobj.verify().then(c=> {
            return this.objs.clientobj.getClientByID(c).then(cli=> {

                if (cli===null) {
                    return "N";
                }
  
          
                if (cli.PFUSusage>=300) {
                    return "N";
                }
            
    
                return this.db.Clients.update({
                    ClientID: cli.ClientID
                },{
                    PFUSusage: cli.PFUSusage+1
                }).then(c=>{
   
                    return this.doWorkPFUS(params);
                                  
                });
            });
        });
    }

    async doTokenPFUS(params) {
        return this.doWorkPFUS(params);
    }

    async doWorkPFUS(params) {

        this.userTime = this.getDateFromOffset(params.Offset);
        return this.getCalendars(params.Users, params.Offset).then(calendardata=>{

            this.calendars=this.buildCalendarDates(calendardata);

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
            if (params.CustomRange===true) {
                this.pushDays(params.CR1, params.CR2);
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
        })
    }

    failPassedCalendar(day,hour,minute,passedCalendars)
    {
        for(var x=0; x<passedCalendars.length; x++) {
            var passedCalendar=passedCalendars[x];
            if (passedCalendar.startDay===passedCalendar.endDay) {
                if (day===passedCalendar.startDay && hour>=passedCalendar.startHour && hour<=passedCalendar.endHour) {
                    if (passedCalendar.startHour===hour && minute<passedCalendar.startMinute) {                      
                        return false;                     
                    }
                    else if (passedCalendar.endHour===hour && minute>=passedCalendar.endMinute) {
                        return false;
                    }
                    else {
                        return true;
                    }
                    
                }
            }
            else {
                if (day===passedCalendar.startDay) {
                    if (hour>=passedCalendar.startHour) {
                        return true;
                    }
                    else if (hour===passedCalendar.startHour && minute>=passedCalendar.startMinute) {
                        return true;
                    }
                }
                else {
                    if (hour<passedCalendar.endHour) {
                        return true;
                    }
                    else if (hour===passedCalendar.endHour && minute<=passedCalendar.endMinute) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    findFinalDate(usePreferred) {
        var choices=[];
        var possibleTimes=this.days;
        if (usePreferred) {
            possibleTimes=this.preferredtimes;
        }

        // If there are hour times use those first, then half hour, then 15 minutes 
        for(var day=0; day<possibleTimes.length; day++) {
            for(var time=0; time<possibleTimes[day].t.length; time++) {
                if (possibleTimes[day].t[time][1]===0) {
                    choices.push({d:possibleTimes[day].d, t:possibleTimes[day].t[time]})
               
                }
            }
        }


        for(var day=0; day<possibleTimes.length; day++) {
            for(var time=0; time<possibleTimes[day].t.length; time++) {
                if (possibleTimes[day].t[time][1]===30) {
                    choices.push({d:possibleTimes[day].d, t:possibleTimes[day].t[time]});            
                }
            }
        }
     
        if (choices.length>0) {
            var n=Math.floor(Math.random() * Math.floor(choices.length));
            return choices[n];
        }


        for(var day=0; day<possibleTimes.length; day++) {
            for(var time=0; time<possibleTimes[day].t.length; time++) {
                if (possibleTimes[day].t[time][1]===15) {
                    choices.push({d:possibleTimes[day].d, t:possibleTimes[day].t[time]})    
                }
            }
        }


        if (choices.length>0) {
            var n=Math.floor(Math.random() * Math.floor(choices.length-1));
            return choices[n];
        }

        return null;

    }


    // performs google calendar lookups
    getGoogleCalendar(refreshToken,clientID) {

        if (typeof(clientID)==="undefined" || clientID===null) {
            return new Promise(function (resolve, reject) { resolve([]); });
        }

        const oauth2Client = new this.objs.google.auth.OAuth2(
            "801199894294-iei4roo6p67hitq9sc2tat5ft24qfakt.apps.googleusercontent.com", 
            "WOihpgSDdZkA81FS8mF_RxmS", 
            "https://schd.us/googcalendar" 
        );
        
        oauth2Client.setCredentials({
        refresh_token:
            refreshToken
        });
        
        const calendar = this.objs.google.calendar({version: 'v3', auth: oauth2Client});

        var cliID=clientID;

        return calendar.calendarList.list({}).then(res => {

            if (res.data.items.length>0) {
                return this.getCalendarDataRecur(0, res.data.items,calendar,this).then(c=>{
                    return c;
                });
            }
            else {
                return [];
            }
             
        }).catch(err=>{

       
            return this.db.ClientCalendar.destroy({
                ClientID: cliID,
                CalendarType: 0
            }).then(p=>{
                return this.objs.messageobj.addToQueue(clientID, "Could not access your calendar. Please re-integrate your calendar on the My Account page").then(q=>{
                    return [];
                })
                
            })
        
        })
    
      
        
    }

    getCalendarDataRecur(num,callist,calendar,self) {
        var cal = callist[num];
        var fCal=[];

        if (cal.accessRole.indexOf("owner")>-1)
        {
            console.log("Used");
            console.log(cal);

            return calendar.events.list({
                'calendarId': cal.id,
                'timeMin': (new Date()).toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'orderBy': 'startTime'
            }).then(function(response) {
                var events = response.data.items;
                var calItems=[];
                for(var e=0; e<events.length; e++) {
                    calItems.push([events[e].start.dateTime, events[e].end.dateTime]);
                }

                num++;
                if (num===callist.length) {
                    return new Promise(function (resolve, reject) { resolve(calItems); });
                }
                else {
                   
                    return self.getCalendarDataRecur(num,callist,calendar,self).then(items=>{
                        for (var x=0; x<items.length; x++) {
                            calItems.push(items[x]);                            
                        }

                        return new Promise(function (resolve, reject) { resolve(calItems); });
                    });
                }
            });


        }
        else {

            num++;
            if (num===callist.length) {
                return new Promise(function (resolve, reject) { resolve(fCal); });
            }
            else {
                
                var calItems=[];
                return self.getCalendarDataRecur(num,callist,calendar,self).then(items=>{
                    for (var x=0; x<items.length; x++) {
                        calItems.push(items[x]);                            
                    }
                    return new Promise(function (resolve, reject) { resolve(calItems); });
                });
            }
            
        }
    }

    getCalendarRecur(calendarTokens, filledCalendars, clientIDs) {
        return this.getGoogleCalendar(calendarTokens[0], clientIDs[0]).then(cr=>{
            filledCalendars.push(cr);
            calendarTokens.shift();
            clientIDs.shift();

            if (calendarTokens.length===0) {
                return new Promise(function(resolve,reject) { 
                    resolve(filledCalendars);
                })
            }
            else {
                return this.getCalendarRecur(calendarTokens, filledCalendars, clientIDs);                
            }
        });
    }

    // will look up users and get calendars from sources
    async getCalendars(users,offset) {
        var ors = []; 
        for(var x=0; x<users.length; x++) {
            if (typeof(users[x].cid)!=="undefined") {
                ors.push({ClientID: users[x].cid});
            }
        }

        if (ors.length>0) {
            return await this.db.ClientCalendar.find({
                or: ors
            }).then(res=>{

                var filledCalendars=[];
                var calendarTokens=[];
                var clientIDs=[];

                for(var r=0; r<res.length; r++) {
                    if (res[r].CalendarType===0) {
                       calendarTokens.push(res[r].CalendarToken);
                       clientIDs.push(res[r].ClientID);
                    }
                }
                
                if (clientIDs.length>0) {
                    return this.getCalendarRecur(calendarTokens, filledCalendars, clientIDs);
                }
                else {
                    return [];
                }

            })
        }
        else {
            return new Promise(function (resolve, reject) {
                resolve([]);
            });
        }
        
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

    validCheck(day,hour,minute,params) {
        if (typeof(params.passedCalendar)!=="undefined") {
            if (this.failPassedCalendar(day,hour,minute,params.passedCalendar)) {
                return false;
            }
        }

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