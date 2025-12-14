const express = require('express');
const { Pool } = require('pg');
const Minio = require('minio');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const MINIO_BUCKET = 'videos';
// Use environment variable for public URL (accessible by browser)
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';

// --- DATABASE CONNECTION ---
// Connects to the 'medgram_db' container from your stack
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'medgram_admin',
  host: process.env.POSTGRES_HOST || 'medgram_db', 
  database: process.env.POSTGRES_DB || 'medgram_db',
  password: process.env.POSTGRES_PASSWORD || 'secure_password_change_me',
  port: 5432,
});

// --- MINIO CONNECTION ---
// Connects to the 'medgram_storage' container from your stack (Internal Docker Network)
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'medgram_storage',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER || 'minio_admin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'secure_minio_password_change_me',
});

// --- AUTH MIDDLEWARE ---
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- ROUTES ---

// 1. REGISTER
app.post('/auth/register', async (req, res) => {
  const { username, password, fullName, role, npiNumber } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, npi_number, avatar_url, verified) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, role`,
      [username, hashedPassword, fullName, role, npiNumber, `https://ui-avatars.com/api/?name=${username}`, false]
    );
    const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, JWT_SECRET);
    res.json({ user: result.rows[0], token });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'User already exists or invalid data' });
  }
});

// 2. LOGIN
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    // Remove password from response
    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// 3. GET FEED
app.get('/feed', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.type, p.content, p.media_url as "mediaUrl", p.thumbnail_url as "thumbnailUrl", p.created_at as timestamp, p.processing_status,
        u.id as "authorId", u.username as "authorName", u.avatar_url as "authorAvatar", u.role as "authorRole",
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.processing_status = 'COMPLETED' OR p.processing_status IS NULL
      ORDER BY p.created_at DESC
      LIMIT 50
    `);
    
    // Transform to match frontend types
    const posts = result.rows.map(row => ({
      ...row,
      comments: [], // Comments fetch separate for optimization
      timestamp: new Date(row.timestamp).getTime(),
      likedByCurrentUser: false // Real implementation needs subquery with req.user.id
    }));
    
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch feed' });
  }
});

// 4. CREATE POST
app.post('/posts', authenticate, async (req, res) => {
  const { type, content, mediaUrl, thumbnailUrl } = req.body;
  
  if (req.user.role === 'VIEW_ONLY') return res.status(403).json({ error: 'Permission denied' });
  if (type === 'VIDEO' && req.user.role === 'USER') return res.status(403).json({ error: 'Standard users cannot post videos' });

  // Initial status for videos is PENDING, for threads it is NULL (or COMPLETED implicitly)
  const processingStatus = type === 'VIDEO' ? 'PENDING' : 'COMPLETED';

  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, type, content, media_url, thumbnail_url, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.id, type, content, mediaUrl, thumbnailUrl, processingStatus]
    );
    res.json({ success: true, postId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// 5. GET PRESIGNED URL (For Video Upload)
app.post('/upload/presigned', authenticate, async (req, res) => {
  const { filename } = req.body;
  // Create unique name
  const objectName = `${Date.now()}-${filename}`;
  
  try {
    // URL expires in 15 minutes
    const url = await minioClient.presignedPutObject(MINIO_BUCKET, objectName, 15 * 60);
    // Public URL for accessing the file after upload
    const publicUrl = `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${objectName}`; 
    res.json({ uploadUrl: url, publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate upload URL' });
  }
});

// Initialize DB Tables if not exist (Simple migration)
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100),
                role VARCHAR(20),
                avatar_url TEXT,
                verified BOOLEAN DEFAULT FALSE,
                npi_number VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS posts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                type VARCHAR(10),
                content TEXT,
                media_url TEXT,
                thumbnail_url TEXT,
                processing_status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS likes (
                user_id UUID REFERENCES users(id),
                post_id UUID REFERENCES posts(id),
                PRIMARY KEY (user_id, post_id)
            );
        `);
        console.log("Database initialized");
    } catch(e) {
        console.error("DB Init Error:", e);
    }
}

// Start Server
const PORT = process.env.PORT || 4000;
console.log(`Starting server on port: ${PORT} (from env: ${process.env.PORT || 'default 4000'})`);
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Backend running on port ${PORT}`);
    // Wait a bit for DB to be ready in Docker
    setTimeout(initDb, 5000);
});
