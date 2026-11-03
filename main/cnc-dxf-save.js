const fs = require('fs');
const path = require('path');

module.exports = function saveSheets(directory, sheets) {
    if (!sheets.length) throw Error('No sheets with placed parts to export');
    const written = [];
    try {
        sheets.forEach((dxf, i) => {
            const filename = path.join(directory, `sheet_${String(i + 1).padStart(2, '0')}.dxf`);
            const fd = fs.openSync(filename, 'wx');
            written.push(filename);
            try { fs.writeFileSync(fd, dxf); } finally { fs.closeSync(fd); }
        });
    } catch (error) {
        const failures = [];
        written.forEach(filename => { try { fs.unlinkSync(filename); } catch (e) { failures.push(filename + ': ' + e.message); } });
        throw Error(error.message + (failures.length ? '; could not remove partial files: ' + failures.join(', ') : '; created files removed'));
    }
};
