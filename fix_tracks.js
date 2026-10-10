const fs = require('fs');

function replaceInFile(file, replacements) {
    let content = fs.readFileSync(file, 'utf8');
    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(file, content);
}

replaceInFile('apps/api/src/exams/exams.service.ts', [
    { search: /if \(exam\.targetTrack && exam\.targetTrack !== 'BOTH'\) whereClause\.track = exam\.targetTrack;/g, replace: "if (exam.targetTrackId) whereClause.trackId = exam.targetTrackId;" },
    { search: /targetTrack \}/g, replace: "targetTrackId }" },
    { search: /targetTrack,/g, replace: "targetTrackId," },
    { search: /targetTrack: targetTrack \|\| 'BOTH',/g, replace: "targetTrackId: targetTrackId || null," }
]);

replaceInFile('apps/api/src/students/students.service.ts', [
    { search: /track: data\.track \|\| 'BOTH',/g, replace: "trackId: data.trackId || null," },
    { search: /if \(batch \|\| data\.track\) \{/g, replace: "if (batch || data.trackId) {" },
    { search: /if \(data\.track\) updateData\.track = data\.track;/g, replace: "if (data.trackId) updateData.trackId = data.trackId;" },
    { search: /data\.track/g, replace: "data.trackId" }, // Catch remaining
]);

replaceInFile('apps/api/src/study-materials/study-materials.service.ts', [
    { search: /targetTrack: data\.targetTrack \|\| 'BOTH',/g, replace: "targetTrackId: data.targetTrackId || null," }
]);

replaceInFile('apps/api/src/fee/fee.service.ts', [
    { search: /targetTrack: data\.targetTrack \|\| 'BOTH'/g, replace: "targetTrackId: data.targetTrackId || null" }
]);

replaceInFile('apps/api/src/assignments/assignments.service.ts', [
    { search: /targetTrack: data\.targetTrack \|\| 'BOTH',/g, replace: "targetTrackId: data.targetTrackId || null," }
]);

replaceInFile('apps/api/src/attendance/attendance.service.ts', [
    { search: /track: string/g, replace: "trackId: string" },
    { search: /track: track as any/g, replace: "trackId" },
    { search: /track/g, replace: "trackId" }
]);

replaceInFile('apps/api/src/attendance/attendance.controller.ts', [
    { search: /track: string/g, replace: "trackId: string" },
    { search: /'track'/g, replace: "'trackId'" },
    { search: /track,/g, replace: "trackId," },
    { search: /track\)/g, replace: "trackId)" }
]);

console.log("Replaced successfully!");
