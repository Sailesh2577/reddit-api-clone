const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// Connect to SQLite in-memory database
const db = new sqlite3.Database(":memory:");

// Initialize database tables
db.serialize(() => {
  db.run(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL
        );
    `);

  db.run(`
        CREATE TABLE subreddits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
    `);

  db.run(`
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            subreddit_id INTEGER,
            user_id INTEGER,
            creation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subreddit_id) REFERENCES subreddits(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

  db.run(`
      CREATE TABLE subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          subreddit_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (subreddit_id) REFERENCES subreddits(id),
          UNIQUE(user_id, subreddit_id) -- Prevent duplicate subscriptions
      );
  `);

  db.run(`
      CREATE TABLE upvotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        UNIQUE(user_id, post_id), -- Ensures one upvote per user per post
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (post_id) REFERENCES posts(id)
      );
  `);

  db.run(`
      CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      creation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
});

// Test endpoint
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// STEP 1: Add the Subreddit Timeline API
app.get("/subreddits/:id/posts", (req, res) => {
  const subredditId = req.params.id;
  const query = `
        SELECT * FROM posts
        WHERE subreddit_id = ?
        ORDER BY creation_time DESC
    `;

  db.all(query, [subredditId], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(rows);
  });
});

// STEP 2: Add sample data for testing
db.serialize(() => {
  db.run(`INSERT INTO subreddits (name) VALUES ('javascript'), ('webdev')`);
  db.run(`INSERT INTO users (username) VALUES ('sailesh'), ('john')`);
  db.run(`
        INSERT INTO posts (title, content, subreddit_id, user_id)
        VALUES 
        ('Welcome to JavaScript!', 'This is a JavaScript subreddit.', 1, 1),
        ('Web development tips', 'Learn web development here!', 2, 2),
        ('JavaScript tips', 'Share your JS tips here!', 1, 2)
    `);
});

// Add a new post to a subreddit
app.post("/subreddits/:id/posts", (req, res) => {
  const subredditId = req.params.id;
  const { title, content, user_id } = req.body;

  // Validate input
  if (!title || !content || !user_id) {
    res
      .status(400)
      .json({ error: "Title, content, and user_id are required." });
    return;
  }

  // Check if subreddit exists
  db.get(
    `SELECT id FROM subreddits WHERE id = ?`,
    [subredditId],
    (err, row) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
        return;
      }

      if (!row) {
        res
          .status(404)
          .json({ error: `Subreddit with id ${subredditId} does not exist.` });
        return;
      }

      // Insert the post into the database
      const query = `
          INSERT INTO posts (title, content, subreddit_id, user_id)
          VALUES (?, ?, ?, ?)
      `;
      db.run(query, [title, content, subredditId, user_id], function (err) {
        if (err) {
          console.error(err);
          res
            .status(500)
            .json({ error: "Database error while inserting post" });
          return;
        }

        // Return the newly created post
        res.status(201).json({
          id: this.lastID,
          title,
          content,
          subreddit_id: subredditId,
          user_id,
          creation_time: new Date().toISOString(),
        });
      });
    }
  );
});

// STEP 3: Add the User Subscriptions API
app.post("/subscriptions", (req, res) => {
  const { user_id, subreddit_id } = req.body;

  // Validate input
  if (!user_id || !subreddit_id) {
    res.status(400).json({ error: "user_id and subreddit_id are required." });
    return;
  }

  // Check if the user and subreddit exist
  db.get(`SELECT id FROM users WHERE id = ?`, [user_id], (err, userRow) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
      return;
    }

    if (!userRow) {
      res
        .status(404)
        .json({ error: `User with id ${user_id} does not exist.` });
      return;
    }

    db.get(
      `SELECT id FROM subreddits WHERE id = ?`,
      [subreddit_id],
      (err, subredditRow) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Database error" });
          return;
        }

        if (!subredditRow) {
          res.status(404).json({
            error: `Subreddit with id ${subreddit_id} does not exist.`,
          });
          return;
        }

        // Insert subscription
        db.run(
          `INSERT INTO subscriptions (user_id, subreddit_id) VALUES (?, ?)`,
          [user_id, subreddit_id],
          function (err) {
            if (err) {
              if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).json({
                  error: "User is already subscribed to this subreddit.",
                });
              } else {
                console.error(err);
                res
                  .status(500)
                  .json({ error: "Database error while subscribing." });
              }
              return;
            }

            res.status(201).json({ message: "Subscribed successfully." });
          }
        );
      }
    );
  });
});

// API to retrieve user subscriptions
app.get("/users/:id/subscriptions", (req, res) => {
  const userId = req.params.id;

  // Query to fetch subscribed subreddits
  const query = `
      SELECT subreddits.id, subreddits.name
      FROM subreddits
      JOIN subscriptions ON subreddits.id = subscriptions.subreddit_id
      WHERE subscriptions.user_id = ?
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
      return;
    }

    if (rows.length === 0) {
      res
        .status(404)
        .json({ error: `No subscriptions found for user with id ${userId}.` });
      return;
    }

    res.json(rows);
  });
});

