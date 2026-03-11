const fs = require("fs");
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(' ');
    const clock = parts[0];
    const period = parts[1].toLowerCase();
    
    let [h, m, s] = clock.split(':').map(val => Number(val));
    
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    
    return (h * 3600) + (m * 60) + s;
}

function durationToSeconds(durationStr) {
    const units = durationStr.split(':').map(Number);
    if (units.length === 3) {
        const [hours, minutes, seconds] = units;
        return (hours * 3600) + (minutes * 60) + seconds;
    }
    return 0;
}

function secondsToDuration(secs) {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    
    const mm = String(mins).padStart(2, '0');
    const ss = String(remainingSecs).padStart(2, '0');
    
    return `${hours}:${mm}:${ss}`;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
   const t1 = timeToSeconds(startTime);
    let t2 = timeToSeconds(endTime);
    
    if (t2 < t1) t2 += (24 * 3600);
    
    return secondsToDuration(t2 - t1);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
     const start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);
    if (end < start) end += (24 * 3600);

    const DAY_START = 8 * 3600;  // 8 AM
    const DAY_END = 22 * 3600;   // 10 PM

    const gapBefore = Math.max(0, Math.min(end, DAY_START) - start);
    const gapAfter = Math.max(0, end - Math.max(start, DAY_END));
    
    return secondsToDuration(gapBefore + gapAfter);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
const activeSecs = durationToSeconds(shiftDuration) - durationToSeconds(idleTime);
    return secondsToDuration(Math.max(0, activeSecs));
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
const currentActive = durationToSeconds(activeTime);
    const dateParts = date.split('-').map(Number);
    const [y, m, d] = dateParts;
    
    
    const isHoliday = (y === 2025 && m === 4 && d >= 10 && d <= 30);
    const target = isHoliday ? (6 * 3600) : (8 * 3600 + 24 * 60); 
    
    return currentActive >= target;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
const data = fs.readFileSync(textFile, 'utf8').split('\n').filter(row => row.trim());
    
    
    const alreadyExists = data.some(row => {
        const cols = row.split(',');
        return cols[0] === shiftObj.driverID && cols[2] === shiftObj.date;
    });

    if (alreadyExists) return {};

    const dur = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const active = getActiveTime(dur, idle);
    const quota = metQuota(shiftObj.date, active);

    const newRow = `${shiftObj.driverID},${shiftObj.driverName},${shiftObj.date},${shiftObj.startTime},${shiftObj.endTime},${dur},${idle},${active},${quota},false`;

    let insertPos = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i].split(',')[0] === shiftObj.driverID) insertPos = i;
    }

    if (insertPos === -1) data.push(newRow);
    else data.splice(insertPos + 1, 0, newRow);

    fs.writeFileSync(textFile, data.join('\n') + '\n');
    
    return {
        ...shiftObj,
        shiftDuration: dur,
        idleTime: idle,
        activeTime: active,
        metQuota: quota,
        hasBonus: false
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
const fileLines = fs.readFileSync(textFile, 'utf8').split('\n');
    const updatedContent = fileLines.map(line => {
        const segments = line.split(',');
        if (segments[0] === driverID && segments[2] === date) {
            segments[9] = String(newValue);
            return segments.join(',');
        }
        return line;
    });
    fs.writeFileSync(textFile, updatedContent.join('\n'));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
const records = fs.readFileSync(textFile, 'utf8').split('\n').filter(r => r.trim());
    let bonusCount = 0;
    let foundDriver = false;
    const mm = String(month).padStart(2, '0');

    records.forEach(record => {
        const data = record.split(',');
        if (data[0] === driverID) {
            foundDriver = true;
            const entryMonth = data[2].split('-')[1];
            if (entryMonth === mm && data[9] === 'true') {
                bonusCount++;
            }
        }
    });
    return foundDriver ? bonusCount : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
const rows = fs.readFileSync(textFile, 'utf8').split('\n').filter(r => r.trim());
    const targetMonth = String(month).padStart(2, '0');
    
    
    const dailyActiveTracker = {}; 

    for (let i = 0; i < rows.length; i++) {
        const fields = rows[i].split(',');
        const [id, , dateStr] = fields;
        const entryMonth = dateStr.split('-')[1];

        if (id === driverID && entryMonth === targetMonth) {
            
            dailyActiveTracker[dateStr] = durationToSeconds(fields[7]);
        }
    }

    let totalSeconds = 0;
    
    for (const date in dailyActiveTracker) {
        totalSeconds += dailyActiveTracker[date];
    }

    return secondsToDuration(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
 const rateData = fs.readFileSync(rateFile, 'utf8').split('\n').filter(r => r.trim());
    const driverConfig = rateData.find(line => line.startsWith(driverID + ',')).split(',');
    const dayOff = driverConfig[1].trim();

    const shiftEntries = fs.readFileSync(textFile, 'utf8').split('\n').filter(r => r.trim());
    let accumulatedSecs = 0;
    const targetMonth = String(month).padStart(2, '0');
    const seenDays = new Set(); 

    shiftEntries.forEach(entry => {
        const fields = entry.split(',');
        const entryDate = fields[2];
        if (fields[0] === driverID && entryDate.split('-')[1] === targetMonth) {
            if (!seenDays.has(entryDate)) {
                seenDays.add(entryDate);
                
                const dObj = new Date(entryDate);
                const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });

                if (dayName !== dayOff) {
                    const [y, m, d] = entryDate.split('-').map(Number);
                    const isEid = (y === 2025 && m === 4 && d >= 10 && d <= 30);
                    accumulatedSecs += isEid ? (6 * 3600) : (8 * 3600 + 24 * 60);
                }
            }
        }
    });

    const finalReq = accumulatedSecs - (bonusCount * 7200);
    return secondsToDuration(Math.max(0, finalReq));
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
