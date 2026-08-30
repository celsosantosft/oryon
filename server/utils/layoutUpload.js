const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { appPaths } = require('../config/paths');

const MAX_LAYOUT_FILE_SIZE_BYTES = Number(process.env.LAYOUT_UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
const MAX_LAYOUT_FILES = Number(process.env.LAYOUT_UPLOAD_MAX_FILES || 10);

const ALLOWED_LAYOUT_TYPES = new Map([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.webp', 'image/webp'],
    ['.pdf', 'application/pdf']
]);

function normalizeExtension(filename) {
    return path.extname(String(filename || '')).toLowerCase();
}

function isAllowedLayoutUpload(file) {
    const extension = normalizeExtension(file?.originalname);
    const expectedMime = ALLOWED_LAYOUT_TYPES.get(extension);
    return Boolean(expectedMime && file?.mimetype === expectedMime);
}

function createLayoutUpload() {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = appPaths.uploadsDir;
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const extension = normalizeExtension(file.originalname);
            cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`);
        }
    });

    return multer({
        storage,
        limits: {
            fileSize: MAX_LAYOUT_FILE_SIZE_BYTES,
            files: MAX_LAYOUT_FILES,
            fields: 200,
            parts: 240
        },
        fileFilter: (req, file, cb) => {
            if (!isAllowedLayoutUpload(file)) {
                return cb(new Error('Arquivo de layout inválido. Envie PNG, JPG, WEBP ou PDF.'));
            }
            cb(null, true);
        }
    });
}

module.exports = {
    ALLOWED_LAYOUT_TYPES,
    MAX_LAYOUT_FILE_SIZE_BYTES,
    MAX_LAYOUT_FILES,
    createLayoutUpload,
    isAllowedLayoutUpload
};