// Upvote a post
app.post("/posts/:id/upvote", (req, res) => {
  const postId = req.params.id;
  const { user_id } = req.body;

  if (!user_id) {
    res.status(400).json({ error: "User ID is required." });
    return;
  }

  // Check if the post exists
  const postExistsQuery = `SELECT * FROM posts WHERE id = ?`;
  db.get(postExistsQuery, [postId], (err, post) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Database error." });
      return;
    }
    if (!post) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    // Insert upvote
    const upvoteQuery = `
          INSERT INTO upvotes (user_id, post_id)
          VALUES (?, ?)
          ON CONFLICT(user_id, post_id) DO NOTHING;
      `;
    db.run(upvoteQuery, [user_id, postId], function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Database error." });
        return;
      }

      // Check if the upvote was successfully added
      if (this.changes === 0) {
        res.status(400).json({ error: "User has already upvoted this post." });
      } else {
        res.status(201).json({ message: "Upvote added successfully." });
      }
    });
  });
});

// Get user profile
app.get("/users/:id/profile", (req, res) => {
  const userId = req.params.id;

  // Query to get subscribed subreddits
  const subscribedSubredditsQuery = `
      SELECT subreddits.id, subreddits.name
      FROM subscriptions
      JOIN subreddits ON subscriptions.subreddit_id = subreddits.id
      WHERE subscriptions.user_id = ?
  `;

  // Query to get total upvotes received by the user
  const upvotesReceivedQuery = `
      SELECT COUNT(upvotes.id) AS total_upvotes
      FROM upvotes
      JOIN posts ON upvotes.post_id = posts.id
      WHERE posts.user_id = ?
  `;

  const profileData = {};

  // Get subscribed subreddits
  db.all(subscribedSubredditsQuery, [userId], (err, subreddits) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Database error while fetching subscriptions." });
      return;
    }

    profileData.subscribed_subreddits = subreddits;

    // Get total upvotes
    db.get(upvotesReceivedQuery, [userId], (err, result) => {
      if (err) {
        console.error(err);
        res
          .status(500)
          .json({ error: "Database error while fetching upvotes." });
        return;
      }

      profileData.total_upvotes = result.total_upvotes || 0;

      res.json(profileData);
    });
  });
});

// Add a comment to a post
app.post("/posts/:id/comments", (req, res) => {
  const postId = req.params.id;
  const { user_id, content } = req.body;

  // Validate input
  if (!user_id || !content) {
    res.status(400).json({ error: "User ID and content are required." });
    return;
  }

  // Check if the post exists
  db.get(`SELECT id FROM posts WHERE id = ?`, [postId], (err, post) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Database error." });
      return;
    }
    if (!post) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    // Insert the comment into the database
    const query = `
        INSERT INTO comments (post_id, user_id, content)
        VALUES (?, ?, ?)
    `;
    db.run(query, [postId, user_id, content], function (err) {
      if (err) {
        console.error(err);
        res
          .status(500)
          .json({ error: "Database error while inserting comment." });
        return;
      }

      // Return the newly created comment
      res.status(201).json({
        id: this.lastID,
        post_id: postId,
        user_id,
        content,
        creation_time: new Date().toISOString(),
      });
    });
  });
});

// Get all comments for a post
app.get("/posts/:id/comments", (req, res) => {
  const postId = req.params.id;

  // Query to get comments for the post, ordered by creation time
  const query = `
    SELECT comments.id, comments.content, comments.creation_time, users.username
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE comments.post_id = ?
    ORDER BY comments.creation_time DESC
  `;

  db.all(query, [postId], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Database error." });
      return;
    }

    res.json(rows);
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
