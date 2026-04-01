const multer = require("multer");
const path = require("path");//fto eget extensiom of file
const supabase = require("../config/supabase");

// ─── Allowed MIME types = Multipurpose Internet Mail Extensions.───────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE_MB = 10;

// ─── Multer config (memory storage — we stream directly to Supabase) ──────────
const storage = multer.memoryStorage();//but amar kache server end e disk e rakha beter mone hoi
//nahole extreme pressure e memory fail korte pare

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, gif, pdf, doc, docx`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ─── Supabase Upload Helper ───────────────────────────────────────────────────

/**
 * Upload a file buffer to Supabase Storage
 * @param {Object} options
 * @param {Buffer}  options.buffer       - File buffer from multer
 * @param {string}  options.mimetype     - MIME type of the file
 * @param {string}  options.originalName - Original filename
 * @param {string}  options.bucket       - Supabase bucket name (e.g. "avatars", "documents")
 * @param {string}  options.folder       - Sub-folder inside the bucket (e.g. "users/123")
 * @returns {Promise<string>} Public URL of the uploaded file
 */
const uploadToSupabase = async ({ buffer, mimetype, originalName, bucket, folder = "" }) => {
  const ext = path.extname(originalName) || mimeToExt(mimetype);
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
  const filePath = folder ? `${folder}/${uniqueName}` : uniqueName;

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: mimetype,
    upsert: false,//to prevent overwriting of existing ones
  });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (!publicData?.publicUrl) throw new Error("Failed to retrieve public URL from Supabase");

  return publicData.publicUrl;
};

// ─── MIME to extension fallback ───────────────────────────────────────────────
const mimeToExt = (mimetype) => {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };
  return map[mimetype] || "";
};

// ─── Exported multer middleware presets ──────────────────────────────────────

/** Single file upload — field name: "file" */
const uploadSingle = upload.single("file");

/** Single profile picture — field name: "profile_picture" */
const uploadProfilePicture = upload.single("profile_picture");

/** Single driver license document — field name: "license_document" */
const uploadLicenseDocument = upload.single("license_document");

/** Multiple files — field name: "files", max 5 */
const uploadMultiple = upload.array("files", 5);

/** Mixed fields upload */
const uploadFields = (fields) => upload.fields(fields);

// ─── Multer error handler middleware ─────────────────────────────────────────
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

module.exports = {
  uploadSingle,
  uploadProfilePicture,
  uploadLicenseDocument,
  uploadMultiple,
  uploadFields,
  uploadToSupabase,
  handleUploadError,
};
/*Frontend form submits file
        ↓
Route uses uploadProfilePicture
        ↓
Multer runs
   → fileFilter checks type
   → size limit checked
   → file stored in memory
        ↓
req.file available
        ↓
You call uploadToSupabase()
        ↓
File uploaded to Supabase
        ↓
Public URL generated
        ↓
You send/save URL/*/